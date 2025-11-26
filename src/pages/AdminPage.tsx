import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  RefreshCw
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
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    pro_override: boolean;
    pro_override_until: string | null;
  } | null;
}

export function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
    fetchUsers();
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

      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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

      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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

  const getSubscriptionBadge = (user: UserData) => {
    if (!user.subscription) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400">
          No subscription
        </span>
      );
    }

    const { plan, status, pro_override } = user.subscription;

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
            Manage users and subscriptions
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  {users.filter(u => u.subscription?.plan === 'pro').length}
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
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Last Login</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
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
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {formatDate(user.last_sign_in_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
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
                                <X className="w-4 h-4 mr-1" />
                                Revoke
                              </>
                            )}
                          </Button>
                        ) : user.subscription?.plan !== 'pro' ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => grantProAccess(user.id, 1)}
                              disabled={updatingUser === user.id}
                              title="Grant 1 month free"
                            >
                              {updatingUser === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                '1m'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => grantProAccess(user.id, 12)}
                              disabled={updatingUser === user.id}
                              title="Grant 1 year free"
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
                            >
                              {updatingUser === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Gift className="w-4 h-4 mr-1" />
                                  1yr
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Paid Pro</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
