import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false);

  if (!auth.loading && (auth.authenticated || auth.localAuthOff)) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await auth.login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function onReloadSession() {
    setError(null);
    setReloading(true);
    try {
      const ok = await auth.reloadSession();
      if (ok) navigate(from, { replace: true });
      else setError("Não foi possível renovar a sessão. Entre com e-mail e senha.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível renovar a sessão.");
    } finally {
      setReloading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <img src="/logo-header.png" alt="" />
        <h1>Encontre fornecedores com um assistente, não com filtros técnicos.</h1>
        <p>
          Descreva o que sua empresa precisa comprar. O agente conversa com a base BuscaFornecedor e
          devolve uma lista qualificada — no mesmo visual da plataforma.
        </p>
      </section>
      <form className="auth-form" onSubmit={onSubmit}>
        <h2>Entrar</h2>
        <p className="lead">Acesso restrito a compradores cadastrados.</p>
        {auth.sessionState === "expired" ? (
          <div className="session-alert" role="status">
            Sua sessão expirou. Entre novamente ou tente recarregar o login.
            <button
              className="btn btn-ghost"
              type="button"
              disabled={reloading || busy}
              onClick={() => void onReloadSession()}
            >
              {reloading ? "Recarregando…" : "Recarregar sessão"}
            </button>
          </div>
        ) : null}
        {error ? <div className="error" role="alert">{error}</div> : null}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <p className="switch-auth">
          Ainda não tem acesso? <Link to="/cadastro">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
