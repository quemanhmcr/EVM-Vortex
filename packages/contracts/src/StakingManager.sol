// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StakingManager
 * @dev Manages the staking, unstaking, and slashing of assets for participants
 * in the Witness Network.
 */
contract StakingManager {
    mapping(address => uint256) public stakes;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    function stake() public payable {
        require(msg.value > 0, "Cannot stake 0");
        stakes[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function unstake(uint256 amount) public {
        // Check
        require(amount > 0, "Cannot unstake 0");
        uint256 userStake = stakes[msg.sender];
        require(userStake >= amount, "Insufficient stake");

        // Effect
        stakes[msg.sender] = userStake - amount;
        emit Unstaked(msg.sender, amount);

        // Interaction
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
