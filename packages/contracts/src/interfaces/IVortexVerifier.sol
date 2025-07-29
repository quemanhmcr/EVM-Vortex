// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVortexVerifier {
    function finalizeChallenge(bytes32 dataId, bool isFraud) external;
}
