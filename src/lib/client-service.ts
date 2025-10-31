import { supabase, type Client } from './supabase';

export async function getAllClients(): Promise<Client[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
  
  return data || [];
}

export async function getActiveClients(): Promise<Client[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('status', 'active')
    .order('full_name');
  
  if (error) {
    console.error('Error fetching active clients:', error);
    return [];
  }
  
  return data || [];
}

export async function getPastClients(): Promise<Client[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('status', 'past')
    .order('full_name');
  
  if (error) {
    console.error('Error fetching past clients:', error);
    return [];
  }
  
  return data || [];
}

export async function getClient(id: string): Promise<Client | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching client:', error);
    return null;
  }
  
  return data;
}

export async function createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client | null> {
  if (!supabase) return null;

  // Get current user ID
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('No authenticated user');
    return null;
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...client, user_id: user.id })
    .select()
    .single();

  if (error) {
    console.error('Error creating client:', error);
    return null;
  }

  return data;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  if (!supabase) return null;
  
  const { data, error} = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating client:', error);
    return null;
  }
  
  return data;
}

export async function deleteClient(id: string): Promise<boolean> {
  if (!supabase) return false;
  
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting client:', error);
    return false;
  }
  
  return true;
}

export async function archiveClient(id: string): Promise<Client | null> {
  return updateClient(id, { status: 'past' });
}

export async function reactivateClient(id: string): Promise<Client | null> {
  return updateClient(id, { status: 'active' });
}

/**
 * Merge two clients - moves all lab tests from sourceId to targetId, then archives source
 * Use this to fix duplicate clients (e.g., "Ashley Lebedev" and "Ashley Leebody")
 */
export async function mergeClients(targetId: string, sourceId: string): Promise<boolean> {
  if (!supabase) return false;
  
  try {
    // Update all lab_tests to point to target client
    const { error: updateError } = await supabase
      .from('lab_tests')
      .update({ client_id: targetId })
      .eq('client_id', sourceId);
    
    if (updateError) throw updateError;
    
    // Archive the source client
    await archiveClient(sourceId);
    
    return true;
  } catch (error) {
    console.error('Error merging clients:', error);
    return false;
  }
}

