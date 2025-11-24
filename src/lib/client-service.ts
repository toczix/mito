import { supabase, isAuthDisabled, type Client } from './supabase';
import { handleDatabaseError } from './error-handler';

/**
 * Get current user ID from session
 * Returns null if auth is disabled or no session
 */
async function getCurrentUserId(): Promise<string | null> {
  if (!supabase || isAuthDisabled) return null;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch (error) {
    console.error('Failed to get user ID:', error);
    return null;
  }
}

export async function getAllClients(): Promise<Client[]> {
  if (!supabase) return [];

  const userId = await getCurrentUserId();
  
  // SECURITY: Fail closed - if auth is enabled but we can't get user ID, return empty
  if (!isAuthDisabled && !userId) {
    console.warn('⚠️ Auth enabled but no user ID - returning empty results');
    return [];
  }
  
  let query = supabase
    .from('clients')
    .select('*');
  
  // Filter by user_id if we have one
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });

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

  const userId = await getCurrentUserId();

  // SECURITY: Fail closed - if auth is enabled but we can't get user ID, return empty
  if (!isAuthDisabled && !userId) {
    console.warn('⚠️ Auth enabled but no user ID - returning empty results');
    return [];
  }

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

  // Filter by user_id if we have one
  if (userId) {
    query = query.eq('user_id', userId);
  }

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
  
  const userId = await getCurrentUserId();
  
  // SECURITY: Fail closed - if auth is enabled but we can't get user ID, return empty
  if (!isAuthDisabled && !userId) {
    console.warn('⚠️ Auth enabled but no user ID - returning empty results');
    return [];
  }
  
  let query = supabase
    .from('clients')
    .select('*')
    .eq('status', 'active');
  
  // Filter by user_id if we have one
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query.order('full_name');
  
  if (error) {
    handleDatabaseError(error, 'clients', 'select_active');
    return [];
  }
  
  return data || [];
}

export async function getPastClients(): Promise<Client[]> {
  if (!supabase) return [];
  
  const userId = await getCurrentUserId();
  
  // SECURITY: Fail closed - if auth is enabled but we can't get user ID, return empty
  if (!isAuthDisabled && !userId) {
    console.warn('⚠️ Auth enabled but no user ID - returning empty results');
    return [];
  }
  
  let query = supabase
    .from('clients')
    .select('*')
    .eq('status', 'past');
  
  // Filter by user_id if we have one
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query.order('full_name');
  
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

  console.log('📝 Creating new client:', client.full_name);

  // Get current user ID from cached session
  // Skip auth check entirely if auth is disabled
  let userId: string | undefined;

  if (!isAuthDisabled) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
        console.log('✅ Got user ID from session:', userId);
      } else {
        console.warn('⚠️ No session found - will attempt insert without user_id');
      }
    } catch (error) {
      console.error('❌ getSession failed:', error);
      // Continue without userId - user_id is nullable
      console.warn('⚠️ Continuing without user_id');
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

  console.log('🚀 Inserting client into database...');
  const { data, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to insert client:', error);
    handleDatabaseError(error, 'clients', 'insert');
    throw new Error(`Failed to create client: ${error.message}`);
  }

  console.log('✅ Client created successfully:', data.id);
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
  if (!supabase) {
    console.error('❌ Supabase not initialized');
    alert('Database not available. Please enable authentication to delete clients.');
    return false;
  }
  
  console.log(`🗑️ Attempting to delete client: ${id}`);
  
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('❌ Delete failed:', error);
    
    // Check if it's an RLS/auth error
    if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
      alert('Delete failed: Authentication required. Please enable authentication (set VITE_AUTH_DISABLED=false) to delete clients.');
    } else {
      alert(`Delete failed: ${error.message}`);
    }
    
    handleDatabaseError(error, 'clients', 'delete');
    return false;
  }
  
  console.log('✅ Client deleted successfully');
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

