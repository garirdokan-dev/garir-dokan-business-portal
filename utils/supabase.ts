
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve environment variables if provided
const getEnvVar = (key: string): string => {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (metaEnv && metaEnv[key]) {
      return String(metaEnv[key]).trim();
    }
  } catch {
    // fallback if env access fails
  }
  return '';
};

// Project credentials provided for this application
const DEFAULT_SUPABASE_URL = 'https://iuizhowzdifnxnmkjbif.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1aXpob3d6ZGlmbnhubWtqYmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTMzNzEsImV4cCI6MjEwNDUyOTM3MX0.8iYk5b58Tfo0IpSSJfGe3URGhj6spF6tdyFvnjhkVy4';

export const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  SUPABASE_URL.startsWith('http')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;


