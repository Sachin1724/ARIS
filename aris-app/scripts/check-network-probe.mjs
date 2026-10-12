// Self-check for local-network discovery. Run:
//   node scripts/check-network-probe.mjs
// With a reachable board, also sweeps it for real:
//   ARIS_HOST=192.168.31.46 ARIS_TOKEN=<token> node scripts/check-network-probe.mjs
import assert from "node:assert/strict";
import { buildCandidates, classifyProbe, probeEndpoints } from "../services/device/networkProbe.ts";

// --- classification: a 401 means "found, needs token", not "absent" ---------
assert.deepEqual(classifyProbe(401), { found: true, requiresToken: true });
assert.deepEqual(classifyProbe(403), { found: true, requiresToken: true });
assert.deepEqual(classifyProbe(200, { status: "ok", version: "0.1.0" }), {
  found: true,
  requiresToken: false,
});
assert.deepEqual(classifyProbe(200, { unrelated: true }), { found: false, requiresToken: false });
assert.deepEqual(classifyProbe(404), { found: false, requiresToken: false });
assert.deepEqual(classifyProbe(500), { found: false, requiresToken: false });

// --- candidate ordering and the /24 sweep ----------------------------------
const candidates = buildCandidates({ savedEndpoint: "192.168.31.46:8000", selfIp: "192.168.31.228" });
assert.equal(candidates[0], "http://192.168.31.46:8000", "saved endpoint is tried first");
assert.equal(candidates[1], "http://aris-unoq.local:8000", "then mDNS");
assert.ok(candidates.includes("http://192.168.31.1:8000"), "sweeps the phone's /24");
assert.ok(!candidates.includes("http://192.168.31.228:8000"), "skips the phone itself");
assert.equal(new Set(candidates).size, candidates.length, "no duplicates");
// mDNS + 253 sweep hosts (.228 is us); the saved .46 is already in the sweep.
assert.equal(candidates.length, 254, "deduped candidate list");

const noWifi = buildCandidates({ savedEndpoint: null, selfIp: null });
assert.deepEqual(noWifi, ["http://aris-unoq.local:8000"], "degrades to mDNS only");
assert.equal(buildCandidates({ selfIp: "not-an-ip" }).length, 1, "ignores a malformed address");

// --- abort stops the sweep mid-flight --------------------------------------
const cancelled = { aborted: true };
const none = await probeEndpoints(buildCandidates({ selfIp: "10.1.1.5" }), { signal: cancelled });
assert.deepEqual(none, [], "aborted sweep probes nothing");

// --- optional: sweep the real board ----------------------------------------
if (process.env.ARIS_HOST) {
  const host = process.env.ARIS_HOST;
  const urls = buildCandidates({ savedEndpoint: `${host}:8000`, selfIp: null });

  const unauthorized = await probeEndpoints(urls, { timeoutMs: 4000 });
  assert.equal(unauthorized.length, 1, "board is discoverable without a token");
  assert.equal(unauthorized[0].requiresToken, true, "and reports that it needs one");
  console.log(`no token  -> found=${unauthorized[0].found} requiresToken=${unauthorized[0].requiresToken}`);

  const authorized = await probeEndpoints(urls, { token: process.env.ARIS_TOKEN, timeoutMs: 4000 });
  assert.equal(authorized.length, 1, "board found with a token too");
  assert.equal(authorized[0].requiresToken, false, "and no longer asks for one");
  console.log(`with token -> found=${authorized[0].found} requiresToken=${authorized[0].requiresToken}`);
} else {
  console.log("(set ARIS_HOST to also sweep a real board)");
}

console.log("network probe check: ok");
