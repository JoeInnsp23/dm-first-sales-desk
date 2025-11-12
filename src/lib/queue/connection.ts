import { Redis } from "ioredis";

// Connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
};

// Create Redis connection for BullMQ
export const createRedisConnection = () => {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return new Redis(redisConnection);
};

// Shared connection instance
let connection: Redis | null = null;

export const getRedisConnection = () => {
  if (!connection) {
    connection = createRedisConnection();
  }
  return connection;
};
