import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ShieldAlert, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { AuthService } from '../lib/auth-service';

interface VerificationBannerProps {
  userEmail: string;
}

export function VerificationBanner({ userEmail }: VerificationBannerProps) {
  const [isResending, setIsResending] = useState(false);
  const [emailSent, setEmailSent] = useState(true); // True because initial signup sends email

  const handleVerifyEmail = async () => {
    setIsResending(true);
    try {
      await AuthService.resendVerificationEmail();
      setEmailSent(true);
      toast.success('Verification email sent! Please check your inbox and click the link to verify.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification email');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-2 border-amber-500/40 rounded-xl p-6 mb-6 shadow-lg"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            <div className="bg-amber-500/20 p-3 rounded-full">
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Email Verification Required
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              To unlock full access to biomarker analysis and all features, please verify your email address: 
              <span className="block font-medium text-foreground mt-1">{userEmail}</span>
            </p>
            
            {emailSent ? (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-200">
                    We've sent a verification link to your email. Click the link in the email to verify your account.
                    Don't see it? Check your spam folder.
                  </p>
                </div>
              </div>
            ) : null}
            
            <div className="flex gap-3">
              <Button
                onClick={handleVerifyEmail}
                disabled={isResending}
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {isResending ? (
                  <>
                    <Mail className="w-4 h-4 mr-2 animate-pulse" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {emailSent ? 'Resend Verification Email' : 'Send Verification Email'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
