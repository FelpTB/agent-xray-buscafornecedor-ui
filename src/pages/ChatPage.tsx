import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ReloginForm } from "../components/ReloginForm";
import { Composer } from "../components/Composer";
import { MarkdownBody, visibleMessages } from "../components/MarkdownBody";
import { RateSearchModal } from "../components/RateSearchModal";
import { SearchParamsPanel } from "../components/SearchParamsPanel";
import {
  api,
  DEFAULT_SETTINGS,
  type ChatMessage,
  type ChatResponse,
  type ConversationItem,
  type SearchSettings,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  snapshotFromChat,
  snapshotFromConsulta,
  type SearchSnapshot,
} from "../lib/searchExplain";
import { DEFAULT_DIMENSION_KEYS, type SearchParamsPayload } from "../lib/searchParams";

const SUGGESTIONS = [
  "Procuro fabricantes de embalagens plásticas em Campinas, raio de 50 km",
  "Preciso de instalação de energia solar para condomínios em SP",
  "Quero limpeza industrial, ainda não sei a cidade",
];

const SESSION_KEY = "bf_ui_session_id";
const SNAPSHOT_KEY = "bf_ui_search_snapshot";
const PENDING_CHAT_ID = "pending-new-chat";
const BLANK_TITLES = new Set(["", "Nova conversa", "Conversa"]);

function isBlankHistoryItem(c: ConversationItem): boolean {
  if (c.creating) return true;
  const title = (c.title || "").trim();
  return BLANK_TITLES.has(title) && !c.last_search_id;
}

function hasUserMessage(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.role === "user" && Boolean(m.content?.trim()));
}

function readStoredSnapshot(): SearchSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SearchSnapshot;
  } catch {
    return null;
  }
}

async function loadSnapshotFromSearchId(searchId: string | null | undefined): Promise<SearchSnapshot | null> {
  if (!searchId) return null;
  try {
    const row = await api.getConsulta(searchId);
    return snapshotFromConsulta(row);
  } catch {
    return null;
  }
}

export function ChatPage() {
  const auth = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [settings, setSettings] = useState<SearchSettings>(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState<SearchSnapshot | null>(() => readStoredSnapshot());
  const [maxLimit, setMaxLimit] = useState(20);
  const [dimensionKeys, setDimensionKeys] = useState<string[]>(DEFAULT_DIMENSION_KEYS);
  const [creatingChat, setCreatingChat] = useState(false);
  const [ratingPrompt, setRatingPrompt] = useState<{ searchId: string; query: string | null } | null>(
    null,
  );
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [reloginBusy, setReloginBusy] = useState(false);
  const [reloginError, setReloginError] = useState<string | null>(null);
  const [reloadingSession, setReloadingSession] = useState(false);

  useEffect(() => {
    if (!auth.authenticated && !auth.localAuthOff && auth.sessionState !== "expired") return;
    document.documentElement.classList.add("layout-fixed");
    return () => document.documentElement.classList.remove("layout-fixed");
  }, [auth.authenticated, auth.localAuthOff, auth.sessionState]);

  const persistSnapshot = useCallback((next: SearchSnapshot | null) => {
    setSnapshot(next);
    if (next) sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(SNAPSHOT_KEY);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations();
      setConversations(data.items || []);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401) auth.markExpired();
    }
  }, [auth.markExpired]);

  useEffect(() => {
    if (!auth.authenticated && !auth.localAuthOff) return;
    if (auth.acessoAgente === false) return;
    void loadConversations();
    void api.config().then((cfg) => {
      const max = cfg.limits?.final_limit_max;
      if (typeof max === "number" && max > 0) setMaxLimit(max);
      if (Array.isArray(cfg.dimension_keys) && cfg.dimension_keys.length) {
        setDimensionKeys(cfg.dimension_keys);
      }
    });
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      void (async () => {
        try {
          const row = await api.getConversation(existing);
          const msgs = (row.messages || [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content || "" }));
          setMessages(msgs);
          setSessionId(row.id);
          if (row.last_search_id) {
            const fromDb = await loadSnapshotFromSearchId(row.last_search_id);
            if (fromDb) persistSnapshot(fromDb);
          }
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
          setSessionId(null);
        }
      })();
    }
  }, [auth.authenticated, auth.localAuthOff, auth.acessoAgente, loadConversations, persistSnapshot]);

  const shellClass = [
    "app-shell",
    sidebarOpen ? "sidebar-open" : "",
    inspectorOpen ? "inspector-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const thread = useMemo(() => visibleMessages(messages), [messages]);

  const currentIsBlank = !hasUserMessage(messages) && !snapshot?.searchId;
  const alreadyOnBlank =
    currentIsBlank &&
    Boolean(sessionId) &&
    sessionId !== PENDING_CHAT_ID &&
    conversations.some((c) => c.id === sessionId && isBlankHistoryItem(c));

  function applyChatResponse(data: ChatResponse, fallbackPrev: ChatMessage[]) {
    if (data.session_id) {
      setSessionId(data.session_id);
      sessionStorage.setItem(SESSION_KEY, data.session_id);
    }
    const next = visibleMessages(data.messages, data.reply);
    setMessages(
      next.length ? next : [...fallbackPrev, { role: "assistant", content: data.reply || "Pronto." }],
    );
    if (data.search?.results?.length) setInspectorOpen(true);
    const used = snapshotFromChat(data);
    if (used) persistSnapshot(used);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    const optimistic: ChatMessage[] = [...messages, { role: "user", content: message }];
    setMessages(optimistic);
    try {
      const data = await api.chat({
        message,
        session_id: sessionId,
        final_limit: settings.finalLimit,
        rerank: false,
      });
      if (data.session_upgraded) await auth.refresh();
      applyChatResponse(data, optimistic);
      void loadConversations();
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401) {
        auth.markExpired();
        setError("Sua sessão expirou. Entre novamente para continuar a busca.");
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível concluir a busca.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function rerunSearch(params: SearchParamsPayload) {
    if (busy || !params.query?.trim()) return;
    setBusy(true);
    setError(null);
    const message = "Refazer busca com os parâmetros ajustados.";
    const optimistic: ChatMessage[] = [...messages, { role: "user", content: message }];
    setMessages(optimistic);
    try {
      const data = await api.chat({
        message,
        session_id: sessionId,
        final_limit: settings.finalLimit,
        rerank: false,
        search_params: params,
      });
      applyChatResponse(data, optimistic);
      void loadConversations();
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401) {
        auth.markExpired();
        setError("Sua sessão expirou. Entre novamente para refazer a busca.");
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível refazer a busca.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function startNewChat(opts?: { excludeId?: string }) {
    if (creatingChat) return;
    const reusable = conversations.find(
      (c) =>
        c.id !== PENDING_CHAT_ID &&
        c.id !== opts?.excludeId &&
        isBlankHistoryItem(c) &&
        !(c.id === sessionId && hasUserMessage(messages)),
    );
    if (reusable) {
      if (reusable.id === sessionId && currentIsBlank) {
        setSidebarOpen(false);
        return;
      }
      await openConversation(reusable.id);
      return;
    }
    if (currentIsBlank && sessionId && sessionId !== PENDING_CHAT_ID && sessionId !== opts?.excludeId) {
      setSidebarOpen(false);
      return;
    }
    setCreatingChat(true);
    setRatingPrompt(null);
    setRatingError(null);
    setError(null);
    setDraft("");
    persistSnapshot(null);
    setMessages([]);
    const previousId = sessionId;
    const pending: ConversationItem = {
      id: PENDING_CHAT_ID,
      title: "Nova conversa",
      creating: true,
      updated_at: new Date().toISOString(),
    };
    setSessionId(PENDING_CHAT_ID);
    setConversations((prev) => [pending, ...prev.filter((c) => c.id !== PENDING_CHAT_ID)]);
    try {
      const out = await api.resetChat(previousId && previousId !== PENDING_CHAT_ID ? previousId : null);
      const newId = out.session_id;
      setSessionId(newId);
      sessionStorage.setItem(SESSION_KEY, newId);
      setConversations((prev) => {
        const rest = prev.filter((c) => c.id !== PENDING_CHAT_ID && c.id !== newId);
        return [
          { id: newId, title: "Nova conversa", updated_at: new Date().toISOString() },
          ...rest,
        ];
      });
      try {
        const data = await api.listConversations();
        const items = data.items || [];
        setConversations(() => {
          if (items.some((c) => c.id === newId)) return items;
          return [
            { id: newId, title: "Nova conversa", updated_at: new Date().toISOString() },
            ...items,
          ];
        });
      } catch {
        /* aba otimista já está selecionada */
      }
    } catch (err) {
      sessionStorage.removeItem(SESSION_KEY);
      setSessionId(null);
      setConversations((prev) => prev.filter((c) => c.id !== PENDING_CHAT_ID));
      setError(err instanceof Error ? err.message : "Não foi possível criar a conversa.");
    } finally {
      setCreatingChat(false);
      setSidebarOpen(false);
    }
  }

  async function requestNewChat() {
    if (creatingChat || ratingPrompt || busy || alreadyOnBlank) return;
    const searchId =
      (typeof snapshot?.searchId === "string" && snapshot.searchId.trim()) ||
      conversations.find((c) => c.id === sessionId)?.last_search_id ||
      "";
    if (!searchId) {
      await startNewChat();
      return;
    }
    try {
      const row = await api.getConsulta(searchId);
      if (row.qualidade) {
        await startNewChat();
        return;
      }
    } catch {
      /* consulta ainda pode estar gravando — mesmo assim pedimos a avaliação */
    }
    setRatingError(null);
    setRatingPrompt({
      searchId,
      query: typeof snapshot?.query === "string" ? snapshot.query : null,
    });
  }

  async function submitRating(qualidade: string) {
    if (!ratingPrompt || ratingBusy) return;
    setRatingBusy(true);
    setRatingError(null);
    try {
      await api.rateConsulta(ratingPrompt.searchId, qualidade);
    } catch {
      /* a escolha já foi feita; a consulta pode ainda não ter sido gravada */
    }
    setRatingBusy(false);
    setRatingPrompt(null);
    await startNewChat();
  }

  async function openConversation(id: string) {
    setBusy(true);
    setError(null);
    try {
      const row = await api.getConversation(id);
      setSessionId(row.id);
      sessionStorage.setItem(SESSION_KEY, row.id);
      const msgs = (row.messages || [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content || "" }));
      setMessages(msgs);
      setSidebarOpen(false);
      if (row.last_search_id) {
        const fromDb = await loadSnapshotFromSearchId(row.last_search_id);
        persistSnapshot(fromDb);
      } else {
        persistSnapshot(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a conversa.");
    } finally {
      setBusy(false);
    }
  }

  async function removeConversation(id: string) {
    if (!window.confirm("Apagar esta conversa do histórico?")) return;
    try {
      await api.deleteConversation(id);
      if (sessionId === id) await startNewChat({ excludeId: id });
      else void loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar.");
    }
  }

  if (auth.loading) {
    return (
      <div className="welcome">
        <p>Carregando sua sessão…</p>
      </div>
    );
  }
  if (!auth.authenticated && !auth.localAuthOff && auth.sessionState !== "expired") {
    return <Navigate to="/login" replace />;
  }

  if (auth.authenticated && auth.acessoAgente === false) {
    return (
      <div className="auth-page">
        <section className="auth-hero">
          <img src="/logo-header.png" alt="" />
          <h1>Modo de busca com agente em acesso restrito</h1>
          <p>
            Sua conta está autenticada, mas o assistente conversacional ainda não foi
            liberado para este perfil. A busca tradicional da plataforma continua
            disponível. Se você faz parte do grupo piloto, fale com a ABC Advise.
          </p>
        </section>
        <section className="auth-form">
          <h2>Acesso pendente</h2>
          <p className="lead">
            {auth.nome ? `${auth.nome}, ` : ""}o modo agente está limitado aos
            compradores habilitados na allowlist.
          </p>
          <button className="btn btn-primary btn-block" type="button" onClick={() => void auth.logout()}>
            Sair
          </button>
        </section>
      </div>
    );
  }

  const sessionExpired = !auth.authenticated && !auth.localAuthOff && auth.sessionState === "expired";

  async function onRelogin(email: string, password: string) {
    setReloginError(null);
    setReloginBusy(true);
    try {
      await auth.login(email, password);
      setError(null);
    } catch (err) {
      setReloginError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setReloginBusy(false);
    }
  }

  async function onReloadSession() {
    setReloginError(null);
    setReloadingSession(true);
    try {
      const ok = await auth.reloadSession();
      if (!ok) setReloginError("Não foi possível renovar a sessão. Entre com e-mail e senha.");
    } finally {
      setReloadingSession(false);
    }
  }

  return (
    <div className={shellClass}>
      {sessionExpired ? (
        <div className="session-overlay" role="alertdialog" aria-labelledby="session-expired-title">
          <div className="session-overlay-card">
            <p className="session-badge is-expired" id="session-expired-title">
              Você não está mais conectado
            </p>
            <ReloginForm
              busy={reloginBusy}
              error={reloginError}
              onSubmit={onRelogin}
            />
            <button
              className="btn btn-ghost btn-block"
              type="button"
              disabled={reloadingSession || reloginBusy}
              onClick={() => void onReloadSession()}
            >
              {reloadingSession ? "Recarregando…" : "Tentar recarregar a sessão"}
            </button>
          </div>
        </div>
      ) : null}
      {ratingPrompt ? (
        <RateSearchModal
          query={ratingPrompt.query}
          busy={ratingBusy}
          error={ratingError}
          onChoose={(qualidade) => void submitRating(qualidade)}
        />
      ) : null}
      {(sidebarOpen || inspectorOpen) && (
        <button
          type="button"
          className="backdrop"
          aria-label="Fechar painel"
          onClick={() => {
            setSidebarOpen(false);
            setInspectorOpen(false);
          }}
        />
      )}

      <aside className="sidebar" aria-label="Histórico">
        <div className="brand">
          <img src="/logo-header.png" alt="" />
          <div>
            <strong>BuscaFornecedor</strong>
            <span>Agente de busca</span>
          </div>
        </div>
        <div className="sidebar-actions">
          <button
            className="btn btn-primary btn-block"
            type="button"
            disabled={creatingChat || Boolean(ratingPrompt) || busy || alreadyOnBlank}
            title={
              alreadyOnBlank
                ? "Já existe uma conversa vazia. Envie uma busca nela antes de abrir outra."
                : undefined
            }
            onClick={() => void requestNewChat()}
          >
            Nova conversa
          </button>
          {alreadyOnBlank ? (
            <p className="help">Já existe uma conversa vazia. Use-a antes de abrir outra.</p>
          ) : null}
        </div>
        <div className="conv-list">
          <h2>Histórico</h2>
          {conversations.length === 0 ? (
            <p className="help" style={{ padding: "0 0.4rem" }}>
              Suas conversas aparecerão aqui.
            </p>
          ) : (
            conversations.map((c) => (
              <div className="conv-item" key={c.id}>
                <button
                  type="button"
                  className={`conv-open${sessionId === c.id ? " active" : ""}${c.creating ? " is-creating" : ""}`}
                  disabled={creatingChat || Boolean(ratingPrompt) || c.creating}
                  onClick={() => void openConversation(c.id)}
                >
                  <span className="conv-title">{c.title || "Conversa"}</span>
                  <span className="conv-meta">
                    {c.creating
                      ? "Criando…"
                      : c.updated_at
                        ? new Date(c.updated_at).toLocaleString("pt-BR")
                        : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-danger"
                  aria-label="Apagar conversa"
                  disabled={creatingChat || Boolean(ratingPrompt) || c.creating}
                  onClick={() => void removeConversation(c.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <div className="user-box">
          <div className="user-name">{auth.nome || (auth.localAuthOff ? "Ambiente local" : "Comprador")}</div>
          <div className="user-meta">{auth.quotaLabel || "Sessão autenticada"}</div>
          <div
            className={`session-badge${sessionExpired ? " is-expired" : " is-ok"}`}
            role="status"
            aria-live="polite"
          >
            {auth.localAuthOff
              ? "Auth local desligada"
              : sessionExpired
                ? "Sessão expirada"
                : "Conectado"}
          </div>
          {sessionExpired ? (
            <button
              className="btn btn-ghost"
              type="button"
              disabled={reloadingSession}
              onClick={() => void onReloadSession()}
            >
              {reloadingSession ? "Recarregando…" : "Recarregar sessão"}
            </button>
          ) : (
            <button className="btn btn-ghost" type="button" onClick={() => void auth.logout()}>
              Sair
            </button>
          )}
        </div>
      </aside>

      <main className="main">
        {creatingChat ? (
          <div className="chat-transition" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <h2>Criando nova conversa</h2>
            <p>Preparando um espaço limpo para a próxima cotação…</p>
          </div>
        ) : null}
        <header className="topbar">
          <button className="btn mobile-only" type="button" onClick={() => setSidebarOpen(true)}>
            Menu
          </button>
          <h1>Assistente de fornecedores</h1>
          <button className="btn mobile-only" type="button" onClick={() => setInspectorOpen(true)}>
            Parâmetros
          </button>
        </header>

        <div className="thread" aria-live="polite">
          {thread.length === 0 ? (
            <div className="welcome">
              <h2>Como posso ajudar na busca?</h2>
              <p>
                Fale como falaria com um colega de compras: o produto ou serviço, a região e o tipo de
                empresa. O assistente pergunta o que faltar e então consulta a base.
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="chip-btn" onClick={() => setDraft(s)}>
                    {s.split(",")[0]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            thread.map((m, i) => (
              <div className={`bubble ${m.role}`} key={`${m.role}-${i}`}>
                <span className="who">{m.role === "user" ? "Você" : "Assistente"}</span>
                {m.role === "assistant" ? <MarkdownBody text={m.content} /> : m.content}
              </div>
            ))
          )}
          {busy ? (
            <div className="bubble assistant typing">
              <span className="who">Assistente</span>
              Consultando a base de fornecedores…
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="error" role="alert" style={{ margin: "0 1rem 0.5rem" }}>
            {error}
          </div>
        ) : null}

        <Composer
          value={draft}
          disabled={busy || creatingChat || Boolean(ratingPrompt) || sessionExpired}
          onChange={setDraft}
          onSubmit={() => void send(draft)}
        />
      </main>

      <aside className="inspector" aria-label="Parâmetros da busca">
        <div className="brand">
          <div>
            <strong>Parâmetros da busca</strong>
          </div>
        </div>
        <div className="inspector-body">
          <SearchParamsPanel
            snapshot={snapshot}
            dimensionKeys={dimensionKeys}
            finalLimit={settings.finalLimit}
            maxLimit={maxLimit}
            busy={busy || creatingChat || Boolean(ratingPrompt) || sessionExpired}
            onFinalLimitChange={(finalLimit) => setSettings({ finalLimit })}
            onRerun={(payload) => void rerunSearch(payload)}
          />
        </div>
      </aside>
    </div>
  );
}
