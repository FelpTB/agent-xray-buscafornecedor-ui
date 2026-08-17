/**
 * BFF — serve o SPA e conversa com a BuscaFornecedor API+MCP.
 * Credenciais ficam em cookie httpOnly; o browser nunca precisa colar API key.
 */
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IS_PROD =
  process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);
const PORT = Number(process.env.PORT) || 8787;
const API_BASE = (process.env.BUSCA_API_BASE_URL || "").replace(/\/+$/, "");
const COOKIE = "bf_session";
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "1" || (IS_PROD && process.env.COOKIE_SECURE !== "0");
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const FONTE = "AgentUI";

if (!API_BASE) {
  console.warn("BUSCA_API_BASE_URL não definido — o BFF não conseguirá falar com a API.");
}

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: "256kb" }));

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function getToken(req) {
  return parseCookies(req.headers.cookie)[COOKIE] || "";
}

function setSessionCookie(res, token) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(COOKIE_MAX_AGE / 1000)}`,
  ];
  if (COOKIE_SECURE) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (COOKIE_SECURE) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function pickCredential(payload) {
  const key = payload?.api_key?.key;
  if (typeof key === "string" && key.trim()) return key.trim();
  const jwt = payload?.access_token;
  if (typeof jwt === "string" && jwt.trim()) return jwt.trim();
  return null;
}

function publicBuyer(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    user_id: payload.user_id || null,
    email: payload.email || null,
    comprador: payload.comprador || null,
    key_prefix: payload.api_key?.key_prefix || null,
    has_session: true,
  };
}

function authHeaders(token) {
  const h = { Accept: "application/json" };
  if (token) {
    h.Authorization = token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
    if (token.startsWith("sk_bf_")) h["X-Api-Key"] = token;
  }
  return h;
}

async function backendFetch(pathname, { method = "GET", token, body, query } = {}) {
  if (!API_BASE) {
    const err = new Error("API de busca não configurada (BUSCA_API_BASE_URL)");
    err.status = 503;
    throw err;
  }
  const url = new URL(API_BASE + pathname);
  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders(token),
      ...(body != null ? { "Content-Type": "application/json" } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || res.statusText };
  }
  return { status: res.status, data };
}

function sendBackend(res, result) {
  return res.status(result.status).json(result.data);
}

app.get("/health", async (_req, res) => {
  let backend = { reachable: false };
  if (API_BASE) {
    try {
      const r = await backendFetch("/health");
      backend = { reachable: r.status === 200, ...(r.data || {}) };
    } catch (err) {
      backend = { reachable: false, error: err.message };
    }
  }
  return res.json({
    status: "ok",
    service: "agent-xray-buscafornecedor-ui",
    version: "1.0.0",
    api_base_configured: Boolean(API_BASE),
    backend,
    uptime: process.uptime(),
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const result = await backendFetch("/auth/login-buyer", {
      method: "POST",
      body: {
        email: req.body?.email,
        password: req.body?.password,
        fonte: FONTE,
        key_name: "agent-ui",
      },
    });
    if (result.status >= 200 && result.status < 300) {
      const cred = pickCredential(result.data);
      if (cred) setSessionCookie(res, cred);
      return res.status(result.status).json(publicBuyer(result.data));
    }
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || "Falha no login" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const result = await backendFetch("/auth/register-buyer", {
      method: "POST",
      body: {
        email: req.body?.email,
        nome: req.body?.nome,
        password: req.body?.password,
        telefone: req.body?.telefone,
        empresa_nome: req.body?.empresa_nome,
        fonte: FONTE,
        key_name: "agent-ui",
      },
    });
    if (result.status >= 200 && result.status < 300) {
      const cred = pickCredential(result.data);
      if (cred) setSessionCookie(res, cred);
      return res.status(result.status).json(publicBuyer(result.data));
    }
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || "Falha no cadastro" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  const token = getToken(req);
  if (!token) return res.json({ authenticated: false, auth: null, profile: null });
  try {
    const result = await backendFetch("/auth/me", { token });
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
});

app.get("/api/config", async (req, res) => {
  try {
    const result = await backendFetch("/config", { token: getToken(req) });
    const cfg = result.data || {};
    return res.status(result.status).json({
      limits: cfg.limits || null,
      auth: cfg.auth
        ? {
            required: cfg.auth.required,
            require_comprador: cfg.auth.require_comprador,
          }
        : null,
      llm_rerank: cfg.llm_rerank
        ? { enabled: Boolean(cfg.llm_rerank.enabled) }
        : { enabled: false },
    });
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const token = getToken(req);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "Escreva uma mensagem para o assistente." });

  const final_limit = Number(req.body?.final_limit);
  const body = {
    message,
    session_id: req.body?.session_id || undefined,
    final_limit: Number.isInteger(final_limit) && final_limit >= 1 ? final_limit : 10,
    rerank: req.body?.rerank === true,
  };

  try {
    const result = await backendFetch("/search/xray/chat", {
      method: "POST",
      token,
      body,
    });

    if (result.status >= 200 && result.status < 300) {
      const issued = result.data?.issued_api_key;
      if (typeof issued === "string" && issued.trim()) {
        setSessionCookie(res, issued.trim());
      }
      const safe = { ...result.data };
      delete safe.issued_api_key;
      if (issued) safe.session_upgraded = true;
      return res.status(result.status).json(safe);
    }
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message || "Falha no chat" });
  }
});

app.post("/api/chat/reset", async (req, res) => {
  try {
    const result = await backendFetch("/search/xray/chat/reset", {
      method: "POST",
      token: getToken(req),
      body: { session_id: req.body?.session_id || undefined },
    });
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
});

app.get("/api/conversations", async (req, res) => {
  try {
    const result = await backendFetch("/conversations", {
      token: getToken(req),
      query: { limit: req.query.limit, offset: req.query.offset },
    });
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
});

app.get("/api/conversations/:id", async (req, res) => {
  try {
    const result = await backendFetch(`/conversations/${encodeURIComponent(req.params.id)}`, {
      token: getToken(req),
    });
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
});

app.get("/api/consultas/:searchId", async (req, res) => {
  try {
    const result = await backendFetch(
      `/auth/consultas/${encodeURIComponent(req.params.searchId)}`,
      { token: getToken(req) },
    );
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
});

app.delete("/api/conversations/:id", async (req, res) => {
  try {
    const result = await backendFetch(`/conversations/${encodeURIComponent(req.params.id)}`, {
      method: "DELETE",
      token: getToken(req),
    });
    return sendBackend(res, result);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
});

if (IS_PROD) {
  const dist = path.join(ROOT, "dist");
  app.use(express.static(dist, { maxAge: "1h", index: false }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    return res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
});

app.listen(PORT, () => {
  console.log(
    `[ui] listening on :${PORT}  api=${API_BASE || "(unset)"}  prod=${IS_PROD}`,
  );
});
