import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Comprador, type MeResponse } from "./api";

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  userId: string | null;
  nome: string | null;
  email: string | null;
  comprador: Comprador | null;
  quotaLabel: string | null;
};

const EMPTY: AuthState = {
  loading: true,
  authenticated: false,
  userId: null,
  nome: null,
  email: null,
  comprador: null,
  quotaLabel: null,
};

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function fromMe(data: MeResponse): Omit<AuthState, "loading"> {
  const c = data.profile?.comprador || data.auth?.comprador || null;
  const limite = c?.limite_buscas ?? c?.limiteBuscas;
  const usadas = c?.buscas_realizadas ?? c?.buscasRealizadas;
  let quotaLabel: string | null = null;
  if (typeof limite === "number" && typeof usadas === "number") {
    quotaLabel = `${usadas} de ${limite} buscas usadas`;
  }
  return {
    authenticated: Boolean(data.authenticated && data.auth?.userId),
    userId: data.auth?.userId || data.profile?.user_id || null,
    nome: c?.nome || null,
    email: null,
    comprador: c,
    quotaLabel,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY);

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setState({ loading: false, ...fromMe(data) });
    } catch {
      setState({ ...EMPTY, loading: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ ...EMPTY, loading: false });
    }
  }, []);

  const value = useMemo(() => ({ ...state, refresh, logout }), [state, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
