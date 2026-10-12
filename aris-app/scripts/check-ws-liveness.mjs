// Self-check for websocket-manager liveness logic. Run:
//   node scripts/check-ws-liveness.mjs
// Fails loudly if timestamp normalization, the liveness watchdog, or the
// no-duplicate-socket guard regress.
import assert from "node:assert/strict";

// --- fakes installed before importing the module under test -----------------
let now = 1_700_000_000_000;
Date.now = () => now;

const intervals = [];
globalThis.setInterval = (fn) => {
  const handle = { fn, cleared: false };
  intervals.push(handle);
  return handle;
};
globalThis.clearInterval = (handle) => {
  if (handle) handle.cleared = true;
};
const tickWatchdogs = () => intervals.filter((i) => !i.cleared).forEach((i) => i.fn());

const sockets = [];
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.closeCalls = 0;
    sockets.push(this);
  }
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  deliver(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
  close() {
    this.closeCalls += 1;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}
globalThis.WebSocket = FakeWebSocket;

const { wsManager, normalizeTimestamp, isWebSocketEvent } = await import(
  "../services/websocket-manager.ts"
);

// --- timestamp compatibility ------------------------------------------------
assert.equal(normalizeTimestamp("2026-10-12T00:00:00+00:00"), "2026-10-12T00:00:00+00:00");
assert.equal(normalizeTimestamp(1760000000), "2025-10-09T08:53:20.000Z", "unix seconds");
assert.equal(normalizeTimestamp(1760000000000), "2025-10-09T08:53:20.000Z", "unix millis");
assert.ok(isWebSocketEvent({ type: "sensor_update", timestamp: 1760000000, data: {} }),
  "numeric timestamp must not be rejected (the original dropout bug)");
assert.ok(!isWebSocketEvent({ type: "sensor_update", timestamp: {}, data: {} }));

// --- events reach listeners with an ISO timestamp ---------------------------
const received = [];
wsManager.onEvent((e) => received.push(e));
wsManager.configure("192.168.1.50", 8000);
wsManager.connect();
assert.equal(sockets.length, 1);

wsManager.connect(); // while CONNECTING
sockets[0].open();
wsManager.connect(); // while OPEN
assert.equal(sockets.length, 1, "connect() must not create a duplicate socket");

sockets[0].deliver({ type: "sensor_update", timestamp: 1760000000, data: { pm25: 12 } });
assert.equal(received.length, 1);
assert.equal(received[0].timestamp, "2025-10-09T08:53:20.000Z", "numeric normalized to ISO");
assert.ok(wsManager.isHealthy);

// --- heartbeats count as activity -------------------------------------------
now += 8000;
sockets[0].deliver({ type: "heartbeat", timestamp: new Date(now).toISOString(), data: {} });
assert.equal(received.length, 2, "heartbeat is forwarded like any other event");
now += 8000;
tickWatchdogs();
assert.equal(sockets.length, 1, "heartbeat within window must keep the socket");
assert.ok(wsManager.isHealthy);

// --- silent half-open socket is replaced exactly once -----------------------
now += 11000;
assert.ok(!wsManager.isHealthy, "silent socket must report unhealthy");
tickWatchdogs();
assert.equal(sockets.length, 2, "watchdog must reconnect after the liveness timeout");
assert.equal(sockets[0].closeCalls, 1, "old socket closed");
const beforeStale = received.length;
sockets[0].deliver({ type: "sensor_update", timestamp: 1760000000, data: { pm25: 99 } });
assert.equal(received.length, beforeStale, "detached socket must not deliver frames");

// --- resume path leaves a healthy socket alone ------------------------------
sockets[1].open();
sockets[1].deliver({ type: "sensor_update", timestamp: new Date(now).toISOString(), data: {} });
wsManager.ensureHealthy();
assert.equal(sockets.length, 2, "ensureHealthy() must not churn a healthy socket");

now += 20000;
wsManager.ensureHealthy();
assert.equal(sockets.length, 3, "ensureHealthy() must revive a silent socket");

wsManager.disconnect();
console.log("websocket-manager liveness check: ok");
