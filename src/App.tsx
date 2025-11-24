import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate, Navigate } from 'react-router-dom';
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
import { CheckEmailPending } from '@/components/CheckEmailPending';
import { isAuthDisabled } from '@/lib/supabase';
import { AuthService, type AuthUser } from '@/lib/auth-service';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FileText, Users, Settings as SettingsIcon, LogOut, Loader2, Moon, Sun } from 'lucide-react';
import { Toaster } from 'sonner';
import { useTheme } from '@/lib/theme-context';

// Wrapper components that call useNavigate themselves (inside Router context)
// Note: onLogin/onSignup handlers are empty - navigation happens via useEffect when user state updates
function LoginWrapper() {
  const navigate = useNavigate();
  return <Login 
    onLogin={() => {}} 
    onSwitchToSignup={() => navigate('/signup')} 
    onSwitchToForgotPassword={() => navigate('/forgot-password')} 
  />;
}

function AdminLoginWrapper() {
  const navigate = useNavigate();
  return <AdminLogin 
    onLogin={() => {}} 
    onSwitchToForgotPassword={() => navigate('/forgot-password')} 
  />;
}

function PractitionerLoginWrapper() {
  const navigate = useNavigate();
  return <PractitionerLogin 
    onLogin={() => {}} 
    onSwitchToSignup={() => navigate('/signup')} 
    onSwitchToForgotPassword={() => navigate('/forgot-password')} 
  />;
}

function ClientLoginWrapper() {
  const navigate = useNavigate();
  return <ClientLogin 
    onLogin={() => {}} 
    onSwitchToForgotPassword={() => navigate('/forgot-password')} 
  />;
}

function SignupWrapper() {
  const navigate = useNavigate();
  
  return <Signup 
    onSignup={() => {
      // Navigate to check-email with the email in the URL
      const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
      const email = emailInput?.value || '';
      navigate(`/check-email?email=${encodeURIComponent(email)}`, { replace: true });
    }}
    onSwitchToLogin={() => navigate('/login')} 
  />;
}

function ForgotPasswordWrapper() {
  const navigate = useNavigate();
  return <ForgotPassword onBackToLogin={() => navigate('/login')} />;
}

function CheckEmailWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = new URLSearchParams(location.search).get('email') || '';
  
  return <CheckEmailPending 
    email={email} 
    onBackToLogin={() => navigate('/login')} 
  />;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip auth check if disabled - return early before calling AuthService
    if (isAuthDisabled) {
      setLoading(false);
      return; // Exit effect immediately - don't call AuthService
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

    // Listen for auth changes (don't navigate here - let separate effect handle it)
    const { data: { subscription } } = AuthService.onAuthStateChange((authUser) => {
      setUser(authUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Separate effect to navigate when user becomes authenticated
  useEffect(() => {
    // Only navigate if auth is enabled, not loading, and user just became authenticated
    const isAuthPage = location.pathname.startsWith('/login') || 
                       location.pathname.startsWith('/signup') ||
                       location.pathname.startsWith('/forgot-password') ||
                       location.pathname.startsWith('/check-email');
    
    if (!isAuthDisabled && !loading && user && isAuthPage) {
      navigate('/', { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  const handleLogout = async () => {
    try {
      await AuthService.signOut();
      setUser(null);
      navigate('/login');
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
  if (!isAuthDisabled && !user) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginWrapper />} />
          <Route path="/login/admin" element={<AdminLoginWrapper />} />
          <Route path="/login/practitioner" element={<PractitionerLoginWrapper />} />
          <Route path="/login/client" element={<ClientLoginWrapper />} />
          <Route path="/signup" element={<SignupWrapper />} />
          <Route path="/forgot-password" element={<ForgotPasswordWrapper />} />
          <Route path="/check-email" element={<CheckEmailWrapper />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </ErrorBoundary>
    );
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
            {/* Logo */}
            <div className="flex items-center">
              <img src="/mito-logo.png" alt="Mito" className="h-24 w-auto" />
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
                <>
                  {/* Theme Toggle */}
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                </>
              )}

              {user && (
                <div className="flex items-center gap-3 pl-2 border-l">
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
      </div>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
