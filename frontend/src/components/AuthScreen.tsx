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
        setRegistered(res.user);
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
        <div className="auth-done">
          <div className="eyebrow">ACCOUNT CREATED</div>
          <h2 className="done-title">Welcome, {registered.name.split(" ")[0]}</h2>
          <p className="done-sub">
            This is your Login ID. You can sign in with{" "}
            <strong>either your email or this ID.</strong>
          </p>
          <div className="login-id-badge">{registered.login_code}</div>
          <p className="save-note">
            Note it down — next time just type <strong>{registered.login_code}</strong> and your password.
          </p>
          <button className="full-btn" onClick={() => onAuth(registered)}>
            Continue to my ledger
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-split">
        <aside className="auth-brand">
          <span className="brand-blob b1" />
          <span className="brand-blob b2" />
          <span className="brand-blob b3" />
          <div className="auth-brand-inner">
            <div className="brand-eyebrow">PERSONAL FINANCE · KHAATA</div>
            <h1 className="brand-title">Money, made clear.</h1>
            <p className="brand-tagline">
              Track what comes in, what goes out, and what stays — with a ledger
              that does the heavy lifting for you.
            </p>
            <ul className="brand-features">
              <li>
                <span className="tick">✓</span> Log by chat, voice, or a photo of your receipt
              </li>
              <li>
                <span className="tick">✓</span> Monthly &amp; yearly insights at a glance
              </li>
              <li>
                <span className="tick">✓</span> Export a clean PDF statement anytime
              </li>
            </ul>
          </div>
        </aside>

        <section className="auth-form-side">
          <div className="form-head">
            <h2>{isLogin ? "Sign in" : "Create your account"}</h2>
            <p>
              {isLogin
                ? "Welcome back. Use your email or Login ID."
                : "Start tracking in under a minute."}
            </p>
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
        </section>
      </div>
    </div>
  );
}
