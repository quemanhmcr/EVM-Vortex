# ADR 001: Optimistic-ZK Hybrid Approach

**Date:** 2025-07-28
**Status:** Accepted

## Context

The core challenge for the Vortex Protocol is to bring external data onto an EVM chain in a timely and cost-effective manner. Standard EVM chains like XLayer lack native precompiles for efficient, complex cryptographic signature schemes like BLS (EIP-2537). Implementing such verification in pure Solidity is computationally expensive and would render the protocol economically non-viable for frequent data updates.

## Decision

We will adopt a hybrid "Optimistic-ZK" model.

1.  **Optimistic Default:** Data will be submitted to the chain optimistically by a designated Proposer from the Witness Network. This data is considered valid after a "challenge period" has passed. This is the "happy path" and is designed to be fast and cheap.
2.  **ZK-Proof for Disputes:** If any network participant (a "Challenger") detects that the submitted data is fraudulent, they can initiate a challenge. The dispute is resolved definitively by submitting a ZK-Proof to an on-chain verifier contract. This proof cryptographically demonstrates the discrepancy between the Proposer's submitted data and the actual data from the source (OKX API).

## Consequences

### Positive:

- **Economic Viability:** The common case (no fraud) is extremely cheap, requiring only a simple transaction to post data.
- **High Speed:** Data can be used on-chain after a short, configurable challenge period.
- **Trustless Security:** While the happy path is optimistic, the system's overall security is anchored in the cryptographic truth of ZK-Proofs, which act as the ultimate arbiter. This avoids the need to trust the entire Witness Network.

### Negative:

- **Latency in Unhappy Path:** Dispute resolution will take longer due to the need for off-chain proof generation and on-chain verification.
- **Increased Complexity:** The system requires two distinct pathways (optimistic and ZK-dispute), increasing the overall complexity of the codebase and infrastructure.
- **Gas Cost for Challenges:** Submitting a ZK-Proof on-chain is expensive. This cost is a necessary deterrent and a tool for security, but it is a significant expenditure that must be covered by the Challenger's potential reward.
