import { createHandyClient } from "handy-redis";

const redis = createHandyClient({
  host: "srv-captain--redis",
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  retry_strategy: options => {
    if (options.error && options.error.code === "ECONNREFUSED") {
      console.error("Redis connection failed", "Server refused the connection");
    }

    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error("Redis connection failed", "Total retry time exhausted");
    }

    if (options.attempt > 10) {
      console.error(
        "Redis connection failed",
        "Max number of attempts exceeded"
      );
      return 43200;
    }

    // Reconnect after this time
    return Math.min(options.attempt * 100, 3000);
  }
});

export default redis;
