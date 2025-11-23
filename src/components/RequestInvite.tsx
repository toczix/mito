import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Activity, Mail, User as UserIcon, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';

interface RequestInviteProps {
  onBackToSignup: () => void;
  onBackToLogin: () => void;
}

export function RequestInvite({ onBackToSignup, onBackToLogin }: RequestInviteProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    setRequestSent(true);
    toast.success('Invitation request submitted!');
    setIsLoading(false);
  };

  if (requestSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-card rounded-2xl shadow-2xl p-6 border border-border">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex items-center justify-center mb-4"
            >
              <div className="bg-green-500/10 p-4 rounded-full">
                <Send className="w-12 h-12 text-green-500" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-center text-xl mb-2">Request Submitted!</h1>
              <p className="text-center text-muted-foreground text-sm mb-6">
                We've received your invitation request. Our team will review it and send you an invitation code within 24-48 hours.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="text-xs text-muted-foreground">
                  We'll send the invitation code to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <Button
                onClick={onBackToSignup}
                className="w-full h-9 rounded-lg bg-gradient-to-br from-[#1c1c1e] via-[#2c2c2e] to-[#1c1c1e] hover:from-[#2c2c2e] hover:via-[#3c3c3e] hover:to-[#2c2c2e] text-white shadow-lg text-xs"
              >
                Back to Signup
              </Button>
              <Button
                onClick={onBackToLogin}
                variant="outline"
                className="w-full h-9 rounded-lg text-xs"
              >
                Back to Login
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-2xl shadow-2xl p-6 border border-border">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="flex items-center justify-center mb-4"
          >
            <div className="bg-primary/10 p-2.5 rounded-xl">
              <Activity className="w-8 h-8 text-primary" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-center text-xl mb-0.5">Request Invitation</h1>
            <p className="text-center text-muted-foreground text-xs mb-4">
              Tell us about yourself to receive an invite
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Label htmlFor="fullName" className="text-xs">Full Name</Label>
              <div className="relative mt-1">
                <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Dr. Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9 h-9 rounded-lg text-xs"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
            >
              <Label htmlFor="email" className="text-xs">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="practitioner@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-9 rounded-lg text-xs"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Label htmlFor="organization" className="text-xs">Organization</Label>
              <div className="relative mt-1">
                <Input
                  id="organization"
                  type="text"
                  placeholder="Your clinic or organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="h-9 rounded-lg text-xs"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 }}
            >
              <Label htmlFor="message" className="text-xs">Why do you want to join Mito?</Label>
              <div className="relative mt-1">
                <textarea
                  id="message"
                  placeholder="Tell us a bit about your practice and how you plan to use Mito..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full min-h-[80px] px-3 py-2 text-xs rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="pt-1"
            >
              <Button
                type="submit"
                className="w-full h-9 rounded-lg bg-gradient-to-br from-[#1c1c1e] via-[#2c2c2e] to-[#1c1c1e] hover:from-[#2c2c2e] hover:via-[#3c3c3e] hover:to-[#2c2c2e] text-white shadow-lg text-xs"
                disabled={isLoading}
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Activity className="w-3.5 h-3.5" />
                  </motion.div>
                ) : (
                  'Request Invitation'
                )}
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="text-center pt-1 space-y-1"
            >
              <div className="text-[10px] text-muted-foreground">
                Already have a code?{' '}
                <button
                  type="button"
                  className="text-primary hover:underline text-[10px]"
                  onClick={onBackToSignup}
                >
                  Go to signup
                </button>
              </div>
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                onClick={onBackToLogin}
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Login
              </button>
            </motion.div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
