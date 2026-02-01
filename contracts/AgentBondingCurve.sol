// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentToken is ERC20 {
    address public factory;
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        factory = msg.sender;
    }
    function mint(address to, uint256 amount) external {
        require(msg.sender == factory, "Only factory");
        _mint(to, amount);
    }
    function burn(address from, uint256 amount) external {
        require(msg.sender == factory, "Only factory");
        _burn(from, amount);
    }
}

contract AgentPumpFactory is Ownable {
    event TokenLaunched(address indexed token, address indexed owner, string symbol);
    
    mapping(address => address) public agentToToken;
    
    // Simple Linear Curve: Price = Supply * 0.0001 ETH
    function getBuyPrice(address token, uint256 amount) public view returns (uint256) {
        return amount * 0.001 ether; // Mock logic
    }

    function launchToken(string memory name, string memory symbol) external payable {
        // 1. Deploy Token
        // 2. Mint 20% to Owner (Vested?)
        // 3. Emit Event
    }
}
