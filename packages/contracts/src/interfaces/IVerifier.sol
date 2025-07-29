// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVerifier
 * @notice A generic interface for any ZK Verifier contract.
 * @dev This allows the DisputeResolver to be decoupled from the specific
 * ZK-SNARK implementation (e.g., Groth16, Plonk, etc.).
 */
interface IVerifier {
    /**
     * @dev Verifies a ZK-SNARK proof.
     * @param a The 'a' part of the proof.
     * @param b The 'b' part of the proof.
     * @param c The 'c' part of the proof.
     * @param input The public inputs for the circuit.
     * @return A boolean indicating whether the proof is valid.
     */
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata input
    ) external view returns (bool);
}
