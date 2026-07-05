const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");

function createCricScoreMcpServer(pool) {
  const server = new McpServer({
    name: "CricScore Database Server",
    version: "1.0.0",
  });

  // Tool 1: execute_sql
  server.tool(
    "execute_sql",
    "Execute a READ-ONLY SQL query against the CricScore PostgreSQL database.",
    {
      query: z
        .string()
        .describe(
          "The PostgreSQL query to execute. MUST be a SELECT statement.",
        ),
    },
    async ({ query }) => {
      console.log("MCP Server Executing SQL:", query);
      let queryResult = "";

      try {
        const sqlClient = await pool.connect();
        try {
          const dbSchema = process.env.DB_SCHEMA || "public";
          await sqlClient.query(`SET search_path TO ${dbSchema}`);
          await sqlClient.query("BEGIN READ ONLY;");
          await sqlClient.query("SET statement_timeout = 3000;"); // 3s timeout
          const res = await sqlClient.query(query);
          queryResult = JSON.stringify(res.rows).slice(0, 2000);
          await sqlClient.query("COMMIT;");
        } catch (err) {
          await sqlClient.query("ROLLBACK;");
          console.error("SQL Tool Error:", err);
          queryResult = "Error executing SQL: " + err.message;
        } finally {
          sqlClient.release();
        }
      } catch (err) {
        queryResult = "Failed to connect to database.";
      }

      return {
        content: [{ type: "text", text: queryResult || "No results found." }],
      };
    },
  );

  // Tool 2: search_tournament_rules
  server.tool(
    "search_tournament_rules",
    "Search the tournament rulebook PDF for specific rules, procedures, or conditions.",
    {
      query: z
        .string()
        .describe(
          "The search query detailing the rule or situation to look up.",
        ),
    },
    async ({ query }) => {
      console.log("MCP Server Searching Rules:", query);
      let searchResult = "";

      try {
        const baseURL =
          process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
        const embeddingReq = await fetch(`${baseURL}/embeddings`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LLM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/text-embedding-3-small",
            input: query,
          }),
        });

        if (!embeddingReq.ok) throw new Error("Embedding API failed");

        const embeddingRes = await embeddingReq.json();
        const embedding = embeddingRes.data[0].embedding;
        const embeddingVectorString = `[${embedding.join(",")}]`;

        const sqlClient = await pool.connect();
        try {
          const dbSchema = process.env.DB_SCHEMA || "public";
          // Include public so pgvector operators (<=> etc.) remain visible
          await sqlClient.query(`SET search_path TO ${dbSchema}, public`);

          const res = await sqlClient.query(
            "SELECT chunk_text FROM tournament_rules ORDER BY embedding <=> $1::public.vector LIMIT 3",
            [embeddingVectorString],
          );

          if (res.rows.length > 0) {
            searchResult = res.rows
              .map((r) => r.chunk_text)
              .join("\n\n---\n\n");
          } else {
            searchResult =
              "No rules document has been uploaded yet, or no relevant rules found.";
          }
        } finally {
          sqlClient.release();
        }
      } catch (err) {
        console.error("Rules Search Error:", err);
        searchResult = "Error searching rules: " + err.message;
      }

      return {
        content: [{ type: "text", text: searchResult }],
      };
    },
  );

  return server;
}

module.exports = { createCricScoreMcpServer };
