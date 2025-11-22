import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ClientsPage } from '@/pages/ClientsPage';
import { BenchmarksPage } from '@/pages/BenchmarksPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { supabase, isAuthDisabled } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { handleAuthError } from '@/lib/error-handler';
import { logAuditSuccess, logAuditError } from '@/lib/audit-logger';
import { Activity, FileText, Users, Settings as SettingsIcon, LogOut, Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

function App() {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip auth check if disabled
    if (isAuthDisabled) {
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    // Initialize auth with proper async handling
    const initializeAuth = async () => {
      // Check for PKCE code in query params (magic link callback)
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');

      if (code && supabase) {
        console.log('🔐 Detected PKCE auth code, exchanging for session...');
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('❌ Failed to exchange code for session:', error);
            setSession(null);
            setLoading(false);
            return;
          }
          
          console.log('✅ Session established successfully');
          // Clear code from URL
          window.history.replaceState(null, '', window.location.pathname);
          
          // Set the session from the exchange result
          setSession(data.session);
          setLoading(false);
          return; // Done - no need to check again
        } catch (error) {
          console.error('❌ Error during PKCE exchange:', error);
          setSession(null);
          setLoading(false);
          return;
        }
      }

      // Get initial session after handling callback (only if no code was processed)
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Checking for session...');
        const startTime = Date.now();
        
        // Race between session check and 3-second timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }, error: any }>((resolve) =>
          setTimeout(() => {
            console.warn('⏰ Session check timed out after 3s, proceeding without session');
            resolve({ data: { session: null }, error: null });
          }, 3000)
        );
        
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        console.log(`📋 Session check completed in ${duration}ms:`, session ? 'exists' : 'none');
        
        if (error) {
          console.error('❌ Session check error:', error);
          setSession(null);
        } else {
          setSession(session);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('❌ Session check failed:', error);
        handleAuthError(error, 'get_session');
        setSession(null);
        setLoading(false);
      }
    };

    // Initialize auth without timeout (let it complete naturally)
    initializeAuth();

    // Listen for auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session ? 'session exists' : 'no session');
      setSession(session);

      // Log authentication events
      try {
        if (event === 'SIGNED_IN' && session) {
          await logAuditSuccess('login', 'auth');
        } else if (event === 'SIGNED_OUT') {
          await logAuditSuccess('logout', 'auth');
        }
      } catch (error) {
        console.error('Error logging auth event:', error);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      handleAuthError(error, 'sign_out');
      await logAuditError('logout', error, 'auth');
    }
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated (and Supabase is enabled)
  const enforceAuth = supabase && !isAuthDisabled;

  if (enforceAuth && !session) {
    return <LoginPage />;
  }

  const navItems = [
    { path: '/', label: 'Analysis', icon: FileText },
    { path: '/clients', label: 'Clients', icon: Users },
    { path: '/benchmarks', label: 'Benchmarks', icon: SettingsIcon },
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-8">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Mito Analysis</h1>
                <p className="text-sm text-muted-foreground">
                  Clinical Pathology Analysis Portal
                </p>
              </div>
            </div>

            {/* Navigation and User Info */}
            <div className="flex items-center gap-4">
              <nav className="flex gap-2">
              {navItems.map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path || 
                  (path !== '/' && location.pathname.startsWith(path));
                
                return (
                  <NavLink
                    key={path}
                    to={path}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-md transition-colors
                      ${isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{label}</span>
                  </NavLink>
                );
              })}
              </nav>

              {/* User Info & Logout */}
              {session && (
                <div className="flex items-center gap-3 pl-4 border-l">
                  <div className="text-sm text-right">
                    <p className="text-muted-foreground">Signed in as</p>
                    <p className="font-medium">{session.user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/clients/*" element={<ClientsPage />} />
          <Route path="/benchmarks" element={<BenchmarksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            Mito Clinical Pathology Analysis Portal | Powered by Claude AI
          </p>
          <p className="mt-2">
            For informational purposes only. Always consult with healthcare professionals.
          </p>
        </div>
      </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
