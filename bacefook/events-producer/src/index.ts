import { CONFIG } from 'config';
import { EventsGenerator } from 'events-generator';
import { Producer } from 'kafka/producer';
import { logError } from 'utils';

async function main() {
  const generator = new EventsGenerator();
  const stream = generator.stream(CONFIG.GENERATOR_COUNT);

  const producer = new Producer({
    clientId: 'bacefook-producer',
    brokers: [CONFIG.KAFKA_BROKER],
    topic: CONFIG.KAFKA_TOPIC,
    logLevel: 'ERROR',
  });

  await producer.connect();

  let totalSent = 0;
  let sentThisSecond = 0;

  const timer = setInterval(() => {
    console.log(`[${new Date().toISOString()}] ✅ Sent ${sentThisSecond} msg/s`);
    sentThisSecond = 0;
  }, 1000);

  try {
    for await (const batch of stream) {
      if (totalSent >= CONFIG.MAX_MESSAGES) break;

      let sent = 0;
      let attempt = 0;
      let delay = 500;

      while (true) {
        try {
          sent = await producer.send(batch);
          break;
        } catch (err) {
          attempt++;
          logError(`Send attempt ${attempt} failed`, err, `Retrying in ${delay}ms…`);
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 2, 30_000);
        }
      }

      totalSent += sent;
      sentThisSecond += sent;

      if (totalSent >= CONFIG.MAX_MESSAGES) break;
    }
  } finally {
    clearInterval(timer);
    console.log(`🛑 Reached ${totalSent} messages, shutting down.`);
    process.exit(0);
  }
}

main().catch((err) => {
  logError('Unhandled error in main()', err);
  process.exit(1);
});
