import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { AuthService } from '@/lib/auth-service';
import { 
  Users, 
  Crown, 
  Shield, 
  Mail, 
  Search,
  Gift,
  X,
  Loader2,
  RefreshCw,
  BarChart3,
  DollarSign,
  Activity,
  Pause,
  Play,
  Ban,
  RotateCcw,
  CreditCard,
  TrendingUp,
  FileText,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  subscription: {
    plan: string;
    status: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    pro_override: boolean;
    pro_override_until: string | null;
  } | null;
}

interface UsageStats {
  overall: {
    totalAnalyses: number;
    totalClients: number;
    totalUsers: number;
    analysesLast7Days: number;
    analysesLast30Days: number;
    proUsers: number;
    freeUsers: number;
    overrideUsers: number;
  };
  revenue: {
    mrr: number;
    totalRevenue: number;
    activeSubscriptions: number;
    charges: Array<{
      id: string;
      amount: number;
      currency: string;
      created: string;
      customerEmail: string | null;
    }>;
  };
  apiUsage: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCents: number;
    last30DaysCalls: number;
    last30DaysCostCents: number;
    last7DaysCalls: number;
    last7DaysCostCents: number;
    perUser: Record<string, {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costCents: number;
    }>;
  };
  perUser: Record<string, {
    analysisCount: number;
    clientCount: number;
    lastAnalysis: string | null;
    subscription: any;
  }>;
}

export function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    checkAdminAccess();
    fetchUsers();
    fetchStats();
  }, []);

  const checkAdminAccess = async () => {
    const user = await AuthService.getCurrentUser();
    if (!user || AuthService.getUserRole(user) !== 'admin') {
      toast.error('Admin access required');
      navigate('/');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase!.auth.getSession();
      
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const { data: { session } } = await supabase!.auth.getSession();
      
      if (!session) return;

      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch stats');
        return;
      }

      const data = await response.json();
      setStats(data);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load usage and revenue stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const grantProAccess = async (userId: string, months: number = 12) => {
    try {
      setUpdatingUser(userId);
      const { data: { session } } = await supabase!.auth.getSession();
      
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const overrideUntil = new Date();
      overrideUntil.setMonth(overrideUntil.getMonth() + months);

      const response = await fetch(`/api/admin/subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          override: true,
          overrideUntil: overrideUntil.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to grant Pro access');
      }

      toast.success(`Granted ${months} month${months > 1 ? 's' : ''} of free Pro access`);
      fetchUsers();
    } catch (error: any) {
      console.error('Error granting Pro:', error);
      toast.error(error.message || 'Failed to grant Pro access');
    } finally {
      setUpdatingUser(null);
    }
  };

  const revokeProAccess = async (userId: string) => {
    try {
      setUpdatingUser(userId);
      const { data: { session } } = await supabase!.auth.getSession();
      
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(`/api/admin/subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          override: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke Pro access');
      }

      toast.success('Pro access revoked');
      fetchUsers();
    } catch (error: any) {
      console.error('Error revoking Pro:', error);
      toast.error(error.message || 'Failed to revoke Pro access');
    } finally {
      setUpdatingUser(null);
    }
  };

  const performSubscriptionAction = async (userId: string, action: string) => {
    try {
      setUpdatingUser(userId);
      const { data: { session } } = await supabase!.auth.getSession();
      
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch('/api/admin/subscription-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, action }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} subscription`);
      }

      toast.success(data.message);
      fetchUsers();
      fetchStats();
    } catch (error: any) {
      console.error(`Error performing ${action}:`, error);
      toast.error(error.message || `Failed to ${action} subscription`);
    } finally {
      setUpdatingUser(null);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const getSubscriptionBadge = (user: UserData) => {
    if (!user.subscription) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400">
          No subscription
        </span>
      );
    }

    const { plan, status, pro_override } = user.subscription;

    if (status === 'paused') {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
          <Pause className="w-3 h-3" />
          Paused
        </span>
      );
    }

    if (status === 'canceled') {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center gap-1">
          <Ban className="w-3 h-3" />
          Canceled
        </span>
      );
    }

    if (pro_override) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center gap-1">
          <Gift className="w-3 h-3" />
          Free Pro
        </span>
      );
    }

    if (plan === 'pro' && status === 'active') {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Crown className="w-3 h-3" />
          Pro (Paid)
        </span>
      );
    }

    return (
      <span className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
        Free
      </span>
    );
  };

  const getUserUsage = (userId: string) => {
    return stats?.perUser[userId] || { analysisCount: 0, clientCount: 0, lastAnalysis: null };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage users, subscriptions, and view analytics
          </p>
        </div>
        <Button onClick={() => { fetchUsers(); fetchStats(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Revenue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-500/10">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{users.length}</div>
                    <div className="text-sm text-muted-foreground">Total Users</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <Crown className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {users.filter(u => u.subscription?.plan === 'pro' && u.subscription?.status === 'active').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Pro Users</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-purple-500/10">
                    <Gift className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {users.filter(u => u.subscription?.pro_override).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Free Pro Grants</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <CreditCard className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {users.filter(u => u.subscription?.stripe_subscription_id).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Paying Customers</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                View and manage all registered users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Subscription</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Usage</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const usage = getUserUsage(user.id);
                      const hasPaidSub = !!user.subscription?.stripe_subscription_id;
                      const isPaused = user.subscription?.status === 'paused';
                      const isCanceled = user.subscription?.status === 'canceled';
                      const cancelAtEnd = user.subscription?.cancel_at_period_end;

                      return (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Mail className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">{user.full_name || 'No name'}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              user.role === 'admin' 
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
                                : 'bg-green-500/10 text-green-600 dark:text-green-400'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {getSubscriptionBadge(user)}
                            {user.subscription?.pro_override && user.subscription?.pro_override_until && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Until {formatDate(user.subscription.pro_override_until)}
                              </div>
                            )}
                            {cancelAtEnd && (
                              <div className="text-xs text-orange-600 mt-1">
                                Cancels {formatDate(user.subscription?.current_period_end)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                <FileText className="w-3 h-3 text-muted-foreground" />
                                {usage.analysisCount} analyses
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Users className="w-3 h-3" />
                                {usage.clientCount} clients
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1 flex-wrap">
                              {user.subscription?.pro_override ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => revokeProAccess(user.id)}
                                  disabled={updatingUser === user.id}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                >
                                  {updatingUser === user.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <X className="w-3 h-3 mr-1" />
                                      Revoke
                                    </>
                                  )}
                                </Button>
                              ) : !hasPaidSub && user.subscription?.plan !== 'pro' ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => grantProAccess(user.id, 1)}
                                    disabled={updatingUser === user.id}
                                    title="Grant 1 month free"
                                  >
                                    1m
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => grantProAccess(user.id, 12)}
                                    disabled={updatingUser === user.id}
                                    title="Grant 1 year free"
                                    className="text-purple-600"
                                  >
                                    <Gift className="w-3 h-3 mr-1" />
                                    1yr
                                  </Button>
                                </>
                              ) : null}
                              
                              {hasPaidSub && !isCanceled && (
                                <>
                                  {isPaused ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => performSubscriptionAction(user.id, 'resume')}
                                      disabled={updatingUser === user.id}
                                      title="Resume subscription"
                                      className="text-green-600"
                                    >
                                      <Play className="w-3 h-3 mr-1" />
                                      Resume
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => performSubscriptionAction(user.id, 'pause')}
                                      disabled={updatingUser === user.id}
                                      title="Pause subscription"
                                      className="text-yellow-600"
                                    >
                                      <Pause className="w-3 h-3 mr-1" />
                                      Pause
                                    </Button>
                                  )}
                                  
                                  {cancelAtEnd ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => performSubscriptionAction(user.id, 'reactivate')}
                                      disabled={updatingUser === user.id}
                                      title="Reactivate subscription"
                                      className="text-green-600"
                                    >
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Reactivate
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => performSubscriptionAction(user.id, 'cancel_at_period_end')}
                                      disabled={updatingUser === user.id}
                                      title="Cancel at period end"
                                      className="text-orange-600"
                                    >
                                      <Clock className="w-3 h-3 mr-1" />
                                      Cancel
                                    </Button>
                                  )}
                                  
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (confirm('Are you sure you want to cancel immediately? This cannot be undone.')) {
                                        performSubscriptionAction(user.id, 'cancel');
                                      }
                                    }}
                                    disabled={updatingUser === user.id}
                                    title="Cancel immediately"
                                    className="text-red-600"
                                  >
                                    <Ban className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredUsers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No users match your search' : 'No users found'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-600" />
                    Claude API Costs
                  </CardTitle>
                  <CardDescription>Token usage and costs for biomarker extraction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency((stats.apiUsage?.totalCostCents || 0) / 100)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Cost</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency((stats.apiUsage?.last30DaysCostCents || 0) / 100)}
                      </div>
                      <div className="text-xs text-muted-foreground">Last 30 Days</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency((stats.apiUsage?.last7DaysCostCents || 0) / 100)}
                      </div>
                      <div className="text-xs text-muted-foreground">Last 7 Days</div>
                    </div>
                    <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {(stats.apiUsage?.totalCalls || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">Total API Calls</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between p-2 bg-white dark:bg-gray-900 rounded">
                      <span className="text-muted-foreground">Input Tokens:</span>
                      <span className="font-mono">{((stats.apiUsage?.totalInputTokens || 0) / 1000).toFixed(1)}K</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white dark:bg-gray-900 rounded">
                      <span className="text-muted-foreground">Output Tokens:</span>
                      <span className="font-mono">{((stats.apiUsage?.totalOutputTokens || 0) / 1000).toFixed(1)}K</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-blue-500/10">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stats.overall.totalAnalyses}</div>
                        <div className="text-sm text-muted-foreground">Total Analyses</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-green-500/10">
                        <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stats.overall.analysesLast7Days}</div>
                        <div className="text-sm text-muted-foreground">Last 7 Days</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-purple-500/10">
                        <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stats.overall.analysesLast30Days}</div>
                        <div className="text-sm text-muted-foreground">Last 30 Days</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-amber-500/10">
                        <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stats.overall.totalClients}</div>
                        <div className="text-sm text-muted-foreground">Total Clients</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Usage by User</CardTitle>
                  <CardDescription>Analyses, clients, and API costs per user</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Analyses</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Clients</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">API Calls</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">API Cost</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users
                          .sort((a, b) => {
                            const usageA = stats.perUser[a.id]?.analysisCount || 0;
                            const usageB = stats.perUser[b.id]?.analysisCount || 0;
                            return usageB - usageA;
                          })
                          .map((user) => {
                            const usage = stats.perUser[user.id] || { analysisCount: 0, clientCount: 0, lastAnalysis: null };
                            const apiUsage = stats.apiUsage?.perUser?.[user.id] || { calls: 0, costCents: 0 };
                            return (
                              <tr key={user.id} className="border-b hover:bg-muted/50">
                                <td className="py-3 px-4">
                                  <div className="font-medium">{user.full_name || user.email}</div>
                                  <div className="text-sm text-muted-foreground">{user.email}</div>
                                </td>
                                <td className="py-3 px-4 font-medium">{usage.analysisCount}</td>
                                <td className="py-3 px-4">{usage.clientCount}</td>
                                <td className="py-3 px-4 text-sm">{apiUsage.calls}</td>
                                <td className="py-3 px-4 text-sm font-mono text-orange-600">
                                  {apiUsage.costCents > 0 ? formatCurrency(apiUsage.costCents / 100) : '-'}
                                </td>
                                <td className="py-3 px-4">
                                  {getSubscriptionBadge(user)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Unable to load usage stats
            </div>
          )}
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-green-500/10">
                        <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{formatCurrency(stats.revenue.mrr)}</div>
                        <div className="text-sm text-muted-foreground">Monthly Recurring Revenue</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-blue-500/10">
                        <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{formatCurrency(stats.revenue.totalRevenue)}</div>
                        <div className="text-sm text-muted-foreground">Revenue (Last 30 Days)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-purple-500/10">
                        <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{stats.revenue.activeSubscriptions}</div>
                        <div className="text-sm text-muted-foreground">Active Subscriptions</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Payments from the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.revenue.charges.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.revenue.charges.map((charge) => (
                            <tr key={charge.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-4 text-sm">
                                {formatDate(charge.created)}
                              </td>
                              <td className="py-3 px-4">
                                {charge.customerEmail || 'Unknown'}
                              </td>
                              <td className="py-3 px-4 font-medium text-green-600">
                                {formatCurrency(charge.amount, charge.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions in the last 30 days
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Unable to load revenue data
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
