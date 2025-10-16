# Biomarker Extraction Diagnostics Guide

## Overview
This guide explains the enhanced biomarker extraction and matching system that helps diagnose why biomarkers might be missing from analysis reports.

## What Was Fixed

### 1. **Enhanced Logging System**
The system now provides detailed console logs showing:
- What biomarkers Claude extracts from each PDF/image
- How biomarkers are consolidated across multiple documents
- Which biomarkers matched successfully and which didn't
- Biomarker names that didn't match any expected benchmark

### 2. **Improved Claude Prompt**
The AI prompt has been enhanced to:
- Emphasize extracting EVERY biomarker visible in documents
- Provide specific guidance about where to look (CBC sections, CMP, lipid panels, etc.)
- Require extraction of 30-40+ biomarkers from comprehensive reports
- Be more thorough with image-based lab reports

### 3. **Expanded Biomarker Aliases**
Added more common lab report name variations for better matching:
- **WBC differential markers**: Now includes "Neutrophil %", "Lymphs", "Monos", "PMN", etc.
- **Common CBC markers**: "Red Cell Count", "Hemoglobin Level", "Platelet", etc.
- **Glucose variations**: "Serum Glucose", "Plasma Glucose", "Blood Glucose Level"
- **eGFR variations**: "eGFR (CKD-EPI)", "eGFR (MDRD)", etc.

### 4. **Detailed Matching Logic**
Enhanced the matching algorithm to:
- Show exactly which aliases were tried for each biomarker
- Identify biomarkers extracted by Claude that don't match any benchmark
- Provide detailed normalization logs for debugging name mismatches

### 5. **User-Facing Diagnostic View**
The analysis results page now shows:
- A detailed alert when biomarkers are missing
- An expandable list of all missing biomarkers
- A tip to check browser console for detailed logs

## How to Use the Diagnostic System

### Step 1: Upload Lab Reports
Upload Melissa Mor's (or any client's) PDF or image files as usual through the Analysis page.

### Step 2: Open Browser Console
Before clicking "Analyze":
1. Press `F12` (or `Cmd+Option+I` on Mac)
2. Click on the "Console" tab
3. Clear any existing logs (optional - click the 🚫 icon)

### Step 3: Run Analysis
Click the "Analyze" button and watch the console for detailed logs.

### Step 4: Review Extraction Logs
You'll see organized log groups:

#### 📊 Biomarker Extraction Summary
Shows what Claude extracted from each PDF:
```
📄 PDF 1: lab_report_2024.pdf
  ✅ Extracted 42 biomarkers:
  [Table showing all extracted biomarkers with names, values, and units]
```

#### 🔄 Biomarker Consolidation
Shows how biomarkers from multiple PDFs are combined:
```
Total extracted across all PDFs: 48
After deduplication: 43
[Table showing consolidated biomarkers]
```

#### 🔍 Detailed Biomarker Matching
Shows how extracted names are matched to standard names:
```
Extracted biomarker names (normalized):
["glucose", "wbc", "rbc", "hemoglobin", ...]

✅ Matched: "Glucose" → "Fasting Glucose" (via alias: "Glucose")
✅ Matched: "Hgb" → "Hemoglobin" (via alias: "Hgb")
❌ Not found: "Free T3" (tried: Free T3, FT3, Free Triiodothyronine, ...)
```

#### 🎯 Biomarker Matching Results
Final summary:
```
✅ Matched: 38
❌ Missing: 16
Missing biomarkers: [list of missing biomarker names]
```

#### ⚠️ Unmatched Extractions
If Claude extracted biomarkers that don't match any benchmark:
```
⚠️ Extracted biomarkers that didn't match any benchmark:
"TSH (3rd Generation)" (normalized: "tsh3rdgeneration")
```

### Step 5: Analyze the Results

#### If biomarkers are missing due to extraction failure:
The logs will show that Claude didn't extract them from the PDF. Possible causes:
- **Poor image quality**: Blurry or low-resolution images
- **PDF text extraction issues**: PDFs with embedded images instead of text
- **Complex layouts**: Lab reports with unusual formatting
- **Multiple pages**: Important data on pages Claude didn't process thoroughly

**Solution**: 
- Re-scan documents at higher resolution
- Ensure PDFs are text-based, not just images
- Try uploading individual pages as separate high-quality images
- Check that all relevant pages were uploaded

#### If biomarkers are missing due to name matching failure:
The logs will show biomarkers in the "Unmatched Extractions" section. This means Claude found them but the name didn't match any known alias.

**Solution**:
- Note the exact name Claude extracted
- Add it as an alias to the appropriate biomarker in `src/lib/biomarkers.ts`
- Example: If Claude extracted "TSH (3rd Gen)", add it to the TSH aliases array

## Common Issues and Solutions

### Issue: "Only 20 biomarkers extracted from a 46-marker report"

**Diagnosis Steps:**
1. Check the "📊 Biomarker Extraction Summary" - did Claude extract all 46?
2. If YES → it's a matching problem (check "Unmatched Extractions")
3. If NO → it's an extraction problem (Claude vision/text extraction issue)

**Solutions:**
- **For extraction problems:**
  - Use higher quality scans (at least 800x600 pixels)
  - Upload pages individually as images if the PDF has issues
  - Ensure all pages of the lab report are included
  
- **For matching problems:**
  - Check console for unmatched biomarker names
  - Add missing aliases to `biomarkers.ts`
  - Report the issue so aliases can be added to the system

### Issue: "Different results when uploading the same file twice"

**Possible Causes:**
- Claude API variability (AI is non-deterministic)
- Image quality detection triggering different code paths
- PDF vs image processing differences

**Solution:**
- Check image quality warnings in the upload
- Convert PDFs to high-quality images for consistency
- Use text-based PDFs when possible (better extraction)

### Issue: "Biomarker extracted with wrong unit"

**Diagnosis:**
Check the "📊 Biomarker Extraction Summary" to see exactly what Claude extracted.

**Solution:**
This is a Claude extraction issue. The biomarker should still match if the name is correct. The unit is preserved as extracted by Claude.

## Adding New Biomarker Aliases

If you find a biomarker name that Claude extracts but doesn't match:

1. Open `src/lib/biomarkers.ts`
2. Find the biomarker definition (e.g., "TSH")
3. Add the new name to the `aliases` array:

```typescript
{
  name: "TSH",
  maleRange: "1.0-2.5 mIU/L",
  femaleRange: "1.0-2.5 mIU/L",
  units: ["mIU/L", "µIU/mL", "uIU/mL"],
  category: "Thyroid",
  aliases: [
    "Thyroid Stimulating Hormone",
    "Thyrotropin",
    "TSH (3rd Generation)",  // ← ADD NEW ALIAS HERE
  ]
},
```

## Testing with Melissa Mor's Data

To verify the fix specifically for Melissa Mor:

1. Open browser console (F12)
2. Upload all her lab report files
3. Click Analyze
4. Review the extraction logs:
   - How many biomarkers were extracted per file?
   - Were all 46 biomarkers found across all files?
   - Which specific 16 biomarkers are missing?
   - Are they missing due to extraction or matching?

5. Check the results page:
   - Click the "View missing biomarkers" dropdown in the alert
   - Compare against what you know should be in the reports

6. Take screenshots of:
   - The console logs (especially "Biomarker Extraction Summary")
   - The analysis results showing missing biomarkers
   - Any "Unmatched Extractions" warnings

7. Share findings:
   - If extraction is the issue: Document which specific sections/pages weren't read
   - If matching is the issue: List the exact names Claude extracted that didn't match

## Technical Details

### Normalization Logic
Biomarker names are normalized for matching by:
1. Converting to lowercase
2. Trimming whitespace
3. Removing all non-alphanumeric characters

Example:
- "TSH (3rd Gen)" → "tsh3rdgen"
- "Vitamin D, 25-OH" → "vitamind25oh"
- "eGFR" → "egfr"

This ensures flexible matching while preventing false positives.

### Consolidation Logic
When multiple PDFs are uploaded:
1. Each PDF is analyzed separately by Claude
2. Biomarkers with the same normalized name are consolidated
3. If duplicates exist, the system prefers:
   - Non-N/A values over N/A values
   - More recent test dates over older ones
4. Final consolidated list is matched against all 54 standard biomarkers

## Performance Notes

- Each PDF/image is sent to Claude separately (required for API)
- Processing is batched (3 at a time) to avoid rate limits
- 2-second delay between batches
- Typical processing time: 10-30 seconds for 3-5 documents

## Next Steps for Debugging

If missing biomarkers persist after these improvements:

1. **Document the issue**: Screenshot the console logs
2. **Identify the root cause**: Extraction vs. Matching
3. **For extraction issues**: Test with higher quality images
4. **For matching issues**: Add the missing aliases
5. **Report patterns**: If many biomarkers from a specific lab are missing, the lab might use non-standard naming that needs bulk alias additions

## Support

When reporting biomarker extraction issues, please include:
1. Screenshot of browser console logs (especially extraction summary)
2. Screenshot of the missing biomarkers list
3. Information about the lab report source (which lab company)
4. Image quality or PDF type (text-based vs image-based)

This information helps identify whether it's a Claude extraction issue, a name matching issue, or a systematic problem with specific lab formats.

