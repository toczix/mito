import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Analysis } from '@/lib/supabase';

interface BiomarkerTrendsProps {
  analyses: Analysis[];
  biomarkerName: string;
}

interface DataPoint {
  date: string;
  value: number;
  displayDate: string;
}

export function BiomarkerTrends({ analyses, biomarkerName }: BiomarkerTrendsProps) {
  // Extract data points for the specified biomarker
  const dataPoints: DataPoint[] = analyses
    .map(analysis => {
      const result = analysis.results?.find((r: any) => r.biomarkerName === biomarkerName);
      if (!result || result.hisValue === 'N/A') return null;

      const value = parseFloat(result.hisValue);
      if (isNaN(value)) return null;

      const date = analysis.lab_test_date || analysis.analysis_date;
      return {
        date,
        value,
        displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    })
    .filter((dp): dp is DataPoint => dp !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort oldest to newest
    .reduce((acc, curr) => {
      // Remove duplicates: keep only one entry per unique date
      const existingIndex = acc.findIndex(dp => dp.date === curr.date);
      if (existingIndex === -1) {
        acc.push(curr);
      }
      return acc;
    }, [] as DataPoint[]);

  if (dataPoints.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No trend data available for {biomarkerName}
        </CardContent>
      </Card>
    );
  }

  // Calculate trend
  const firstValue = dataPoints[0].value;
  const lastValue = dataPoints[dataPoints.length - 1].value;
  const percentChange = ((lastValue - firstValue) / firstValue) * 100;
  const trend = percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable';

  // Normalize values for visualization (0-100 scale)
  const values = dataPoints.map(dp => dp.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1; // Prevent division by zero

  const normalizedPoints = dataPoints.map(dp => ({
    ...dp,
    normalized: ((dp.value - minValue) / range) * 100,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{biomarkerName}</CardTitle>
          <div className="flex items-center gap-2">
            {trend === 'up' && (
              <Badge variant="default" className="gap-1 bg-orange-500">
                <TrendingUp className="h-3 w-3" />
                +{percentChange.toFixed(1)}%
              </Badge>
            )}
            {trend === 'down' && (
              <Badge variant="default" className="gap-1 bg-blue-500">
                <TrendingDown className="h-3 w-3" />
                {percentChange.toFixed(1)}%
              </Badge>
            )}
            {trend === 'stable' && (
              <Badge variant="outline" className="gap-1">
                <Minus className="h-3 w-3" />
                Stable
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Simple mini chart */}
        <div className="space-y-4">
          {/* Chart area */}
          <div className="relative h-40 bg-muted/30 rounded-lg p-6">            
            {/* Data points and line */}
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" strokeWidth="0.2" opacity="0.2" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.2" opacity="0.2" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" strokeWidth="0.2" opacity="0.2" vectorEffect="non-scaling-stroke" />
              
              {/* Connect the dots with a line */}
              {normalizedPoints.length > 1 && (
                <polyline
                  points={normalizedPoints
                    .map((dp, i) => {
                      const x = (i / (normalizedPoints.length - 1)) * 100;
                      const y = 100 - dp.normalized;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  stroke="hsl(var(--primary))"
                  strokeWidth="1"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              
              {/* Data points */}
              {normalizedPoints.map((dp, i) => {
                const x = normalizedPoints.length === 1 ? 50 : (i / (normalizedPoints.length - 1)) * 100;
                const y = 100 - dp.normalized;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="1.5"
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          </div>

          {/* Data table */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {dataPoints.map((dp, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm p-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <span className="text-muted-foreground">{dp.displayDate}</span>
                <span className="font-mono font-semibold">{dp.value.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Min: <strong>{minValue.toFixed(2)}</strong></span>
            <span>Max: <strong>{maxValue.toFixed(2)}</strong></span>
            <span>Latest: <strong>{lastValue.toFixed(2)}</strong></span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface BiomarkerTrendsGridProps {
  analyses: Analysis[];
  biomarkerNames?: string[];
}

export function BiomarkerTrendsGrid({ analyses, biomarkerNames }: BiomarkerTrendsGridProps) {
  // If no biomarker names specified, find the most commonly measured ones
  const defaultBiomarkers = biomarkerNames || extractCommonBiomarkers(analyses);

  if (analyses.length < 2) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          At least 2 analyses are needed to show trends
        </CardContent>
      </Card>
    );
  }

  if (defaultBiomarkers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Not enough data to show trends. Need at least 2 analyses with measurable biomarkers.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Showing {defaultBiomarkers.length} biomarker{defaultBiomarkers.length !== 1 ? 's' : ''} measured in at least 2 analyses
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {defaultBiomarkers.map(biomarkerName => (
          <BiomarkerTrends
            key={biomarkerName}
            analyses={analyses}
            biomarkerName={biomarkerName}
          />
        ))}
      </div>
    </div>
  );
}

// Helper function to find commonly measured biomarkers
function extractCommonBiomarkers(analyses: Analysis[]): string[] {
  const biomarkerCounts: Record<string, number> = {};

  analyses.forEach(analysis => {
    if (analysis.results && Array.isArray(analysis.results)) {
      analysis.results.forEach((result: any) => {
        if (result.hisValue !== 'N/A' && !isNaN(parseFloat(result.hisValue))) {
          biomarkerCounts[result.biomarkerName] = (biomarkerCounts[result.biomarkerName] || 0) + 1;
        }
      });
    }
  });

  // Return all biomarkers measured at least twice, sorted by frequency
  return Object.entries(biomarkerCounts)
    .filter(([_, count]) => count >= 2) // Must appear in at least 2 analyses
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

