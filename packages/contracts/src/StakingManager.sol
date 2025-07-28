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

    function stake() public payable {
        require(msg.value > 0, "Cannot stake 0");
        stakes[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }
}
