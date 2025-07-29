// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IStakingManager.sol";
import "./DisputeResolver.sol";

/**
 * @title VortexVerifier
 * @author Your Name/Team Name
 * @notice This contract is the core of the optimistic mechanism. It receives data payloads
 * from Proposers, manages a challenge period, and allows for execution of intents
 * after the period has safely passed.
 * @dev All data proposed is considered valid unless challenged within the challenge period.
 */
contract VortexVerifier {
    /// @notice The address of the StakingManager contract, used to verify proposer stakes.
    IStakingManager public immutable stakingManager;

    /// @notice The address of the DisputeResolver contract, where challenges are sent.
    DisputeResolver public immutable disputeResolver;

    /// @notice The duration in seconds for the challenge period.
    uint256 public immutable challengePeriod;

    struct DataPayload {
        uint256 timestamp;
        bytes data;
    }

    struct Proposal {
        address proposer;
        uint256 proposedAt;
        DataPayload payload;
        bool isExecuted;
        bool isChallenged;
    }

    mapping(bytes32 => Proposal) public proposedData;

    event DataProposed(bytes32 indexed dataId, address indexed proposer, DataPayload payload);
    event DataExecuted(bytes32 indexed dataId);
    event DataChallenged(bytes32 indexed dataId, address indexed challenger);

    modifier onlyStaker() {
        require(stakingManager.stakes(msg.sender) > 0, "VortexVerifier: Caller is not a staker");
        _;
    }

    constructor(address _stakingManager, address _disputeResolver, uint256 _challengePeriod) {
        require(_stakingManager != address(0), "VortexVerifier: Invalid StakingManager address");
        require(_disputeResolver != address(0), "VortexVerifier: Invalid DisputeResolver address");
        require(_challengePeriod > 0, "VortexVerifier: Challenge period must be greater than 0");
        
        stakingManager = IStakingManager(_stakingManager);
        disputeResolver = DisputeResolver(_disputeResolver);
        challengePeriod = _challengePeriod;
    }

    function proposeData(DataPayload calldata _payload) external onlyStaker returns (bytes32) {
        bytes32 dataId = keccak256(abi.encodePacked(msg.sender, block.timestamp, _payload.timestamp, _payload.data));

        proposedData[dataId] = Proposal({
            proposer: msg.sender,
            proposedAt: block.timestamp,
            payload: _payload,
            isExecuted: false,
            isChallenged: false
        });

        emit DataProposed(dataId, msg.sender, _payload);
        return dataId;
    }

    function executeIntent(bytes32 _dataId) external {
        Proposal storage proposal = proposedData[_dataId];

        require(proposal.proposer != address(0), "VortexVerifier: Proposal does not exist");
        require(!proposal.isExecuted, "VortexVerifier: Intent already executed");
        require(!proposal.isChallenged, "VortexVerifier: Proposal is under challenge");
        require(block.timestamp >= proposal.proposedAt + challengePeriod, "VortexVerifier: Challenge period has not ended");

        proposal.isExecuted = true;
        emit DataExecuted(_dataId);
    }

    /**
     * @notice Allows any user to challenge a proposed data payload within the challenge period.
     * @dev This function marks the proposal as challenged, preventing its execution until the dispute is resolved.
     * @param _dataId The unique ID of the data payload to challenge.
     */
    function challengeData(bytes32 _dataId) external {
        Proposal storage proposal = proposedData[_dataId];

        require(proposal.proposer != address(0), "VortexVerifier: Proposal does not exist");
        require(block.timestamp < proposal.proposedAt + challengePeriod, "VortexVerifier: Challenge period has ended");
        require(!proposal.isChallenged, "VortexVerifier: Proposal already challenged");

        proposal.isChallenged = true;
        
        // Initiate the dispute in the resolver contract, passing the original proposer's address
        disputeResolver.createDispute(_dataId, proposal.proposer);

        emit DataChallenged(_dataId, msg.sender);
    }
}