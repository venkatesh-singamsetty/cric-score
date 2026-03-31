import { Kafka } from 'kafkajs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Re-declare __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Physical Aiven Connection Details (From terraform.tfvars)
const BROKER = "cricscore-kafka-venky-cric-score.l.aivencloud.com:17729";

const kafka = new Kafka({
  clientId: 'cricscore-showcase-consumer',
  brokers: [BROKER],
  ssl: {
    rejectUnauthorized: false,
    ca: [fs.readFileSync(path.join(__dirname, '../certs/ca.pem'), 'utf-8')],
    key: fs.readFileSync(path.join(__dirname, '../certs/key.pem'), 'utf-8'),
    cert: fs.readFileSync(path.join(__dirname, '../certs/cert.pem'), 'utf-8'),
  },
});

const consumer = kafka.consumer({ groupId: 'showcase-group-' + Date.now() });

const runShowcase = async () => {
  console.log('\n🏏 [CricScore] Connecting to Aiven Kafka...');
  console.log(`📍 Broker: ${BROKER}`);

  await consumer.connect();
  console.log('✅ [CricScore] Connected! Listening for "score-updates" topic...');

  await consumer.subscribe({ topic: 'score-updates', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        
        // Find the correct ball/over fields from the payload
        const currentOver = payload.currentOvers ?? payload.overs ?? (payload.ballData ? payload.ballData.overNumber : 0);
        const currentBall = payload.currentBalls ?? payload.balls ?? (payload.ballData ? payload.ballData.ballNumber : 0);
        const totalRuns = payload.explicitTotalRuns ?? payload.totalRuns ?? 0;
        const totalWickets = payload.explicitTotalWickets ?? payload.totalWickets ?? 0;

        console.log('\n----------------------------------------');
        console.log('🔥 [KAFKA EVENT] New Score Update Received');
        console.log('----------------------------------------');
        console.log(`🏟️ Match ID: ${payload.matchId}`);
        console.log(`🏏 Over: ${currentOver}.${currentBall}`);
        console.log(`📊 Score: ${totalRuns} / ${totalWickets}`);
        
        if (payload.ballData) {
          const ball = payload.ballData;
          if (ball.isWicket) {
             console.log(`☝️  EVENT: OUT! ${ball.batterName} was dismissed (${ball.wicketType}) by ${ball.bowlerName}`);
          } else {
             const runPlural = ball.runs === 1 ? 'run' : 'runs';
             console.log(`📝 EVENT: ${ball.batterName} scored ${ball.runs} ${runPlural} off ${ball.bowlerName}`);
          }
        }
        
        console.log('----------------------------------------\n');
      } catch (e) {
        console.log('📦 [RAW EVENT]:', message.value.toString());
      }
    },
  });
};

runShowcase().catch(err => {
  console.error('\n❌ [Kafka Error]:', err.message);
  process.exit(1);
});
