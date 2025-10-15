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
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">{message}</p>
            {progress !== undefined && (
              <div className="w-64 mx-auto">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">{progress}%</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              This may take a moment...
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

