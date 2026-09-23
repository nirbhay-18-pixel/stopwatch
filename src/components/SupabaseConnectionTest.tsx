import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { I } from "./ui";

interface ConnectionStatus {
  configured: boolean;
  connected: boolean;
  error: string | null;
  testing: boolean;
}

export function SupabaseConnectionTest() {
  const [status, setStatus] = useState<ConnectionStatus>({
    configured: false,
    connected: false,
    error: null,
    testing: false,
  });

  useEffect(() => {
    const configured = isSupabaseConfigured();
    setStatus((s) => ({ ...s, configured }));

    if (configured) {
      testConnection();
    }
  }, []);

  const testConnection = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus({
        configured: false,
        connected: false,
        error: "Supabase client not initialized",
        testing: false,
      });
      return;
    }

    setStatus((s) => ({ ...s, testing: true, error: null }));

    try {
      // Simple health check - try to get current session
      // This doesn't require authentication, just verifies the client can connect
      const { error } = await supabase.auth.getSession();
      
      if (error) {
        setStatus({
          configured: true,
          connected: false,
          error: error.message,
          testing: false,
        });
      } else {
        setStatus({
          configured: true,
          connected: true,
          error: null,
          testing: false,
        });
      }
    } catch (err) {
      setStatus({
        configured: true,
        connected: false,
        error: err instanceof Error ? err.message : "Connection failed",
        testing: false,
      });
    }
  };

  if (!status.configured) {
    return (
      <div className="card p-4 border-study/40">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-study/10 text-study grid place-items-center shrink-0">
            <I n="alert" className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[14px] mb-1">Cloud Sync Not Configured</h3>
            <p className="text-[12.5px] text-mut leading-snug mb-2">
              To enable cloud sync, create a <code className="bg-raise px-1.5 py-0.5 rounded text-xs">.env</code> file with your Supabase credentials.
            </p>
            <p className="text-[11px] text-mut font-mono bg-raise p-2 rounded">
              VITE_SUPABASE_URL=https://your-project.supabase.co<br />
              VITE_SUPABASE_ANON_KEY=your-anon-key
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-4 ${status.connected ? "border-pine/40" : "border-danger/40"}`}>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${
          status.connected ? "bg-pine/10 text-pine" : "bg-danger/10 text-danger"
        }`}>
          <I n={status.connected ? "check" : "alert"} className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-[14px] mb-1">
            {status.connected ? "Supabase Connected" : "Connection Error"}
          </h3>
          <p className="text-[12.5px] text-mut leading-snug">
            {status.connected 
              ? "Successfully connected to Supabase. Ready for authentication."
              : status.error || "Failed to connect to Supabase"
            }
          </p>
          {status.testing && (
            <p className="text-[11px] text-mut mt-2 flex items-center gap-1.5">
              <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Testing connection...
            </p>
          )}
          {!status.testing && !status.connected && (
            <button
              onClick={testConnection}
              className="mt-2 text-[12px] font-semibold text-pine hover:text-pinedeep transition-colors"
            >
              Retry connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
