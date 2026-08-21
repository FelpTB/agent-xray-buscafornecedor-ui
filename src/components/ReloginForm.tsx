import { useState, type FormEvent } from "react";

type ReloginFormProps = {
  title?: string;
  lead?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (email: string, password: string) => Promise<void> | void;
};

export function ReloginForm({
  title = "Entrar novamente",
  lead = "Sua sessão não está mais ativa. Informe e-mail e senha para continuar.",
  busy = false,
  error = null,
  onSubmit,
}: ReloginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    await onSubmit(email.trim(), password);
  }

  return (
    <form className="relogin-form" onSubmit={(e) => void handleSubmit(e)}>
      {title ? <h2>{title}</h2> : null}
      {lead ? <p className="lead">{lead}</p> : null}
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="relogin-email">E-mail</label>
        <input
          id="relogin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="relogin-password">Senha</label>
        <input
          id="relogin-password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "Entrando…" : "Entrar novamente"}
      </button>
    </form>
  );
}
