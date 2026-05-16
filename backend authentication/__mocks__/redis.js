// __mocks__/redis.js
// Automatic manual mock for the ioredis instance (./redis).
// Jest resolves __mocks__/redis.js whenever a test calls jest.mock('../redis').
// Uses a plain Map as the in-memory store — no real Redis required.
'use strict';

/** In-memory key-value store used across all mock calls within a test file. */
const _store = new Map();

/** TTL registry (seconds remaining — stored as absolute expiry timestamp). */
const _ttlStore = new Map();

const _ttlRemaining = (key) => {
  const exp = _ttlStore.get(key);
  if (exp === undefined) return -2; // key does not exist
  const remaining = Math.ceil((exp - Date.now()) / 1000);
  return remaining > 0 ? remaining : -1; // -1 = key exists but no TTL (shouldn't happen)
};

const redisMock = {
  // ── Core ops ──────────────────────────────────────────────────────────────
  get: jest.fn(async (key) => {
    const exp = _ttlStore.get(key);
    if (exp !== undefined && Date.now() > exp) {
      // Expired — lazy evict
      _store.delete(key);
      _ttlStore.delete(key);
      return null;
    }
    return _store.has(key) ? _store.get(key) : null;
  }),

  set: jest.fn(async (key, value) => {
    _store.set(key, String(value));
    return 'OK';
  }),

  setex: jest.fn(async (key, ttlSeconds, value) => {
    _store.set(key, String(value));
    _ttlStore.set(key, Date.now() + ttlSeconds * 1000);
    return 'OK';
  }),

  del: jest.fn(async (...keys) => {
    let count = 0;
    for (const k of keys.flat()) {
      if (_store.delete(k)) count++;
      _ttlStore.delete(k);
    }
    return count;
  }),

  incr: jest.fn(async (key) => {
    const current = parseInt(_store.get(key) ?? '0', 10);
    const next = current + 1;
    _store.set(key, String(next));
    return next;
  }),

  expire: jest.fn(async (key, ttlSeconds) => {
    if (!_store.has(key)) return 0;
    _ttlStore.set(key, Date.now() + ttlSeconds * 1000);
    return 1;
  }),

  ttl: jest.fn(async (key) => _ttlRemaining(key)),

  exists: jest.fn(async (key) => (_store.has(key) ? 1 : 0)),

  // ── No-op lifecycle methods ───────────────────────────────────────────────
  on:         jest.fn(),
  connect:    jest.fn(async () => {}),
  disconnect: jest.fn(async () => {}),
  quit:       jest.fn(async () => {}),

  // ── Test helpers (not part of the real ioredis API) ───────────────────────
  _store,
  _clear() {
    _store.clear();
    _ttlStore.clear();
  },
  _set(key, value, ttlSeconds) {
    _store.set(key, String(value));
    if (ttlSeconds !== undefined) {
      _ttlStore.set(key, Date.now() + ttlSeconds * 1000);
    }
  },
};

module.exports = redisMock;
