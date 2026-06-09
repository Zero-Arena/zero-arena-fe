// Known operator wallets — the operator addresses Zero Arena publishes for
// owners to delegate to. Used to label live-cert badges.
//
// Why a static map: per-token operator attribution is NOT recorded in the
// EpochCommitted event (LiveCertificate.update() emits no msg.sender). Post-H2
// `authorizedUpdaters` IS per-token on-chain (keyed by (tokenId, operator)),
// but the event still doesn't say which operator signed a given epoch — so the
// FE shows "trust badge by intent": for each iNFT, what trust path applies
// given (a) who owns the token and (b) which operators are publicly trusted.
//
// When the registry of known operators changes, update this map. Future
// improvement: read authorizedUpdaters(tokenId, op) from chain and overlay.

export const KNOWN_OPERATORS: Record<string, { name: string; href?: string }> = {
  // Dedicated ZA operator hot wallet (separated from the deployer/admin in
  // the C3 key rotation, 2026-06-10). Owners delegate to it per-token via
  // authorizeUpdater(tokenId, operator, true).
  '0x0dce34908552ac7348a99820cc97f437e98c1654': {
    name: 'Zero Arena',
    href: 'https://onboard-production-ed6c.up.railway.app/health',
  },
};

export type OperatorBadgeKind =
  | 'operator-attested'
  | 'owner-operated'
  | 'tee-attested';

export interface OperatorBadgeInfo {
  kind: OperatorBadgeKind;
  label: string;
  tooltip: string;
  href?: string;
}

const ZERO_HASH = '0x' + '00'.repeat(32);

/**
 * Infer the operator badge for an iNFT based on its on-chain owner and
 * (future) attestation hash. Returns null for placeholder rows where
 * the owner address is empty or zero.
 */
export function inferOperatorBadge(opts: {
  ownerAddress: string | null | undefined;
  attestationHash?: string | null;
}): OperatorBadgeInfo | null {
  const owner = (opts.ownerAddress ?? '').toLowerCase();
  if (!owner || owner === '0x' + '00'.repeat(20)) return null;

  // v0.4+: TEE-attested takes priority — once a non-zero attestationHash
  // is anchored, the live cert co-signed by an enclave is the strongest
  // available trust tier.
  if (opts.attestationHash && opts.attestationHash !== ZERO_HASH) {
    return {
      kind: 'tee-attested',
      label: 'TEE-attested',
      tooltip:
        'Live-cert epochs co-signed by a 0G Compute Sealed Inference enclave. Trustless — no operator can manipulate the trades.',
    };
  }

  const known = KNOWN_OPERATORS[owner];
  if (known) {
    // Owner == known operator: this is operator-attested by default
    // (e.g. Zero Arena admin-owned tokens drive themselves through the
    // operator wallet the owner authorized per-token via authorizeUpdater).
    return {
      kind: 'operator-attested',
      label: `Operator: ${known.name}`,
      tooltip: `Live-cert epochs signed by ${known.name}'s operator wallet (owner-authorized per-token in LiveCertificate.authorizedUpdaters). Trust = ${known.name}'s public reputation.`,
      href: known.href,
    };
  }

  // External owner. We can't tell from chain alone whether they
  // self-operate or have delegated to a known operator (per-epoch
  // operator attribution is not in the EpochCommitted event). Default
  // to "owner-operated", which is the conservative reading.
  return {
    kind: 'owner-operated',
    label: 'Owner-operated',
    tooltip:
      "This iNFT's live cert is driven by the owner's wallet directly. Trust = owner self-attestation only (cheatable). Owner can delegate to Zero Arena via /paper/onboard for operator-attestation.",
  };
}
