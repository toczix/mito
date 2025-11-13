# Mito Biomarker Analysis - Documentation Index

Welcome! This index will help you navigate all the documentation about the Mito biomarker analysis system.

## Quick Navigation

### I have 5 minutes
Start with: **QUICK_REFERENCE.md**
- Overview of all components
- File locations
- Data flow steps

### I have 20 minutes
Read: **QUICK_REFERENCE.md** → **DATA_FLOW.md**
- Quick reference first (5 min)
- Then detailed flow documentation (15 min)

### I have 45 minutes
Read all three documents in order:
1. **QUICK_REFERENCE.md** (5 min) - Overview
2. **DATA_FLOW.md** (25 min) - Detailed explanations
3. **ARCHITECTURE.txt** (15 min) - Visual diagrams

### I need to debug/troubleshoot
See: **QUICK_REFERENCE.md** - "Troubleshooting Common Issues" section

### I need to modify something
See: **QUICK_REFERENCE.md** - "Common Customizations" section

---

## Document Descriptions

### 1. QUICK_REFERENCE.md (8.5 KB)
**Best for**: Quick lookups, troubleshooting, customizations

**Contains**:
- File location reference
- Data flow steps overview
- Key functions table
- Database tables description
- Common customizations
- Troubleshooting guide
- Testing instructions
- Configuration checklist

**Read when**: You need specific information quickly

---

### 2. DATA_FLOW.md (18 KB)
**Best for**: Understanding the complete system in detail

**Contains**:
- Section 1: Upload component (PdfUploader.tsx)
- Section 2: PDF processing (pdf-processor.ts)
- Section 3: Biomarker extraction (claude-service.ts + Edge Function)
- Section 4: Biomarker matching (analyzer.ts)
- Section 5: Client matching (client-matcher.ts)
- Section 6: Database operations (analysis-service.ts)
- Section 7: Client data storage (client-service.ts)
- Section 8: HomePage orchestration
- Database schema with field descriptions
- Error handling strategies
- Key features and design decisions
- Complete data type definitions
- Deployment configuration

**Read when**: You want to understand how the system works from end-to-end

---

### 3. ARCHITECTURE.txt (31 KB)
**Best for**: Visual understanding of data flow and component interactions

**Contains**:
- ASCII art diagrams of each major stage:
  - User interaction
  - Processing pipeline
  - Biomarker extraction
  - Consolidation
  - Confirmation dialog
  - Client matching
  - Analysis creation
  - Database persistence
  - Results display
- Database relationship diagrams
- Design pattern descriptions
- Performance optimization notes

**Read when**: You want to visualize how components interact

---

## System Overview

### The Complete Flow (1 minute read)

```
1. User uploads files (PDF, DOCX, PNG, JPG)
         ↓
2. Extract text or convert to images
         ↓
3. Batch send to Claude AI (max 10 files per request)
         ↓
4. Claude extracts: biomarkers, patient info, panel name
         ↓
5. Consolidate data from multiple files
         ↓
6. User confirms patient info
         ↓
7. Search for existing client or create new
         ↓
8. Match biomarkers with optimal ranges (gender-specific)
         ↓
9. Save analysis to database
         ↓
10. Display results to user
```

### Key Technologies

- **Frontend**: React 18+, TypeScript, Vite
- **Backend**: Supabase Edge Functions (Deno)
- **AI**: Claude Haiku 4.5 API (secure server-side)
- **Database**: Supabase PostgreSQL
- **Processing**: pdfjs-dist (PDF), mammoth (Word), Canvas API (images)
- **Matching**: Levenshtein distance algorithm, server-side search with ilike

### Critical Features

1. **Batch Processing**: 10x faster (10 files per API call)
2. **Smart Image Fallback**: Vision API only when text extraction fails
3. **Multilingual Support**: 15+ languages, normalized to English
4. **WBC Differential Handling**: Absolute counts only (critical medical requirement)
5. **Error Resilience**: Transient error retry with exponential backoff
6. **Deduplication**: Prevents duplicate biomarkers and analyses
7. **Progress Tracking**: Real-time feedback (0-100%)
8. **Optional Supabase**: Works offline (client-side analysis only)

---

## File References by Purpose

### If you want to modify the upload interface
See: **QUICK_REFERENCE.md** → File sections
Look at: `/src/components/PdfUploader.tsx` (from DATA_FLOW.md Section 1)

### If you want to add a new biomarker
See: **QUICK_REFERENCE.md** → "Common Customizations"
Look at: `/src/lib/biomarkers.ts` and Edge Function prompts

### If Claude extraction isn't working
See: **DATA_FLOW.md** → Section 3
Look at: `/supabase/functions/analyze-biomarkers/index.ts`
Check: Browser console for error details (F12)

### If client matching is wrong
See: **DATA_FLOW.md** → Section 5
Look at: `/src/lib/client-matcher.ts` (scoring algorithm)
Adjust: Match confidence thresholds (from QUICK_REFERENCE.md)

### If analyses aren't saving to database
See: **QUICK_REFERENCE.md** → "Troubleshooting Common Issues"
Look at: `/src/lib/analysis-service.ts` (createAnalysis function)
Check: Supabase configuration and RLS policies

### If you want to understand database operations
See: **DATA_FLOW.md** → Section 7 & Database Schema
Look at: `/src/lib/analysis-service.ts` and `/sql/supabase-setup.sql`

### If batch processing isn't working
See: **DATA_FLOW.md** → Section 3 (extractBiomarkersFromPdfs)
Look at: `/src/lib/claude-service.ts` (lines 643-742)
Adjust: BATCH_SIZE constant (line 651)

### If you need to change timeouts
See: **QUICK_REFERENCE.md** → "Common Customizations"
Look at: 
- Client-side: `/src/lib/claude-service.ts` (line 26, 120s timeout)
- Server-side: `/supabase/functions/analyze-biomarkers/index.ts` (line 237, 300s timeout)

---

## Typical Use Cases

### "I'm a new developer and need to understand this system"
1. Read **QUICK_REFERENCE.md** (5 min)
2. Read **DATA_FLOW.md** (25 min)
3. Review **ARCHITECTURE.txt** (10 min)
4. Trace through `HomePage.tsx` (15 min)

### "Something is broken, how do I debug?"
1. Check **QUICK_REFERENCE.md** → "Common Error Messages & Causes"
2. Look at **DATA_FLOW.md** → "Error Handling & Recovery"
3. Check browser console (F12) for detailed logs
4. Find relevant file from DATA_FLOW.md sections

### "I need to add a feature"
1. Check **QUICK_REFERENCE.md** → "Common Customizations"
2. Find relevant section in **DATA_FLOW.md**
3. Look at **ARCHITECTURE.txt** for design patterns
4. Modify appropriate file from `/src/lib/` or `/src/components/`

### "Performance is slow, how do I optimize?"
1. Check **QUICK_REFERENCE.md** → "Performance Optimization Tips"
2. Review **DATA_FLOW.md** → "Key Features & Design Decisions"
3. Check **ARCHITECTURE.txt** → "KEY DESIGN PATTERNS"
4. Profile with browser DevTools

### "I need to deploy or configure this"
1. See **DATA_FLOW.md** → "Deployment & Configuration"
2. Check **QUICK_REFERENCE.md** → "Configuration Checklist"
3. Review environment variables section

---

## Key Concepts Explained

### Batch Processing
Files are processed in groups of up to 10 per Claude API request for 10x performance improvement. See **DATA_FLOW.md** Section 3 or **ARCHITECTURE.txt** design patterns.

### Smart Image Fallback
Text extraction is attempted first (faster). If it fails, ALL PDF pages are converted to high-quality PNG images for Claude's Vision API. See **DATA_FLOW.md** Section 2.

### Patient Info Consolidation
When multiple lab reports are uploaded, patient information (name, DOB, gender, test date) is merged intelligently, flagging discrepancies. See **DATA_FLOW.md** Section 3.

### Client Matching Algorithm
Uses Levenshtein distance to find similar names and exact DOB matching. Scores are calculated with weights, resulting in high/medium/low confidence. See **DATA_FLOW.md** Section 5.

### Deduplication
Biomarkers from the same client on the same test date are merged (keeping non-N/A values). Analyses with identical (clientId, labTestDate) pairs update existing instead of creating duplicates. See **DATA_FLOW.md** Sections 3 & 6.

### Gender-Specific Ranges
Optimal biomarker ranges differ by gender. System automatically selects male or female range based on consolidated patient info. See **DATA_FLOW.md** Section 4.

### WBC Differential Handling
Critical requirement: Only absolute counts (×10³/µL) are extracted, NEVER percentages. Values in cells/µL are auto-converted by dividing by 1000. See **DATA_FLOW.md** Section 3 Edge Function prompt.

### Error Resilience
Transient errors (rate limits, network) are retried with exponential backoff (3s → 6s → 10s). Non-transient errors (timeouts, file too large) fail immediately. Batch failures don't stop processing. See **DATA_FLOW.md** Section 8 & QUICK_REFERENCE.md troubleshooting.

---

## Documentation Statistics

- **Total Pages**: 57 KB across 3 files
- **Total Sections**: 25+ detailed sections
- **Code Examples**: 10+
- **Diagrams**: 8 ASCII art visualizations
- **Data Type Definitions**: 8 complete TypeScript interfaces
- **Functions Documented**: 15+ key functions
- **Database Tables**: 3 tables with full schema
- **Error Scenarios**: 20+ error cases with solutions

---

## Quick Command Reference

### Run the application
```bash
npm run dev
```

### Deploy Edge Function
```bash
supabase functions deploy analyze-biomarkers
```

### Test database connection
```typescript
// In browser console
import { supabase } from '@/lib/supabase'
supabase.from('clients').select('count').then(r => console.log(r))
```

### Check logs
```
Browser DevTools (F12) → Console tab
Filter by emojis: 📄 📊 🚀 ✅ ❌ ⏳
```

---

## When to Reference Each Document

| Task | Document | Time |
|------|----------|------|
| Overview | QUICK_REFERENCE.md | 5 min |
| Understanding flow | DATA_FLOW.md | 25 min |
| Visual reference | ARCHITECTURE.txt | 10 min |
| Troubleshooting | QUICK_REFERENCE.md | Varies |
| Customizing | QUICK_REFERENCE.md + DATA_FLOW.md | Varies |
| Deploying | DATA_FLOW.md | 10 min |

---

## Document Change Log

- **2024-11-12**: Created comprehensive documentation suite
  - DATA_FLOW.md: Complete system walkthrough (18 KB)
  - ARCHITECTURE.txt: Visual diagrams and design (31 KB)
  - QUICK_REFERENCE.md: Quick lookup guide (8.5 KB)
  - DOCUMENTATION_INDEX.md: This navigation guide

---

## Additional Resources in Project

- `README.md` - Basic project description
- `PROJECT_ANALYSIS.md` - Previous system analysis
- `UPLOAD_TO_ANALYSIS_FLOW.md` - Alternative flow documentation
- `TIMELINE_AND_TRENDS_BREAKDOWN.md` - Historical documentation
- SQL files in `/sql/` - Database migrations and setup

---

## Getting Help

1. **For quick questions**: Check QUICK_REFERENCE.md
2. **For detailed explanations**: Read relevant DATA_FLOW.md section
3. **For visual understanding**: Review ARCHITECTURE.txt diagrams
4. **For errors**: See "Troubleshooting Common Issues" in QUICK_REFERENCE.md
5. **For code review**: Trace through HomePage.tsx using documentation

---

## Summary

This documentation suite provides:
- **Complete understanding** of the entire data flow
- **Visual diagrams** of architecture and interactions
- **Quick reference** for specific information
- **Troubleshooting guide** for common issues
- **Deployment checklist** for configuration

Start with **QUICK_REFERENCE.md** for a 5-minute overview, then dive deeper into **DATA_FLOW.md** or **ARCHITECTURE.txt** as needed.

