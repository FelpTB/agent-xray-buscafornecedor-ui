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

Arquivos prontos: `railway.toml`, `nixpacks.toml`.

1. Crie um serviço a partir deste repositório.
2. Defina `BUSCA_API_BASE_URL` (API de busca) e `COOKIE_SECURE=1`.
3. **Não** defina `PORT` — o Railway injeta.
4. Healthcheck: `GET /health`.

Na API de busca, inclua a origem desta UI em `CORS_ORIGINS` só se algum cliente browser chamar a API direto. Com o BFF, o browser fica same-origin e CORS da API não entra no caminho.

Na API, o chat exige `XRAY_ENABLED=1` (já é o padrão do serviço `buscafornecedor-searchapi`).

## Segurança

- Segredos só em variáveis de ambiente.
- Cookie de sessão `HttpOnly` + `SameSite=Lax` (+ `Secure` em produção).
- O BFF não devolve a API key plaintext ao cliente.
- Logs do BFF não imprimem token.
