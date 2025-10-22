# Troubleshooting "Claude returned invalid JSON" Error

## Overview

If you're seeing the error "Claude API error: Claude returned invalid JSON. This may be due to a malformed response", this guide will help you diagnose and fix the issue.

## Quick Debug Steps

### Step 1: Open Browser Console

1. Press **F12** (Windows/Linux) or **Cmd+Option+I** (Mac)
2. Click on the **Console** tab
3. Try analyzing your files again
4. Look for detailed error messages in red

### Step 2: Check What Claude Returned

The system now logs the **full raw response** from Claude to the console when errors occur. Look for:

```
❌ Failed to parse Claude response:
Raw response (full): [the actual text Claude returned]
💡 Full error details saved to sessionStorage.lastClaudeError
```

### Step 3: Inspect the Saved Error

In the browser console, type:
```javascript
JSON.parse(sessionStorage.lastClaudeError)
```

This will show you:
- The exact error message
- The full raw response from Claude
- A timestamp of when it occurred

## Common Causes & Solutions

### 1. Special Characters in Lab Reports

**Symptom:** Error occurs with non-English lab reports (Spanish, Portuguese, etc.)

**Cause:** Special characters like á, é, í, ó, ú, ñ, ç breaking JSON parsing

**Solution:** 
- The system has been updated with improved character handling
- If you still see errors, check the console for the raw response
- Look for unescaped quotes or backslashes in patient names

**Example:** 
```
Patient name: "María José González" 
✅ Should work fine now

Patient name with quotes: "José "El Grande" García"
❌ May cause issues - the quotes need escaping
```

### 2. Empty or Corrupted .docx Files

**Symptom:** Error specifically when uploading .docx files

**Cause:** The Word document may be empty, password-protected, or corrupted

**Solution:**
- Open the .docx file in Microsoft Word or Google Docs to verify it has content
- Try re-saving the file as a new .docx
- Convert to PDF and try uploading the PDF instead
- Check console for: "No text could be extracted from [filename]"

**Console Check:**
```
Processing Word document: labs.docx
Extracted 0 characters from labs.docx
❌ Error: No text could be extracted
```

### 3. Malformed Lab Report Structure

**Symptom:** Error with specific lab reports that work fine as images

**Cause:** The text extraction produces unusual formatting that confuses Claude

**Solution:**
- If it's a PDF with poor text extraction, try converting to an image (PNG/JPG) first
- Take a screenshot of the lab report and upload the image instead
- Check console logs: "Extracted X characters from [filename]" - if X is very low, extraction failed

### 4. Claude API Response Issues

**Symptom:** Error says "Claude encountered an issue processing the document"

**Cause:** Claude couldn't process the document content for various reasons

**Possible Reasons:**
- Document is not a lab report (e.g., uploaded wrong file)
- Document is in an unsupported format (Claude can't read it)
- Document has no clear biomarker values
- API rate limiting or service issues

**Solution:**
- Verify the file is actually a lab report with numeric biomarker values
- Try uploading one file at a time instead of multiple files
- Wait a few minutes and try again (could be API rate limiting)
- Check if Claude API status is operational: https://status.anthropic.com

### 5. Network or API Issues

**Symptom:** Intermittent errors that sometimes work, sometimes don't

**Cause:** Network connectivity, API rate limits, or Claude service issues

**Solution:**
- Check your internet connection
- Try again in a few minutes
- If using many files, reduce batch size (upload fewer at a time)
- Verify your Claude API key is valid in Settings

## Detailed Logging

The system now provides extensive logging at each step:

### File Processing Logs
```
Processing Word document: labs.docx
Extracted 5234 characters from labs.docx
First 500 chars: [preview of extracted text]
```

### Claude Response Logs
```
Raw response length: 3456
First 300 chars: [Claude's response start]
Last 300 chars: [Claude's response end]
Attempting to parse JSON (first 500 chars): [JSON preview]
```

### Extraction Results
```
📊 Biomarker Extraction Summary
📄 PDF 1: labs.pdf
✅ Extracted 42 biomarkers
```

## How to Report an Issue

If you continue to experience errors after trying these solutions:

1. **Open the browser console (F12)**
2. **Copy the full console output** (right-click → Save as...)
3. **Take a screenshot** of the error message
4. **Get the saved error details:**
   ```javascript
   JSON.parse(sessionStorage.lastClaudeError)
   ```
5. **Note:**
   - File format (PDF, DOCX, PNG/JPG)
   - File language (English, Spanish, etc.)
   - File size
   - Number of files uploaded

## Recent Improvements

### October 2024 Updates

✅ **Improved JSON Parsing**
- Better handling of special characters (accents, non-Latin scripts)
- Multiple fallback strategies for JSON extraction
- Escape sequence handling in patient names

✅ **Enhanced Error Messages**
- Full raw response logged to console
- Error details saved to sessionStorage for inspection
- Specific error messages based on failure type

✅ **Better .docx Support**
- Validation of extracted text before sending to Claude
- Detailed logging of extraction process
- Empty file detection

✅ **Multilingual Support**
- Explicit support for Spanish, Portuguese, French, German, Italian
- Support for Asian languages (Chinese, Japanese, Korean)
- Support for Arabic, Russian, and other scripts

## Advanced Debugging

### Manual JSON Extraction

If you want to see what Claude actually returned:

1. Open Console (F12)
2. Run:
   ```javascript
   const lastError = JSON.parse(sessionStorage.lastClaudeError);
   console.log('Full Response:', lastError.rawResponse);
   ```
3. Try to identify the issue:
   - Does it start with `{`?
   - Does it end with `}`?
   - Are there any unescaped characters?
   - Is there explanatory text before or after the JSON?

### Testing Individual Files

To isolate which file is causing issues:

1. Upload files **one at a time**
2. Note which file triggers the error
3. Check console logs for that specific file
4. Try converting that file to a different format

## Prevention Tips

1. **Use high-quality scans** - Clear, well-lit, high-resolution images work best
2. **Prefer digital PDFs** - PDFs generated directly from lab systems work better than scanned images
3. **One language per upload** - While mixed languages are supported, sticking to one language per batch may be more reliable
4. **Standard formats** - Use standard lab report formats when possible
5. **Test with one file first** - Before uploading 10 files, test with one to ensure it works

---

**Still having issues?** Check the browser console for detailed error logs and the raw Claude response.

