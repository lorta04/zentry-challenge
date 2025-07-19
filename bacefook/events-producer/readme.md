# Events Producer

This component uses the provided generator to feed data into a Kafka topic.

## How to Run

1.  **Install dependencies:**

    ```
    bun install
    ```

2.  **Set up environment:** Copy the example environment file:

    ```
    cp .env.example .env
    ```

    Adjust `GENERATOR_COUNT` and `MAX_MESSAGES` in the `.env` file as needed. The program will exit after the total number of generated events has exceeded `MAX_MESSAGES`.

3.  **Ensure Redpanda is running:** Make sure the Redpanda (Kafka) broker is up and running before starting the producer.
4.  **Start the producer:**

    ```
    bun run start
    ```

## Testing

A small test file for the Kafka producer exists. To run the test, use the following command:

```
bun run test
```

## Environment Variables

- `KAFKA_BROKER`: The address of the Kafka broker.
- `KAFKA_TOPIC`: The Kafka topic to which messages will be sent.
- `GENERATOR_COUNT`: The `count` argument passed to the `events-generator`.
- `MAX_MESSAGES`: The total number of messages for the program to generate and feed into the Kafka topic before it exits.
