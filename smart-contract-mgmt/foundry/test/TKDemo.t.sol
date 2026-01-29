// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {TKDemo} from "src/TKDemo.sol";

contract TKDemoTest is Test {
  TKDemo public instance;

  function setUp() public {
    address initialOwner = vm.addr(1);
    address proxy = Upgrades.deployTransparentProxy(
      "TKDemo.sol",
      initialOwner,
      abi.encodeCall(TKDemo.initialize, (initialOwner))
    );
    instance = TKDemo(proxy);
  }

  function testName() public view {
    assertEq(instance.name(), "TKDemo");
  }
}
