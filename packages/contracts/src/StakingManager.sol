// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakingManager
 * @author Your Name/Team Name
 * @notice Manages the staking, unstaking, and future slashing of assets for participants
 * in the Witness Network. This contract handles the core financial incentives for validators.
 * @dev Inherits from ReentrancyGuard to prevent re-entrancy attacks on the unstake function.
 */
contract StakingManager is ReentrancyGuard {
    address public owner;
    address public disputeResolverAddress;

    /**
     * @notice Mapping from a user's address to their staked amount in wei.
     */
    mapping(address => uint256) public stakes;

    /**
     * @notice Emitted when a user successfully stakes funds.
     * @param user The address of the user who staked.
     * @param amount The amount staked in wei.
     */
    event Staked(address indexed user, uint256 amount);

    /**
     * @notice Emitted when a user successfully unstakes funds.
     * @param user The address of the user who unstaked.
     * @param amount The amount unstaked in wei.
     */
    event Unstaked(address indexed user, uint256 amount);

    event Slashed(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "StakingManager: Caller is not the owner");
        _;
    }

    modifier onlyDisputeResolver() {
        require(msg.sender == disputeResolverAddress, "StakingManager: Caller is not the DisputeResolver");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setDisputeResolverAddress(address _address) external onlyOwner {
        require(_address != address(0), "StakingManager: Zero address not allowed");
        disputeResolverAddress = _address;
    }

    /**
     * @notice Allows a user to stake ETH by sending it to this function.
     * @dev The amount staked is determined by `msg.value`. Requires the sent value to be greater than zero.
     */
    function stake() public payable {
        require(msg.value > 0, "StakingManager: Cannot stake 0");
        stakes[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    /**
     * @notice Allows a user to unstake a specified amount of their staked ETH.
     * @dev This function is protected against re-entrancy attacks.
     * It follows the Checks-Effects-Interactions pattern.
     * @param amount The amount to unstake in wei. Must be greater than zero and not exceed the user's stake.
     */
    function unstake(uint256 amount) public nonReentrant {
        // Check
        require(amount > 0, "StakingManager: Cannot unstake 0");
        uint256 userStake = stakes[msg.sender];
        require(userStake >= amount, "StakingManager: Insufficient stake");

        // Effect
        stakes[msg.sender] = userStake - amount;
        emit Unstaked(msg.sender, amount);

        // Interaction
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "StakingManager: ETH transfer failed");
    }

    /**
     * @notice Slashes the entire stake of a proposer.
     * @dev Can only be called by the registered DisputeResolver contract.
     * The slashed funds are kept in this contract.
     * @param _proposer The address of the proposer to be slashed.
     */
    function slash(address _proposer) external onlyDisputeResolver {
        uint256 stakeToSlash = stakes[_proposer];
        require(stakeToSlash > 0, "StakingManager: No stake to slash");
        
        stakes[_proposer] = 0;
        emit Slashed(_proposer, stakeToSlash);
    }
}
