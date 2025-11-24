import { motion } from 'framer-motion';
import { Mail, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
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

  const steps = [
    { text: 'Check your inbox for an email from Mito', icon: Mail },
    { text: 'Click the verification link in the email', icon: ArrowRight },
    { text: "You'll be redirected to log in", icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Header Section */}
          <div className="p-5 text-center border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center mb-3"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <div className="relative bg-gradient-to-br from-primary/20 to-primary/10 p-3 rounded-2xl border border-primary/20">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-xl mb-1.5">Check Your Email</h1>
              <p className="text-xs text-muted-foreground mb-0.5">
                We've sent a verification link to
              </p>
              <p className="text-xs font-medium text-primary">
                {email}
              </p>
            </motion.div>
          </div>

          {/* Steps Section */}
          <div className="p-5 space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <span className="text-[10px] font-medium text-primary">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-foreground">{step.text}</p>
                    </div>
                    <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Info Box */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-muted/30 border border-border/50 rounded-lg p-2.5"
            >
              <p className="text-[10px] text-muted-foreground text-center">
                Don't see it? Check your spam or junk folder
              </p>
            </motion.div>

            {/* Resend Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="pt-1"
            >
              <Button
                onClick={handleResendEmail}
                disabled={isResending}
                variant="outline"
                className="w-full h-9 rounded-lg border-border hover:bg-muted/50 transition-all text-xs"
              >
                {isResending ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="mr-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </motion.div>
                    Checking...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 mr-2" />
                    Didn't receive it?
                  </>
                )}
              </Button>
            </motion.div>

            {/* Back to Login */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              <button
                onClick={onBackToLogin}
                className="w-full text-xs text-primary hover:text-primary/80 transition-colors py-2"
              >
                ← Back to Login
              </button>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="px-5 py-3 bg-muted/20 border-t border-border"
          >
            <p className="text-[10px] text-center text-muted-foreground">
              After verifying your email, you can log in to access your dashboard
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
