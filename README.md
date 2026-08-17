# BuscaFornecedor · Agente de busca (UI)

Interface conversacional para a [API+MCP de busca](https://github.com) (`buscafornecedor-searchapi`). Substitui o harness X-Ray por um produto voltado a profissionais de compras: login sólido, linguagem natural e a identidade visual de [buscafornecedor.com.br](https://buscafornecedor.com.br/).

## O que este app faz

- **Login / cadastro** contra `POST /auth/login-buyer` e `POST /auth/register-buyer` (Supabase no backend).
- Sessão em **cookie httpOnly** — a API key / JWT não aparece na tela.
- **Chat** com o agente de busca em `POST /search/xray/chat` (mesma inteligência do X-Ray).
- Histórico em `GET|DELETE /conversations`.
- Preferências explicadas em português (quantidade de resultados, reordenação com IA).

O browser **não** fala com Qdrant, OpenAI ou Supabase. Só o BFF (`server/index.js`) chama a API.

## Desenvolvimento local

Requisitos: Node 20+.

```bash
cp .env.example .env
npm install
npm run dev
```

- UI: http://127.0.0.1:5173
- BFF: http://127.0.0.1:8787 (`/health`)

Variável obrigatória:

| Variável | Função |
|----------|--------|
| `BUSCA_API_BASE_URL` | URL da API no Railway (sem barra no final) |

## Railway

Arquivos: `railway.toml`, `nixpacks.toml` (Node 20, `npm ci --include=dev`, `npm run build`, `npm start`).

1. New Project → Deploy from GitHub → `FelpTB/agent-xray-buscafornecedor-ui`.
2. Variáveis do serviço:

| Variável | Valor |
|----------|--------|
| `BUSCA_API_BASE_URL` | `https://buscafornecedor-searchapi-buscafornecedor.up.railway.app` (sem barra no final) |
| `COOKIE_SECURE` | `1` |
| `NODE_ENV` | `production` (o Railway costuma injetar) |

3. **Não** defina `PORT` — o Railway injeta.
4. Healthcheck: `GET /health` (já no `railway.toml`).
5. Gere um domínio público (Settings → Networking → Generate domain).

O BFF serve o SPA em `dist/` e chama a API no servidor. O browser não precisa de CORS na API.

Na API de busca, o chat (`POST /search/xray/chat`) precisa estar montado (já é o caso no `main` atual). `QDRANT_BM25_VECTOR_NAME` é opcional: sem ele a busca específica usa só vetores densos.

## Segurança

- Segredos só em variáveis de ambiente.
- Cookie de sessão `HttpOnly` + `SameSite=Lax` (+ `Secure` em produção).
- O BFF não devolve a API key plaintext ao cliente.
- Logs do BFF não imprimem token.
