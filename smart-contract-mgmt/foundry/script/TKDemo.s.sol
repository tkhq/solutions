// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {TKDemo} from "src/TKDemo.sol";

contract TKDemoScript is Script {
  function setUp() public {}

  function run() public {
    // TODO: Set addresses for the variables below, then uncomment the following section:
    /*
    vm.startBroadcast();
    address initialOwner = <Set initialOwner address here>;
    address proxy = Upgrades.deployTransparentProxy(
      "TKDemo.sol",
      initialOwner,
      abi.encodeCall(TKDemo.initialize, (initialOwner))
    );
    TKDemo instance = TKDemo(proxy);
    console.log("Proxy deployed to %s", address(instance));
    vm.stopBroadcast();
    */
  }
}
