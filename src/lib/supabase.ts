import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug: Log env vars (remove in production)
console.log('Supabase URL:', supabaseUrl ? '✓ Set' : '✗ Not set');
console.log('Supabase Key:', supabaseAnonKey ? '✓ Set' : '✗ Not set');

// Supabase is optional for beta - app works without it
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseEnabled = !!supabase;
console.log('Supabase Enabled:', isSupabaseEnabled);

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
  analysis_date: string;
  results: any; // JSON biomarker results
  summary: any | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Settings ID (singleton)
const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

// API Key Management
export async function getClaudeApiKey(): Promise<string | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('settings')
    .select('claude_api_key')
    .eq('id', SETTINGS_ID)
    .single();
  
  if (error) {
    console.error('Error fetching API key:', error);
    return null;
  }
  
  return data?.claude_api_key || null;
}

export async function saveClaudeApiKey(apiKey: string): Promise<boolean> {
  if (!supabase) return false;
  
  const { error } = await supabase
    .from('settings')
    .update({ claude_api_key: apiKey })
    .eq('id', SETTINGS_ID);
  
  if (error) {
    console.error('Error saving API key:', error);
    return false;
  }
  
  return true;
}

