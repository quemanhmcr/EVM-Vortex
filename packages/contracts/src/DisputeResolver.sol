// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStakingManager.sol";
import "./interfaces/IVortexVerifier.sol";

contract DisputeResolver is Ownable {
    // --- Structs ---
    struct Dispute {
        address proposer;
        uint256 yesVotes;
        uint256 noVotes;
        mapping(address => bool) hasVoted;
        bool resolved;
        bool exists;
    }

    // --- State Variables ---
    address public vortexVerifierAddress;
    IStakingManager public stakingManager;
    mapping(address => bool) public isMember;
    mapping(bytes32 => Dispute) public disputes;
    uint256 public totalMembers;

    // --- Events ---
    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);
    event Voted(bytes32 indexed disputeId, address indexed voter, bool voteConfirm);
    event DisputeResolved(bytes32 indexed disputeId, bool result, address indexed proposer);
    event DisputeCreated(bytes32 indexed disputeId, address indexed proposer);

    // --- Modifiers ---
    modifier onlyVortexVerifier() {
        require(msg.sender == vortexVerifierAddress, "DisputeResolver: Caller is not the VortexVerifier");
        _;
    }

    // --- Constructor ---
    constructor(address initialOwner) Ownable(initialOwner) {
        isMember[initialOwner] = true;
        totalMembers = 1;
        emit MemberAdded(initialOwner);
    }

    // --- External Functions ---

    function setAddresses(address _verifier, address _stakingManager) external onlyOwner {
        require(_verifier != address(0) && _stakingManager != address(0), "DisputeResolver: Zero address");
        vortexVerifierAddress = _verifier;
        stakingManager = IStakingManager(_stakingManager);
    }

    function createDispute(bytes32 disputeId, address proposer) external onlyVortexVerifier {
        require(!disputes[disputeId].exists, "DisputeResolver: Dispute already exists");
        disputes[disputeId].exists = true;
        disputes[disputeId].proposer = proposer;
        emit DisputeCreated(disputeId, proposer);
    }

    function castVote(bytes32 disputeId, bool voteConfirm) public {
        require(isMember[msg.sender], "DisputeResolver: Caller is not a council member");
        Dispute storage dispute = disputes[disputeId];
        require(dispute.exists, "DisputeResolver: Dispute does not exist");
        require(!dispute.hasVoted[msg.sender], "DisputeResolver: Member has already voted");
        require(!dispute.resolved, "DisputeResolver: Dispute has already been resolved");

        dispute.hasVoted[msg.sender] = true;
        if (voteConfirm) {
            dispute.yesVotes++;
        } else {
            dispute.noVotes++;
        }

        emit Voted(disputeId, msg.sender, voteConfirm);
    }

    function resolveDispute(bytes32 disputeId) public {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.exists, "DisputeResolver: Dispute does not exist");
        require(!dispute.resolved, "DisputeResolver: Dispute has already been resolved");

        uint256 majorityThreshold = (totalMembers / 2) + 1;
        bool isFraud = false;

        if (dispute.yesVotes >= majorityThreshold) {
            isFraud = true;
        } else if (dispute.noVotes >= majorityThreshold) {
            isFraud = false;
        } else {
            revert("DisputeResolver: Majority threshold not reached");
        }

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
    function getDispute(bytes32 disputeId) external view returns (address, uint256, uint256, bool, bool) {
        Dispute storage d = disputes[disputeId];
        return (d.proposer, d.yesVotes, d.noVotes, d.resolved, d.exists);
    }

    // --- Membership Management ---
    function addMember(address _member) public onlyOwner {
        require(_member != address(0), "DisputeResolver: Cannot add the zero address");
        require(!isMember[_member], "DisputeResolver: Address is already a member");
        isMember[_member] = true;
        totalMembers++;
        emit MemberAdded(_member);
    }

    function removeMember(address _member) public onlyOwner {
        require(_member != address(0), "DisputeResolver: Cannot remove the zero address");
        require(isMember[_member], "DisputeResolver: Address is not a member");
        require(_member != owner(), "DisputeResolver: Cannot remove the owner");
        isMember[_member] = false;
        totalMembers--;
        emit MemberRemoved(_member);
    }
}