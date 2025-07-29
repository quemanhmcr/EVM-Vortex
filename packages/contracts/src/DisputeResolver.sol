// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStakingManager.sol";
import "./interfaces/IVortexVerifier.sol";
import "./interfaces/IVerifier.sol";

contract DisputeResolver is Ownable {
    // --- Structs ---
    struct Dispute {
        address proposer;
        bool resolved;
        bool exists;
    }

    // --- State Variables ---
    address public vortexVerifierAddress;
    address public zkVerifierAddress;
    IStakingManager public stakingManager;
    mapping(bytes32 => Dispute) public disputes;

    // --- Events ---
    event DisputeResolved(bytes32 indexed disputeId, bool result, address indexed proposer);
    event DisputeCreated(bytes32 indexed disputeId, address indexed proposer);

    // --- Modifiers ---
    modifier onlyVortexVerifier() {
        require(msg.sender == vortexVerifierAddress, "DisputeResolver: Caller is not the VortexVerifier");
        _;
    }

    // --- Constructor ---
    constructor(address initialOwner) Ownable(initialOwner) {}

    // --- External Functions ---

    function setAddresses(address _verifier, address _stakingManager) external onlyOwner {
        require(_verifier != address(0) && _stakingManager != address(0), "DisputeResolver: Zero address");
        vortexVerifierAddress = _verifier;
        stakingManager = IStakingManager(_stakingManager);
    }

    function setZkVerifierAddress(address _zkVerifier) external onlyOwner {
        zkVerifierAddress = _zkVerifier;
    }

    function createDispute(bytes32 disputeId, address proposer) external onlyVortexVerifier {
        require(!disputes[disputeId].exists, "DisputeResolver: Dispute already exists");
        disputes[disputeId].exists = true;
        disputes[disputeId].proposer = proposer;
        emit DisputeCreated(disputeId, proposer);
    }

    function resolveDispute(
        bytes32 disputeId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata input
    ) public {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.exists, "DisputeResolver: Dispute does not exist");
        require(!dispute.resolved, "DisputeResolver: Dispute has already been resolved");
        require(zkVerifierAddress != address(0), "DisputeResolver: ZK Verifier not set");

        bool verified = IVerifier(zkVerifierAddress).verifyProof(a, b, c, input);
        require(verified, "DisputeResolver: Invalid ZK proof");

        // If proof is valid, it means fraud was proven.
        _resolve(disputeId, true);
    }

    // --- Internal Functions ---
    function _resolve(bytes32 disputeId, bool isFraud) internal {
        Dispute storage dispute = disputes[disputeId];
        dispute.resolved = true;
        emit DisputeResolved(disputeId, isFraud, dispute.proposer);

        // Finalize the challenge in the verifier (handles bond)
        IVortexVerifier(vortexVerifierAddress).finalizeChallenge(disputeId, isFraud);

        // Slash the proposer if fraud was confirmed
        if (isFraud) {
            stakingManager.slash(dispute.proposer);
        }
    }

    // --- View Functions ---
    function getDispute(bytes32 disputeId) external view returns (address, bool, bool) {
        Dispute storage d = disputes[disputeId];
        return (d.proposer, d.resolved, d.exists);
    }
}
