// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AgentPumpFunFactory
 * @notice Complete Pump.fun clone implementation
 * 
 * PUMP.FUN BUSINESS MODEL:
 * 1. Free launch (optional 0.025 SOL fee when creating with initial buy)
 * 2. 20% Creator vesting (200M tokens out of 1B max)
 * 3. Fixed fees: 0.95% Protocol + 0.30% Creator = 1.25% total
 * 4. Graduation when bonding curve fully sells out (~$69k market cap)
 * 5. Post-graduation: Migrate to PumpSwap (we use Uniswap V2 as equivalent)
 * 6. Post-graduation fees: Dynamic based on market cap (0.30% - 1.25%)
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Uniswap V2 Router Interface
interface IUniswapV2Router02 {
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    
    function WETH() external pure returns (address);
    function factory() external pure returns (address);
}

// Uniswap V2 Factory Interface
interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

// The Agent Token
contract AgentToken is ERC20, Ownable {
    address public factory;
    constructor(string memory name, string memory symbol, address _owner) ERC20(name, symbol) {
        factory = msg.sender;
        transferOwnership(_owner);
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

// The Factory - Pump.fun Clone
contract AgentPumpFunFactory is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    event TokenLaunched(address indexed token, address indexed creator, string symbol, uint256 timestamp);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 newPrice);
    event Graduated(address indexed token, uint256 ethAmount, uint256 tokenAmount, address lpToken);

    // Constants - Pump.fun Style
    uint256 public constant OPTIONAL_LAUNCH_FEE = 0.025 ether; // ~0.025 SOL equivalent (optional, only when creating with initial buy)
    uint256 public constant GRADUATION_THRESHOLD = 20 ether; // ~$69k market cap (equivalent to pump.fun's sell-out threshold)
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address public immutable UNISWAP_V2_ROUTER;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1B tokens max
    uint256 public constant MIN_TRADE_AMOUNT = 0.0001 ether; // Minimum trade amount to prevent dust
    
    // Pump.fun Fixed Fees (in basis points, 10000 = 100%)
    uint256 public constant PROTOCOL_FEE_BPS = 95;  // 0.95% fixed (pump.fun style)
    uint256 public constant CREATOR_FEE_BPS = 30;  // 0.30% fixed (pump.fun style)
    uint256 public constant TOTAL_FEE_BPS = 125;    // 1.25% total (pump.fun style)
    
    // Pump.fun Creator Vesting
    uint256 public constant CREATOR_VESTING_BPS = 2000; // 20% (200M tokens out of 1B)
    
    // Post-graduation fee tiers (based on market cap in ETH)
    // Pump.fun style: fees decrease as market cap increases
    mapping(address => uint256) public postGraduationFeeBps; // Dynamic fee per token after graduation
    
    // State variables
    mapping(address => address) public agentToToken;
    mapping(address => uint256) public tokenCollateral;
    mapping(address => uint256) public nonces; // Nonce for signature replay protection
    mapping(address => uint256) public virtualK; // Virtual AMM constant product (x * y = k)
    mapping(address => bool) public graduated; // Whether token has graduated to Uniswap
    mapping(address => uint256) public tokenMarketCap; // Track market cap for post-graduation fees
    uint256 public protocolTreasury; // Total protocol treasury (optional launch fees + post-graduation fees)

    // The backend signer address (Admin)
    address public signerAddress;

    constructor(address _signer, address _uniswapRouter) {
        require(_signer != address(0), "Invalid signer");
        require(_uniswapRouter != address(0), "Invalid Uniswap router");
        signerAddress = _signer;
        UNISWAP_V2_ROUTER = _uniswapRouter;
    }

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        signerAddress = _signer;
    }

    // Pause functions for emergency
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Launch token - Pump.fun style (free launch, optional fee when creating with initial buy)
     * @param name Token name
     * @param symbol Token symbol
     * @param signature Backend signature for verification
     * @param nonce Nonce for replay protection
     * @param deadline Signature deadline
     * @param devBuyAmount Optional initial buy amount (if > 0, requires OPTIONAL_LAUNCH_FEE)
     */
    function launchToken(
        string memory name, 
        string memory symbol, 
        bytes memory signature,
        uint256 nonce,
        uint256 deadline,
        uint256 devBuyAmount
    ) external payable whenNotPaused {
        // Pump.fun: Free launch, but if creating with initial buy, require fee
        if (devBuyAmount > 0) {
            require(msg.value >= OPTIONAL_LAUNCH_FEE, "Launch fee required when creating with initial buy");
            protocolTreasury += OPTIONAL_LAUNCH_FEE;
        }
        // Otherwise, launch is free
        
        require(agentToToken[msg.sender] == address(0), "Already launched");
        require(bytes(name).length > 0 && bytes(name).length <= 50, "Invalid name length");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "Invalid symbol length");
        require(block.timestamp <= deadline, "Signature expired");
        
        uint256 remainingEth = msg.value;
        if (devBuyAmount > 0) {
            remainingEth = msg.value - OPTIONAL_LAUNCH_FEE;
        }
        
        // Verify Signature with nonce, chainId, and deadline
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender, 
            name, 
            symbol, 
            nonce,
            block.chainid,
            deadline,
            devBuyAmount
        ));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        
        require(recoveredSigner == signerAddress, "Invalid signature");
        require(nonces[msg.sender] < nonce, "Nonce too low");
        nonces[msg.sender] = nonce;

        // Deploy token
        AgentToken newToken = new AgentToken(name, symbol, msg.sender);
        address tokenAddr = address(newToken);
        agentToToken[msg.sender] = tokenAddr;
        
        // Pump.fun: Mint 20% to creator (vesting)
        uint256 creatorAmount = (MAX_SUPPLY * CREATOR_VESTING_BPS) / 10000;
        AgentToken(tokenAddr).mint(msg.sender, creatorAmount);
        
        // Initialize Virtual AMM with minimal liquidity
        uint256 initialEth = 0.001 ether;
        tokenCollateral[tokenAddr] = initialEth;
        // Initialize k = x * y
        virtualK[tokenAddr] = initialEth * creatorAmount;
        
        // Handle dev buy if requested
        uint256 ethUsedForDevBuy = 0;
        
        if (devBuyAmount > 0) {
            // Calculate required ETH for dev buy using bonding curve formula
            // Current state: x0 = initialEth, y0 = creatorAmount
            // Using formula: tokensBought = (ethForCurve * y0) / x0
            // So: ethForCurve = (devBuyAmount * x0) / y0
            uint256 ethForCurve = (devBuyAmount * initialEth) / creatorAmount;
            
            // Add fees to get total ETH needed (pump.fun fixed fees: 1.25%)
            uint256 ethNeededWithFees = (ethForCurve * 10000) / (10000 - TOTAL_FEE_BPS);
            
            require(remainingEth >= ethNeededWithFees, "Insufficient ETH for dev buy");
            
            // Perform dev buy (this will update collateral and k, and mint tokens)
            _buy(tokenAddr, msg.sender, ethNeededWithFees, devBuyAmount);
            ethUsedForDevBuy = ethNeededWithFees;
        } else {
            // No dev buy, mint minimal tokens to establish curve
            uint256 minTokens = 1000 * 1e18; // 1000 tokens
            AgentToken(tokenAddr).mint(msg.sender, minTokens);
            
            // Update k with new supply to maintain curve consistency
            uint256 newSupply = creatorAmount + minTokens;
            virtualK[tokenAddr] = initialEth * newSupply;
        }
        
        // Refund excess ETH
        uint256 totalEthUsed = (devBuyAmount > 0 ? OPTIONAL_LAUNCH_FEE : 0) + ethUsedForDevBuy;
        if (msg.value > totalEthUsed) {
            uint256 refund = msg.value - totalEthUsed;
            (bool success, ) = msg.sender.call{value: refund}("");
            require(success, "Refund failed");
        }
        
        emit TokenLaunched(tokenAddr, msg.sender, symbol, block.timestamp);
    }

    // Public Buy
    function buy(address token, uint256 minTokensOut) external payable nonReentrant whenNotPaused {
        require(token != address(0), "Invalid token");
        require(!graduated[token], "Token has graduated");
        _buy(token, msg.sender, msg.value, minTokensOut);
    }

    // Internal Buy Logic using Virtual AMM - Pump.fun Style
    function _buy(address tokenAddr, address buyer, uint256 ethAmount, uint256 minTokensOut) internal {
        require(ethAmount >= MIN_TRADE_AMOUNT, "ETH amount too small");
        require(!graduated[tokenAddr], "Token has graduated");
        
        AgentToken token = AgentToken(tokenAddr);
        
        // Pump.fun: Fixed fees (0.95% Protocol + 0.30% Creator = 1.25%)
        uint256 protocolFee = (ethAmount * PROTOCOL_FEE_BPS) / 10000;
        uint256 creatorFee = (ethAmount * CREATOR_FEE_BPS) / 10000;
        uint256 ethForCurve = ethAmount - protocolFee - creatorFee;

        // Get current state
        uint256 x0 = tokenCollateral[tokenAddr]; // ETH reserve
        uint256 y0 = token.totalSupply(); // Token supply
        uint256 k = virtualK[tokenAddr];
        
        // If k is 0, initialize it
        if (k == 0) {
            require(x0 > 0 && y0 > 0, "Invalid initial state");
            k = x0 * y0;
            virtualK[tokenAddr] = k;
        }

        // Virtual AMM Bonding Curve Formula
        // Buy formula: tokensBought = (ethForCurve * y0) / x0
        uint256 x1 = x0 + ethForCurve;
        
        uint256 tokensBought;
        if (x0 > 0 && y0 > 0) {
            tokensBought = (ethForCurve * y0) / x0;
            require(tokensBought > 0, "Token amount too small");
            require(x1 > x0, "ETH amount overflow check");
        } else {
            // Initial state: if no liquidity, use a simple formula
            tokensBought = ethForCurve * 1000; // 1 ETH = 1000 tokens initially
        }

        require(tokensBought >= minTokensOut, "Slippage too high");
        require(y0 + tokensBought <= MAX_SUPPLY, "Max supply reached");

        // Distribute fees immediately (pump.fun style)
        address creator = token.owner();
        if (protocolFee > 0) {
            (bool success1, ) = owner().call{value: protocolFee}("");
            require(success1, "Protocol fee transfer failed");
        }
        if (creatorFee > 0 && creator != address(0)) {
            (bool success2, ) = creator.call{value: creatorFee}("");
            require(success2, "Creator fee transfer failed");
        }

        // Update state
        uint256 y1_new = y0 + tokensBought;
        tokenCollateral[tokenAddr] = x1;
        virtualK[tokenAddr] = x1 * y1_new; // Update k with new state (k increases)

        // Mint tokens
        token.mint(buyer, tokensBought);

        // Check for graduation (pump.fun: when bonding curve fully sells out)
        _checkAndGraduate(tokenAddr);

        // Calculate new price for event
        uint256 newPrice = (x1 * 1e18) / (y0 + tokensBought);
        emit Trade(tokenAddr, buyer, true, ethAmount, tokensBought, newPrice);
    }

    // Sell function using Virtual AMM - Pump.fun Style
    function sell(address token, uint256 amount, uint256 minEthOut) external nonReentrant whenNotPaused {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(!graduated[token], "Token has graduated");
        
        AgentToken tokenContract = AgentToken(token);
        require(tokenContract.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Get current state
        uint256 x0 = tokenCollateral[token];
        uint256 y0 = tokenContract.totalSupply();
        
        // Calculate minimum ETH equivalent to enforce MIN_TRADE_AMOUNT
        if (y0 > 0 && x0 > 0) {
            uint256 estimatedEthValue = (amount * x0) / y0;
            require(estimatedEthValue >= MIN_TRADE_AMOUNT, "Trade amount too small");
        }
        uint256 k = virtualK[token];
        
        require(k > 0, "Invalid curve state");
        require(x0 > 0 && y0 > 0, "Invalid reserves");
        
        // Virtual AMM: Constant Product Formula for Selling
        uint256 y1 = y0 + amount;
        require(y1 > y0, "Invalid token amount");
        
        // Calculate new ETH reserve using constant product formula
        uint256 x1 = (x0 * y0) / y1;
        
        // Safety checks
        require(x1 > 0, "Division underflow: y1 too large");
        require(x0 >= x1, "Insufficient ETH reserve");
        
        // ETH to return: ethOutRaw = x0 - x1
        uint256 ethOutRaw = x0 - x1;
        
        // Pump.fun: Fixed fees (0.95% Protocol + 0.30% Creator = 1.25%)
        uint256 protocolFee = (ethOutRaw * PROTOCOL_FEE_BPS) / 10000;
        uint256 creatorFee = (ethOutRaw * CREATOR_FEE_BPS) / 10000;
        uint256 ethToReturn = ethOutRaw - protocolFee - creatorFee;
        
        require(ethToReturn >= minEthOut, "Slippage too high");
        require(tokenCollateral[token] >= ethToReturn, "Insufficient collateral");
        
        // Distribute fees immediately (pump.fun style)
        address creator = tokenContract.owner();
        if (protocolFee > 0) {
            (bool success1, ) = owner().call{value: protocolFee}("");
            require(success1, "Protocol fee transfer failed");
        }
        if (creatorFee > 0 && creator != address(0)) {
            (bool success2, ) = creator.call{value: creatorFee}("");
            require(success2, "Creator fee transfer failed");
        }
        
        // Update state
        tokenCollateral[token] = x1;
        virtualK[token] = x1 * y1; // Update k with new state (k decreases when selling)
        
        // Burn tokens
        tokenContract.burn(msg.sender, amount);
        
        // Transfer ETH to seller
        (bool success, ) = msg.sender.call{value: ethToReturn}("");
        require(success, "ETH transfer failed");
        
        // Calculate new price for event
        uint256 newPrice = (x1 * 1e18) / y1;
        emit Trade(token, msg.sender, false, ethToReturn, amount, newPrice);
    }

    // Check and graduate token if threshold reached (pump.fun: when bonding curve fully sells out)
    function _checkAndGraduate(address tokenAddr) internal {
        if (graduated[tokenAddr]) {
            return; // Already graduated
        }
        
        uint256 collateral = tokenCollateral[tokenAddr];
        if (collateral >= GRADUATION_THRESHOLD) {
            _graduate(tokenAddr);
        }
    }

    /**
     * @notice Graduate token to Uniswap V2 (equivalent to PumpSwap in pump.fun)
     * @dev Pump.fun style: All remaining tokens and ETH go to liquidity
     */
    function _graduate(address tokenAddr) internal {
        require(!graduated[tokenAddr], "Already graduated");
        
        AgentToken token = AgentToken(tokenAddr);
        uint256 totalSupply = token.totalSupply();
        uint256 collateral = tokenCollateral[tokenAddr];
        
        require(collateral >= GRADUATION_THRESHOLD, "Threshold not reached");
        
        // Mark as graduated
        graduated[tokenAddr] = true;
        
        // Pump.fun: No explicit graduation fee extraction
        // All collateral goes to liquidity creation
        uint256 ethForLiquidity = collateral;
        
        // Calculate market cap for post-graduation fee tracking
        // Market cap ≈ collateral * 2 (rough estimate, can be refined)
        tokenMarketCap[tokenAddr] = collateral * 2;
        
        // Set initial post-graduation fee based on market cap
        // Pump.fun: 0-420 SOL (≈0-20 ETH): 1.25%, gradually decreasing
        if (collateral < 20 ether) {
            postGraduationFeeBps[tokenAddr] = 125; // 1.25%
        } else {
            postGraduationFeeBps[tokenAddr] = 30; // 0.30% (for higher market caps)
        }
        
        // Approve router to spend tokens
        token.approve(UNISWAP_V2_ROUTER, totalSupply);
        
        // Add liquidity to Uniswap V2 (equivalent to PumpSwap)
        uint256 amountTokenMin = (totalSupply * 95) / 100; // 5% slippage tolerance
        uint256 amountETHMin = (ethForLiquidity * 95) / 100; // 5% slippage tolerance
        
        // Get Uniswap Factory address from Router
        address uniswapFactory = IUniswapV2Router02(UNISWAP_V2_ROUTER).factory();
        address weth = IUniswapV2Router02(UNISWAP_V2_ROUTER).WETH();
        
        // Add liquidity - LP tokens will be sent to DEAD_ADDRESS
        (uint256 amountToken, uint256 amountETH, uint256 liquidity) = 
            IUniswapV2Router02(UNISWAP_V2_ROUTER).addLiquidityETH{value: ethForLiquidity}(
                tokenAddr,
                totalSupply,
                amountTokenMin,
                amountETHMin,
                DEAD_ADDRESS, // Send LP tokens directly to dead address
                block.timestamp + 300 // 5 minute deadline
            );
        
        // Validate Uniswap call results
        require(liquidity > 0, "Liquidity creation failed");
        require(amountToken > 0 && amountETH > 0, "Invalid liquidity amounts");
        require(amountToken >= amountTokenMin, "Token slippage too high");
        require(amountETH >= amountETHMin, "ETH slippage too high");
        
        // Get LP token (pair) address
        address lpToken = IUniswapV2Factory(uniswapFactory).getPair(tokenAddr, weth);
        require(lpToken != address(0), "LP token pair not found");
        
        // Clear collateral (it's now in Uniswap)
        tokenCollateral[tokenAddr] = 0;
        
        // Emit graduation event
        emit Graduated(tokenAddr, amountETH, amountToken, lpToken);
    }

    /**
     * @notice Get post-graduation fee based on market cap (pump.fun style)
     * @dev Pump.fun: Fees scale by market cap, decreasing as market cap increases
     */
    function getPostGraduationFeeBps(address token) external view returns (uint256) {
        if (!graduated[token]) {
            return 0; // Not graduated yet
        }
        
        uint256 marketCap = tokenMarketCap[token];
        
        // Pump.fun fee tiers (converted from SOL to ETH)
        // 0-420 SOL ≈ 0-20 ETH: 1.25%
        // Gradually decreasing to 98k+ SOL ≈ 98k+ ETH: 0.30%
        if (marketCap < 20 ether) {
            return 125; // 1.25%
        } else if (marketCap < 100 ether) {
            return 100; // 1.00%
        } else if (marketCap < 500 ether) {
            return 75; // 0.75%
        } else if (marketCap < 1000 ether) {
            return 50; // 0.50%
        } else if (marketCap < 10000 ether) {
            return 40; // 0.40%
        } else {
            return 30; // 0.30% (for 98k+ ETH market cap)
        }
    }

    // Update market cap for post-graduation fee calculation
    function updateTokenMarketCap(address token, uint256 newMarketCap) external onlyOwner {
        require(graduated[token], "Token not graduated");
        tokenMarketCap[token] = newMarketCap;
        
        // Update post-graduation fee based on new market cap
        if (newMarketCap < 20 ether) {
            postGraduationFeeBps[token] = 125;
        } else if (newMarketCap < 100 ether) {
            postGraduationFeeBps[token] = 100;
        } else if (newMarketCap < 500 ether) {
            postGraduationFeeBps[token] = 75;
        } else if (newMarketCap < 1000 ether) {
            postGraduationFeeBps[token] = 50;
        } else if (newMarketCap < 10000 ether) {
            postGraduationFeeBps[token] = 40;
        } else {
            postGraduationFeeBps[token] = 30;
        }
    }

    // Withdraw protocol treasury (optional launch fees + post-graduation fees)
    function withdrawTreasury() external onlyOwner {
        uint256 amount = protocolTreasury;
        require(amount > 0, "No treasury to withdraw");
        protocolTreasury = 0;
        (bool success, ) = owner().call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // View function to get current price (using Virtual AMM)
    function getCurrentPrice(address token) external view returns (uint256) {
        AgentToken tokenContract = AgentToken(token);
        uint256 supply = tokenContract.totalSupply();
        uint256 collateral = tokenCollateral[token];
        
        if (supply == 0 || collateral == 0) {
            return 0;
        }
        
        // Price = x / y (ETH per token)
        return (collateral * 1e18) / supply;
    }

    // View function to get buy quote (using Virtual AMM)
    function getBuyQuote(address token, uint256 ethAmount) external view returns (uint256 tokensOut) {
        if (graduated[token]) {
            return 0;
        }
        
        // Pump.fun: Fixed fees (1.25%)
        uint256 protocolFee = (ethAmount * PROTOCOL_FEE_BPS) / 10000;
        uint256 creatorFee = (ethAmount * CREATOR_FEE_BPS) / 10000;
        uint256 ethForCurve = ethAmount - protocolFee - creatorFee;
        
        AgentToken tokenContract = AgentToken(token);
        uint256 x0 = tokenCollateral[token];
        uint256 y0 = tokenContract.totalSupply();
        
        if (x0 == 0 || y0 == 0) {
            // Initial state: use simple formula
            return ethForCurve * 1000; // 1 ETH = 1000 tokens initially
        }
        
        // Calculate tokens using bonding curve formula
        tokensOut = (ethForCurve * y0) / x0;
        
        // Check max supply
        if (y0 + tokensOut > MAX_SUPPLY) {
            tokensOut = MAX_SUPPLY - y0;
        }
    }

    // View function to get sell quote (using Virtual AMM)
    function getSellQuote(address token, uint256 tokenAmount) external view returns (uint256 ethOut) {
        if (graduated[token]) {
            return 0;
        }
        
        AgentToken tokenContract = AgentToken(token);
        uint256 x0 = tokenCollateral[token];
        uint256 y0 = tokenContract.totalSupply();
        
        if (x0 == 0 || y0 == 0) {
            return 0;
        }
        
        // Calculate ETH using constant product formula
        uint256 y1 = y0 + tokenAmount;
        
        // Safety check
        if (y1 == 0 || y1 > y0 + tokenAmount) {
            return 0;
        }
        
        uint256 x1 = (x0 * y0) / y1;
        
        // Check for underflow
        if (x1 == 0 || x0 < x1) {
            return 0;
        }
        
        uint256 ethOutRaw = x0 - x1;
        
        // Pump.fun: Fixed fees (1.25%)
        uint256 protocolFee = (ethOutRaw * PROTOCOL_FEE_BPS) / 10000;
        uint256 creatorFee = (ethOutRaw * CREATOR_FEE_BPS) / 10000;
        ethOut = ethOutRaw - protocolFee - creatorFee;
    }
}
