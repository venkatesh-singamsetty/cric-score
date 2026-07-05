# 🤖 MCP — Model Context Protocol

This directory contains the **MCP Server** and all registered **tools** for the CricScore AI Chat Assistant.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard that separates AI tool _definition_ from tool _execution_. In CricScore, it enforces a critical security boundary:

```
┌─────────────────────────────────┐
│  LLM (OpenRouter / gpt-4o-mini) │  ← Sees: tool schemas + result text only
│                                 │  ← Never sees: DATABASE_URL, LLM_API_KEY
└──────────────┬──────────────────┘
               │ Tool call request
               ▼
┌─────────────────────────────────┐
│  MCP Server (server.js)         │  ← Holds: all credentials + execution logic
│  - execute_sql tool             │  ← Runs: SQL queries, vector searches
│  - search_tournament_rules tool │  ← Returns: plain text results to LLM
└─────────────────────────────────┘
```

## Transport

We use `InMemoryTransport` from `@modelcontextprotocol/sdk` — this means the MCP Server runs **entirely within the Lambda execution environment** with zero external network calls or infrastructure costs. It boots in milliseconds.

## Files

```
mcp/
├── server.js          # MCP Server — creates instance and registers all tools
└── tools/
    ├── executeSql.js  # Tool: execute_sql
    └── searchRules.js # Tool: search_tournament_rules
```

## Registered Tools

### `execute_sql` — Text-to-SQL RAG

| Property      | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| **Trigger**   | Questions about scores, stats, players, matches, history       |
| **Input**     | `query: string` — a PostgreSQL SELECT statement                |
| **Execution** | Runs inside `BEGIN READ ONLY` + `SET statement_timeout = 3000` |
| **Output**    | JSON rows (truncated to 2000 chars for LLM context window)     |
| **Security**  | Enforces read-only transaction; no DDL or DML possible         |

### `search_tournament_rules` — Vector RAG

| Property      | Value                                                           |
| ------------- | --------------------------------------------------------------- |
| **Trigger**   | Questions about rules, timings, formats, LBW, eligibility, DLS  |
| **Input**     | `query: string` — natural language rule question                |
| **Execution** | Embeds query → pgvector cosine similarity search → top 3 chunks |
| **Model**     | `openai/text-embedding-3-small` via OpenRouter                  |
| **Output**    | Top 3 matching rule text chunks joined by `---`                 |

## Adding a New Tool

1. Create `tools/myNewTool.js`:

```js
const { pool, setSearchPath } = require("../../config/db");

async function myNewTool({ param }) {
  // ... tool logic
  return { content: [{ type: "text", text: result }] };
}

module.exports = { myNewTool };
```

2. Register in `server.js`:

```js
const { myNewTool } = require("./tools/myNewTool");

server.tool("my_new_tool", "Description...", { param: z.string() }, myNewTool);
```

3. The LLM will automatically discover the new tool on next invocation — no other changes needed!
