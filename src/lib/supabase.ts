/* ---------------------------------------------------------------------------
   Supabase client — reads credentials from Vite environment variables.
   Never expose the service_role key in the frontend.
--------------------------------------------------------------------------- */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/* ---------------------------------------------------------------------------
   Database types — match the SQL schema
--------------------------------------------------------------------------- */
export interface DbProfile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCategory {
  id: string;
  user_id: string;
  mode: "study" | "other";
  name: string;
  description: string | null;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSession {
  id: string;
  user_id: string;
  mode: "study" | "other";
  category: string;
  topic: string;
  task: string;
  timer_type: "stopwatch" | "countdown";
  started_at: number;
  ended_at: number;
  duration: number;
  paused_ms: number;
  continues_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSegment {
  id: string;
  user_id: string;
  session_id: string;
  started_at: number;
  ended_at: number | null;
  duration: number;
  paused_ms: number;
  created_at: string;
  updated_at: string;
}

export interface DbLap {
  id: string;
  user_id: string;
  session_id: string;
  lap_number: number;
  timestamp: number;
  lap_duration: number;
  total_elapsed: number;
  remaining: number | null;
  created_at: string;
  updated_at: string;
}
