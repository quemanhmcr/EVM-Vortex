// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DisputeResolver
 * @author Your Name/Team Name
 * @notice This contract acts as the ultimate court for the protocol. It is responsible
 * for verifying fraud proofs (initially via owner, later via ZK proofs) and resolving disputes.
 * @dev Inherits from Ownable to restrict sensitive functions to a trusted address.
 */
contract DisputeResolver is Ownable {
    // --- Structs ---
    struct Dispute {
        uint256 yesVotes;
        uint256 noVotes;
        mapping(address => bool) hasVoted;
        bool resolved;
    }

    // --- State Variables ---
    mapping(address => bool) public isMember;
    mapping(bytes32 => Dispute) public disputes;

    // --- Events ---
    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);
    event Voted(bytes32 indexed disputeId, address indexed voter, bool voteConfirm);

    // --- Constructor ---
    constructor(address initialOwner) Ownable(initialOwner) {
        isMember[initialOwner] = true;
        emit MemberAdded(initialOwner);
    }

    // --- Membership Management ---
    function addMember(address _member) public onlyOwner {
        require(_member != address(0), "DisputeResolver: Cannot add the zero address");
        require(!isMember[_member], "DisputeResolver: Address is already a member");
        isMember[_member] = true;
        emit MemberAdded(_member);
    }

    function removeMember(address _member) public onlyOwner {
        require(_member != address(0), "DisputeResolver: Cannot remove the zero address");
        require(isMember[_member], "DisputeResolver: Address is not a member");
        require(_member != owner(), "DisputeResolver: Cannot remove the owner");
        isMember[_member] = false;
        emit MemberRemoved(_member);
    }

    // --- Voting ---
    /**
     * @notice Allows a council member to cast a vote on a dispute.
     * @param disputeId The unique identifier of the dispute.
     * @param voteConfirm True to confirm fraud, false to deny fraud.
     */
    function castVote(bytes32 disputeId, bool voteConfirm) public {
        require(isMember[msg.sender], "DisputeResolver: Caller is not a council member");
        Dispute storage dispute = disputes[disputeId];
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

    // Placeholder for future ZK proof verification logic
}
