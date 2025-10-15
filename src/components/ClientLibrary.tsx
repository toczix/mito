import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, UserPlus, Archive, ArchiveRestore, Trash2, Edit, Upload, Download } from 'lucide-react';
import { isSupabaseEnabled } from '@/lib/supabase';
import type { Client } from '@/lib/supabase';
import {
  getActiveClients,
  getPastClients,
  createClient,
  updateClient,
  deleteClient,
  archiveClient,
  reactivateClient,
} from '@/lib/client-service';

export function ClientLibrary() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    date_of_birth: '',
    gender: 'male' as 'male' | 'female' | 'other',
    notes: '',
  });

  useEffect(() => {
    loadClients();
  }, [activeTab]);

  async function loadClients() {
    setLoading(true);
    const data = activeTab === 'active' ? await getActiveClients() : await getPastClients();
    setClients(data);
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      full_name: '',
      email: '',
      date_of_birth: '',
      gender: 'male',
      notes: '',
    });
    setEditingClient(null);
  }

  function handleEdit(client: Client) {
    setEditingClient(client);
    setFormData({
      full_name: client.full_name,
      email: client.email || '',
      date_of_birth: client.date_of_birth || '',
      gender: client.gender || 'male',
      notes: client.notes || '',
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (editingClient) {
      // Update existing client
      await updateClient(editingClient.id, formData);
    } else {
      // Create new client
      await createClient({
        ...formData,
        status: 'active',
        tags: [],
      });
    }

    setIsDialogOpen(false);
    resetForm();
    loadClients();
  }

  async function handleArchive(client: Client) {
    if (client.status === 'active') {
      await archiveClient(client.id);
    } else {
      await reactivateClient(client.id);
    }
    loadClients();
  }

  async function handleDelete(client: Client) {
    if (confirm(`Are you sure you want to delete ${client.full_name}? This action cannot be undone.`)) {
      await deleteClient(client.id);
      loadClients();
    }
  }

  async function handleCsvImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV file appears to be empty');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      let imported = 0;
      let failed = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Required field check
        if (!row.full_name && !row.name) {
          failed++;
          continue;
        }

        const clientData = {
          full_name: row.full_name || row.name || '',
          email: row.email || null,
          date_of_birth: row.date_of_birth || row.dob || null,
          gender: (row.gender === 'male' || row.gender === 'female' || row.gender === 'other') 
            ? row.gender as 'male' | 'female' | 'other'
            : null,
          status: 'active' as const,
          notes: row.notes || null,
          tags: [],
        };

        const result = await createClient(clientData);
        if (result) {
          imported++;
        } else {
          failed++;
        }
      }

      alert(`Import complete!\n✅ Imported: ${imported}\n${failed > 0 ? `❌ Failed: ${failed}` : ''}`);
      loadClients();
    } catch (error) {
      console.error('CSV import error:', error);
      alert('Error importing CSV. Please check the file format.');
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  }

  function downloadCsvTemplate() {
    const template = 'full_name,email,date_of_birth,gender,notes\nJohn Doe,john@example.com,1990-01-15,male,First consultation\nJane Smith,jane@example.com,1985-06-22,female,Regular checkup';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'client-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!isSupabaseEnabled) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            Client Library
          </CardTitle>
          <CardDescription>
            Supabase is not configured. Please add your Supabase credentials to .env.local to enable client management.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              Client Library
            </CardTitle>
            <CardDescription>
              Manage your patient records and analysis history
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="hidden"
              id="csv-import"
              disabled={importing}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCsvTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              CSV Template
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => document.getElementById('csv-import')?.click()}
              disabled={importing}
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Importing...' : 'Import CSV'}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Client
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </DialogTitle>
                <DialogDescription>
                  Enter client information below
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value: 'male' | 'female' | 'other') =>
                        setFormData({ ...formData, gender: value })
                      }
                    >
                      <SelectTrigger id="gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingClient ? 'Update' : 'Create'} Client
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === 'active' ? 'default' : 'ghost'}
            className="rounded-b-none"
            onClick={() => setActiveTab('active')}
          >
            Active Clients ({clients.filter(c => c.status === 'active').length})
          </Button>
          <Button
            variant={activeTab === 'past' ? 'default' : 'ghost'}
            className="rounded-b-none"
            onClick={() => setActiveTab('past')}
          >
            Past Clients ({clients.filter(c => c.status === 'past').length})
          </Button>
        </div>

        {/* Client List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              No {activeTab} clients yet. Click "Add Client" to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <Card key={client.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{client.full_name}</h3>
                        <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                          {client.status}
                        </Badge>
                        {client.gender && (
                          <Badge variant="outline" className="capitalize">
                            {client.gender}
                          </Badge>
                        )}
                      </div>
                      
                      {client.email && (
                        <p className="text-sm text-muted-foreground">{client.email}</p>
                      )}
                      
                      {client.date_of_birth && (
                        <p className="text-sm text-muted-foreground">
                          DOB: {new Date(client.date_of_birth).toLocaleDateString()}
                        </p>
                      )}
                      
                      {client.notes && (
                        <>
                          <Separator className="my-2" />
                          <p className="text-sm text-muted-foreground italic">{client.notes}</p>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(client)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(client)}
                        title={client.status === 'active' ? 'Archive client' : 'Reactivate client'}
                      >
                        {client.status === 'active' ? (
                          <Archive className="h-4 w-4" />
                        ) : (
                          <ArchiveRestore className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(client)}
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

