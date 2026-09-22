/* ---------------------------------------------------------------------------
   Auth context — manages Supabase authentication state.
   Provides login, register, logout, and session persistence.
--------------------------------------------------------------------------- */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabase, isSupabaseConfigured, type DbProfile } from "../lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  profile: DbProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const supabase = getSupabase();
  const configured = isSupabaseConfigured();

  /* --------------------------- initial session ---------------------------- */
  useEffect(() => {
    if (!supabase) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id);
        setState({
          user: session.user,
          profile: null,
          loading: false,
          error: null,
        });
      } else {
        setState({ user: null, profile: null, loading: false, error: null });
      }
    }).catch(() => {
      setState({ user: null, profile: null, loading: false, error: null });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          loadProfile(session.user.id);
          setState({
            user: session.user,
            profile: null,
            loading: false,
            error: null,
          });
        } else if (event === "SIGNED_OUT") {
          setState({ user: null, profile: null, loading: false, error: null });
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  /* --------------------------- load profile ------------------------------- */
  const loadProfile = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (!error && data) {
        setState((s) => ({ ...s, profile: data }));
      }
    } catch {
      // Profile load failure is non-critical
    }
  };

  /* --------------------------- auth actions ------------------------------- */
  const login = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    setState((s) => ({ ...s, error: null, loading: true }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({ ...s, error: error.message, loading: false }));
      throw error;
    }
    // Session will be loaded via onAuthStateChange
  };

  const register = async (email: string, password: string, displayName?: string) => {
    if (!supabase) throw new Error("Supabase not configured");
    setState((s) => ({ ...s, error: null, loading: true }));
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email },
      },
    });
    if (error) {
      setState((s) => ({ ...s, error: error.message, loading: false }));
      throw error;
    }
    // If email confirmation is disabled, session will be loaded via onAuthStateChange
    // Otherwise, user needs to confirm email first
  };

  const logout = async () => {
    if (!supabase) return;
    setState((s) => ({ ...s, loading: true }));
    await supabase.auth.signOut();
    setState({ user: null, profile: null, loading: false, error: null });
  };

  const clearError = () => setState((s) => ({ ...s, error: null }));

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    clearError,
    isConfigured: configured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
