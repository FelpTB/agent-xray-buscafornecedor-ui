import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Comprador, type MeResponse } from "./api";

export type SessionState = "ok" | "expired" | "none";

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  sessionState: SessionState;
  localAuthOff: boolean;
  userId: string | null;
  nome: string | null;
  email: string | null;
  comprador: Comprador | null;
  quotaLabel: string | null;
  acessoAgente: boolean | null;
};

const EMPTY: AuthState = {
  loading: true,
  authenticated: false,
  sessionState: "none",
  localAuthOff: false,
  userId: null,
  nome: null,
  email: null,
  comprador: null,
  quotaLabel: null,
  acessoAgente: null,
};

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  reloadSession: () => Promise<boolean>;
  markExpired: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readAcessoAgente(c: Comprador | null): boolean | null {
  if (!c) return null;
  if (typeof c.acesso_agente === "boolean") return c.acesso_agente;
  if (typeof c.acessoAgente === "boolean") return c.acessoAgente;
  return null;
}

function fromMe(data: MeResponse, localAuthOff: boolean): Omit<AuthState, "loading"> {
  const c = data.profile?.comprador || data.auth?.comprador || null;
  const limite = c?.limite_buscas ?? c?.limiteBuscas;
  const usadas = c?.buscas_realizadas ?? c?.buscasRealizadas;
  let quotaLabel: string | null = null;
  if (typeof limite === "number" && typeof usadas === "number") {
    quotaLabel = `${usadas} de ${limite} buscas usadas`;
  }
  const authenticated = Boolean(data.authenticated && data.auth?.userId);
  const sessionState: SessionState =
    data.session_state === "ok" || data.session_state === "expired" || data.session_state === "none"
      ? data.session_state
      : authenticated
        ? "ok"
        : "none";
  return {
    authenticated,
    sessionState: authenticated ? "ok" : sessionState,
    localAuthOff,
    userId: data.auth?.userId || data.profile?.user_id || null,
    nome: c?.nome || null,
    email: null,
    comprador: c,
    quotaLabel: quotaLabel || (localAuthOff ? "Ambiente local (auth desligada)" : null),
    acessoAgente: readAcessoAgente(c),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      const ready = await api.healthReady().catch(() => null);
      const localAuthOff = ready?.backend?.auth_mode === "off";
      setState({ loading: false, ...fromMe(data, localAuthOff) });
    } catch {
      setState((prev) => {
        if (prev.loading && !prev.authenticated) {
          return { ...EMPTY, loading: false, sessionState: "none" };
        }
        return { ...prev, loading: false };
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void refresh();
    };
    const id = window.setInterval(tick, 45_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const reloadSession = useCallback(async () => {
    try {
      const data = await api.refreshSession();
      const ready = await api.healthReady().catch(() => null);
      const localAuthOff = ready?.backend?.auth_mode === "off";
      const next = fromMe(data, localAuthOff);
      setState({ loading: false, ...next });
      return next.authenticated;
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        authenticated: false,
        sessionState: "expired",
      }));
      return false;
    }
  }, []);

  const markExpired = useCallback(() => {
    setState((prev) => ({
      ...prev,
      loading: false,
      authenticated: false,
      sessionState: "expired",
    }));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState((prev) => ({
        ...EMPTY,
        loading: false,
        localAuthOff: prev.localAuthOff,
        sessionState: "none",
      }));
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, refresh, reloadSession, markExpired, login, logout }),
    [state, refresh, reloadSession, markExpired, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
