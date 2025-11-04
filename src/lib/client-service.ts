import { supabase, type Client } from './supabase';
import { handleDatabaseError } from './error-handler';

export async function getAllClients(): Promise<Client[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    handleDatabaseError(error, 'clients', 'select_all');
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
    handleDatabaseError(error, 'clients', 'select_active');
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
    handleDatabaseError(error, 'clients', 'select_past');
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
    handleDatabaseError(error, 'clients', 'select_one');
    return null;
  }
  
  return data;
}

export async function createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client | null> {
  if (!supabase) return null;

  // Get current user ID (if auth is enabled)
  let userId: string | undefined;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    userId = user.id;
  }

  // Build insert data - only include user_id if we have it
  const insertData: any = { ...client };
  if (userId) {
    insertData.user_id = userId;
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    handleDatabaseError(error, 'clients', 'insert');
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
    handleDatabaseError(error, 'clients', 'update');
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
    handleDatabaseError(error, 'clients', 'delete');
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

