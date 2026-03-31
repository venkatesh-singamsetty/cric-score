import { Kafka } from 'kafkajs';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Re-declare __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Physical Aiven Connection Details (From terraform.tfvars)
const KAFKA_BROKER = "cricscore-kafka-venky-cric-score.l.aivencloud.com:17729";
const POSTGRES_URL = "postgres://avnadmin:AVNS_wzjK8g56LJXN1zpqHiI@cricscore-db-venky-cric-score.b.aivencloud.com:17727/defaultdb";

// 3. Setup Kafka Client (mTLS)
const kafka = new Kafka({
  clientId: 'cricscore-deep-recovery-worker',
  brokers: [KAFKA_BROKER],
  ssl: {
    rejectUnauthorized: false,
    ca: [fs.readFileSync(path.join(__dirname, '../certs/ca.pem'), 'utf-8')],
    key: fs.readFileSync(path.join(__dirname, '../certs/key.pem'), 'utf-8'),
    cert: fs.readFileSync(path.join(__dirname, '../certs/cert.pem'), 'utf-8'),
  },
});

// 4. Setup PostgreSQL Client (Adding ssl bypass for Aiven self-signed certs)
const pClient = new pg.Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const consumer = kafka.consumer({ groupId: 'deep-recovery-group-' + Date.now() });

const runRecovery = async () => {
  console.log('\n🏥 [CricScore Deep Recovery] Starting Full Statistical Reconstruction...');
  await consumer.connect();

  console.log('✅ [CricScore Recovery] Connected to Postgres & Kafka.');
  await consumer.subscribe({ topic: 'score-updates', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        const ball = payload.ballData;
        const inningId = payload.inningId;

        if (ball) {
            console.log(`🔎 Reconstructing: Inning [${inningId}] Over ${ball.overNumber}.${ball.ballNumber}`);

            // A. Recover the Ball Event
            const res = await pClient.query(
                'SELECT id FROM ball_events WHERE inning_id = $1 AND over_number = $2 AND ball_number = $3',
                [inningId, ball.overNumber, ball.ballNumber]
            );

            if (res.rowCount === 0) {
                await pClient.query(
                    `INSERT INTO ball_events (inning_id, over_number, ball_number, bowler_name, batter_name, runs, is_extra, extra_type, extra_runs, is_wicket, wicket_type, fielder_name, commentary) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [inningId, ball.overNumber, ball.ballNumber, ball.bowlerName, ball.batterName, ball.runs, ball.isExtra, ball.extraType, ball.extraRuns, ball.isWicket, ball.wicketType, ball.fielderName || null, ball.commentary || null]
                );
                console.log(`📝 Ball Recovered.`);
            }

            // B. Reconstruct Aggregates (Live Calculation)
            const isWide = ball.extraType === 'WIDE';
            const isNoBall = ball.extraType === 'NO_BALL';
            const isBye = ball.extraType === 'BYE';
            const isLegBye = ball.extraType === 'LEG_BYE';
            const totalRunsToAdd = ball.runs + (isWide || isNoBall ? 1 : 0);
            const batterRunsToAdd = (!isWide && !isBye && !isLegBye) ? ball.runs : 0;
            const bowlerRunsToAdd = (!isBye && !isLegBye) ? totalRunsToAdd : 0;
            const isValidBall = !isWide && !isNoBall;

            // 1. Update Player Stats
            await pClient.query(
                `UPDATE players SET 
                    runs = runs + $1, 
                    balls_faced = balls_faced + $2,
                    fours = fours + $3,
                    sixes = sixes + $4,
                    is_out = $5,
                    wicket_by = $6,
                    wicket_type = $7,
                    fielder_name = $8
                 WHERE inning_id = $9 AND name = $10`,
                [
                  batterRunsToAdd, isValidBall ? 1 : 0, ball.runs === 4 ? 1 : 0, ball.runs === 6 ? 1 : 0,
                  ball.isWicket && ball.wicketType !== 'RETIRED_HURT',
                  ball.isWicket ? ball.bowlerName : null, ball.isWicket ? ball.wicketType : null, ball.fielderName || null,
                  inningId, ball.batterName
                ]
            );

            // 2. Update Bowler Stats
            await pClient.query(
                `UPDATE bowlers SET 
                    runs_conceded = runs_conceded + $1, 
                    wickets = wickets + $2,
                    balls = balls + $3
                 WHERE inning_id = $4 AND name = $5`,
                [bowlerRunsToAdd, (ball.isWicket && !['RUN_OUT', 'RETIRED_HURT', 'RETIRED_OUT'].includes(ball.wicketType)) ? 1 : 0, 1, inningId, ball.bowlerName]
            );

            // 3. Update Inning State
            await pClient.query(
                `UPDATE innings SET 
                    total_runs = total_runs + $1, 
                    balls = balls + $2,
                    total_wickets = total_wickets + $3,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4`,
                [totalRunsToAdd, isValidBall ? 1 : 0, ball.isWicket ? 1 : 0, inningId]
            );

            console.log(`📊 Stats Re-Aggregated.`);
        }
      } catch (err) {
        console.error('❌ [Deep Recovery Error]:', err.message);
      }
    },
  });
};

runRecovery().catch(err => {
  console.error('\n❌ [Recovery Error]:', err.message);
  process.exit(1);
});
