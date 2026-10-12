// Opt-in device check (needs a reachable UNO Q):
//   ARIS_HOST=192.168.31.46 ARIS_TOKEN=<device token> node scripts/check-ws-live.mjs
//
// Reproduces the Android-doze failure against the live UNO Q: a TCP proxy that
// stalls the connection (pause, like a dozing radio) without closing it. The
// socket stays OPEN and silent. The watchdog must notice and reconnect.
import assert from "node:assert/strict";
import net from "node:net";

const BOARD = { host: process.env.ARIS_HOST ?? "192.168.31.46", port: 8000 };
let conns = 0;
let stalled = false;
const upstreams = [];

const proxy = net.createServer((client) => {
  conns += 1;
  const up = net.connect(BOARD);
  upstreams.push(up);
  up.pipe(client);
  client.pipe(up);
  if (stalled) up.pause();
  client.on("close", () => up.destroy());
  client.on("error", () => up.destroy());
  up.on("error", () => {});
});
await new Promise((r) => proxy.listen(9099, "127.0.0.1", r));
const stall = (on) => { stalled = on; upstreams.forEach((u) => (on ? u.pause() : u.resume())); };

const { wsManager } = await import("../services/websocket-manager.ts");
const events = [];
wsManager.onEvent((e) => events.push(e));
wsManager.configure("127.0.0.1:9099", 8000, process.env.ARIS_TOKEN);
wsManager.connect();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(6000);
const before = events.length;
assert.ok(before >= 4, `streaming before stall, got ${before}`);
assert.equal(conns, 1, "exactly one connection while healthy");
console.log(`frames before stall: ${before}, healthy: ${wsManager.isHealthy}`);

stall(true);                                  // radio asleep: OPEN but silent
await wait(18000);
assert.equal(wsManager.isHealthy, false, "must report unhealthy while stalled");
const frozen = events.length;
console.log(`during stall: frames=${frozen}, connections=${conns}`);
assert.ok(conns >= 2, "watchdog must open a fresh connection while stalled");

stall(false);                                 // radio awake again
await wait(8000);
console.log(`after recovery: frames=${events.length}, connections=${conns}, healthy=${wsManager.isHealthy}`);
assert.ok(events.length > frozen, "real frames must resume after recovery");
assert.ok(wsManager.isHealthy, "link healthy again");
assert.ok(events.every((e) => !Number.isNaN(new Date(e.timestamp).getTime())), "timestamps stay parseable");

wsManager.disconnect();
proxy.close();
console.log("half-open recovery against live board: ok");
process.exit(0);
