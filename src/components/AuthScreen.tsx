import { useState } from "react";
import { useAuth } from "../state/AuthContext";
import { Btn, Field, I } from "./ui";

export function AuthScreen() {
  const { login, register, error, clearError, isConfigured } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isConfigured) {
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-pine/10 text-pine grid place-items-center mx-auto mb-4">
            <I n="alert" className="h-8 w-8" />
          </div>
          <h1 className="font-display font-bold text-xl mb-2">Sync Not Configured</h1>
          <p className="text-sm text-mut mb-4">
            To enable cloud sync, add your Supabase credentials to a <code className="bg-raise px-1.5 py-0.5 rounded text-xs">.env</code> file:
          </p>
          <pre className="bg-raise rounded-lg p-3 text-left text-xs font-mono overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
          <p className="text-xs text-mut mt-4">
            See <code className="bg-raise px-1.5 py-0.5 rounded">.env.example</code> for reference.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    clearError();

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
    } catch {
      // Error is handled by auth context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="card max-w-md w-full p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-pine grid place-items-center mx-auto mb-4">
            <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
              <circle cx="20" cy="22.5" r="9.5" fill="none" stroke="rgb(var(--bg))" strokeWidth="2.5" />
              <path
                d="M20 17.5v5l3.4 3.4"
                stroke="rgb(var(--bg))"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M16 6h8" stroke="rgb(var(--study))" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M20 8.5v2.5" stroke="rgb(var(--bg))" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Tempo</h1>
          <p className="text-sm text-mut mt-1">Sign in to sync your data</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-6 p-1 bg-raise rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              clearError();
            }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
              mode === "login" ? "bg-surface text-ink shadow-sm" : "text-mut hover:text-ink"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              clearError();
            }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
              mode === "register" ? "bg-surface text-ink shadow-sm" : "text-mut hover:text-ink"
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <Field label="Display Name" htmlFor="display-name">
              <input
                id="display-name"
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Optional"
                autoComplete="name"
              />
            </Field>
          )}

          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 text-danger text-sm">
              <I n="alert" className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Btn type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </>
            ) : mode === "login" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Btn>
        </form>

        <p className="text-xs text-mut text-center mt-6">
          Your data is encrypted and synced securely across devices.
        </p>
      </div>
    </div>
  );
}
