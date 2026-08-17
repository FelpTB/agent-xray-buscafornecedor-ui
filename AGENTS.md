# Memória do agente — UI BuscaFornecedor

Leia isto no início de tarefas não triviais.

## Papel

SPA + BFF que consome a **BuscaFornecedor API+MCP** (`BuscaFornecedor-Api-Mcp-Main` / serviço Railway `buscafornecedor-searchapi`). Não reimplementa busca, embeddings nem Supabase.

## Contratos

| UI (BFF) | Backend |
|----------|---------|
| `POST /api/auth/login` | `POST /auth/login-buyer` |
| `POST /api/auth/register` | `POST /auth/register-buyer` |
| `GET /api/auth/me` | `GET /auth/me` |
| `POST /api/chat` | `POST /search/xray/chat` |
| `GET/DELETE /api/conversations` | `/conversations*` |

Verdade da busca: `src/` no repo da API. Identidade visual: tokens HSL de buscafornecedor.com.br (`--primary: 163 100% 38%`, `--secondary: 211 67% 18%`).

## Regras

1. Não expor API key / JWT no HTML.
2. Não chamar Qdrant / OpenAI / service role daqui.
3. Textos de configuração em linguagem de compras, não de vetores.
4. Deploy: Railway (`railway.toml`); health em `/health`.
