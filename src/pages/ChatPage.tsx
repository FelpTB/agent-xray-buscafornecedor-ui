import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Composer } from "../components/Composer";
import { MarkdownBody, visibleMessages } from "../components/MarkdownBody";
import { SearchUsedPanel } from "../components/SearchUsedPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { SupplierList } from "../components/SupplierList";
import {
  api,
  DEFAULT_SETTINGS,
  type ChatMessage,
  type ConversationItem,
  type SearchSettings,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { mapResultsForDisplay, type SupplierCard } from "../lib/display";
import {
  snapshotFromChat,
  snapshotFromConsulta,
  type SearchSnapshot,
} from "../lib/searchExplain";

const SUGGESTIONS = [
  "Procuro fabricantes de embalagens plásticas em Campinas, raio de 50 km",
  "Preciso de instalação de energia solar para condomínios em SP",
  "Quero limpeza industrial, ainda não sei a cidade",
];

const SESSION_KEY = "bf_ui_session_id";
const SNAPSHOT_KEY = "bf_ui_search_snapshot";

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
  const [cards, setCards] = useState<SupplierCard[]>([]);
  const [snapshot, setSnapshot] = useState<SearchSnapshot | null>(() => readStoredSnapshot());
  const [maxLimit, setMaxLimit] = useState(20);

  const persistSnapshot = useCallback((next: SearchSnapshot | null) => {
    setSnapshot(next);
    if (next) sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(SNAPSHOT_KEY);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations();
      setConversations(data.items || []);
    } catch {
      /* histórico exige sessão autenticada com userId — silencioso se vazio */
    }
  }, []);

  useEffect(() => {
    if (!auth.authenticated && !auth.localAuthOff) return;
    void loadConversations();
    void api.config().then((cfg) => {
      const max = cfg.limits?.final_limit_max;
      if (typeof max === "number" && max > 0) setMaxLimit(max);
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
  }, [auth.authenticated, auth.localAuthOff, loadConversations, persistSnapshot]);

  const shellClass = [
    "app-shell",
    sidebarOpen ? "sidebar-open" : "",
    inspectorOpen ? "inspector-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const thread = useMemo(() => visibleMessages(messages), [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const data = await api.chat({
        message,
        session_id: sessionId,
        final_limit: settings.finalLimit,
        rerank: settings.rerank,
      });
      if (data.session_id) {
        setSessionId(data.session_id);
        sessionStorage.setItem(SESSION_KEY, data.session_id);
      }
      if (data.session_upgraded) await auth.refresh();
      setMessages((prev) => {
        const next = visibleMessages(data.messages, data.reply);
        if (next.length) return next;
        return [...prev, { role: "assistant", content: data.reply || "Pronto." }];
      });
      if (data.search?.results?.length) {
        setCards(mapResultsForDisplay(data.search.results));
        setInspectorOpen(true);
      }
      const used = snapshotFromChat(data);
      if (used) persistSnapshot(used);
      void loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a busca.");
    } finally {
      setBusy(false);
    }
  }

  async function newChat() {
    try {
      await api.resetChat(sessionId);
    } catch {
      /* nova conversa local mesmo se o reset remoto falhar */
    }
    sessionStorage.removeItem(SESSION_KEY);
    persistSnapshot(null);
    setSessionId(null);
    setMessages([]);
    setCards([]);
    setError(null);
    setSidebarOpen(false);
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
      if (sessionId === id) await newChat();
      void loadConversations();
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
  if (!auth.authenticated && !auth.localAuthOff) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={shellClass}>
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
          <button className="btn btn-primary btn-block" type="button" onClick={() => void newChat()}>
            Nova conversa
          </button>
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
                  className={`conv-open${sessionId === c.id ? " active" : ""}`}
                  onClick={() => void openConversation(c.id)}
                >
                  <span className="conv-title">{c.title || "Conversa"}</span>
                  <span className="conv-meta">
                    {c.updated_at ? new Date(c.updated_at).toLocaleString("pt-BR") : ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-danger"
                  aria-label="Apagar conversa"
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
          <button className="btn btn-ghost" type="button" onClick={() => void auth.logout()}>
            Sair
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="btn mobile-only" type="button" onClick={() => setSidebarOpen(true)}>
            Menu
          </button>
          <h1>Assistente de fornecedores</h1>
          <button className="btn mobile-only" type="button" onClick={() => setInspectorOpen(true)}>
            Como buscamos
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

        <Composer value={draft} disabled={busy} onChange={setDraft} onSubmit={() => void send(draft)} />
      </main>

      <aside className="inspector" aria-label="Resultados e preferências">
        <div className="brand">
          <div>
            <strong>Como buscamos</strong>
            <span>{cards.length ? `${cards.length} fornecedores nesta lista` : "Recortes da consulta"}</span>
          </div>
        </div>
        <div className="inspector-body">
          <SearchUsedPanel snapshot={snapshot} />
          <section className="card">
            <h3>Fornecedores encontrados</h3>
            <SupplierList cards={cards} />
          </section>
          <SettingsPanel settings={settings} maxLimit={maxLimit} onChange={setSettings} />
        </div>
      </aside>
    </div>
  );
}
