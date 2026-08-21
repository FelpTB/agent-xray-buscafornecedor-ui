export type Comprador = {
  nome?: string | null;
  telefone?: string | null;
  empresa_nome?: string | null;
  tier_busca?: string;
  limite_buscas?: number;
  buscas_realizadas?: number;
  tierBusca?: string;
  limiteBuscas?: number;
  buscasRealizadas?: number;
};

export type AuthView = {
  authenticated: boolean;
  userId: string | null;
  provider?: string;
  keyPrefix?: string | null;
  roles?: string[];
  comprador?: Comprador | null;
};

export type Profile = {
  user_id: string;
  comprador: Comprador | null;
  api_keys?: Array<{
    id: string;
    name: string;
    key_prefix: string;
    active: boolean;
  }>;
};

export type MeResponse = {
  authenticated: boolean;
  session_state?: "ok" | "expired" | "none";
  auth: AuthView | null;
  profile?: Profile | null;
};

export type ChatMessage = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
};

export type SearchResult = {
  posicao: number;
  id?: string | number;
  score_final?: number;
  payload?: Record<string, unknown>;
};

export type ChatResponse = {
  session_id: string;
  reply: string;
  messages?: ChatMessage[];
  actions?: Array<Record<string, unknown>>;
  search?: { search_id?: string; results?: SearchResult[] } | null;
  geo?: Record<string, unknown> | null;
  intent?: string | null;
  query_manager?: Record<string, unknown> | null;
  mcp_tool_call?: { name?: string; arguments?: Record<string, unknown> } | null;
  fallback?: unknown;
  session_upgraded?: boolean;
  error?: string;
  duration_ms?: number;
};

export type ConsultaRow = {
  id?: string;
  parametros?: Record<string, unknown> | null;
  resultados?: unknown[];
  v_produto?: string | null;
  v_servico?: string | null;
  v_descricao?: string | null;
  v_publico?: string | null;
  v_cliente?: string | null;
  bm_25?: string | null;
  uf?: unknown;
  municipio?: unknown;
  modelo_negocio?: string | null;
  qualidade?: string | null;
};

export type ConversationItem = {
  id: string;
  title?: string | null;
  updated_at?: string;
  created_at?: string;
  last_search_id?: string | null;
  creating?: boolean;
};

export type ConversationDetail = ConversationItem & {
  messages?: Array<{
    id?: string;
    role: string;
    content?: string | null;
    seq?: number;
    metadata?: {
      tool?: string;
      search_id?: string | null;
      result_count?: number;
      display?: Array<Record<string, unknown>>;
      results?: unknown;
    };
  }>;
};

export type SearchSettings = {
  finalLimit: number;
};

export const DEFAULT_SETTINGS: SearchSettings = {
  finalLimit: 10,
};

export function apiErrorMessage(data: unknown, fallback = "Algo deu errado. Tente de novo."): string {
  if (data && typeof data === "object") {
    const rec = data as { error?: unknown; message?: unknown };
    if (typeof rec.error === "string" && rec.error.trim()) return rec.error;
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  }
  return fallback;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    ...init,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const err = new Error(apiErrorMessage(data, `Erro ${res.status}`));
    (err as Error & { status?: number; payload?: unknown }).status = res.status;
    (err as Error & { status?: number; payload?: unknown }).payload = data;
    throw err;
  }
  return data as T;
}

export const api = {
  health: () =>
    request<{
      status: string;
      backend?: { reachable?: boolean; auth_mode?: string };
    }>("/health", { signal: AbortSignal.timeout(8_000) }),
  healthReady: () =>
    request<{
      status: string;
      backend?: { reachable?: boolean; auth_mode?: string };
    }>("/health/ready", { signal: AbortSignal.timeout(8_000) }),
  me: () => request<MeResponse>("/api/auth/me", { signal: AbortSignal.timeout(10_000) }),
  login: (email: string, password: string) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  refreshSession: () =>
    request<MeResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
    }),
  register: (body: {
    email: string;
    nome: string;
    password: string;
    telefone?: string;
    empresa_nome?: string;
  }) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }),
  config: () =>
    request<{
      limits: { final_limit_max?: number; final_limit_default?: number } | null;
      dimension_keys?: string[] | null;
      llm_rerank: { enabled: boolean };
    }>("/api/config"),
  chat: (body: {
    message: string;
    session_id?: string | null;
    final_limit: number;
    rerank?: boolean;
    search_params?: Record<string, unknown>;
  }) => request<ChatResponse>("/api/chat", { method: "POST", body: JSON.stringify(body) }),
  resetChat: (session_id?: string | null) =>
    request<{ session_id: string }>("/api/chat/reset", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  listConversations: () =>
    request<{ items: ConversationItem[]; total: number }>("/api/conversations?limit=40"),
  getConversation: (id: string) => request<ConversationDetail>(`/api/conversations/${id}`),
  deleteConversation: (id: string) =>
    request<{ ok: boolean; id: string }>(`/api/conversations/${id}`, { method: "DELETE" }),
  getConsulta: (searchId: string) => request<ConsultaRow>(`/api/consultas/${searchId}`),
  rateConsulta: (searchId: string, qualidade: string) =>
    request<{ id: string; qualidade: string }>(`/api/consultas/${searchId}/qualidade`, {
      method: "PATCH",
      body: JSON.stringify({ qualidade }),
    }),
};
