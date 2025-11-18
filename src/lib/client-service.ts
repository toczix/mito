import { supabase, isAuthDisabled, type Client } from './supabase';
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

/**
 * Search clients by name (fast, server-side filtering)
 * Returns clients whose name contains the search term (case-insensitive)
 */
export async function searchClientsByName(searchTerm: string, limit: number = 50): Promise<Client[]> {
  if (!supabase || !searchTerm) return [];

  // Normalize search term: remove special chars, extra spaces
  const normalized = searchTerm
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();

  if (!normalized) return [];

  // Split into words for flexible matching (e.g., "John Smith" or "Smith John")
  const words = normalized.split(/\s+/);

  // Build query: Use ilike for case-insensitive pattern matching
  // Search for each word in the name
  let query = supabase
    .from('clients')
    .select('*');

  // Apply filters for each word (all must match)
  words.forEach(word => {
    query = query.ilike('full_name', `%${word}%`);
  });

  // Limit results and order by name
  const { data, error } = await query
    .limit(limit)
    .order('full_name');

  if (error) {
    handleDatabaseError(error, 'clients', 'search_by_name');
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

  // Get current user ID from cached session with timeout to prevent infinite hang
  // Skip auth check entirely if auth is disabled
  let userId: string | undefined;

  if (!isAuthDisabled) {
    try {
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getSession timeout after 5 seconds')), 5000)
      );

      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
      if (session?.user) {
        userId = session.user.id;
        console.log('✅ Got user ID from session:', userId);
      } else {
        console.warn('⚠️ No session found - will attempt insert without user_id');
      }
    } catch (error) {
      console.error('❌ getSession failed or timed out:', error);
      // Continue without userId - RLS is disabled, so this is fine
      console.warn('⚠️ Continuing without user_id (RLS disabled)');
    }
  } else {
    console.log('🔓 Auth disabled - skipping session check, user_id will be null');
  }

  // Build insert data - only include user_id if we have it
  // When auth is disabled, user_id will be null (which is now allowed)
  const insertData: any = { ...client };
  if (userId) {
    insertData.user_id = userId;
  } else {
    insertData.user_id = null;
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

