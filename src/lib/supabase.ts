import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Toggle authentication on/off via environment variable
// Set VITE_AUTH_DISABLED=true in .env to disable auth (default: enabled)
export const isAuthDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';

// Supabase can be enabled even when auth is disabled (for database/edge functions)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Disable auto-detection to prevent hanging
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'mito-auth-token'
      },
      global: {
        headers: {
          'x-application-name': 'mito-analysis'
        }
      }
    })
  : null;

export const isSupabaseEnabled = !!supabase;

// Database Types (Simplified - No Auth)
export interface Settings {
  id: string;
  claude_api_key: string | null;
  updated_at: string;
}

export interface CustomBenchmark {
  id: string;
  name: string;
  male_range: string | null;
  female_range: string | null;
  units: string[];
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  email: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  status: 'active' | 'past';
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: string;
  client_id: string;
  lab_test_date: string | null;  // Actual test date from lab report (YYYY-MM-DD)
  analysis_date: string;  // When uploaded/created
  results: any; // JSON biomarker results
  summary: any | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// API Key Management (per-user)
export async function getClaudeApiKey(): Promise<string | null> {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('settings')
    .select('claude_api_key')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching API key:', error);
    return null;
  }

  return data?.claude_api_key || null;
}

export async function saveClaudeApiKey(apiKey: string): Promise<boolean> {
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // First, check if settings exist for this user
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // Update existing settings
    const { error } = await supabase
      .from('settings')
      .update({ claude_api_key: apiKey, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating API key:', error);
      return false;
    }
  } else {
    // Create new settings for this user
    const { error } = await supabase
      .from('settings')
      .insert({
        user_id: user.id,
        claude_api_key: apiKey,
      });

    if (error) {
      console.error('Error creating settings:', error);
      return false;
    }
  }

  return true;
}

