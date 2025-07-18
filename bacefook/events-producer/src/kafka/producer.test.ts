import type { ConnectionEvent } from 'events-generator/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Producer } from './producer';

vi.mock('kafkajs', async (importActual) => {
  const actual = await importActual<typeof import('kafkajs')>();

  return {
    ...actual,
    Kafka: vi.fn().mockImplementation(() => ({
      producer: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  };
});

describe('Producer', () => {
  let producer: Producer;

  beforeEach(async () => {
    producer = new Producer({
      clientId: 'mock-client',
      brokers: ['mock:9092'],
    });
    await producer.connect();
  });

  it('should send messages without error', async () => {
    const mockEvents: ConnectionEvent[] = [
      {
        type: 'register',
        name: 'user1',
        created_at: '20250718111111',
      },
      {
        type: 'register',
        name: 'user2',
        created_at: '20250718111111',
      },
    ];

    const sentCount = await producer.send(mockEvents);
    expect(sentCount).toBe(2);
  });
});
