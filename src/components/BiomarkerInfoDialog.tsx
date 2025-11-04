import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import type { BiomarkerInfo } from '@/lib/biomarker-info';

interface BiomarkerInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  biomarkerInfo: BiomarkerInfo | null;
  currentValue?: string;
  optimalRange?: string;
  status?: 'in-range' | 'out-of-range' | 'unknown';
}

export function BiomarkerInfoDialog({
  open,
  onOpenChange,
  biomarkerInfo,
  currentValue,
  optimalRange,
  status
}: BiomarkerInfoDialogProps) {
  if (!biomarkerInfo) return null;

  // Try to determine more precisely if it's high or low
  // This is a simple heuristic - could be improved with more sophisticated parsing
  const numValue = parseFloat(currentValue || '0');
  const rangeMatch = optimalRange?.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  let isDefinitelyHigh = false;
  let isDefinitelyLow = false;

  if (rangeMatch && !isNaN(numValue)) {
    const minRange = parseFloat(rangeMatch[1]);
    const maxRange = parseFloat(rangeMatch[2]);
    isDefinitelyHigh = numValue > maxRange;
    isDefinitelyLow = numValue < minRange;
  }

  // Check for "less than" or "greater than" patterns in optimal range
  const lessThanMatch = optimalRange?.match(/[<≤]\s*(\d+\.?\d*)/);
  const greaterThanMatch = optimalRange?.match(/[>≥]\s*(\d+\.?\d*)/);

  if (lessThanMatch && !isNaN(numValue)) {
    const threshold = parseFloat(lessThanMatch[1]);
    isDefinitelyHigh = numValue > threshold;
  }

  if (greaterThanMatch && !isNaN(numValue)) {
    const threshold = parseFloat(greaterThanMatch[1]);
    isDefinitelyLow = numValue < threshold;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Info className="h-5 w-5 text-blue-500" />
            {biomarkerInfo.name}
          </DialogTitle>
          <DialogDescription>
            Detailed information about this biomarker
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Status Alert */}
          {status === 'out-of-range' && (
            <Alert variant={isDefinitelyHigh || isDefinitelyLow ? 'destructive' : 'default'}>
              <AlertDescription className="flex items-center gap-2">
                {isDefinitelyHigh && <TrendingUp className="h-4 w-4" />}
                {isDefinitelyLow && <TrendingDown className="h-4 w-4" />}
                <span className="font-semibold">
                  Current Value: {currentValue}
                </span>
                {isDefinitelyHigh && <Badge variant="destructive">High</Badge>}
                {isDefinitelyLow && <Badge variant="destructive">Low</Badge>}
              </AlertDescription>
            </Alert>
          )}

          {/* Description */}
          {biomarkerInfo.description && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                About
              </h3>
              <p className="text-sm leading-relaxed">
                {biomarkerInfo.description}
              </p>
            </div>
          )}

          {/* Optimal Values */}
          {biomarkerInfo.optimalValues && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Optimal Values
              </h3>
              <p className="text-sm font-mono bg-muted px-3 py-2 rounded">
                {biomarkerInfo.optimalValues}
              </p>
            </div>
          )}

          {/* Low Reasons - Show if value is low or if no specific direction */}
          {biomarkerInfo.lowReasons && biomarkerInfo.lowReasons.length > 0 && (
            (!isDefinitelyHigh || status === 'in-range' || !currentValue) && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-blue-500" />
                  Possible Reasons for Low Values
                </h3>
                <ul className="space-y-1.5 ml-6">
                  {biomarkerInfo.lowReasons.map((reason, index) => (
                    <li key={index} className="text-sm list-disc leading-relaxed">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          {/* High Reasons - Show if value is high or if no specific direction */}
          {biomarkerInfo.highReasons && biomarkerInfo.highReasons.length > 0 && (
            (!isDefinitelyLow || status === 'in-range' || !currentValue) && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  Possible Reasons for High Values
                </h3>
                <ul className="space-y-1.5 ml-6">
                  {biomarkerInfo.highReasons.map((reason, index) => (
                    <li key={index} className="text-sm list-disc leading-relaxed">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          {/* What Next */}
          {biomarkerInfo.whatNext && biomarkerInfo.whatNext.length > 0 && (
            <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-blue-900">
                <ArrowRight className="h-4 w-4" />
                What To Do Next
              </h3>
              <ul className="space-y-1.5 ml-6">
                {biomarkerInfo.whatNext.map((item, index) => (
                  <li key={index} className="text-sm list-disc leading-relaxed text-blue-900">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
