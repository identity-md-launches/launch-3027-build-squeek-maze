import test from "node:test";
import assert from "node:assert/strict";
import { parseStatus, watchStatus, STATUS_URL } from "../src/status.js";
const now = Date.now();
const body = (rpmMilli = 12000, extra = {}) => ({
  measurement: {
    freshness: "online",
    observedAt: new Date(now).toISOString(),
    staleAfterSeconds: 120,
    rpmMilli,
    ...extra,
  },
});

test("fresh rotation enables the boost, zero rotation means sleeping", () => {
  assert.deepEqual(parseStatus(body(), now), { state: "running", rpm: 12 });
  assert.deepEqual(parseStatus(body(0), now), { state: "sleeping", rpm: 0 });
});
test("stale, offline, malformed and future measurements cannot grant a boost", () => {
  for (const value of [
    null,
    {},
    { measurement: null },
    body(-1),
    body(NaN),
    body(2, { freshness: "offline" }),
    body(2, { observedAt: "invalid" }),
    body(2, { observedAt: new Date(now - 121000).toISOString() }),
    body(2, { observedAt: new Date(now + 60000).toISOString() }),
  ])
    assert.equal(parseStatus(value, now).state, "unavailable");
});
test("poller uses the real URL, polls every 10 seconds and handles failure without a fake state", async (t) => {
  const originalFetch = globalThis.fetch,
    originalInterval = globalThis.setInterval,
    originalClear = globalThis.clearInterval;
  let callback,
    interval,
    requests = 0;
  const updates = [];
  globalThis.setInterval = (fn, ms) => {
    callback = fn;
    interval = ms;
    return 123;
  };
  globalThis.clearInterval = () => {};
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(url, STATUS_URL);
    assert.equal(options.credentials, "omit");
    return { ok: true, json: async () => body() };
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.setInterval = originalInterval;
    globalThis.clearInterval = originalClear;
  });
  const stop = watchStatus((s) => updates.push(s));
  await new Promise((r) => setImmediate(r));
  assert.equal(interval, 10000);
  assert.equal(updates.at(-1).state, "running");
  globalThis.fetch = async () => {
    requests++;
    throw new Error("offline");
  };
  await callback();
  assert.equal(updates.at(-1).state, "unavailable");
  assert.equal(requests, 2);
  stop();
  await callback();
  assert.equal(requests, 2);
});
