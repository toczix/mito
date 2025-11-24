import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, FileText, Clock, Loader2 } from 'lucide-react';
import Lottie from 'lottie-react';
import loadingAnimation from '@/animations/loading.json';

export interface FileProgress {
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface LoadingStateProps {
  message?: string;
  progress?: number;
  fileProgress?: FileProgress[];
}

export function LoadingState({ message = 'Processing...', progress, fileProgress }: LoadingStateProps) {
  // If we have file-level progress, show enhanced UI
  if (fileProgress && fileProgress.length > 0) {
    return (
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="py-8">
          <div className="flex flex-col space-y-6">
            {/* Overall progress header */}
            <div className="text-center space-y-3">
              <div className="flex flex-col items-center gap-2">
                <Lottie
                  animationData={loadingAnimation}
                  loop={true}
                  className="w-40 h-40"
                />
                {progress !== undefined && (
                  <span className="text-xl font-bold text-primary">
                    {progress}%
                  </span>
                )}
              </div>
              <p className="text-lg font-medium">{message}</p>
            </div>

            {/* Overall progress bar */}
            {progress !== undefined && (
              <div className="w-full px-4">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Individual file progress */}
            <div className="space-y-2 px-4 max-h-[400px] overflow-y-auto">
              {fileProgress.map((file, index) => (
                <div
                  key={index}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border transition-all duration-300
                    ${file.status === 'completed' ? 'border-[hsl(var(--status-success-border))]' : ''}
                    ${file.status === 'processing' ? 'border-[hsl(var(--status-info-border))]' : ''}
                    ${file.status === 'error' ? 'border-[hsl(var(--status-error-border))]' : ''}
                    ${file.status === 'pending' ? 'bg-muted/30 border-border' : ''}
                  `}
                  style={{
                    backgroundColor: file.status === 'completed' ? 'hsl(var(--status-success-bg))' :
                                   file.status === 'processing' ? 'hsl(var(--status-info-bg))' :
                                   file.status === 'error' ? 'hsl(var(--status-error-bg))' : undefined
                  }}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {file.status === 'completed' && (
                      <CheckCircle2 className="h-5 w-5" style={{ color: 'hsl(var(--status-success-text))' }} />
                    )}
                    {file.status === 'processing' && (
                      <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'hsl(var(--status-info-text))' }} />
                    )}
                    {file.status === 'pending' && (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    {file.status === 'error' && (
                      <FileText className="h-5 w-5" style={{ color: 'hsl(var(--status-error-text))' }} />
                    )}
                  </div>

                  {/* File name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${file.status === 'pending' ? 'text-muted-foreground' : ''}`}
                       style={file.status !== 'pending' ? {
                         color: file.status === 'completed' ? 'hsl(var(--status-success-text))' :
                                file.status === 'processing' ? 'hsl(var(--status-info-text))' :
                                file.status === 'error' ? 'hsl(var(--status-error-text))' : undefined
                       } : undefined}>
                      {file.fileName}
                    </p>
                    {file.error && (
                      <p className="text-xs truncate" style={{ color: 'hsl(var(--status-error-text))' }}>
                        {file.error}
                      </p>
                    )}
                  </div>

                  {/* Status text */}
                  <div className="flex-shrink-0">
                    <span className={`text-xs font-medium ${file.status === 'pending' ? 'text-muted-foreground' : ''}`}
                          style={file.status !== 'pending' ? {
                            color: file.status === 'completed' ? 'hsl(var(--status-success-text))' :
                                   file.status === 'processing' ? 'hsl(var(--status-info-text))' :
                                   file.status === 'error' ? 'hsl(var(--status-error-text))' : undefined
                          } : undefined}>
                      {file.status === 'completed' && 'Done'}
                      {file.status === 'processing' && 'Processing...'}
                      {file.status === 'pending' && 'Waiting'}
                      {file.status === 'error' && 'Failed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Helpful tip */}
            {progress !== undefined && progress >= 30 && progress < 90 && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground text-center">
                  Processing {fileProgress.length} file{fileProgress.length > 1 ? 's' : ''} in parallel. Please keep this tab open.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback to simple progress UI if no file progress
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* Animated Lottie spinner with percentage below */}
          <div className="flex flex-col items-center gap-3">
            <Lottie
              animationData={loadingAnimation}
              loop={true}
              className="w-48 h-48"
            />
            {progress !== undefined && (
              <span className="text-2xl font-bold text-primary">
                {progress}%
              </span>
            )}
          </div>

          {/* Progress bar */}
          {progress !== undefined && (
            <div className="w-80 mx-auto">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status messages */}
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">{message}</p>
            {progress !== undefined && progress >= 30 && progress < 70 && (
              <p className="text-sm text-muted-foreground animate-pulse">
                AI is analyzing your document...
              </p>
            )}
          </div>

          {/* Helpful tip for long waits during AI processing (30% - 70%) */}
          {progress !== undefined && progress >= 30 && progress < 70 && (
            <div className="mt-2 p-4 bg-muted/50 rounded-lg max-w-md">
              <p className="text-xs text-muted-foreground text-center">
                Processing may take 1-2 minutes per document.
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Please keep this tab open while processing.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

