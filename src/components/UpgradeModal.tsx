import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, Loader2, X } from 'lucide-react';
import { createCheckoutSession } from '@/lib/subscription-service';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
  patientName?: string;
}

export function UpgradeModal({ open, onOpenChange, currentCount, patientName }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const url = await createCheckoutSession();
      if (url) {
        window.location.href = url;
      } else {
        alert('Failed to create checkout session. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      alert('Failed to create checkout session. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription className="text-base">
            {patientName 
              ? `You've used all ${currentCount} free analyses for ${patientName}.`
              : `You've reached the free trial limit of ${currentCount} analyses per patient.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Pricing Card */}
          <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-lg p-6 border border-violet-500/20">
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold">$29</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            
            <ul className="space-y-3">
              {[
                'Unlimited analyses per patient',
                'Full biomarker history & trends',
                'Priority processing',
                'Cancel anytime',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Button */}
          <Button 
            onClick={handleUpgrade} 
            className="w-full" 
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </>
            )}
          </Button>

          {/* Cancel button */}
          <Button 
            onClick={() => onOpenChange(false)} 
            variant="ghost" 
            className="w-full"
            disabled={loading}
          >
            <X className="mr-2 h-4 w-4" />
            Maybe later
          </Button>

          {/* Fine print */}
          <p className="text-xs text-muted-foreground text-center">
            Secure payment powered by Stripe. Cancel anytime from your account settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
