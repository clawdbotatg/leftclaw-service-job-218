// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployHelpers.s.sol";
import { PizzaSliceMinter } from "../contracts/PizzaSliceMinter.sol";

/**
 * @notice Deploy script for PizzaSliceMinter.
 * @dev Deployer-first pattern: deploys with `deployer` as initial owner, then calls
 *      `transferOwnership` to hand off to the client wallet. Client must call
 *      `acceptOwnership()` (Ownable2Step) to complete the transfer.
 *
 * Example:
 *   yarn deploy --file DeployPizzaSliceMinter.s.sol --network base
 */
contract DeployPizzaSliceMinter is ScaffoldETHDeploy {
    // CLAWD ERC-20 on Base mainnet (18 decimals — verified).
    address constant CLAWD_TOKEN = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;

    // Client wallet that will receive ownership.
    address constant CLIENT_OWNER = 0x34aA3F359A9D614239015126635CE7732c18fDF3;

    function run() external ScaffoldEthDeployerRunner {
        uint256 eventStart = block.timestamp + 1 hours;
        uint256 eventEnd = block.timestamp + 25 hours;

        PizzaSliceMinter pizzaSliceMinter =
            new PizzaSliceMinter(CLAWD_TOKEN, eventStart, eventEnd, deployer);

        console.log("PizzaSliceMinter deployed at:", address(pizzaSliceMinter));
        console.log("eventStart:", eventStart);
        console.log("eventEnd:", eventEnd);

        // Hand off to the client. Ownable2Step requires the client to call acceptOwnership().
        pizzaSliceMinter.transferOwnership(CLIENT_OWNER);
        console.log("Ownership transfer initiated to:", CLIENT_OWNER);

        deployments.push(Deployment({ name: "PizzaSliceMinter", addr: address(pizzaSliceMinter) }));
    }
}
