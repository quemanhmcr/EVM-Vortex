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
}