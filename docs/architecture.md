# Technical Design Document: Decentralized EVM-Vortex Protocol v2.0

**Date:** 2025-07-28
**Status:** Final
**Subject:** Final system architecture for a high-speed, decentralized Oracle layer optimized for XLayer and standard EVM.

## 1. Vision & Goals

**Vision:** To build a decentralized infrastructure layer that enables smart contracts on XLayer to consume real-time data from the OKX DEX API within the same atomic execution cycle, eliminating latency and trust in intermediaries.

**Technical Goal:** To design an economically viable protocol on standard EVM, overcoming the lack of precompiles for complex cryptographic mechanisms (like BLS).

## 2. Pre-feasibility Study Results

- **Off-Chain (Feasible):** OKX provides public WebSocket and REST API endpoints sufficient for a decentralized network. Design Decision: Prioritize WebSocket for real-time data ingestion.
- **On-Chain (Critical Barrier):** XLayer (and standard EVM) lacks precompiles for BLS signature verification (EIP-2537). Pure Solidity verification would be prohibitively expensive, threatening the economic viability of the protocol.
- **Conclusion:** A different, cheaper on-chain verification mechanism is required for the common case.

## 3. System Architecture (Optimistic-ZK Hybrid Approach)

We adopt a hybrid model: "Optimistic by default, with undeniable proof of fraud."

**Core Components:**

- **The Witness Network (Off-Chain):** A Proof-of-Stake network of independent nodes.
- **The On-Chain Layer (on XLayer):** A suite of smart contracts operating optimistically.
- **The ZK-Challenger Role (Off-Chain/On-Chain):** A specialized, permissionless role for dispute resolution.

## 4. Detailed Component Analysis

### A. The Witness Network

- **Requirement:** Stake assets in the `StakingManager.sol` contract.
- **Tasks:**
  1.  **Fetch:** All nodes connect to the OKX WebSocket for continuous price data.
  2.  **Consensus:** Run an off-chain consensus algorithm (e.g., CometBFT) to agree on a `dataPayload` (price, timestamp, etc.) for each request.
  3.  **Propose:** A randomly selected Proposer from the network optimistically posts the agreed-upon `dataPayload` to `VortexVerifier.sol`.
  4.  **Validate:** All other nodes validate that the Proposer's on-chain data is correct.

### B. The On-Chain Layer (on XLayer)

- **`VortexVerifier.sol`:**
  - `proposeData(bytes dataPayload)`: Callable only by a valid Proposer. Stores the payload and starts a "Challenge Period" (e.g., 10 minutes). Low GAS cost.
  - `executeIntent(bytes userIntent, bytes32 dataId)`: Called after the challenge period ends without a challenge. Reads the payload and executes user logic. Medium GAS cost.
  - `challengeData(bytes32 dataId, ...)`: Called during the challenge period. Freezes execution of the challenged data and initiates the dispute resolution process. Low GAS cost.
- **`DisputeResolver.sol`:**
  - Contains the logic to verify a ZK-Proof.
  - Interacted with only during a dispute.
- **`StakingManager.sol`:**
  - Manages staking, unstaking, and slashing based on outcomes from the `DisputeResolver`.

### C. The ZK-Challenger Role

- **Role:** Anyone (typically another node in the Witness Network) who detects a Proposer posting fraudulent data.
- **Tasks:**
  1.  Call `challengeData` on `VortexVerifier`.
  2.  **Generate Proof (Off-Chain):** Run a program inside a zkVM (RISC Zero/SP1). This program generates a ZK-Proof demonstrating that the data from the OKX API differs from what the Proposer posted.
  3.  **Submit Proof (On-Chain):** Submit the ZK-Proof to `DisputeResolver.sol` for verification. High GAS cost, but only occurs during a dispute.

## 5. End-to-End Flow

- **Happy Path (>99% of cases):**
  1.  Witness Network agrees on data.
  2.  Proposer posts data on-chain.
  3.  Challenge Period passes peacefully.
  4.  User's transaction is executed.
  - **Result:** Fast, low-cost, no complex on-chain cryptography needed.

- **Unhappy Path (Fraudulent case, rare):**
  1.  Proposer posts incorrect data.
  2.  Another Validator immediately challenges.
  3.  The system freezes the disputed data.
  4.  The Challenger generates and submits a ZK-Proof.
  5.  The contract verifies the proof, slashes the malicious Proposer, and rewards the honest Challenger.
  - **Security:** Cryptographic security is guaranteed by the ZK-Proof, which acts as the system's "supreme court."

## 6. Economic & Security Model

- **Security:** Guaranteed by a game-theoretic economic model. The cost of being slashed for posting incorrect data is always designed to be significantly higher than the potential profit from fraud.
- **Incentives:** Witness Nodes/Proposers earn fees from users. Challengers receive a large reward for successfully proving fraud.
- **Disincentives:** Malicious Proposers are heavily slashed. Challengers who submit false challenges lose a small bond to prevent spam.
