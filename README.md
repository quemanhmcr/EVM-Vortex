# Decentralized EVM-Vortex Protocol v2.0 - Monorepo

This monorepo contains the source code for the Decentralized EVM-Vortex Protocol, a high-speed, optimistic-zk hybrid oracle for XLayer and other EVM chains.

## Architecture

See [docs/architecture.md](./docs/architecture.md) for a detailed explanation of the system design.

## Packages & Services

- **`services/witness-network`**: The off-chain Proof-of-Stake network that fetches and signs data from the OKX API.
- **`services/zk-challenger`**: The service responsible for generating and submitting ZK fraud proofs.
- **`packages/contracts`**: The on-chain layer, containing all Solidity smart contracts managed by Hardhat.
- **`packages/zk-circuits`**: The ZK circuits (e.g., Circom, RISC Zero) used for fraud proofs.
- **`packages/shared`**: Shared types, constants, and utility functions used across the monorepo.

## Development

This monorepo is managed by **pnpm** and **Turborepo**.

### Prerequisites

- Node.js (v18+)
- pnpm

### Getting Started

1.  **Install dependencies:**

    ```bash
    pnpm install
    ```

2.  **Build all packages and services:**
    ```bash
    pnpm turbo build
    ```

### Common Commands

- `pnpm turbo lint`: Lint all code.
- `pnpm turbo test`: Run all tests.
- `pnpm --filter <package-name> <command>`: Run a command within a specific package (e.g., `pnpm --filter contracts test`).

---

_This project adheres to the highest standards of software engineering, including automated CI/CD, comprehensive testing, and detailed documentation._
