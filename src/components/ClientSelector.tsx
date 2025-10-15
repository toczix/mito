import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { UserCircle, UserPlus, ChevronRight } from 'lucide-react';
import { isSupabaseEnabled } from '@/lib/supabase';
import type { Client } from '@/lib/supabase';
import { getActiveClients, createClient } from '@/lib/client-service';

interface ClientSelectorProps {
  onClientSelected: (clientId: string, clientName: string) => void;
}

export function ClientSelector({ onClientSelected }: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Quick create form
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientGender, setNewClientGender] = useState<'male' | 'female' | 'other'>('male');

  useEffect(() => {
    if (isSupabaseEnabled) {
      loadClients();
    }
  }, []);

  async function loadClients() {
    setLoading(true);
    const activeClients = await getActiveClients();
    setClients(activeClients);
    setLoading(false);
  }

  async function handleQuickCreate() {
    if (!newClientName.trim()) {
      alert('Please enter a client name');
      return;
    }

    const newClient = await createClient({
      full_name: newClientName,
      email: newClientEmail || null,
      gender: newClientGender,
      status: 'active',
      tags: [],
      date_of_birth: null,
      notes: null,
    });

    if (newClient) {
      await loadClients();
      setSelectedClientId(newClient.id);
      setIsCreateDialogOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientGender('male');
    }
  }

  function handleContinue() {
    if (!selectedClientId) {
      alert('Please select a client');
      return;
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (selectedClient) {
      onClientSelected(selectedClientId, selectedClient.full_name);
    }
  }

  // If Supabase not enabled, allow proceeding without client
  if (!isSupabaseEnabled) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-6 w-6" />
            Client Selection (Optional)
          </CardTitle>
          <CardDescription>
            Supabase is not configured. You can still analyze PDFs, but results won't be saved to a client record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => onClientSelected('', 'Anonymous')} className="gap-2">
            Continue Without Client
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-6 w-6" />
          Select Client
        </CardTitle>
        <CardDescription>
          Choose which client this analysis is for. Results will be automatically saved to their record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading clients...</p>
        ) : (
          <>
            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client-select">Active Clients</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-select" className="w-full">
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No active clients found.<br />
                      Create one below to get started.
                    </div>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <span>{client.full_name}</span>
                          {client.gender && (
                            <Badge variant="outline" className="ml-2 capitalize text-xs">
                              {client.gender}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Create */}
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 border-t" />
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <UserPlus className="h-4 w-4" />
                  Create New Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Quick Create Client</DialogTitle>
                  <DialogDescription>
                    Add a new client quickly. You can add more details later in the Clients tab.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="quick-name">Full Name *</Label>
                    <Input
                      id="quick-name"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick-email">Email</Label>
                    <Input
                      id="quick-email"
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick-gender">Gender</Label>
                    <Select
                      value={newClientGender}
                      onValueChange={(value: 'male' | 'female' | 'other') => setNewClientGender(value)}
                    >
                      <SelectTrigger id="quick-gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleQuickCreate}>Create & Select</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Continue Button */}
            <Button
              onClick={handleContinue}
              disabled={!selectedClientId}
              className="w-full gap-2"
              size="lg"
            >
              Continue with {selectedClientId ? clients.find(c => c.id === selectedClientId)?.full_name : 'Selected Client'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

