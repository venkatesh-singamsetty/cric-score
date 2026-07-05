// Polyfills for pdf-parse in modern Node.js environments
global.DOMMatrix = global.DOMMatrix || class DOMMatrix {};
global.ImageData = global.ImageData || class ImageData {};
global.Path2D = global.Path2D || class Path2D {};

const { PDFParse } = require("pdf-parse");
const { OpenAI } = require("openai");

async function uploadRulesHandler(event, pool, corsHeaders) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { fileBase64 } = body;

    if (!fileBase64) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "No PDF file provided" }),
      };
    }

    // Decode Base64 PDF
    const pdfBuffer = Buffer.from(
      fileBase64.split(",")[1] || fileBase64,
      "base64",
    );

    // Extract text using PDFParse v2 API
    const parser = new PDFParse({ data: pdfBuffer });
    const data = await parser.getText();
    const fullText = data.text;

    // Basic Chunking Strategy (Split by paragraphs or 1000 characters)
    const rawChunks = fullText
      .split(/\n\s*\n/)
      .filter((c) => c.trim().length > 10);
    const chunks = [];

    for (const chunk of rawChunks) {
      if (chunk.length > 2000) {
        // Simple sub-chunking if a paragraph is too long
        const subChunks = chunk.match(/.{1,1500}/g) || [];
        chunks.push(...subChunks);
      } else {
        chunks.push(chunk);
      }
    }

    // Removed OpenAI SDK initialization since we will use native fetch for OpenRouter

    const client = await pool.connect();

    try {
      const dbSchema = process.env.DB_SCHEMA || "public";
      await client.query(`SET search_path TO ${dbSchema}`);

      // Clear old rules if user uploads a new one (or we could keep them, but let's clear for simplicity)
      await client.query("DELETE FROM tournament_rules");

      const validChunks = chunks.filter((c) => c.trim().length > 0);
      let insertedCount = 0;

      if (validChunks.length > 0) {
        // Generate embeddings using native fetch to avoid OpenAI SDK compatibility issues with OpenRouter
        const baseURL =
          process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
        const response = await fetch(`${baseURL}/embeddings`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LLM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/text-embedding-3-small", // OpenRouter requires the provider prefix
            input: validChunks,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(
            `Embedding API Error: ${response.status} - ${errText}`,
          );
        }

        const embeddingRes = await response.json();

        for (let i = 0; i < validChunks.length; i++) {
          const chunk = validChunks[i];
          const embedding = embeddingRes.data[i].embedding;
          const embeddingVectorString = `[${embedding.join(",")}]`;

          await client.query(
            "INSERT INTO tournament_rules (chunk_text, embedding) VALUES ($1, $2)",
            [chunk, embeddingVectorString],
          );
          insertedCount++;
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Rules successfully parsed and embedded",
          chunksProcessed: insertedCount,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Rules Upload Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to process PDF" }),
    };
  }
}

module.exports = { uploadRulesHandler };
