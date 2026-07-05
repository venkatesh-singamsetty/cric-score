const { OpenAI } = require("openai");

async function generateSummary(matchId, pool, corsHeaders) {
  if (!matchId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "matchId is required" }),
    };
  }

  const client = await pool.connect();
  let summary = "";
  try {
    const dbSchema = process.env.DB_SCHEMA || "public";
    await client.query(`SET search_path TO ${dbSchema}`);

    // Fetch Match Data
    const matchRes = await client.query("SELECT * FROM matches WHERE id = $1", [
      matchId,
    ]);
    if (matchRes.rows.length === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Match not found" }),
      };
    }
    const m = matchRes.rows[0];

    // Check if summary already exists
    if (m.ai_summary) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ summary: m.ai_summary }),
      };
    }

    // Fetch Top Batters
    const battersRes = await client.query(
      `
      SELECT p.name, p.runs, p.balls_faced, p.fours, p.sixes, i.batting_team_name
      FROM players p
      JOIN innings i ON p.inning_id = i.id
      WHERE i.match_id = $1 AND p.runs > 0
      ORDER BY p.runs DESC
      LIMIT 5
    `,
      [matchId],
    );

    // Fetch Top Bowlers
    const bowlersRes = await client.query(
      `
      SELECT b.name, b.wickets, b.runs_conceded, b.overs_completed, i.bowling_team_name
      FROM bowlers b
      JOIN innings i ON b.inning_id = i.id
      WHERE i.match_id = $1 AND (b.wickets > 0 OR b.overs_completed > 0)
      ORDER BY b.wickets DESC, b.runs_conceded ASC
      LIMIT 5
    `,
      [matchId],
    );

    // Construct the context for the LLM
    const prompt = `
You are an expert cricket commentator and analyst. 
Please generate a captivating 2-3 paragraph post-match summary for the following match.
At the end, predict the "Man of the Match" based on the statistics and explain why.

Match: ${m.team_a_name} vs ${m.team_b_name}
Result/Status: ${m.status} (Winner: ${m.match_winner || "TBD"})
Score 1: ${m.team_a_name} - ${m.team_a_score}/${m.team_a_wickets} (${m.team_a_overs} overs)
Score 2: ${m.team_b_name} - ${m.team_b_score}/${m.team_b_wickets} (${m.team_b_overs} overs)

Top Batting Performances:
${battersRes.rows.map((b) => `- ${b.name} (${b.batting_team_name}): ${b.runs} off ${b.balls_faced} balls (${b.fours}x4, ${b.sixes}x6)`).join("\n")}

Top Bowling Performances:
${bowlersRes.rows.map((b) => `- ${b.name} (${b.bowling_team_name}): ${b.wickets}/${b.runs_conceded} in ${b.overs_completed} overs`).join("\n")}
    `;

    const defaultModel =
      process.env.LLM_BASE_URL && process.env.LLM_BASE_URL.includes("groq")
        ? "llama-3.3-70b-versatile"
        : "gpt-4o-mini";

    const openai = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    });

    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || defaultModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    });

    summary = response.choices[0].message.content;

    // Save summary to database
    await client.query("UPDATE matches SET ai_summary = $1 WHERE id = $2", [
      summary,
      matchId,
    ]);
  } catch (err) {
    console.error("Summary Generation Error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to generate summary" }),
    };
  } finally {
    client.release();
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ summary }),
  };
}

module.exports = { generateSummary };
