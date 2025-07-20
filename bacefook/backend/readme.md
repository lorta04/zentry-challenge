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
    cp .env.processor.example .env
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

## API

This component serves HTTP endpoints consumed by the frontend. On startup, it replays historical events to generate snapshot files for fast access by analytics endpoints. Although it's intended to stay in sync with the database in real time, due to time constraints, it performs a one-time sync on startup instead.

Note: time series endpoints and user-facing APIs are not implemented in this component.

By default, this runs at port `3000`.

### How to Run

1.  **Install dependencies:**

    ```
    bun install
    ```

2.  **Set up environment:** Copy the example environment file:

    ```
    cp .env.api.example .env
    ```

    Adjust the environment variables in the `.env` file as needed.

3.  **Ensure MongoDB is running:** Make sure the MongoDB instance is up and running before starting the API server.
4.  **Start the API server:**

    ```
    bun run start:api
    ```

### Environment Variables

- `MONGO_URI`: The connection URI for the MongoDB instance.
- `MONGO_DB`: The name of the database to use in MongoDB.
- `PORT`: The port that the backend HTTP server listens on (defaults to `3000`).

### Swagger

Swagger UI documentation is available at:

http://localhost:3000/swagger

### API Endpoints

This section details the available API endpoints.

#### `GET /analytics/network`

<details>

Fetches a user's direct relationship network, including their referrer, referrals, and friends.

- **Request**
  - **Query Parameters**:
    - `username` (string, **required**): The name of the user to query.

- **Successful Response (200 OK)**
  - Returns an array of edge objects representing connections.

  ```json
  {
    "ok": true,
    "code": 200,
    "data": [
      {
        "from": "user00001",
        "to": "user00034",
        "type": "Referred"
      },
      {
        "from": "user00034",
        "to": "user10287",
        "type": "Referred"
      },
      {
        "from": "user00034",
        "to": "user00746",
        "type": "Friend"
      }
    ]
  }
  ```

</details>

#### `GET /analytics/leaderboard`

<details>

Gets leaderboards for network strength and referral points gained within a specific date range.

- **Request**
  - **Query Parameters**:
    - `start` (ISO Date string, **required**): The start of the time range.
    - `end` (ISO Date string, **required**): The end of the time range.
    - `count` (number, _optional_, default: 10): The number of entries to return.

- **Successful Response (200 OK)**
  - Returns the snapshot timestamps and two ranked lists.

  ```json
  {
    "ok": true,
    "code": 200,
    "data": {
      "startTimestamp": "2025-07-01T10:00:00.000Z",
      "endTimestamp": "2025-07-20T18:30:00.000Z",
      "referralPoints": [{ "name": "userX", "value": 50 }],
      "networkStrength": [{ "name": "userY", "value": 120 }]
    }
  }
  ```

</details>

#### `GET /users/:name/top-friends`

<details>

Fetches a user's top 3 most influential friends based on their network strength.

- **Request**
  - **Path Parameters**:
    - `name` (string, **required**): The name of the user.

- **Successful Response (200 OK)**
  - Returns an array of up to 3 friends, sorted by strength.

  ```json
  {
    "ok": true,
    "code": 200,
    "data": [
      { "name": "friendA", "strength": 150 },
      { "name": "friendB", "strength": 132 },
      { "name": "friendC", "strength": 98 }
    ]
  }
  ```

</details>

#### `GET /users/:name/friends`

<details>

Gets a paginated list of a user's friends.

- **Request**
  - **Path Parameters**:
    - `name` (string, **required**): The name of the user.

  - **Query Parameters**:
    - `page` (number, _optional_, default: 1): The page number.
    - `pageSize` (number, _optional_, default: 10): The number of results per page.

- **Successful Response (200 OK)**
  - Returns a pagination object with a list of user details.

  ```json
  {
    "ok": true,
    "code": 200,
    "data": {
      "page": 2,
      "pageSize": 4,
      "total": 12,
      "results": [
        {
          "_id": "687cad276a353e960bca8595",
          "name": "user00316",
          "createdAt": "20250720T084448760Z",
          "friendsCount": 4,
          "referralPoints": 1,
          "referralsCount": 1
        }
      ]
    }
  }
  ```

</details>

#### `GET /meta/snapshots`

<details>

Returns the timestamps for the first and last data snapshots available.

- **Request**
  - No parameters.

- **Successful Response (200 OK)**
  - Returns an object with `firstSnapshotTime` and `lastSnapshotTime`.

  ```json
  {
    "ok": true,
    "code": 200,
    "data": {
      "firstSnapshotTime": "2025-01-01T00:00:00.000Z",
      "lastSnapshotTime": "2025-07-20T12:00:00.000Z"
    }
  }
  ```

</details>

#### `GET /meta/users`

<details>

Gets the total number of users in the system.

- **Request**
  - No parameters.

- **Successful Response (200 OK)**
  - Returns an object containing the `totalUsers` count.

  ```json
  {
    "ok": true,
    "code": 200,
    "data": {
      "totalUsers": 15234
    }
  }
  ```

</details>
