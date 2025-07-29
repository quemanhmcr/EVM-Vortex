// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IStakingManager.sol";
import "./interfaces/IVortexVerifier.sol";
import "./DisputeResolver.sol";

/**
 * @title VortexVerifier
 * @author Your Name/Team Name
 * @notice This contract is the core of the optimistic mechanism. It receives data payloads
 * from Proposers, manages a challenge period, and allows for execution of intents
 * after the period has safely passed.
 * @dev All data proposed is considered valid unless challenged within the challenge period.
 */
contract VortexVerifier is IVortexVerifier {
    /// @notice The address of the StakingManager contract, used to verify proposer stakes.
    IStakingManager public immutable stakingManager;

    /// @notice The address of the DisputeResolver contract, where challenges are sent.
    address public immutable disputeResolver;

    /// @notice The duration in seconds for the challenge period.
    uint256 public immutable challengePeriod;

    /// @notice The amount of ETH required to be sent as a bond to challenge a proposal.
    uint256 public immutable challengeBond;

    struct DataPayload {
        uint256 timestamp;
        bytes data;
    }
    struct Proposal {
        address proposer;
        address challenger;
        uint256 proposedAt;
        DataPayload payload;
        bool isExecuted;
        bool isChallenged;
    }

    mapping(bytes32 => Proposal) public proposedData;

    event DataProposed(bytes32 indexed dataId, address indexed proposer, DataPayload payload);
    event DataExecuted(bytes32 indexed dataId);
    event DataChallenged(bytes32 indexed dataId, address indexed challenger, uint256 bondAmount);
    event ChallengeFinalized(bytes32 indexed dataId, bool indexed isFraud, address indexed challenger);

    modifier onlyStaker() {
        require(stakingManager.stakes(msg.sender) > 0, "VortexVerifier: Caller is not a staker");
        _;
    }

    modifier onlyDisputeResolver() {
        require(msg.sender == disputeResolver, "VortexVerifier: Caller is not the DisputeResolver");
        _;
    }

    constructor(address _stakingManager, address _disputeResolver, uint256 _challengePeriod, uint256 _challengeBond) {
        require(_stakingManager != address(0), "VortexVerifier: Invalid StakingManager address");
        require(_disputeResolver != address(0), "VortexVerifier: Invalid DisputeResolver address");
        require(_challengePeriod > 0, "VortexVerifier: Challenge period must be greater than 0");
        require(_challengeBond > 0, "VortexVerifier: Challenge bond must be greater than 0");
        
        stakingManager = IStakingManager(_stakingManager);
        disputeResolver = _disputeResolver;
        challengePeriod = _challengePeriod;
        challengeBond = _challengeBond;
    }

    function proposeData(DataPayload calldata _payload) external onlyStaker returns (bytes32) {
        bytes32 dataId = keccak256(abi.encodePacked(msg.sender, block.timestamp, _payload.timestamp, _payload.data));

        proposedData[dataId] = Proposal({
            proposer: msg.sender,
            challenger: address(0),
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

    function challengeData(bytes32 _dataId) external payable {
        require(msg.value == challengeBond, "VortexVerifier: Challenge bond must be provided");
        Proposal storage proposal = proposedData[_dataId];

        require(proposal.proposer != address(0), "VortexVerifier: Proposal does not exist");
        require(block.timestamp < proposal.proposedAt + challengePeriod, "VortexVerifier: Challenge period has ended");
        require(!proposal.isChallenged, "VortexVerifier: Proposal already challenged");

        proposal.isChallenged = true;
        proposal.challenger = msg.sender;
        
        DisputeResolver(disputeResolver).createDispute(_dataId, proposal.proposer);

        emit DataChallenged(_dataId, msg.sender, msg.value);
    }

    function finalizeChallenge(bytes32 dataId, bool isFraud) external override onlyDisputeResolver {
        Proposal storage proposal = proposedData[dataId];
        require(proposal.challenger != address(0), "VortexVerifier: Challenge does not exist for this proposal");

        if (isFraud) {
            // Refund the bond to the successful challenger
            (bool success, ) = proposal.challenger.call{value: challengeBond}("");
            require(success, "VortexVerifier: Bond refund failed");
        }
        // If not fraud, the bond is forfeited and remains with the contract.

        emit ChallengeFinalized(dataId, isFraud, proposal.challenger);
    }
}
