// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IStakingManager.sol";

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

    /// @notice The duration in seconds for the challenge period.
    uint256 public immutable challengePeriod;

    /**
     * @notice Represents the data payload submitted by a Proposer.
     * @param timestamp The timestamp associated with the data (e.g., from an off-chain source).
     * @param data The arbitrary data bytes being proposed.
     */
    struct DataPayload {
        uint256 timestamp;
        bytes data;
    }

    /**
     * @notice Contains all information about a proposed data payload.
     * @param proposer The address of the account that proposed the data.
     * @param proposedAt The block timestamp when the proposal was made.
     * @param payload The actual data payload.
     * @param isExecuted A flag indicating if the proposal's intent has been executed.
     */
    struct Proposal {
        address proposer;
        uint256 proposedAt;
        DataPayload payload;
        bool isExecuted;
        // bool isChallenged; // To be used in the unhappy path
    }

    /// @notice Mapping from a unique data ID to the corresponding proposal.
    mapping(bytes32 => Proposal) public proposedData;

    /// @notice Emitted when a new data payload is proposed.
    event DataProposed(bytes32 indexed dataId, address indexed proposer, DataPayload payload);
    
    /// @notice Emitted when a data payload is executed after the challenge period.
    event DataExecuted(bytes32 indexed dataId);

    /**
     * @dev A modifier to ensure the caller has a stake in the StakingManager.
     */
    modifier onlyStaker() {
        require(stakingManager.stakes(msg.sender) > 0, "VortexVerifier: Caller is not a staker");
        _;
    }

    /**
     * @notice Initializes the contract with necessary addresses and parameters.
     * @param _stakingManager The address of the deployed StakingManager contract.
     * @param _challengePeriod The duration of the challenge period in seconds.
     */
    constructor(address _stakingManager, uint256 _challengePeriod) {
        require(_stakingManager != address(0), "VortexVerifier: Invalid StakingManager address");
        require(_challengePeriod > 0, "VortexVerifier: Challenge period must be greater than 0");
        stakingManager = IStakingManager(_stakingManager);
        challengePeriod = _challengePeriod;
    }

    /**
     * @notice Called by a Proposer (a staker) to submit a new data payload.
     * @dev The dataId is generated using keccak256 over the proposer, block timestamp, and payload.
     * This is considered sufficiently unique for the happy path.
     * @param _payload The data payload containing the timestamp and data bytes.
     * @return dataId The unique identifier for the proposal.
     */
    function proposeData(DataPayload calldata _payload) external onlyStaker returns (bytes32) {
        bytes32 dataId = keccak256(abi.encodePacked(msg.sender, block.timestamp, _payload.timestamp, _payload.data));

        proposedData[dataId] = Proposal({
            proposer: msg.sender,
            proposedAt: block.timestamp,
            payload: _payload,
            isExecuted: false
        });

        emit DataProposed(dataId, msg.sender, _payload);
        return dataId;
    }

    /**
     * @notice Executes a user's intent based on a proposed data payload, after the challenge period has passed.
     * @param _dataId The unique ID of the data payload to execute.
     */
    function executeIntent(bytes32 _dataId) external {
        Proposal storage proposal = proposedData[_dataId];

        require(proposal.proposer != address(0), "VortexVerifier: Proposal does not exist");
        require(!proposal.isExecuted, "VortexVerifier: Intent already executed");
        // require(!proposal.isChallenged, "VortexVerifier: Proposal is under challenge");

        require(block.timestamp >= proposal.proposedAt + challengePeriod, "VortexVerifier: Challenge period has not ended");

        proposal.isExecuted = true;

        emit DataExecuted(_dataId);
    }
}
