/**
 * Local-network discovery for the UNO Q API. Kept free of React Native imports
 * so it can be exercised by scripts/check-network-probe.mjs under plain node.
 */

export interface ProbeClassification {
  /** An ARIS API answered here. */
  found: boolean;
  /** It answered, but refused us: the API token is missing or wrong. */
  requiresToken: boolean;
}

export interface ProbeResult extends ProbeClassification {
  url: string;
  hardware?: string;
}

export interface CandidateOptions {
  /** Last endpoint we successfully used, e.g. "192.168.31.46:8000". */
  savedEndpoint?: string | null;
  /** mDNS name the board publishes. */
  mdnsHost?: string | null;
  /** This phone's Wi-Fi address, used to derive the /24 to sweep. */
  selfIp?: string | null;
  port?: number;
}

const DEFAULT_PORT = 8000;

function normalizeHost(value: string, port: number): string {
  const bare = value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!bare) return "";
  return bare.includes(":") ? `http://${bare}` : `http://${bare}:${port}`;
}

/**
 * Cheapest first: the endpoint that worked last time, then mDNS, then a sweep of
 * the phone's own /24. The old hardcoded address list only ever matched one
 * developer network.
 */
export function buildCandidates(options: CandidateOptions = {}): string[] {
  const port = options.port ?? DEFAULT_PORT;
  const urls: string[] = [];
  const push = (value?: string | null) => {
    if (!value) return;
    const url = normalizeHost(value, port);
    if (url && !urls.includes(url)) urls.push(url);
  };

  push(options.savedEndpoint);
  push(options.mdnsHost ?? "aris-unoq.local");

  const ip = options.selfIp?.trim();
  if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const octets = ip.split(".");
    const base = octets.slice(0, 3).join(".");
    const self = Number(octets[3]);
    for (let host = 1; host <= 254; host += 1) {
      if (host === self) continue;
      push(`${base}.${host}`);
    }
  }

  return urls;
}

/**
 * 401/403 means an ARIS board is there and asking for its token — the board is
 * found, not absent. Treating it as absent is why a provisioned UNO Q never
 * appeared in the scan list.
 */
export function classifyProbe(status: number, body?: unknown): ProbeClassification {
  if (status === 401 || status === 403) return { found: true, requiresToken: true };
  if (status < 200 || status >= 300) return { found: false, requiresToken: false };
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const looksLikeAris =
      typeof record["status"] === "string" ||
      typeof record["version"] === "string" ||
      typeof record["hardware"] === "string";
    return { found: looksLikeAris, requiresToken: false };
  }
  return { found: false, requiresToken: false };
}

export interface ProbeOptions {
  token?: string | null;
  timeoutMs?: number;
  concurrency?: number;
  signal?: { aborted: boolean };
  onFound?: (result: ProbeResult) => void;
}

async function probeOne(url: string, options: ProbeOptions): Promise<ProbeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 1200);
  try {
    const response = await fetch(`${url}/api/v1/health`, {
      signal: controller.signal,
      headers: options.token ? { Authorization: `Bearer ${options.token}` } : undefined,
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const verdict = classifyProbe(response.status, body);
    if (!verdict.found) return null;
    const hardware =
      body && typeof body === "object"
        ? ((body as Record<string, unknown>)["hardware"] as string | undefined)
        : undefined;
    return { url, ...verdict, hardware };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Sweeps candidates with a bounded number of sockets in flight. */
export async function probeEndpoints(
  urls: string[],
  options: ProbeOptions = {}
): Promise<ProbeResult[]> {
  // A /24 must finish inside the scan window (~12s), so keep many in flight.
  const concurrency = Math.max(1, options.concurrency ?? 48);
  const results: ProbeResult[] = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < urls.length) {
      if (options.signal?.aborted) return;
      const url = urls[cursor];
      cursor += 1;
      const result = await probeOne(url, options);
      if (result && !options.signal?.aborted) {
        results.push(result);
        options.onFound?.(result);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}
