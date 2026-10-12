// Checks the app's own api-client against a live UNO Q /api/v1/system:
//   ARIS_HOST=192.168.31.46 ARIS_TOKEN=<token> node scripts/check-system-api.mjs
// The payload is fetched directly rather than through services/api-client.ts:
// that module uses a TypeScript parameter property, which node's strip-only
// mode rejects. What matters here is the contract the client consumes.
import assert from "node:assert/strict";

const host = process.env.ARIS_HOST;
if (!host) {
  console.log("set ARIS_HOST (and ARIS_TOKEN) to check against a board");
  process.exit(0);
}

const response = await fetch(`http://${host}:8000/api/v1/system`, {
  headers: process.env.ARIS_TOKEN ? { Authorization: `Bearer ${process.env.ARIS_TOKEN}` } : undefined,
});
assert.equal(response.status, 200, `unexpected status ${response.status}`);
const health = await response.json();

const inRange = (value, low, high, label) => {
  assert.ok(value === null || (typeof value === "number" && value >= low && value <= high), `${label}: ${value}`);
};

assert.ok(!Number.isNaN(new Date(health.timestamp).getTime()), "timestamp parses");
inRange(health.cpu?.load1_pct ?? null, 0, 100, "cpu.load1_pct");
assert.ok((health.cpu?.cores ?? 0) >= 1, "cpu.cores");
inRange(health.memory?.used_pct ?? null, 0, 100, "memory.used_pct");
inRange(health.disk?.used_pct ?? null, 0, 100, "disk.used_pct");
inRange(health.temperature_c, 0, 150, "temperature_c");
assert.ok((health.uptime_s ?? 0) > 0, "uptime_s");

assert.ok(Array.isArray(health.services) && health.services.length > 0, "services listed");
for (const service of health.services) {
  assert.equal(typeof service.unit, "string");
  assert.equal(typeof service.ok, "boolean");
}

assert.ok(health.collector, "collector reported");
assert.equal(typeof health.collector.ok, "boolean");
assert.ok(health.clients, "clients reported");
// This script's own request is HTTP, so it must not appear as a live stream.
assert.ok(health.clients.sockets >= 0 && health.clients.devices <= health.clients.sockets,
  "devices never exceeds sockets");
assert.ok(health.ble, "ble reported");

assert.equal(health.errors, undefined, `probes failed: ${JSON.stringify(health.errors)}`);

console.log(
  `cpu ${health.cpu.load1_pct}% | mem ${health.memory.used_pct}% | disk ${health.disk.used_pct}% | ` +
  `${health.temperature_c}°C | up ${Math.round(health.uptime_s / 3600)}h | ` +
  `clients ${health.clients.devices}/${health.clients.sockets} | slm ${health.slm.reachable}`,
);
console.log("services:", health.services.map((s) => `${s.unit}=${s.state}`).join(" "));
console.log("system api check: ok");
