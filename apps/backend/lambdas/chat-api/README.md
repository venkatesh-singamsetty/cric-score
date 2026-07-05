# 🤖 chat-api — Agentic RAG Lambda

The `chat-api` Lambda is the AI engine of CricScore. It implements an **Agentic Retrieval-Augmented Generation (RAG)** pipeline using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) to power an intelligent cricket assistant.

> 📖 See the **[Full AI Architecture Guide](../../../../docs/ai_architecture.md)** for a deep-dive including sequence diagrams, troubleshooting history, and cost analysis.

## How It Works

```
Fan asks: "What are the break timings in my tournament?"
         │
         ▼
  1. chatHandler.js initializes MCP Server + Client via InMemoryTransport
         │
         ▼
  2. LLM receives: system prompt + tool schemas (no credentials)
         │
         ▼
  3. LLM decides: "I need search_tournament_rules"
         │
         ▼
  4. chatHandler delegates tool call → MCP Server
         │
         ▼
  5. MCP Server executes: embed query → pgvector cosine search
         │
         ▼
  6. MCP returns top 3 matching rule chunks
         │
         ▼
  7. LLM generates human-readable answer from the chunks
         │
         ▼
  Fan receives: tournament-specific answer ✅
```

## File Structure

```
chat-api/
├── index.js                      # Lambda entry point — thin router only
│
├── config/                       # Shared configuration (injected via env vars)
│   ├── db.js                     # PostgreSQL pool + setSearchPath (dev/prod)
│   └── llm.js                    # OpenAI client, model name, embedding config
│
├── handlers/                     # Business logic per route
│   ├── chatHandler.js            # POST /chat — full Agentic MCP loop
│   ├── summaryHandler.js         # POST /chat/summary — AI match report
│   └── uploadRulesHandler.js     # POST /rules/upload — PDF → pgvector
│
└── mcp/                          # Model Context Protocol implementation
    ├── server.js                 # MCP Server — registers tools
    └── tools/
        ├── executeSql.js         # Tool: execute_sql (Text-to-SQL RAG)
        └── searchRules.js        # Tool: search_tournament_rules (Vector RAG)
```

## MCP Tools

### `execute_sql`

- **Type:** Text-to-SQL RAG
- **What it does:** LLM generates a SQL SELECT query; MCP Server executes it READ-ONLY against PostgreSQL
- **Security:** Runs inside `BEGIN READ ONLY` transaction with `SET statement_timeout = 3000`
- **When triggered:** Questions about match scores, player stats, innings, history

### `search_tournament_rules`

- **Type:** Vector RAG (pgvector cosine similarity)
- **What it does:** Embeds the user query via `text-embedding-3-small`, searches the `tournament_rules` table
- **When triggered:** Questions about rules, timings, formats, eligibility, tiebreakers, LBW, weather

## Dev/Prod Environment Isolation

The `DB_SCHEMA` environment variable (injected by Terraform as `dev` or `prod`) scopes all database queries to the correct PostgreSQL schema:

```js
// config/db.js
await client.query(`SET search_path TO ${dbSchema}, public`);
//                                              ↑ always include public
//                                                so pgvector operators work
```

The `public` schema is always appended to keep pgvector's `<=>` operator accessible regardless of which environment schema is active.

## Required Environment Variables

| Variable       | Source             | Description                           |
| -------------- | ------------------ | ------------------------------------- |
| `DATABASE_URL` | AWS Secrets / TF   | Aiven PostgreSQL connection string    |
| `DB_SCHEMA`    | Terraform variable | `dev` or `prod`                       |
| `LLM_API_KEY`  | GitHub Secret      | OpenRouter API key                    |
| `LLM_BASE_URL` | Terraform variable | `https://openrouter.ai/api/v1`        |
| `LLM_MODEL`    | _(Optional)_       | Override model (default: gpt-4o-mini) |

## Lambda Configuration (Terraform)

| Setting | Value      | Reason                                             |
| ------- | ---------- | -------------------------------------------------- |
| Memory  | 1024 MB    | Required for pdf-parse to avoid OOM + GC thrashing |
| Timeout | 30 sec     | Allows for PDF processing + multi-step LLM calls   |
| Runtime | Node.js 24 | Latest LTS for top V8 performance                  |

## Local Testing

```bash
cd apps/backend/lambdas/chat-api
npm install
node -e "require('./index.js'); console.log('✅ Loads clean')"
```
