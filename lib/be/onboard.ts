// Typed client for the v0.3 onboard service (INTEGRATION.md §3).
//
// The service spawns a paper-trading daemon that signs LiveCertificate
// updates from an operator wallet on behalf of an iNFT owner. The FE
// orchestrates: fetch /health (to learn the operator address & pubkey),
// confirm the on-chain authorizedUpdaters allowance, then POST /onboard
// with a signed authorization payload.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** Read from process.env at call time so missing-config UX can react. */
function baseUrl(): string | null {
  return process.env.NEXT_PUBLIC_ONBOARD_URL?.trim() || null;
}

export function isOnboardConfigured(): boolean {
  return baseUrl() !== null;
}

export interface OnboardHealth {
  status: string;
  operator: Address;
  operatorPubKey: Hex;
  encryptionScheme: "ecies-v1" | string;
  active: boolean;
  authRequired: boolean;
}

export interface OnboardStatus {
  operator: Address;
  daemons: Array<{ tokenId: string; pid: number; startedAt: string }>;
}

/** EIP-191-signed authorization payload. Decimal strings per INTEGRATION.md
 * "bigints over JSON" rule. */
export interface OnboardPayload {
  action: "onboard" | "offboard";
  tokenId: string;
  nonce: string;
  deadline: string;
  // Present iff action === "onboard" — binds the run to the owner's signature (H4).
  agentHash?: Hex; // 0x keccak256(utf8(agent source plaintext))
  genesisHash?: Hex;
  symbol?: string;
  interval?: string;
  market?: "spot" | "perp";
  barsPerEpoch?: string;
  initialBalance?: string;
  leverage?: string;
  feeBps?: string;
  slippageBps?: string;
}

export type AgentSource =
  | string
  | { scheme: "ecies-v1"; blob: Hex };

export interface OnboardRequest {
  payload: OnboardPayload;
  signature: Hex;
  // Run params now live INSIDE the signed payload; the body carries only the
  // opaque agent bytes whose keccak the BE checks against payload.agentHash.
  agentSource: AgentSource;
}

export interface OnboardResponse {
  status: "onboarded";
  tokenId: string;
  operator: Address;
  pid: number;
  startedAt: string;
}

export interface OffboardRequest {
  payload: OnboardPayload;
  signature: Hex;
}

export interface OffboardResponse {
  status: "offboarded" | "not-running";
  tokenId: string;
}

export class OnboardError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "OnboardError";
  }
}

export class OnboardNotConfiguredError extends Error {
  constructor() {
    super("NEXT_PUBLIC_ONBOARD_URL is not set — the onboard service has not been deployed yet.");
    this.name = "OnboardNotConfiguredError";
  }
}

function withAuth(headers: HeadersInit, bearer?: string): HeadersInit {
  if (!bearer) return headers;
  return { ...headers, authorization: `Bearer ${bearer}` };
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function call<T>(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  const base = baseUrl();
  if (!base) throw new OnboardNotConfiguredError();
  const res = await fetch(`${base}${path}`, { ...init, signal });
  const body = await safeJson(res);
  if (!res.ok) {
    const msg = (body as { error?: string })?.error ?? `onboard ${path} ${res.status}`;
    throw new OnboardError(msg, res.status, body);
  }
  return body as T;
}

export function fetchOnboardHealth(signal?: AbortSignal): Promise<OnboardHealth> {
  return call<OnboardHealth>("/health", { method: "GET" }, signal);
}

export function fetchOnboardStatus(
  opts?: { bearerToken?: string; signal?: AbortSignal },
): Promise<OnboardStatus> {
  return call<OnboardStatus>(
    "/status",
    { method: "GET", headers: withAuth({}, opts?.bearerToken) },
    opts?.signal,
  );
}

export function postOnboard(
  req: OnboardRequest,
  opts?: { bearerToken?: string; signal?: AbortSignal },
): Promise<OnboardResponse> {
  return call<OnboardResponse>(
    "/onboard",
    {
      method: "POST",
      headers: withAuth({ "content-type": "application/json" }, opts?.bearerToken),
      body: JSON.stringify(req),
    },
    opts?.signal,
  );
}

export function postOffboard(
  req: OffboardRequest,
  opts?: { bearerToken?: string; signal?: AbortSignal },
): Promise<OffboardResponse> {
  return call<OffboardResponse>(
    "/offboard",
    {
      method: "POST",
      headers: withAuth({ "content-type": "application/json" }, opts?.bearerToken),
      body: JSON.stringify(req),
    },
    opts?.signal,
  );
}

/** Build a fresh OnboardPayload with a random nonce and a future deadline.
 * BE expects unix seconds + decimal strings (INTEGRATION.md gotchas). */
export function newPayload(
  action: "onboard" | "offboard",
  tokenId: bigint,
  secondsAhead = 300,
): OnboardPayload {
  // 16 random bytes -> hex -> uint256 decimal. Anti-replay only; uniqueness
  // matters more than unpredictability since the BE just checks nonce hasn't
  // been used for this (action, tokenId, address) tuple.
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  let nonce = 0n;
  for (const b of buf) nonce = (nonce << 8n) | BigInt(b);

  return {
    action,
    tokenId: tokenId.toString(),
    nonce: nonce.toString(),
    deadline: (Math.floor(Date.now() / 1000) + secondsAhead).toString(),
  };
}

/** The message passed to personal_sign / EIP-191. Canonical JSON: sorted keys,
 * no whitespace, every value coerced to a string, `undefined` dropped. MUST
 * stay byte-for-byte identical to the BE's `digestFor()` (zero-arena-be
 * onboard/auth.ts) and the SDK's `digestForOnboard()`. */
export function payloadToSigningString(p: OnboardPayload): string {
  const obj: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null) obj[k] = String(v);
  }
  return JSON.stringify(obj, Object.keys(obj).sort());
}
