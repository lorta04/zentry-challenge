# Bacefook Backend Assignment

This repository contains the solution for the Zentry backend assignment. It uses Bun as the main JavaScript runtime. Please install Bun to run this project.

## Components

This project consists of four components:

### 1. events-producer

This component uses the provided generator to feed data into a Kafka topic with a single partition, achieving a throughput of ~70-100k messages per second with `count = 5` as the input for the events generator.

### 2. backend-processor

This component reads events from the Kafka topic, processes them to construct a relationship graph, and updates MongoDB with the most recent state of the graph in every batch. It also stores all observed events in MongoDB, which allows other sub-services to replay and process the data for analytics.

The relationship graph is designed to be idempotent; duplicate events will not corrupt the state of the graph, provided that the events are ordered (hence the single partition in the Kafka topic). The processor achieves a throughput of around 40k messages per second (~200k messages per 5 seconds).

### 3. backend-api

This component serves the following API endpoints:

- `GET /analytics/network`
- `GET /analytics/leaderboard`
- `GET /users/{name}/top-friends`
- `GET /users/{name}/friends`
- `GET /meta/snapshots`
- `GET /meta/users`

On startup, this service also acts as a replayer for processing events stored in MongoDB for analytical purposes. It retrieves all events from MongoDB in batches of 100,000 records and saves them to disk to prevent memory exhaustion. It then uses these on-disk event chunks to feed the relationship graph and generate snapshot files for every 5 seconds of the records' creation times.

This process is intended to always be up-to-date with MongoDB's state. However, due to time constraints, it currently only syncs with the database on startup.

This component does not yet serve:

- User's referral timeseries graph for any given time range.
- User's referral count for any given time range.
- User's friends count timeseries graph for any given time range.
- User's friends count for any given time range.

The author believes that these four features can be implemented together if attempted.

### 4. frontend

// TODO

## How to Run

A Docker Compose file is included in this directory. Run `docker-compose up -d` to create the following services:

- **Redpanda**: A Kafka broker on port `19092`.
- **Redpanda Console**: A web UI for Redpanda at `http://localhost:8080`. The `bacefook-relationship-events-topic` is automatically created on startup.
- **MongoDB**: An instance is created and available at port `27017`.

Please see the README in each component's folder to continue the startup process for each component.

## What Has Been Accomplished

- Kafka data pipeline for global event ordering and the ability to replay in case of a crash or failure to sync with the database.
- The processor can process events, satisfying the required throughput.
- Display a network of relationships for a given user.
- Display a `network strength` ranking in a leaderboard-like list for any time range.
- Display a `referral points` ranking in a leaderboard-like list for any time range.
- Display a user's top 3 `influential friends`.
- Display a paginated list of a user's friends.
- Frontend // TODO

## What Hasn't Been Accomplished

- User's referral timeseries graph for any given time range.
- User's referral count for any given time range.
- User's friends count timeseries graph for any given time range.
- User's friends count for any given time range.
- The backend API only syncs with the database on startup and is not always up-to-date for the analytics page.
