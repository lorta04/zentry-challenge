# Backend

## Processor

This component reads events from the Kafka topic, processes them to construct a relationship graph, updates MongoDB with the most recent state of the graph, and also saves all observed events to MongoDB.

### How to Run

1.  **Install dependencies:**

    ```
    bun install
    ```

2.  **Set up environment:** Copy the example environment file:

    ```
    cp .env.example .env
    ```

    Adjust the environment variables in the `.env` file as needed.

3.  **Ensure Redpanda and MongoDB are running:** Make sure the Redpanda (Kafka) broker and MongoDB instance are up and running before starting the processor.
4.  **Start the processor:**

    ```
    bun run start:processor
    ```

### Testing

Unit tests for the graph module are available. To run them, use the following command:

```
bun run test
```

### Environment Variables

- `MONGO_URI`: The connection URI for the MongoDB instance.
- `MONGO_DB`: The name of the database to use in MongoDB.
- `KAFKA_BROKERS`: A comma-separated list of Kafka broker addresses.
- `KAFKA_TOPIC`: The Kafka topic from which to consume events.
- `KAFKA_GROUP_ID`: The consumer group ID for Kafka.
- `RESUME`: Set to `1` to resume processing from the last saved offset, or `0` to start from the beginning of the topic.
