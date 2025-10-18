# Gender Detection Debug Guide

**Issue:** Melissa's test is being detected as male instead of female.

---

## How Gender Detection Works

The system detects gender from lab reports in two places:

### 1. **Claude AI Extraction** (`src/lib/claude-service.ts`)
- Claude reads the patient information section of the lab report
- Looks for fields like: "Sex:", "Gender:", "M/F", etc.
- Normalizes to: "male", "female", or "other"

### 2. **Client Matching** (`src/lib/client-matcher.ts`)
- After extraction, the system tries to match with existing clients
- If a client already exists in the database, it uses the stored gender
- If creating a new client, it uses the gender from the extraction

---

## Common Causes of Incorrect Gender Detection

### 1. **Lab Report Format Issue**
- The gender field on the lab report might be unclear or abbreviated
- Common problematic formats:
  - `M/F: M` (checkbox style)
  - `Sex: ___ M ___ F` (blank form)
  - `Gender: Not specified`

### 2. **Existing Client Override**
- If "Melissa" already exists in the database with gender set to "male"
- The system will use the stored value instead of the extracted value
- **Solution:** Update the client's gender in the Client Library

### 3. **Name-Based Assumption**
- While the system doesn't explicitly use name-based gender detection, Claude might make assumptions
- Some lab report templates have confusing layouts

---

## How to Debug

### Step 1: Check Browser Console During Upload

When you upload a lab report, open the browser console (F12 or Cmd+Option+I) and look for:

```javascript
// Look for patient info extraction logs:
{
  "patientInfo": {
    "name": "Melissa ...",
    "dateOfBirth": "...",
    "gender": "male",  // ← Check what was extracted
    "testDate": "..."
  }
}
```

### Step 2: Check Existing Client Database

1. Go to **Client Library** page
2. Search for "Melissa"
3. Check the gender field
4. If it's set to "male", click **Edit** and change it to "female"

### Step 3: Review the Lab Report PDF

Look at the patient information section:
- Is the gender clearly marked?
- Is it in a standard format (e.g., "Sex: F" or "Gender: Female")?
- Could Claude be misreading it?

---

## Quick Fixes

### Fix 1: Update Existing Client Gender

If Melissa already exists in your database:

1. Go to **Client Library**
2. Find "Melissa" in the list
3. Click **Edit**
4. Change **Gender** to "Female"
5. Click **Save**
6. Re-upload the lab report

### Fix 2: Delete and Re-Create

If the client was created incorrectly:

1. Go to **Client Library**
2. Find "Melissa"
3. Delete the client (if no important data)
4. Re-upload the lab report
5. During client confirmation, manually select "Female"

### Fix 3: Manual Override During Upload

When uploading:
1. After extraction, the system shows a confirmation dialog
2. You can manually correct the gender before creating/updating the client
3. Select the correct gender from the dropdown

---

## Improving Gender Detection

### Update the Extraction Prompt (Advanced)

If you're seeing consistent issues, you can enhance the prompt in `src/lib/claude-service.ts`:

```typescript
// Find this section:
3. Extract PATIENT DEMOGRAPHIC INFORMATION:
   - Patient's gender/sex (male, female, or other)

// Enhance it to:
3. Extract PATIENT DEMOGRAPHIC INFORMATION:
   - Patient's gender/sex:
     * Look for: "Sex:", "Gender:", "M/F", "Male/Female"
     * Convert: M → male, F → female
     * IMPORTANT: Look carefully at the patient info section
     * If unclear, check the reference ranges (some labs show gender-specific ranges)
```

### Add Validation

You could add a validation step that checks if the name suggests a different gender than what was extracted and flags it for manual review.

---

## System Behavior

### Client Confirmation Dialog

The system should show a confirmation dialog with:
```
Patient Information Detected:
Name: Melissa [Last Name]
Date of Birth: [DOB]
Gender: [Dropdown with Male/Female/Other]  ← You can change this here
Test Date: [Date]

[Button: Create New Client] [Button: Use Existing]
```

If this isn't showing up, there might be an issue with the auto-match logic.

---

## Testing Gender Detection

### Test with Known Lab Reports

1. **Upload a male patient's lab report**
   - Verify it extracts as "male"
   - Check the analysis uses male ranges

2. **Upload a female patient's lab report**
   - Verify it extracts as "female"
   - Check the analysis uses female ranges

3. **Check Range Differences**
   - Some biomarkers have different ranges for males vs females
   - Examples:
     - Hemoglobin: M: 145-155 g/L, F: 135-145 g/L
     - RBC: M: 4.2-4.9, F: 3.9-4.5
   - Verify the correct ranges are being used in the analysis

---

## Next Steps

1. **Check Melissa's existing client record** - Update gender if incorrect
2. **Review the lab report PDF** - Verify gender is clearly marked
3. **Test with a fresh upload** - See if manual override works
4. **Enable debug logging** - Check browser console during extraction

---

## Need More Help?

If the issue persists:

1. **Check the raw Claude response** in browser console:
   ```javascript
   // Look for the full extraction response
   raw: "{\"patientInfo\": {\"gender\": \"...\"}, ...}"
   ```

2. **Verify the lab report has clear gender indicators**

3. **Try manual selection** during the client confirmation step

---

## Related Files

```
src/lib/claude-service.ts      ← Extraction logic
src/lib/client-matcher.ts      ← Client matching logic
src/lib/analyzer.ts            ← Range selection based on gender
src/components/ClientConfirmation.tsx  ← UI for manual override
```

