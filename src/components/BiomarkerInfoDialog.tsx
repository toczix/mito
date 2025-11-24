import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';
import type { BiomarkerInfo } from '@/lib/biomarker-info';
import { getBiomarkerFullName } from '@/lib/biomarkers';

interface BiomarkerInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  biomarkerInfo: BiomarkerInfo | null;
  currentValue?: string;
  unit?: string;
  optimalRange?: string;
  status?: 'in-range' | 'out-of-range' | 'unknown';
}

export function BiomarkerInfoDialog({
  open,
  onOpenChange,
  biomarkerInfo,
  currentValue,
  unit,
  optimalRange
}: BiomarkerInfoDialogProps) {
  if (!biomarkerInfo) return null;

  // Determine if value is high or low
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
          {getBiomarkerFullName(biomarkerInfo.name) && (
            <p className="text-sm text-muted-foreground mt-1">
              {getBiomarkerFullName(biomarkerInfo.name)}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Value */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            {isDefinitelyHigh && <TrendingUp className="h-5 w-5 text-orange-500" />}
            {isDefinitelyLow && <TrendingDown className="h-5 w-5 text-blue-500" />}
            <span className="font-semibold text-lg">
              Current Value: {currentValue} {unit}
            </span>
            {isDefinitelyHigh && <Badge variant="destructive">High</Badge>}
            {isDefinitelyLow && <Badge variant="destructive">Low</Badge>}
          </div>

          {/* Low Reasons - Show if value is low */}
          {biomarkerInfo.lowReasons && biomarkerInfo.lowReasons.length > 0 && isDefinitelyLow && (
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
          )}

          {/* High Reasons - Show if value is high */}
          {biomarkerInfo.highReasons && biomarkerInfo.highReasons.length > 0 && isDefinitelyHigh && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
