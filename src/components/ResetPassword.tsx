import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ResetPasswordProps {
  onBackToLogin: () => void;
}

export function ResetPassword({ onBackToLogin }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsValidSession(false);
      return;
    }

    const supabaseClient = supabase;

    const initializeSession = async () => {
      console.log('Initializing password reset session...');
      console.log('URL hash:', window.location.hash);
      console.log('URL search:', window.location.search);

      // Check for PKCE flow code parameter (newer Supabase versions)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        console.log('Found PKCE code, exchanging for session...');
        try {
          const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            console.log('Session established from code');
            setIsValidSession(true);
            // Clear the code from URL
            window.history.replaceState(null, '', window.location.pathname);
            return;
          } else if (error) {
            console.error('Error exchanging code:', error);
          }
        } catch (e) {
          console.error('Error in code exchange:', e);
        }
      }

      // Check for hash tokens (older/implicit flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      console.log('Hash params - type:', type, 'hasAccessToken:', !!accessToken);

      if (accessToken && type === 'recovery') {
        console.log('Found hash tokens, setting session...');
        try {
          const { error } = await supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          if (!error) {
            console.log('Session established from hash tokens');
            setIsValidSession(true);
            window.history.replaceState(null, '', window.location.pathname);
            return;
          } else {
            console.error('Error setting session:', error);
          }
        } catch (e) {
          console.error('Error setting session from tokens:', e);
        }
      }

      // Fall back to checking existing session
      const { data: { session } } = await supabaseClient.auth.getSession();
      console.log('Existing session check:', !!session);
      setIsValidSession(!!session);
    };

    initializeSession();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, !!session);
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!supabase) {
      toast.error('Authentication not configured');
      return;
    }

    setIsLoading(true);
    console.log('Starting password update...');

    try {
      // First verify we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session before update:', !!session, session?.user?.email);
      
      if (!session) {
        toast.error('Session expired. Please request a new password reset link.');
        setIsLoading(false);
        return;
      }

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 15000);
      });

      console.log('Calling updateUser...');
      const updatePromise = supabase.auth.updateUser({ password });
      
      const result = await Promise.race([updatePromise, timeoutPromise]) as { data: any; error: any };
      console.log('Update result:', result);

      if (result.error) {
        console.error('Update error:', result.error);
        toast.error(result.error.message);
        setIsLoading(false);
      } else {
        console.log('Password updated successfully');
        setIsSuccess(true);
        toast.success('Password updated successfully!');
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Password update error:', error);
      toast.error(error.message || 'Failed to update password. Please try again.');
      setIsLoading(false);
    }
  };

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-card rounded-2xl shadow-2xl p-6 border border-border">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-500/10 p-4 rounded-full">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
            </div>
            <h1 className="text-center text-xl mb-2">Invalid or Expired Link</h1>
            <p className="text-center text-muted-foreground text-sm mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button
              onClick={onBackToLogin}
              variant="outline"
              className="w-full h-9 rounded-lg text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Login
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
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
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </motion.div>
            <h1 className="text-center text-xl mb-2">Password Updated!</h1>
            <p className="text-center text-muted-foreground text-sm mb-6">
              Your password has been successfully updated. You can now log in with your new password.
            </p>
            <Button
              onClick={onBackToLogin}
              className="w-full h-9 rounded-lg text-xs"
            >
              Continue to Login
            </Button>
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
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <Lock className="w-12 h-12 text-primary" />
            </div>
          </div>

          <h1 className="text-center text-xl mb-2">Set New Password</h1>
          <p className="text-center text-muted-foreground text-sm mb-6">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  className="h-9 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  className="h-9 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-9 rounded-lg text-xs"
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>

          <div className="mt-4">
            <Button
              onClick={onBackToLogin}
              variant="ghost"
              className="w-full h-9 rounded-lg text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Login
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
