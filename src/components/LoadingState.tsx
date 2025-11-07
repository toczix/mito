import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  progress?: number;
}

export function LoadingState({ message = 'Processing...', progress }: LoadingStateProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* Animated spinner with percentage overlay */}
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            {progress !== undefined && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary bg-background rounded-full px-1">
                  {progress}%
                </span>
              </div>
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

