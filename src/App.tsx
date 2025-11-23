import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ClientsPage } from '@/pages/ClientsPage';
import { BenchmarksPage } from '@/pages/BenchmarksPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Login } from '@/components/Login';
import { AdminLogin } from '@/components/AdminLogin';
import { PractitionerLogin } from '@/components/PractitionerLogin';
import { ClientLogin } from '@/components/ClientLogin';
import { Signup } from '@/components/Signup';
import { ForgotPassword } from '@/components/ForgotPassword';
import { RequestInvite } from '@/components/RequestInvite';
import { isAuthDisabled } from '@/lib/supabase';
import { AuthService, type AuthUser } from '@/lib/auth-service';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Activity, FileText, Users, Settings as SettingsIcon, LogOut, Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

function App() {
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip auth check if disabled
    if (isAuthDisabled) {
      setLoading(false);
      return;
    }

    // Check for existing session
    AuthService.getCurrentUser()
      .then((currentUser) => {
        if (currentUser) {
          setUser(currentUser);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = AuthService.onAuthStateChange((authUser) => {
      setUser(authUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
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

  // Show authentication views if not logged in (unless auth is disabled)
  const isAuthPath = location.pathname.startsWith('/login') || 
                     location.pathname.startsWith('/signup') || 
                     location.pathname.startsWith('/forgot-password') ||
                     location.pathname.startsWith('/request-invite');

  if (!isAuthDisabled && !user && isAuthPath) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login onLogin={() => window.location.href = '/'} onSwitchToSignup={() => window.location.href = '/signup'} onSwitchToForgotPassword={() => window.location.href = '/forgot-password'} />} />
          <Route path="/login/admin" element={<AdminLogin onLogin={() => window.location.href = '/'} onSwitchToForgotPassword={() => window.location.href = '/forgot-password'} />} />
          <Route path="/login/practitioner" element={<PractitionerLogin onLogin={() => window.location.href = '/'} onSwitchToSignup={() => window.location.href = '/signup'} onSwitchToForgotPassword={() => window.location.href = '/forgot-password'} />} />
          <Route path="/login/client" element={<ClientLogin onLogin={() => window.location.href = '/'} onSwitchToForgotPassword={() => window.location.href = '/forgot-password'} />} />
          <Route path="/signup" element={<Signup onSignup={() => window.location.href = '/'} onSwitchToLogin={() => window.location.href = '/login'} onSwitchToRequestInvite={() => window.location.href = '/request-invite'} />} />
          <Route path="/forgot-password" element={<ForgotPassword onBackToLogin={() => window.location.href = '/login'} />} />
          <Route path="/request-invite" element={<RequestInvite onBackToSignup={() => window.location.href = '/signup'} onBackToLogin={() => window.location.href = '/login'} />} />
        </Routes>
        <Toaster />
      </ErrorBoundary>
    );
  }

  // Redirect to login if not authenticated and not on auth page
  if (!isAuthDisabled && !user) {
    window.location.href = '/login';
    return null;
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
              {user && (
                <div className="flex items-center gap-3 pl-4 border-l">
                  <div className="text-sm text-right">
                    <p className="text-muted-foreground">Signed in as</p>
                    <p className="font-medium">{user.email}</p>
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
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
