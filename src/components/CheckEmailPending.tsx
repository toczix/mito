import { motion } from 'framer-motion';
import { Mail, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface CheckEmailPendingProps {
  email: string;
  onBackToLogin: () => void;
}

export function CheckEmailPending({ email, onBackToLogin }: CheckEmailPendingProps) {
  const [isResending, setIsResending] = useState(false);

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      // We can't resend without a session, so just show a message
      toast.info('Please check your email inbox and spam folder for the verification link.');
    } catch (error: any) {
      toast.error('Please try signing up again if you did not receive an email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="flex items-center justify-center mb-6"
          >
            <div className="bg-blue-500/20 p-4 rounded-full">
              <Mail className="w-12 h-12 text-blue-400" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-6"
          >
            <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
            <p className="text-sm text-muted-foreground">
              We've sent a verification link to
            </p>
            <p className="text-sm font-medium text-foreground mt-1">
              {email}
            </p>
          </motion.div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6"
          >
            <div className="flex items-start gap-3">
              <ArrowRight className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200 space-y-2">
                <p>1. Check your inbox for an email from Mito</p>
                <p>2. Click the verification link in the email</p>
                <p>3. You'll be redirected to log in</p>
                <p className="text-[10px] text-blue-300 mt-2">
                  Don't see it? Check your spam or junk folder
                </p>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="space-y-3"
          >
            <Button
              onClick={handleResendEmail}
              disabled={isResending}
              variant="outline"
              className="w-full"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Didn't receive it?
                </>
              )}
            </Button>

            <button
              onClick={onBackToLogin}
              className="w-full text-sm text-primary hover:underline"
            >
              Back to Login
            </button>
          </motion.div>
        </div>

        {/* Helper text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-muted-foreground mt-4"
        >
          After verifying your email, you can log in to access your dashboard
        </motion.p>
      </motion.div>
    </div>
  );
}
