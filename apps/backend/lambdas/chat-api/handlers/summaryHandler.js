const { openai, LLM_MODEL } = require("../config/llm");
const { pool, setSearchPath } = require("../config/db");

/**
 * Generates an AI-powered post-match summary using match statistics
 * fetched directly from the database.
 *
 * The summary is cached in the `matches.ai_summary` column after first
 * generation to avoid re-generating on every request.
 *
 * @param {string} matchId - UUID of the match to summarize
 * @param {object} corsHeaders - CORS headers to include in response
 * @returns {object} Lambda response with { summary } or error
 */
async function summaryHandler(matchId, corsHeaders) {
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
    await setSearchPath(client);

    // Fetch match metadata
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

    // Return cached summary if already generated
    if (m.ai_summary) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ summary: m.ai_summary }),
      };
    }

    // Fetch top batting performances
    const battersRes = await client.query(
      `SELECT p.name, p.runs, p.balls_faced, p.fours, p.sixes, i.batting_team_name
       FROM players p
       JOIN innings i ON p.inning_id = i.id
       WHERE i.match_id = $1 AND p.runs > 0
       ORDER BY p.runs DESC LIMIT 5`,
      [matchId],
    );

    // Fetch top bowling performances
    const bowlersRes = await client.query(
      `SELECT b.name, b.wickets, b.runs_conceded, b.overs_completed, i.bowling_team_name
       FROM bowlers b
       JOIN innings i ON b.inning_id = i.id
       WHERE i.match_id = $1 AND (b.wickets > 0 OR b.overs_completed > 0)
       ORDER BY b.wickets DESC, b.runs_conceded ASC LIMIT 5`,
      [matchId],
    );

    // Format overs to prevent AI hallucination
    const formatOvers = (o) => {
      if (!o) return "0 overs";
      const parts = o.toString().split(".");
      const overs = parts[0];
      const balls = parts.length > 1 ? parts[1] : "0";
      return `${o} overs (${overs} completed overs and ${balls} balls)`;
    };

    // Build LLM prompt with match context
    const prompt = `You are a factual cricket analyst.
Please generate a simple, concise 1-2 paragraph post-match summary for the following match. Do not be overly creative or dramatic. Keep it straightforward.
CRITICAL INSTRUCTIONS:
- Always write out overs in plain English (e.g., '5 balls' or '1 over and 2 balls') rather than using decimal notation like '0.5 overs' or '1.1 overs'.
- Mention the toss details: ${m.toss_winner || "Unknown"} won the toss and elected to ${m.toss_decision || "BAT"}.
At the end, name the "Man of the Match" based on the statistics and give a brief 1 sentence reason.

Match: ${m.team_a_name} vs ${m.team_b_name}
Result/Status: ${m.status} (Winner: ${m.match_winner || "TBD"})
Score 1: ${m.team_a_name} - ${m.team_a_score}/${m.team_a_wickets} in ${formatOvers(m.team_a_overs)}
Score 2: ${m.team_b_name} - ${m.team_b_score}/${m.team_b_wickets} in ${formatOvers(m.team_b_overs)}

Top Batting Performances:
${battersRes.rows
  .map(
    (b) =>
      `- ${b.name} (${b.batting_team_name}): ${b.runs} off ${b.balls_faced} balls (${b.fours}x4, ${b.sixes}x6)`,
  )
  .join("\n")}

Top Bowling Performances:
${bowlersRes.rows
  .map(
    (b) =>
      `- ${b.name} (${b.bowling_team_name}): ${b.wickets}/${b.runs_conceded} in ${formatOvers(b.overs_completed)}`,
  )
  .join("\n")}`;

    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    });

    summary = response.choices[0].message.content;

    // Cache the summary in the database for future requests
    await client.query("UPDATE matches SET ai_summary = $1 WHERE id = $2", [
      summary,
      matchId,
    ]);
  } catch (err) {
    console.error("summaryHandler error:", err);
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

module.exports = { summaryHandler };
