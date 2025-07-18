import { logError } from 'utils';

import { CONFIG } from './config';
import { EventsGenerator } from './events-generator';
import { Producer } from './kafka/producer';

async function main() {
  const generator = new EventsGenerator();
  const stream = generator.stream(CONFIG.GENERATOR_COUNT);

  const producer = new Producer({
    clientId: 'bacefook-producer',
    brokers: [CONFIG.KAFKA_BROKER],
    logLevel: 'ERROR',
  });

  await producer.connect();

  let sentThisSecond = 0;
  setInterval(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ Sent ${sentThisSecond} message(s) in the last second`);
    sentThisSecond = 0;
  }, 1000);

  for await (const batch of stream) {
    let sent = 0;
    let attempt = 0;
    let delay = 500;

    while (true) {
      try {
        sent = await producer.send(batch);
        break;
      } catch (err) {
        attempt++;
        logError(`Send attempt ${attempt} failed`, err, `Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 30_000);
      }
    }

    sentThisSecond += sent;
  }
}

main().catch((err) => {
  logError('Unhandled error in main()', err);
  process.exit(1);
});
