import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity, Mail, Loader2 } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      setMessage({ type: 'error', text: 'Supabase is not configured. Please check your environment variables.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({
          type: 'success',
          text: 'Check your email for the magic link!'
        });
        setEmail('');
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Activity className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Mito Analysis</h1>
          <p className="text-muted-foreground">Clinical Pathology Analysis Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border rounded-lg p-8 shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 text-center">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="practitioner@example.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending magic link...
                </>
              ) : (
                'Send Magic Link'
              )}
            </button>
          </form>

          {/* Message Display */}
          {message && (
            <div
              className={`mt-4 p-3 rounded-md text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Info Text */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Enter your email to receive a magic link.</p>
            <p className="mt-1">No password required.</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          For informational purposes only. Always consult with healthcare professionals.
        </p>
      </div>
    </div>
  );
}
