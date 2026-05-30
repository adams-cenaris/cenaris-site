'use strict';

// Optional dependency — rate limiting degrades gracefully if Upstash is not configured.
// To enable: npm install @upstash/ratelimit @upstash/redis
// Then set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel environment variables.

let Ratelimit, Redis;
try {
  Ratelimit = require('@upstash/ratelimit').Ratelimit;
  Redis = require('@upstash/redis').Redis;
} catch { /* optional dependency not installed */ }

let redis = null;

function getRedis() {
  if (redis) return redis;
  if (!Redis) return null;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const limiters = new Map();

function getLimiter(key, requests, windowSeconds) {
  if (!Ratelimit || !getRedis()) return null;
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s`),
      prefix: `rl:${key}`,
    }));
  }
  return limiters.get(key);
}

/**
 * Check rate limit. Returns true (and sends 429) if the request is blocked.
 * Returns false if the request is allowed (or Upstash is not configured).
 *
 * @param {object} req   Vercel serverless request
 * @param {object} res   Vercel serverless response
 * @param {string} key   unique limiter key, e.g. 'admin:auth'
 * @param {number} requests   max allowed requests in the window
 * @param {number} windowSeconds   sliding window size in seconds
 */
async function checkRateLimit(req, res, key, requests, windowSeconds) {
  const limiter = getLimiter(key, requests, windowSeconds);
  if (!limiter) return false; // not configured — allow through

  const ip = req.headers['x-real-ip']
    ?? req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    ?? '127.0.0.1';
  try {
    const { success, reset } = await limiter.limit(ip);
    if (!success) {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      });
      return true;
    }
  } catch (err) {
    // On Redis error, fail open so the site keeps working
    console.error('[ratelimit] error', err?.message);
  }
  return false;
}

module.exports = { checkRateLimit };
