import { GraphModule } from '../../modules/graph';
import { KafkaModule } from '../../modules/kafka';
import { MongoModule } from '../../modules/mongo';
import { Processor } from '../../modules/processor';
import { CONFIG } from './config';

async function main() {
  const mongo = new MongoModule({
    uri: CONFIG.MONGO_URI,
    dbName: CONFIG.MONGO_DB,
  });

  const kafka = new KafkaModule({
    brokers: CONFIG.KAFKA_BROKERS,
    topic: CONFIG.KAFKA_TOPIC,
    groupId: CONFIG.KAFKA_GROUP_ID,
  });

  const graph = new GraphModule();

  const processor = new Processor({
    resume: CONFIG.RESUME,
    mongo,
    kafka,
    graph,
  });

  await processor.start();

  const shutdown = async () => {
    await processor.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
