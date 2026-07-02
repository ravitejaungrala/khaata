import { useState } from "react";
import { api, ApiError, setToken } from "../api";
import type { User } from "../types";

export function AuthScreen({ onAuth }: { onAuth: (user: User) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState(""); // email (register) or email/ID (login)
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Holds the freshly-registered user so we can show their Login ID before entering.
  const [registered, setRegistered] = useState<User | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) {
        const res = await api.login(identifier, password);
        setToken(res.access_token);
        onAuth(res.user);
      } else {
        const res = await api.register(name, identifier, password);
        setToken(res.access_token);
        setRegistered(res.user); // show the Login ID, then continue
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  // ---- Post-registration: reveal the assigned Login ID ----
  if (registered) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="eyebrow">ACCOUNT CREATED</div>
          <h1>Welcome, {registered.name.split(" ")[0]}</h1>
          <div className="subtitle" style={{ marginBottom: 18 }}>
            This is your Login ID. You can sign in with{" "}
            <strong>either your email or this ID.</strong>
          </div>
          <div className="login-id-badge">{registered.login_code}</div>
          <div className="save-note" style={{ marginTop: 14 }}>
            Note it down — e.g. next time just type{" "}
            <strong>{registered.login_code}</strong> and your password.
          </div>
          <button
            className="full-btn"
            onClick={() => onAuth(registered)}
            style={{ marginTop: 20 }}
          >
            Continue to my ledger
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="eyebrow">MONTHLY LEDGER · PERSONAL ACCOUNT</div>
        <h1>Khaata</h1>
        <div className="subtitle">
          {isLogin
            ? "Welcome back. Sign in with your email or Login ID."
            : "Create an account to start tracking."}
        </div>

        <form onSubmit={submit}>
          {!isLogin && (
            <>
              <label className="field-label">Name</label>
              <input
                className="form-input"
                style={{ marginTop: 0 }}
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </>
          )}

          <label className="field-label">
            {isLogin ? "Email or Login ID" : "Email"}
          </label>
          <input
            className="form-input"
            style={{ marginTop: 0 }}
            type={isLogin ? "text" : "email"}
            placeholder={isLogin ? "you@example.com  or  016" : "you@example.com"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />

          <label className="field-label">Password</label>
          <input
            className="form-input"
            style={{ marginTop: 0 }}
            type="password"
            placeholder={isLogin ? "Your password" : "At least 6 characters"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <div className="auth-error">{error}</div>}

          <button className="full-btn" type="submit" disabled={busy}>
            {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? "New here? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
          >
            {isLogin ? "Create an account" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
