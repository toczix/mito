# Fix Plan: Upload Stuck at 30% Progress Issue

## Problem Summary
Users report that file uploads get stuck at 30% progress and never complete. This occurs during the AI biomarker extraction phase.

## Root Cause
**Missing timeout configuration on Supabase Edge Function calls**, combined with no retry logic and insufficient user feedback during long-running Claude API requests.

---

## Detailed Analysis

### What Happens at 30%?
At 30% progress in `HomePage.tsx:90`, the system calls `extractBiomarkersFromPdfs()` which:
1. Processes PDFs in batches of 3
2. Calls Supabase Edge Function `analyze-biomarkers` for each PDF
3. Edge Function calls Claude API (can take 30-60+ seconds per file)
4. **NO timeout configured** = indefinite wait if Claude API is slow/unavailable

### Technical Issues Identified

#### 1. **No Timeout on Supabase Function Invocation** (PRIMARY ISSUE)
**File**: `src/lib/claude-service.ts:255`
```typescript
const { data, error } = await supabase.functions.invoke('analyze-biomarkers', {
  body: { processedPdf },
});
// ❌ No timeout specified!
```

#### 2. **No Retry Logic for Transient Failures**
**File**: `src/lib/claude-service.ts:377`
- Uses `Promise.allSettled` but doesn't retry failed requests
- Network blips or temporary Claude API issues cause permanent failures

#### 3. **No Progress Feedback During Individual File Processing**
- User sees "Analyzing document 1 of 3..." for 30-60 seconds with NO visual indication of progress
- Appears frozen even when working correctly

#### 4. **Edge Function Has No Internal Timeout**
**File**: `supabase/functions/analyze-biomarkers/index.ts:140-145`
- Claude SDK call has no explicit timeout
- Can hang if Claude API is overloaded

---

## Solution Design

### Phase 1: Immediate Fixes (Critical)

#### Fix 1.1: Add Timeout to Supabase Function Calls
**File**: `src/lib/claude-service.ts`
**Location**: `extractBiomarkersFromPdf()` function

**Current**:
```typescript
const { data, error } = await supabase.functions.invoke('analyze-biomarkers', {
  body: { processedPdf },
});
```

**Fixed**:
```typescript
// Add timeout wrapper
const EDGE_FUNCTION_TIMEOUT = 90000; // 90 seconds

const invokeWithTimeout = async (processedPdf: ProcessedPDF) => {
  return Promise.race([
    supabase.functions.invoke('analyze-biomarkers', {
      body: { processedPdf },
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout - file took too long to process')), EDGE_FUNCTION_TIMEOUT)
    )
  ]);
};

const result = await invokeWithTimeout(processedPdf);
const { data, error } = result as any;
```

#### Fix 1.2: Add Retry Logic with Exponential Backoff
**File**: `src/lib/claude-service.ts`

**Add new utility function**:
```typescript
/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  maxDelay: number = 10000,
  timeoutMs: number = 90000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wrap with timeout
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRetryable =
        error.message?.includes('timeout') ||
        error.message?.includes('overloaded') ||
        error.message?.includes('rate_limit') ||
        error.message?.includes('network') ||
        error.status === 429 || // Rate limit
        error.status === 503 || // Service unavailable
        error.status === 504;   // Gateway timeout

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

**Update `extractBiomarkersFromPdf()`**:
```typescript
export async function extractBiomarkersFromPdf(
  processedPdf: ProcessedPDF
): Promise<ClaudeResponse> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  return retryWithBackoff(
    async () => {
      console.log(`📄 Processing file: ${processedPdf.fileName}`);
      console.log(`   - Is Image: ${processedPdf.isImage}`);
      console.log(`   - Page Count: ${processedPdf.pageCount}`);
      console.log(`   - Extracted Text Length: ${processedPdf.extractedText?.length || 0} chars`);

      await supabase.auth.getSession();
      console.log('🚀 Sending request to Supabase Edge Function...');

      const { data, error } = await supabase.functions.invoke('analyze-biomarkers', {
        body: { processedPdf },
      });

      if (error) {
        console.error('Edge Function error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));

        let errorMessage = error.message || 'Unknown error';

        if (error.context && typeof error.context === 'object') {
          if (error.context.error) {
            errorMessage = typeof error.context.error === 'string'
              ? error.context.error
              : (error.context.error?.message || errorMessage);
          } else if (error.context.message) {
            errorMessage = error.context.message;
          }
        }

        try {
          const errorMatch = errorMessage.match(/\{.*\}/);
          if (errorMatch) {
            const parsedError = JSON.parse(errorMatch[0]);
            if (parsedError.error) {
              errorMessage = parsedError.error;
            }
          }
        } catch (e) {
          // Continue with original message
        }

        if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
          throw new Error('Edge Function authentication failed. The Edge Function may need to be redeployed with authentication disabled.');
        }

        if (errorMessage.includes('Claude API key not configured')) {
          throw new Error('Claude API key is not configured in Supabase. Please set CLAUDE_API_KEY secret.');
        }

        if (errorMessage.includes('Invalid JSON')) {
          throw new Error('Invalid request format sent to Edge Function.');
        }

        // Add status code to error for retry logic
        const wrappedError: any = new Error(`Server error: ${errorMessage}`);
        wrappedError.status = error.status;
        throw wrappedError;
      }

      if (!data) {
        throw new Error('No response from server');
      }

      console.log('✅ Received response from Edge Function');

      return {
        biomarkers: data.biomarkers || [],
        patientInfo: data.patientInfo || {
          name: null,
          dateOfBirth: null,
          gender: null,
          testDate: null,
        },
        panelName: data.panelName || 'Lab Results',
        raw: JSON.stringify(data),
      };
    },
    3, // maxRetries
    2000, // initialDelay: 2 seconds
    15000, // maxDelay: 15 seconds
    90000 // timeout: 90 seconds
  );
}
```

#### Fix 1.3: Add Progress Indication During Individual File Processing
**File**: `src/lib/claude-service.ts`

**Update `extractBiomarkersFromPdfs()` to provide more granular progress**:
```typescript
export async function extractBiomarkersFromPdfs(
  processedPdfs: ProcessedPDF[],
  onProgress?: (current: number, total: number, batchInfo?: string, status?: string) => void
): Promise<ClaudeResponseBatch> {
  if (processedPdfs.length === 0) {
    throw new Error('No PDFs provided');
  }

  const BATCH_SIZE = 3;
  const DELAY_BETWEEN_BATCHES = 2000;

  const results: ClaudeResponse[] = [];
  const failedFiles: Array<{ fileName: string; error: string }> = [];
  const totalBatches = Math.ceil(processedPdfs.length / BATCH_SIZE);
  let currentBatch = 0;

  for (let i = 0; i < processedPdfs.length; i += BATCH_SIZE) {
    currentBatch++;
    const batch = processedPdfs.slice(i, i + BATCH_SIZE);

    if (onProgress) {
      const batchInfo = processedPdfs.length > BATCH_SIZE
        ? ` (batch ${currentBatch}/${totalBatches})`
        : '';
      onProgress(i, processedPdfs.length, batchInfo, 'starting');
    }

    // Process batch with individual progress tracking
    const batchPromises = batch.map(async (pdf, batchIdx) => {
      const fileIndex = i + batchIdx;
      try {
        // Update progress: Processing individual file
        if (onProgress) {
          onProgress(
            fileIndex,
            processedPdfs.length,
            ` (batch ${currentBatch}/${totalBatches})`,
            `processing "${pdf.fileName}"`
          );
        }

        const result = await extractBiomarkersFromPdf(pdf);

        // Update progress: File completed
        if (onProgress) {
          onProgress(
            fileIndex + 1,
            processedPdfs.length,
            ` (batch ${currentBatch}/${totalBatches})`,
            `completed "${pdf.fileName}"`
          );
        }

        return result;
      } catch (error: any) {
        // Update progress: File failed
        if (onProgress) {
          onProgress(
            fileIndex + 1,
            processedPdfs.length,
            ` (batch ${currentBatch}/${totalBatches})`,
            `failed "${pdf.fileName}"`
          );
        }
        throw error;
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, idx) => {
      const pdf = batch[idx];
      if (result.status === 'fulfilled') {
        results.push(result.value);
        console.log(`✅ Successfully extracted biomarkers from ${pdf.fileName}`);
      } else {
        const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failedFiles.push({ fileName: pdf.fileName, error: errorMessage });
        console.error(`❌ Failed to extract biomarkers from ${pdf.fileName}: ${errorMessage}`);
      }
    });

    if (i + BATCH_SIZE < processedPdfs.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  if (onProgress) {
    onProgress(processedPdfs.length, processedPdfs.length, '', 'completed');
  }

  if (results.length === 0 && failedFiles.length > 0) {
    const errorDetails = failedFiles.map(f => `${f.fileName}: ${f.error}`).join('\n');
    throw new Error(`All files failed to process:\n${errorDetails}`);
  }

  const batchResults: ClaudeResponseBatch = results as ClaudeResponseBatch;
  if (failedFiles.length > 0) {
    batchResults._failedFiles = failedFiles;
    console.warn(`⚠️ ${failedFiles.length} file(s) failed processing, continuing with ${results.length} successful file(s)`);
  }

  return batchResults;
}
```

**Update HomePage.tsx to use new status parameter**:
```typescript
// Line 91-98 in HomePage.tsx
const claudeResponses: ClaudeResponseBatch = await extractBiomarkersFromPdfs(
  validPdfs,
  (current, total, batchInfo, status) => {
    const progress = 30 + Math.round((current / total) * 40);
    setProcessingProgress(progress);

    // Enhanced status message
    let message = `Analyzing document ${current + 1} of ${total}${batchInfo}`;
    if (status) {
      if (status.startsWith('processing')) {
        message = `📄 Processing ${status.replace('processing ', '')}...`;
      } else if (status.startsWith('completed')) {
        message = `✅ Completed ${status.replace('completed ', '')}`;
      } else if (status.startsWith('failed')) {
        message = `❌ Failed ${status.replace('failed ', '')}`;
      }
    }

    setProcessingMessage(message);
  }
);
```

### Phase 2: Enhanced User Experience (High Priority)

#### Fix 2.1: Add Visual Spinner/Activity Indicator
**File**: `src/components/LoadingState.tsx`

**Update to show more detailed progress**:
```typescript
export function LoadingState({
  message,
  progress,
  subMessage
}: {
  message: string;
  progress: number;
  subMessage?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      {/* Animated spinner */}
      <div className="relative">
        <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-primary">{progress}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status messages */}
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-foreground">{message}</p>
        {subMessage && (
          <p className="text-sm text-muted-foreground animate-pulse">{subMessage}</p>
        )}
      </div>

      {/* Helpful tip for long waits */}
      {progress >= 30 && progress < 70 && (
        <div className="mt-4 text-xs text-muted-foreground max-w-md text-center">
          <p>Processing large files may take 1-2 minutes per document.</p>
          <p className="mt-1">Please keep this tab open.</p>
        </div>
      )}
    </div>
  );
}
```

#### Fix 2.2: Add Error Recovery UI
**File**: `src/pages/HomePage.tsx`

**Add better error handling with retry option**:
```typescript
// Add state for retry
const [retryCount, setRetryCount] = useState(0);
const [isRetrying, setIsRetrying] = useState(false);

// Enhanced error handling
const handleAnalyzeWithRetry = async (isRetry: boolean = false) => {
  if (isRetry) {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
  }

  try {
    await handleAnalyze();
  } catch (err) {
    // If timeout error and haven't retried too many times, offer retry
    if (err.message.includes('timeout') && retryCount < 3) {
      setError(
        `${err.message}\n\nThis file may be taking longer than expected. Would you like to retry?`
      );
      // Show retry button
    } else {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  } finally {
    setIsRetrying(false);
  }
};
```

### Phase 3: Edge Function Optimization (Medium Priority)

#### Fix 3.1: Add Timeout to Claude API Call
**File**: `supabase/functions/analyze-biomarkers/index.ts`

**Add timeout configuration**:
```typescript
// Add near top of file
const CLAUDE_API_TIMEOUT = 60000; // 60 seconds

// Update Claude API call (line 140-145)
const response = await Promise.race([
  client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    temperature: 0,
    messages: [{ role: 'user', content }],
  }),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Claude API timeout after 60 seconds')), CLAUDE_API_TIMEOUT)
  )
]);
```

#### Fix 3.2: Add Request Size Validation
**File**: `supabase/functions/analyze-biomarkers/index.ts`

**Add validation before processing**:
```typescript
// Add after parsing request body (line 89)
const { processedPdf } = requestBody;

if (!processedPdf) {
  return new Response(
    JSON.stringify({ error: 'Missing processedPdf in request body' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Validate file size
const textLength = processedPdf.extractedText?.length || 0;
const imageSize = processedPdf.imageData?.length || 0;
const totalSize = textLength + imageSize;

// 5MB limit for request payload
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;

if (totalSize > MAX_PAYLOAD_SIZE) {
  return new Response(
    JSON.stringify({
      error: `File too large for processing. Size: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Maximum: 5MB.`,
      suggestion: 'Try splitting the document into smaller files or reducing image quality.'
    }),
    { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## Implementation Plan

### Step 1: Create Implementation Plan (Junior)
**Status**: ✅ Complete (this document)

### Step 2: Senior Review
**Action**: Senior engineer reviews this plan for:
- Missing edge cases
- Security concerns
- Better approaches
- Performance implications

### Step 3: Implement Phase 1 (Junior)
**Priority**: CRITICAL - Must be done first
1. Add retry logic with exponential backoff
2. Add timeout to Supabase function calls
3. Add enhanced progress feedback
4. Test with large files (intentionally slow network)
5. Test with multiple files

### Step 4: Senior Code Review
**Action**: Review all Phase 1 changes

### Step 5: Implement Phase 2 (Junior)
**Priority**: HIGH
1. Enhanced loading UI
2. Better error messages
3. Retry UI

### Step 6: Implement Phase 3 (Junior)
**Priority**: MEDIUM
1. Edge Function timeout
2. Request size validation
3. Edge Function optimization

---

## Testing Plan

### Test Cases

#### 1. **Timeout Scenarios**
- [ ] Upload very large PDF (10+ MB)
- [ ] Upload with intentionally slow network (Chrome DevTools throttling)
- [ ] Verify timeout triggers after 90 seconds
- [ ] Verify retry logic kicks in
- [ ] Verify user sees helpful error message

#### 2. **Multiple File Upload**
- [ ] Upload 5 files simultaneously
- [ ] Verify all 5 are processed (batches of 3)
- [ ] Verify progress updates for each file
- [ ] Test with 1 file that times out - verify others complete

#### 3. **Network Failure Scenarios**
- [ ] Disconnect network mid-upload
- [ ] Reconnect and verify retry works
- [ ] Verify appropriate error message

#### 4. **Edge Function Issues**
- [ ] Test with invalid Claude API key
- [ ] Test with Claude API rate limit
- [ ] Verify errors are caught and displayed properly

#### 5. **Large/Complex Documents**
- [ ] Upload comprehensive lab report (50+ biomarkers)
- [ ] Upload low-quality scanned image
- [ ] Upload multilingual report
- [ ] Verify all complete within timeout

#### 6. **Progress Feedback**
- [ ] Verify progress bar moves smoothly
- [ ] Verify status messages update for each file
- [ ] Verify "Please wait" message appears
- [ ] Verify completion message shows

---

## Rollback Plan

If issues arise after deployment:

1. **Revert commits** for Phase 1 changes
2. **Keep** enhanced progress UI (Phase 2) if working
3. **Investigate** specific failure and adjust timeout values
4. **Document** any new edge cases discovered

---

## Monitoring & Metrics

After deployment, monitor:

1. **Success Rate**: % of uploads that complete successfully
2. **Timeout Frequency**: How often timeouts occur
3. **Retry Success Rate**: How often retries succeed
4. **Average Processing Time**: Per file and per batch
5. **Error Types**: Categorize errors (timeout, network, API, etc.)

Add logging:
```typescript
// In extractBiomarkersFromPdf
console.log('📊 Processing metrics:', {
  fileName: processedPdf.fileName,
  fileSize: processedPdf.extractedText?.length || 0,
  startTime: Date.now(),
});

// After completion
console.log('📊 Completion metrics:', {
  fileName: processedPdf.fileName,
  duration: Date.now() - startTime,
  biomarkersFound: result.biomarkers.length,
  retryCount: attemptNumber,
});
```

---

## Success Criteria

✅ Uploads no longer freeze at 30%
✅ Users see progress updates every 3-5 seconds
✅ Timeout errors show helpful message with retry option
✅ At least 95% of valid files process successfully
✅ Failed files don't block other files in batch
✅ Total processing time < 2 minutes per file on average

---

## Notes

- The 90-second timeout is conservative - can be adjusted based on monitoring
- Retry logic handles transient issues (network, rate limits)
- Enhanced progress feedback prevents users from thinking app froze
- Edge Function timeout prevents infinite hangs
- Request size validation prevents overload

---

**Created**: 2025-11-07
**Author**: AI Analysis (Junior Engineer)
**Status**: Ready for Senior Review
