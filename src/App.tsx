import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ClientsPage } from '@/pages/ClientsPage';
import { BenchmarksPage } from '@/pages/BenchmarksPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Activity, FileText, Users, Settings as SettingsIcon } from 'lucide-react';

function App() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Analysis', icon: FileText },
    { path: '/clients', label: 'Clients', icon: Users },
    { path: '/benchmarks', label: 'Benchmarks', icon: SettingsIcon },
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Mito Analysis</h1>
              <p className="text-sm text-muted-foreground">
                Clinical Pathology Analysis Portal
              </p>
            </div>
          </div>

          {/* Navigation */}
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
  );
}

export default App;
