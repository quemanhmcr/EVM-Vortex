// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStakingManager
 * @notice Interface for the StakingManager contract.
 * @dev Defines the external functions required by other contracts to interact
 * with the staking system, primarily to check staked balances.
 */
interface IStakingManager {
    /**
     * @notice Returns the staked amount for a given address.
     * @param user The address to query the stake for.
     * @return The amount staked in wei.
     */
    function stakes(address user) external view returns (uint256);
}
