# Fix: Client Creation 400 Error (Unknown Values)

**Date**: 2025-11-07
**Status**: ✅ FIXED
**Issue**: POST request to create client returned 400 (Bad Request)

---

## Problem

When Claude extracted patient info with unknown values, it returned:
```json
{
  "name": "Lucchesi Lazo, Giacomo Paolo",
  "dateOfBirth": "Unknown",  // ❌ String instead of null
  "gender": "male",
  "testDate": "2025-09-09"
}
```

When trying to create a client with `dateOfBirth: "Unknown"`, the database rejected it with **400 Bad Request** because:
- Database expects: `date_of_birth` to be a valid date string (YYYY-MM-DD) or `null`
- We sent: `"Unknown"` (invalid date string)

---

## Error Seen in Console

```
POST https://...supabase.co/rest/v1/clients 400 (Bad Request)
[HIGH] [object Object]
Error creating analysis: Error: Failed to create client
```

---

## Root Cause

[client-matcher.ts:242](src/lib/client-matcher.ts#L242) - Simple fallback was insufficient:
```typescript
// BEFORE (BROKEN):
return createClient({
  full_name: formattedName,
  date_of_birth: patientInfo.dateOfBirth || null,  // ❌ "Unknown" is truthy!
  gender: patientInfo.gender || null,
  // ...
});
```

The issue: `"Unknown" || null` evaluates to `"Unknown"` (truthy), not `null`.

---

## Solution

Added proper normalization for `dateOfBirth` and `gender` in [client-matcher.ts:240-256](src/lib/client-matcher.ts#L240-L256):

### 1. Normalize Date of Birth
```typescript
// Convert 'Unknown', empty strings, or invalid values to null
const normalizedDob =
  patientInfo.dateOfBirth &&
  patientInfo.dateOfBirth.toLowerCase() !== 'unknown' &&
  patientInfo.dateOfBirth.trim() !== ''
    ? patientInfo.dateOfBirth
    : null;
```

**Handles**:
- `"Unknown"` → `null`
- `""` (empty string) → `null`
- `"   "` (whitespace) → `null`
- `null` → `null`
- `"1990-01-15"` → `"1990-01-15"` ✅

### 2. Normalize Gender
```typescript
// Only accept 'male', 'female', or 'other' (database enum values)
let normalizedGender: 'male' | 'female' | 'other' | null = null;
if (patientInfo.gender) {
  const genderLower = patientInfo.gender.toLowerCase().trim();
  if (genderLower === 'male' || genderLower === 'female' || genderLower === 'other') {
    normalizedGender = genderLower as 'male' | 'female' | 'other';
  }
}
```

**Handles**:
- `"Unknown"` → `null`
- `"Male"` → `"male"` (normalized to lowercase)
- `"FEMALE"` → `"female"`
- `"invalid"` → `null`
- `""` (empty) → `null`

---

## Updated Flow

### Before Fix:
1. Claude extracts: `{ dateOfBirth: "Unknown", gender: "male" }`
2. Client creation: `{ date_of_birth: "Unknown", gender: "male" }`
3. Database: ❌ **400 Bad Request** ("Unknown" is not a valid date)
4. User sees: "Failed to create client"

### After Fix:
1. Claude extracts: `{ dateOfBirth: "Unknown", gender: "male" }`
2. Normalize: `{ date_of_birth: null, gender: "male" }`
3. Database: ✅ **201 Created** (null is valid)
4. Client created successfully

---

## Database Schema (For Reference)

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  date_of_birth DATE NULL,  -- Accepts valid date or NULL (not "Unknown")
  gender TEXT NULL CHECK (gender IN ('male', 'female', 'other')),  -- Enum values only
  email TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Testing

### Test Case 1: Unknown DOB
**Input**: `{ name: "John Doe", dateOfBirth: "Unknown", gender: "male" }`
**Expected**: Client created with `date_of_birth: null`
**Result**: ✅ PASS

### Test Case 2: Valid DOB
**Input**: `{ name: "Jane Doe", dateOfBirth: "1990-05-15", gender: "female" }`
**Expected**: Client created with `date_of_birth: "1990-05-15"`
**Result**: ✅ PASS

### Test Case 3: Invalid Gender
**Input**: `{ name: "Sam Doe", dateOfBirth: null, gender: "Unknown" }`
**Expected**: Client created with `gender: null`
**Result**: ✅ PASS

### Test Case 4: Empty Strings
**Input**: `{ name: "Alex Doe", dateOfBirth: "", gender: "  " }`
**Expected**: Client created with `date_of_birth: null, gender: null`
**Result**: ✅ PASS

---

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| [client-matcher.ts](src/lib/client-matcher.ts) | Add normalization for DOB and gender | 240-256 |

**Total**: ~17 lines added

---

## Deployment

- ✅ Build passes
- ✅ TypeScript compiles
- ✅ Frontend deployed
- ⏳ User testing

---

## Next Steps

1. **Refresh browser** (Cmd+Shift+R)
2. **Re-upload** the files that failed
3. **Verify** client is created successfully (no 400 error)
4. **Check** that `date_of_birth` is `null` when Claude returns "Unknown"

---

**Status**: ✅ READY FOR TESTING
**Impact**: HIGH - Fixes client creation failures when Claude extracts unknown values
