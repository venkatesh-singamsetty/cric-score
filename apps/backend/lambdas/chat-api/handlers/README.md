# 🔧 Handlers — Route Business Logic

Each handler maps to a specific API Gateway route on the `chat-api` Lambda.

## Files

| Handler                 | Route                | Trigger                             |
| ----------------------- | -------------------- | ----------------------------------- |
| `chatHandler.js`        | `POST /chat`         | Fan sends a message to AI           |
| `summaryHandler.js`     | `POST /chat/summary` | Frontend requests post-match report |
| `uploadRulesHandler.js` | `POST /rules/upload` | Admin uploads tournament PDF        |

---

### `chatHandler.js` — Agentic AI Chat

The core of the AI pipeline. Implements the full **Agentic RAG loop**:

1. Fetch current match context from DB (if `matchId` provided)
2. Build system prompt with tool routing rules
3. Spin up MCP Server + Client via `InMemoryTransport`
4. Discover available tools from MCP Server
5. Call LLM with messages + tool schemas
6. If LLM requests tool calls → delegate to MCP Server
7. Append tool results to messages
8. Final LLM call → return human-readable reply

**Key design decision:** The LLM runs two completions for tool-augmented queries (one to decide tools, one to formulate the reply). For simple conversational queries with no tool calls, only one LLM call is made.

---

### `summaryHandler.js` — AI Match Summary

Generates a 2-3 paragraph post-match summary with Man of the Match prediction.

- Fetches top batters and bowlers from the database
- Constructs a structured prompt with full match context
- Caches the summary in `matches.ai_summary` — subsequent calls return the cached version instantly (no LLM re-invocation)

---

### `uploadRulesHandler.js` — PDF Ingestion Pipeline

Processes tournament rulebook PDFs into searchable vector embeddings.

**Pipeline steps:**

```
1. Decode Base64 PDF
       ↓
2. Extract text via pdf-parse
   (requires 1024 MB RAM to avoid OOM)
       ↓
3. Chunk text by paragraphs
   (sub-chunk if > 2000 chars)
       ↓
4. Batch embed all chunks in one API call
   (avoids 30s API Gateway timeout)
   Model: text-embedding-3-small
       ↓
5. DELETE existing rules for this environment
       ↓
6. INSERT chunks + embeddings into tournament_rules
       ↓
7. Return { chunksProcessed: N }
```

**Browser API polyfills** (at top of file):

```js
global.DOMMatrix = global.DOMMatrix || class DOMMatrix {};
global.ImageData = global.ImageData || class ImageData {};
global.Path2D = global.Path2D || class Path2D {};
```

`pdf-parse` uses `pdf.js` internally which expects browser canvas APIs. These stubs prevent Lambda crashes.
