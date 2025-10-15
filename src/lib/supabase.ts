import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Types
export interface Practitioner {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  practitioner_id: string;
  service_name: string;
  encrypted_key: string;
  created_at: string;
  updated_at: string;
}

export interface CustomBenchmark {
  id: string;
  practitioner_id: string;
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
  practitioner_id: string;
  full_name: string;
  email: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  status: 'active' | 'past';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: string;
  practitioner_id: string;
  client_id: string;
  analysis_date: string;
  results: any; // JSON biomarker results
  pdf_files: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Helper function to get current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

// Helper function to check if user is authenticated
export async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

