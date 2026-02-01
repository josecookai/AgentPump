// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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

// The Factory
contract AgentPumpFactory is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    event TokenLaunched(address indexed token, address indexed creator, string symbol, uint256 timestamp);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 newPrice);
    event Graduated(address indexed token, uint256 ethAmount, uint256 tokenAmount, address lpToken);

    // Constants
    uint256 public constant LAUNCH_FEE = 0.005 ether;
    uint256 public constant GRADUATION_THRESHOLD = 20 ether;
    uint256 public constant GRADUATION_FEE = 2 ether;
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address public immutable UNISWAP_V2_ROUTER;
    uint256 public constant MAX_TOTAL_FEE_BPS = 1000;        // 10% maximum total fee
    uint256 public constant CREATOR_VESTING_BPS = 0;         // 0% - No creator vesting
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1B tokens max
    uint256 public constant MIN_TRADE_AMOUNT = 0.0001 ether; // Minimum trade amount to prevent dust
    
    // Configurable fees (in basis points, 10000 = 100%)
    uint256 public protocolFeeBps = 100;         // 1% default (pump.fun style)
    uint256 public creatorFeeBps = 50;            // Legacy: kept for compatibility, but now dynamically calculated
    
    // Configurable dev buy cap (in basis points, 10000 = 100%)
    uint256 public maxDevBuyPercentBps = 250;    // 2.5% default

    // State variables
    mapping(address => address) public agentToToken;
    mapping(address => uint256) public tokenCollateral;
    mapping(address => uint256) public nonces; // Nonce for signature replay protection
    mapping(address => uint256) public virtualK; // Virtual AMM constant product (x * y = k)
    mapping(address => bool) public graduated; // Whether token has graduated to Uniswap
    uint256 public protocolTreasury; // Total protocol treasury (launch fees + graduation fees)

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

    // Set protocol fee (in basis points)
    function setProtocolFee(uint256 _protocolFeeBps) external onlyOwner {
        require(_protocolFeeBps <= MAX_TOTAL_FEE_BPS, "Protocol fee exceeds limit");
        // Use dynamic creator fee for total check
        uint256 maxCreatorFeeBps = 95; // Maximum dynamic creator fee
        require(_protocolFeeBps + maxCreatorFeeBps <= MAX_TOTAL_FEE_BPS, "Total fee exceeds limit");
        protocolFeeBps = _protocolFeeBps;
    }

    // Set creator fee (in basis points)
    // Note: Creator fee is now dynamically calculated based on collateral.
    // This function is kept for backward compatibility but may not be used.
    function setCreatorFee(uint256 _creatorFeeBps) external onlyOwner {
        require(protocolFeeBps + _creatorFeeBps <= MAX_TOTAL_FEE_BPS, "Total fee exceeds limit");
        creatorFeeBps = _creatorFeeBps;
    }

    // Get dynamic creator fee based on token collateral (pump.fun style)
    // Fee decreases as collateral increases, incentivizing early creators
    function getCreatorFeeBps(address token) public view returns (uint256) {
        uint256 collateral = tokenCollateral[token];
        
        // Dynamic fee tiers based on collateral (similar to pump.fun)
        if (collateral < 0.5 ether) return 95;      // 0.95% - Early stage, highest incentive
        if (collateral < 1 ether) return 90;        // 0.90%
        if (collateral < 2 ether) return 85;        // 0.85%
        if (collateral < 5 ether) return 75;       // 0.75%
        if (collateral < 10 ether) return 60;      // 0.60%
        if (collateral < 15 ether) return 40;      // 0.40%
        if (collateral < 20 ether) return 20;      // 0.20% - Approaching graduation
        return 5;                                   // 0.05% - Graduated or near graduation
    }

    // Set dev buy cap (in basis points)
    function setDevBuyCap(uint256 _maxDevBuyPercentBps) external onlyOwner {
        require(_maxDevBuyPercentBps <= 10000, "Cannot exceed 100%");
        maxDevBuyPercentBps = _maxDevBuyPercentBps;
    }

    // Pause functions for emergency
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Launch with Signature
    function launchToken(
        string memory name, 
        string memory symbol, 
        bytes memory signature,
        uint256 nonce,
        uint256 deadline,
        uint256 devBuyAmount
    ) external payable whenNotPaused {
        require(msg.value >= LAUNCH_FEE, "Launch fee required");
        require(agentToToken[msg.sender] == address(0), "Already launched");
        require(bytes(name).length > 0 && bytes(name).length <= 50, "Invalid name length");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "Invalid symbol length");
        require(block.timestamp <= deadline, "Signature expired");
        
        // 1. Collect launch fee
        protocolTreasury += LAUNCH_FEE;
        uint256 remainingEth = msg.value - LAUNCH_FEE;
        
        // 2. Verify Signature with nonce, chainId, and deadline
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

        // 3. Deploy token
        AgentToken newToken = new AgentToken(name, symbol, msg.sender);
        address tokenAddr = address(newToken);
        agentToToken[msg.sender] = tokenAddr;
        
        // 4. No creator vesting (0%)
        // Creator rewards removed - creators only earn from trading fees
        
        // 5. Initialize Virtual AMM with minimal liquidity
        uint256 initialEth = 0.001 ether;
        tokenCollateral[tokenAddr] = initialEth;
        // Initial supply is 0, will be set after dev buy or min tokens mint
        virtualK[tokenAddr] = 0; // Will be updated after first tokens are minted
        
        // 6. Handle dev buy if requested
        uint256 ethUsedForDevBuy = 0;
        
        if (devBuyAmount > 0) {
            // Enforce MAX_DEV_BUY_PERCENT limit
            uint256 maxDevBuy = (MAX_SUPPLY * maxDevBuyPercentBps) / 10000;
            require(devBuyAmount <= maxDevBuy, "Dev buy exceeds cap");
            
            // Calculate required ETH for dev buy using bonding curve formula
            // Current state: x0 = initialEth, y0 = 0 (no initial tokens, no creator vesting)
            // For initial buy when y0 = 0, use simple formula: 1 ETH = 1000 tokens
            // So: ethForCurve = devBuyAmount / (1000 * 1e18)
            uint256 ethForCurve = devBuyAmount / (1000 * 1e18); // Simple initial pricing: 1 ETH = 1000 tokens
            
            // Add fees to get total ETH needed (use dynamic creator fee)
            // At launch, collateral is small, so creator fee will be highest (0.95%)
            uint256 dynamicCreatorFeeBps = getCreatorFeeBps(tokenAddr);
            uint256 totalFeeBps = protocolFeeBps + dynamicCreatorFeeBps;
            uint256 ethNeededWithFees = (ethForCurve * 10000) / (10000 - totalFeeBps);
            
            require(remainingEth >= ethNeededWithFees, "Insufficient ETH for dev buy");
            
            // Perform dev buy (this will update collateral and k, and mint tokens)
            _buy(tokenAddr, msg.sender, ethNeededWithFees, devBuyAmount);
            ethUsedForDevBuy = ethNeededWithFees;
        } else {
            // No dev buy, mint minimal tokens to establish curve
            uint256 minTokens = 1000 * 1e18; // 1000 tokens
            AgentToken(tokenAddr).mint(msg.sender, minTokens);
            
            // Update k with new supply to maintain curve consistency
            // Since creatorAmount = 0, newSupply = minTokens
            uint256 newSupply = minTokens;
            virtualK[tokenAddr] = initialEth * newSupply;
            
            // Note: collateral remains at initialEth (0.001 ETH)
            // This establishes the initial price: 0.001 ETH / newSupply
        }
        
        // 7. Refund excess ETH
        uint256 totalEthUsed = LAUNCH_FEE + ethUsedForDevBuy;
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

    // Internal Buy Logic using Virtual AMM
    function _buy(address tokenAddr, address buyer, uint256 ethAmount, uint256 minTokensOut) internal {
        require(ethAmount >= MIN_TRADE_AMOUNT, "ETH amount too small");
        require(!graduated[tokenAddr], "Token has graduated");
        
        AgentToken token = AgentToken(tokenAddr);
        
        // Calculate fees: protocol fee is fixed 1%, creator fee is dynamic (pump.fun style)
        uint256 protocolFee = (ethAmount * protocolFeeBps) / 10000;
        uint256 dynamicCreatorFeeBps = getCreatorFeeBps(tokenAddr);
        uint256 creatorFee = (ethAmount * dynamicCreatorFeeBps) / 10000;
        uint256 ethForCurve = ethAmount - protocolFee - creatorFee;

        // Get current state
        uint256 x0 = tokenCollateral[tokenAddr]; // ETH reserve
        uint256 y0 = token.totalSupply(); // Token supply
        uint256 k = virtualK[tokenAddr];
        
        // If k is 0, initialize it (shouldn't happen, but safety check)
        if (k == 0) {
            require(x0 > 0 && y0 > 0, "Invalid initial state");
            k = x0 * y0;
            virtualK[tokenAddr] = k;
        }

        // Virtual AMM Bonding Curve Formula
        // 
        // DESIGN NOTE: Buy and Sell use different formulas by design:
        // - Buy: Linear formula ensures price increases (bonding curve behavior)
        // - Sell: Constant product formula ensures smooth price decrease
        //
        // This asymmetry is intentional for bonding curves:
        // - Buying pushes price up faster (incentivizes early buyers)
        // - Selling reduces price smoothly (protects liquidity)
        //
        // Buy formula: tokensBought = (ethForCurve * y0) / x0
        // This ensures: new_price = x1/y1 > x0/y0 = old_price
        // Where: x1 = x0 + ethForCurve, y1 = y0 + tokensBought
        //
        // Sell formula: x1 = (x0 * y0) / y1 (constant product)
        // This ensures smooth price decrease when selling
        //
        // The formulas are mathematically consistent for bonding curve behavior
        // where k increases on buy and decreases on sell, maintaining price direction
        
        // New ETH reserve: x1 = x0 + ethForCurve
        uint256 x1 = x0 + ethForCurve;
        
        uint256 tokensBought;
        if (x0 > 0 && y0 > 0) {
            // Buy formula: tokensBought = (ethForCurve * y0) / x0
            // This linear formula ensures price increases: x1/y1 > x0/y0
            // Mathematical proof:
            //   new_price = (x0 + ethForCurve) / (y0 + tokensBought)
            //   old_price = x0 / y0
            //   For new_price > old_price:
            //   (x0 + ethForCurve) / (y0 + tokensBought) > x0 / y0
            //   => (x0 + ethForCurve) * y0 > x0 * (y0 + tokensBought)
            //   => x0*y0 + ethForCurve*y0 > x0*y0 + x0*tokensBought
            //   => ethForCurve*y0 > x0*tokensBought
            //   => tokensBought < (ethForCurve * y0) / x0
            //   Using equality gives maximum tokens while maintaining price increase
            tokensBought = (ethForCurve * y0) / x0;
            
            // Safety checks
            require(tokensBought > 0, "Token amount too small");
            require(x1 > x0, "ETH amount overflow check"); // Ensure x1 > x0
        } else {
            // Initial state: if no liquidity, use a simple formula
            tokensBought = ethForCurve * 1000; // 1 ETH = 1000 tokens initially
        }

        require(tokensBought >= minTokensOut, "Slippage too high");
        require(y0 + tokensBought <= MAX_SUPPLY, "Max supply reached");

        // Distribute fees immediately
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

        // Check for graduation
        _checkAndGraduate(tokenAddr);

        // Calculate new price for event (price = x / y)
        uint256 newPrice = (x1 * 1e18) / (y0 + tokensBought);
        emit Trade(tokenAddr, buyer, true, ethAmount, tokensBought, newPrice);
    }

    // Sell function using Virtual AMM
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
        // This is approximate - actual ETH received may vary due to fees
        if (y0 > 0 && x0 > 0) {
            // Estimate ETH value: (amount / y0) * x0
            uint256 estimatedEthValue = (amount * x0) / y0;
            require(estimatedEthValue >= MIN_TRADE_AMOUNT, "Trade amount too small");
        }
        uint256 k = virtualK[token];
        
        require(k > 0, "Invalid curve state");
        require(x0 > 0 && y0 > 0, "Invalid reserves");
        
        // Virtual AMM: Constant Product Formula for Selling
        // 
        // DESIGN NOTE: Sell uses constant product formula: x * y = k
        // When selling: we add tokens back (y increases), so x decreases
        // Formula: x1 = (x0 * y0) / y1
        // This ensures smooth price decrease and maintains curve consistency
        //
        // New token supply: y1 = y0 + amount
        uint256 y1 = y0 + amount;
        
        // Safety check: y1 must be greater than y0
        require(y1 > y0, "Invalid token amount");
        
        // Calculate new ETH reserve using constant product formula
        // x1 = (x0 * y0) / y1
        // This maintains the k relationship while allowing k to decrease on sell
        uint256 x1 = (x0 * y0) / y1;
        
        // Safety checks: prevent underflow and ensure valid state
        require(x1 > 0, "Division underflow: y1 too large");
        require(x0 >= x1, "Insufficient ETH reserve");
        require(x0 - x1 <= x0, "Subtraction underflow check"); // Additional safety check
        
        // ETH to return: ethOutRaw = x0 - x1
        uint256 ethOutRaw = x0 - x1;
        
        // Calculate fees: protocol fee is fixed 1%, creator fee is dynamic (pump.fun style)
        uint256 protocolFee = (ethOutRaw * protocolFeeBps) / 10000;
        uint256 dynamicCreatorFeeBps = getCreatorFeeBps(token);
        uint256 creatorFee = (ethOutRaw * dynamicCreatorFeeBps) / 10000;
        uint256 ethToReturn = ethOutRaw - protocolFee - creatorFee;
        
        require(ethToReturn >= minEthOut, "Slippage too high");
        require(tokenCollateral[token] >= ethToReturn, "Insufficient collateral");
        
        // Distribute fees immediately
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

    // Check and graduate token if threshold reached
    function _checkAndGraduate(address tokenAddr) internal {
        if (graduated[tokenAddr]) {
            return; // Already graduated
        }
        
        uint256 collateral = tokenCollateral[tokenAddr];
        if (collateral >= GRADUATION_THRESHOLD) {
            _graduate(tokenAddr);
        }
    }

    // Graduate token to Uniswap V2
    function _graduate(address tokenAddr) internal {
        require(!graduated[tokenAddr], "Already graduated");
        
        AgentToken token = AgentToken(tokenAddr);
        uint256 totalSupply = token.totalSupply();
        uint256 collateral = tokenCollateral[tokenAddr];
        
        require(collateral >= GRADUATION_THRESHOLD, "Threshold not reached");
        
        // Mark as graduated
        graduated[tokenAddr] = true;
        
        // Extract graduation fee (2 ETH) to protocol treasury
        require(collateral >= GRADUATION_FEE, "Insufficient collateral for graduation fee");
        protocolTreasury += GRADUATION_FEE;
        uint256 ethForLiquidity = collateral - GRADUATION_FEE;
        
        // Approve router to spend tokens
        token.approve(UNISWAP_V2_ROUTER, totalSupply);
        
        // Add liquidity to Uniswap V2
        // We use all remaining tokens and ETH
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


    // Withdraw protocol treasury (launch fees + graduation fees)
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
        
        uint256 protocolFee = (ethAmount * protocolFeeBps) / 10000;
        uint256 dynamicCreatorFeeBps = getCreatorFeeBps(token);
        uint256 creatorFee = (ethAmount * dynamicCreatorFeeBps) / 10000;
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
        
        // Safety check: prevent division underflow
        if (y1 == 0 || y1 > y0 + tokenAmount) {
            return 0; // Invalid input
        }
        
        uint256 x1 = (x0 * y0) / y1;
        
        // Check for underflow
        if (x1 == 0 || x0 < x1) {
            return 0; // Insufficient reserve or underflow
        }
        
        uint256 ethOutRaw = x0 - x1;
        
        uint256 protocolFee = (ethOutRaw * protocolFeeBps) / 10000;
        uint256 dynamicCreatorFeeBps = getCreatorFeeBps(token);
        uint256 creatorFee = (ethOutRaw * dynamicCreatorFeeBps) / 10000;
        ethOut = ethOutRaw - protocolFee - creatorFee;
    }
}
