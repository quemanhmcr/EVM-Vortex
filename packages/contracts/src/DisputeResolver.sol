// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DisputeResolver is Ownable {
    // --- Structs ---
    struct Dispute {
        uint256 yesVotes;
        uint256 noVotes;
        mapping(address => bool) hasVoted;
        bool resolved;
        bool exists; // To differentiate from default struct values
    }

    // --- State Variables ---
    address public vortexVerifierAddress;
    mapping(address => bool) public isMember;
    mapping(bytes32 => Dispute) public disputes;
    uint256 public totalMembers;

    // --- Events ---
    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);
    event Voted(bytes32 indexed disputeId, address indexed voter, bool voteConfirm);
    event DisputeResolved(bytes32 indexed disputeId, bool result);
    event DisputeCreated(bytes32 indexed disputeId);

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

    function setVortexVerifierAddress(address _address) external onlyOwner {
        require(_address != address(0), "DisputeResolver: Zero address not allowed");
        vortexVerifierAddress = _address;
    }

    function createDispute(bytes32 disputeId) external onlyVortexVerifier {
        require(!disputes[disputeId].exists, "DisputeResolver: Dispute already exists");
        disputes[disputeId].exists = true;
        emit DisputeCreated(disputeId);
    }

    // --- Voting & Resolution ---
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

        if (dispute.yesVotes >= majorityThreshold) {
            dispute.resolved = true;
            emit DisputeResolved(disputeId, true); // Fraud confirmed
        } else if (dispute.noVotes >= majorityThreshold) {
            dispute.resolved = true;
            emit DisputeResolved(disputeId, false); // Fraud denied
        } else {
            revert("DisputeResolver: Majority threshold not reached");
        }
    }

    // --- View Functions ---

    function getDispute(bytes32 disputeId) external view returns (uint256, uint256, bool, bool) {
        Dispute storage d = disputes[disputeId];
        return (d.yesVotes, d.noVotes, d.resolved, d.exists);
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