const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

function createCricScoreMcpServer(pool, isAdmin = false) {
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
          let rows = res.rows;
          if (!isAdmin && rows.length > 0) {
            rows = rows.map((row) => {
              const { scorer_email, ...safeRow } = row;
              return safeRow;
            });
          }
          queryResult = JSON.stringify(rows).slice(0, 2000);
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
  // Tool 3: send_email (Admin Only)
  if (isAdmin) {
    server.tool(
      "delete_match",
      "Delete one, multiple, or ALL matches from the database. Pass a single match ID, an array of match IDs, or the special string 'ALL' to delete everything.",
      {
        matchId: z
          .union([z.string(), z.array(z.string())])
          .describe(
            "A single match UUID, an array of match UUIDs, or the string 'ALL' to delete all matches.",
          ),
      },
      async ({ matchId }) => {
        console.log("MCP Server Deleting Match(es):", matchId);
        const sqlClient = await pool.connect();
        try {
          const dbSchema = process.env.DB_SCHEMA || "public";
          await sqlClient.query(`SET search_path TO ${dbSchema}`);

          let deletedCount = 0;

          if (matchId === "ALL") {
            // Delete all matches
            const res = await sqlClient.query(
              "DELETE FROM matches RETURNING id",
            );
            deletedCount = res.rowCount;
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully deleted ALL ${deletedCount} match(es).`,
                },
              ],
            };
          } else if (Array.isArray(matchId)) {
            // Delete multiple matches
            const placeholders = matchId.map((_, i) => `$${i + 1}`).join(", ");
            const res = await sqlClient.query(
              `DELETE FROM matches WHERE id IN (${placeholders}) RETURNING id`,
              matchId,
            );
            deletedCount = res.rowCount;
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully deleted ${deletedCount} match(es): ${matchId.join(", ")}`,
                },
              ],
            };
          } else {
            // Delete single match
            await sqlClient.query("DELETE FROM matches WHERE id = $1", [
              matchId,
            ]);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully deleted match ${matchId}.`,
                },
              ],
            };
          }
        } catch (err) {
          console.error("Delete Match Tool Error:", err);
          return {
            content: [
              {
                type: "text",
                text: `Failed to delete match(es): ${err.message}`,
              },
            ],
          };
        } finally {
          sqlClient.release();
        }
      },
    );

    server.tool(
      "send_email",
      "Send an email to one or more recipients using AWS SES.",
      {
        to: z.array(z.string()).describe("Array of recipient email addresses."),
        subject: z.string().describe("The subject of the email."),
        body: z.string().describe("The HTML or plain text body of the email."),
      },
      async ({ to, subject, body }) => {
        console.log("MCP Server Sending Email to:", to);
        const ses = new SESClient({
          region: process.env.AWS_REGION || "us-east-1",
        });
        const sourceEmail =
          process.env.TF_SES_SOURCE_EMAIL ||
          "noreply@venkateshsingamsetty.site";

        try {
          const command = new SendEmailCommand({
            Source: sourceEmail,
            Destination: { ToAddresses: to },
            Message: {
              Subject: { Data: subject },
              Body: { Html: { Data: body } },
            },
          });
          await ses.send(command);
          return {
            content: [
              {
                type: "text",
                text: `Successfully sent email to ${to.join(", ")}`,
              },
            ],
          };
        } catch (err) {
          console.error("Email Tool Error:", err);
          return {
            content: [
              { type: "text", text: `Failed to send email: ${err.message}` },
            ],
          };
        }
      },
    );
  }

  return server;
}

module.exports = { createCricScoreMcpServer };
