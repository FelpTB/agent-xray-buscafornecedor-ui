import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!auth.loading && auth.authenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.register({
        nome: nome.trim(),
        email: email.trim(),
        password,
        empresa_nome: empresa.trim() || undefined,
        telefone: telefone.trim() || undefined,
      });
      await auth.refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <img src="/logo-header.png" alt="" />
        <h1>Uma conta, a mesma base de fornecedores da plataforma.</h1>
        <p>
          O cadastro cria seu perfil de comprador no sistema BuscaFornecedor. Depois disso, o assistente
          já pode buscar em seu nome — sem chaves técnicas na tela.
        </p>
      </section>
      <form className="auth-form" onSubmit={onSubmit}>
        <h2>Criar conta</h2>
        <p className="lead">Uso interno para profissionais de compras.</p>
        {error ? <div className="error" role="alert">{error}</div> : null}
        <div className="field">
          <label htmlFor="nome">Seu nome</label>
          <input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail corporativo</label>
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="empresa">Empresa (opcional)</label>
          <input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="telefone">Telefone (opcional)</label>
          <input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Criando…" : "Criar acesso"}
        </button>
        <p className="switch-auth">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
