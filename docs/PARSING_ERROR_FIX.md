# Parsing Error Fix - October 21, 2025

## Issue
Client encountered intermittent error:
```
Analysis Failed
Claude API error: Failed to parse biomarker data from API response. 
The response may not be in the expected format.
```

## Root Cause
The error occurred in `parseClaudeResponse()` function in `claude-service.ts`. When Claude's API returns a response that doesn't perfectly match the expected JSON format, the parser would fail. This can happen when:

1. **Claude adds explanatory text** before/after the JSON
2. **JSON is wrapped in markdown** code blocks with inconsistent formatting
3. **Response includes trailing commas** or other minor JSON syntax issues
4. **Claude misunderstands the prompt** and returns natural language instead of JSON
5. **The document is unreadable** or doesn't contain lab results

## Why It Was Intermittent
AI models like Claude can occasionally:
- Add explanatory text when uncertain
- Format responses slightly differently
- Struggle with poor quality or unusual document formats

Since the user said "I tested and everything was fine," this suggests the issue was either:
- A transient API response variation
- A specific document that was borderline readable
- Random AI behavior variation

## Solution Implemented

### 1. Enhanced JSON Parsing (claude-service.ts)
Added **multiple fallback strategies** to extract JSON:

- **Strategy 1**: Remove markdown code blocks (```json ... ```)
- **Strategy 2**: Find JSON object with "biomarkers" field using flexible regex
- **Strategy 3**: Find balanced braces to extract JSON from mixed content
- **Cleanup**: Remove trailing commas and problematic newlines

### 2. Better Error Detection
Added specific error messages for different failure modes:

- **Invalid JSON syntax**: "Claude returned invalid JSON. This may be due to a malformed response. Please try again."
- **Short response**: "Claude returned an unusually short response. Please try uploading the file again."
- **Error in response**: "Claude encountered an issue processing the document. The document may be unreadable or corrupted."
- **Zero biomarkers**: "No biomarkers were extracted from the document. Please ensure the file contains lab results."
- **Generic parsing failure**: More helpful message suggesting retry or contact support

### 3. Enhanced Logging
Added detailed console logging to help diagnose issues:

```javascript
console.log('Attempting to parse JSON:', jsonText.substring(0, 200) + '...');
console.log(`Successfully parsed ${biomarkers.length} biomarkers`);
console.error('Raw response (first 500 chars):', text.substring(0, 500));
console.error('Raw response (last 500 chars):', text.substring(Math.max(0, text.length - 500)));
```

This helps developers see exactly what Claude returned when errors occur.

### 4. Improved Prompt Instructions
Added stronger directives in the prompt to ensure Claude returns valid JSON:

```
⚠️ CRITICAL: Your response MUST be ONLY the JSON object - no explanations, 
no comments, no additional text before or after the JSON.

⚠️ REMINDER: Return ONLY valid JSON - no text before or after. 
Start your response with { and end with }
```

## Testing Recommendations

When testing with clients, ask them to:

1. **Save problematic files** that cause errors so you can test with them
2. **Check browser console** (F12) for detailed error logs
3. **Try different file formats** if one fails:
   - PDF (preferred)
   - PNG screenshot
   - JPG photo
4. **Ensure good image quality** for scanned documents:
   - Minimum 800x600 resolution
   - Clear, not blurry
   - Good lighting if photographed

## Prevention

The enhanced parsing should handle most edge cases, but to minimize future issues:

1. **Educate clients** on good document quality
2. **Monitor console logs** for patterns in failures
3. **Consider retry logic** for transient API issues
4. **Update prompt** if specific patterns emerge

## Files Modified

- `src/lib/claude-service.ts`:
  - Enhanced `parseClaudeResponse()` function
  - Improved prompt with stronger JSON formatting instructions
  - Added detailed error logging and user-friendly error messages

## Next Steps

If the error persists:

1. Check browser console for detailed logs
2. Get sample file that causes the error
3. Test manually with that file
4. Consider adding automatic retry logic (up to 2-3 times)
5. Consider prompt refinement if specific patterns emerge

