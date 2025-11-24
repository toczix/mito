import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Activity, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { AuthService } from '../lib/auth-service';

interface LoginProps {
  onLogin: (role?: 'practitioner' | 'admin') => void;
  onSwitchToSignup: () => void;
  onSwitchToForgotPassword: () => void;
}

export function Login({ onLogin, onSwitchToSignup, onSwitchToForgotPassword }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { user } = await AuthService.signIn(email, password);
      const role = user?.user_metadata?.role || 'practitioner';
      
      toast.success(`Welcome back${user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!`);
      onLogin(role === 'admin' ? 'admin' : 'practitioner');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
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
            <h1 className="text-center text-xl mb-0.5">Welcome to Mito</h1>
            <p className="text-center text-muted-foreground text-xs mb-4">
              Biomarker analysis for health practitioners
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <button
                  type="button"
                  className="text-primary hover:underline text-xs"
                  onClick={onSwitchToForgotPassword}
                >
                  Forgot?
                </button>
              </div>
              <div className="relative mt-1">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 h-9 rounded-lg text-xs"
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
                  'Sign In'
                )}
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="text-center pt-1"
            >
              <div className="text-[10px] text-muted-foreground">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="text-primary hover:underline text-[10px]"
                  onClick={onSwitchToSignup}
                >
                  Sign up
                </button>
              </div>
            </motion.div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
