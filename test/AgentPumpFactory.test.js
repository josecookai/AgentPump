const { expect } = require("chai");
const { ethers } = require("hardhat");

// Mock Uniswap Router contract for testing
const MockRouterABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function WETH() external pure returns (address)",
  "function factory() external pure returns (address)"
];

const MockRouterBytecode = "0x608060405234801561001057600080fd5b5061012f806100206000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c8063c45a0155166037578063d06ca61f146051575b600080fd5b603d6069565b6040516048919060b1565b60405180910390f35b60576071565b6040516060919060b1565b60405180910390f35b60005481565b60005481565b6000819050919050565b60ab81609a565b82525050565b600060208201905060c4600083018460a4565b9291505056fea2646970667358221220000000000000000000000000000000000000000000000000000000000000000064736f6c63430008070033";

describe("AgentPumpFactory", function () {
  let factory;
  let signer;
  let owner;
  let user1;
  let user2;
  let mockUniswapRouter;

  const LAUNCH_FEE = ethers.parseEther("0.005");
  const GRADUATION_THRESHOLD = ethers.parseEther("20");
  const MAX_SUPPLY = ethers.parseUnits("1000000000", 18); // 1B tokens

  beforeEach(async function () {
    [owner, signer, user1, user2] = await ethers.getSigners();

    // Deploy mock Uniswap Router using a simple contract factory
    // For testing, we'll use a zero address or deploy a minimal mock
    // In production, use actual Uniswap V2 Router address
    const MockRouterFactory = new ethers.ContractFactory(MockRouterABI, MockRouterBytecode, owner);
    mockUniswapRouter = await MockRouterFactory.deploy();
    await mockUniswapRouter.waitForDeployment();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("AgentPumpFactory");
    factory = await Factory.deploy(signer.address, await mockUniswapRouter.getAddress());
    await factory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct signer address", async function () {
      expect(await factory.signerAddress()).to.equal(signer.address);
    });

    it("Should set the correct Uniswap router", async function () {
      expect(await factory.UNISWAP_V2_ROUTER()).to.equal(await mockUniswapRouter.getAddress());
    });

    it("Should have correct default fees", async function () {
      expect(await factory.protocolFeeBps()).to.equal(100); // 1%
    });
  });

  describe("Launch Token", function () {
    let tokenName = "Test Agent Token";
    let tokenSymbol = "TAT";
    let nonce = 1;
    let deadline;
    let devBuyAmount = 0;

    beforeEach(async function () {
      deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    });

    it("Should fail without launch fee", async function () {
      // Create message hash matching contract logic: keccak256(abi.encodePacked(...))
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "uint256", "uint256", "uint256", "uint256"],
        [user1.address, tokenName, tokenSymbol, nonce, 84532, deadline, devBuyAmount]
      );
      // Contract uses toEthSignedMessageHash, so we need to hash again
      const ethSignedMessageHash = ethers.hashMessage(ethers.getBytes(messageHash));
      const signature = await signer.signMessage(ethers.getBytes(messageHash));

      await expect(
        factory.connect(user1).launchToken(
          tokenName,
          tokenSymbol,
          signature,
          nonce,
          deadline,
          devBuyAmount,
          { value: ethers.parseEther("0.001") }
        )
      ).to.be.revertedWith("Launch fee required");
    });

    it("Should fail with invalid signature", async function () {
      const wrongMessageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "uint256", "uint256", "uint256", "uint256"],
        [user2.address, tokenName, tokenSymbol, nonce, 84532, deadline, devBuyAmount]
      );
      const wrongSignature = await signer.signMessage(ethers.getBytes(wrongMessageHash));

      await expect(
        factory.connect(user1).launchToken(
          tokenName,
          tokenSymbol,
          wrongSignature,
          nonce,
          deadline,
          devBuyAmount,
          { value: LAUNCH_FEE }
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should launch token successfully", async function () {
      // Create message hash matching contract logic
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "uint256", "uint256", "uint256", "uint256"],
        [user1.address, tokenName, tokenSymbol, nonce, 84532, deadline, devBuyAmount]
      );
      const signature = await signer.signMessage(ethers.getBytes(messageHash));

      await expect(
        factory.connect(user1).launchToken(
          tokenName,
          tokenSymbol,
          signature,
          nonce,
          deadline,
          devBuyAmount,
          { value: LAUNCH_FEE }
        )
      ).to.emit(factory, "TokenLaunched");

      const tokenAddress = await factory.agentToToken(user1.address);
      expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

      // Check creator received no vesting (0%)
      // Creator should only have tokens from min tokens mint (1000 tokens) if no dev buy
      const Token = await ethers.getContractAt("AgentToken", tokenAddress);
      const creatorBalance = await Token.balanceOf(user1.address);
      // If no dev buy, creator gets minTokens (1000 tokens)
      // If dev buy, creator gets devBuyAmount tokens
      const minTokens = 1000n * 10n**18n; // 1000 tokens
      expect(creatorBalance).to.be.gte(minTokens); // At least minTokens
    });

    it("Should prevent duplicate launches", async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "uint256", "uint256", "uint256", "uint256"],
        [user1.address, tokenName, tokenSymbol, nonce, 84532, deadline, devBuyAmount]
      );
      const signature = await signer.signMessage(ethers.getBytes(messageHash));

      await factory.connect(user1).launchToken(
        tokenName,
        tokenSymbol,
        signature,
        nonce,
        deadline,
        devBuyAmount,
        { value: LAUNCH_FEE }
      );

      // Try to launch again
      const newNonce = nonce + 1;
      const newDeadline = Math.floor(Date.now() / 1000) + 3600;
      const newMessageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "uint256", "uint256", "uint256", "uint256"],
        [user1.address, tokenName, tokenSymbol, newNonce, 84532, newDeadline, devBuyAmount]
      );
      const newSignature = await signer.signMessage(ethers.getBytes(newMessageHash));

      await expect(
        factory.connect(user1).launchToken(
          tokenName,
          tokenSymbol,
          newSignature,
          newNonce,
          newDeadline,
          devBuyAmount,
          { value: LAUNCH_FEE }
        )
      ).to.be.revertedWith("Already launched");
    });
  });

  describe("Buy Token", function () {
    let tokenAddress;

    beforeEach(async function () {
      // Launch a token first
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";
      const nonce = 1;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const devBuyAmount = 0;

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "uint256", "uint256", "uint256", "uint256"],
        [user1.address, tokenName, tokenSymbol, nonce, 84532, deadline, devBuyAmount]
      );
      const signature = await signer.signMessage(ethers.getBytes(messageHash));

      await factory.connect(user1).launchToken(
        tokenName,
        tokenSymbol,
        signature,
        nonce,
        deadline,
        devBuyAmount,
        { value: LAUNCH_FEE }
      );

      tokenAddress = await factory.agentToToken(user1.address);
    });

    it("Should allow buying tokens", async function () {
      const buyAmount = ethers.parseEther("0.1");
      const minTokensOut = 0n;

      await expect(
        factory.connect(user2).buy(tokenAddress, minTokensOut, { value: buyAmount })
      ).to.emit(factory, "Trade");

      const Token = await ethers.getContractAt("AgentToken", tokenAddress);
      const balance = await Token.balanceOf(user2.address);
      expect(balance).to.be.gt(0);
    });

    it("Should update collateral after buy", async function () {
      const buyAmount = ethers.parseEther("0.1");
      const initialCollateral = await factory.tokenCollateral(tokenAddress);
      
      await factory.connect(user2).buy(tokenAddress, 0n, { value: buyAmount });
      
      const newCollateral = await factory.tokenCollateral(tokenAddress);
      expect(newCollateral).to.be.gt(initialCollateral);
    });
  });

  describe("Sell Token", function () {
    let tokenAddress;
    let Token;

    beforeEach(async function () {
      // Launch and buy tokens first
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";
      const nonce = 1;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const devBuyAmount = 0;

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "uint256", "uint256", "uint256", "uint256"],
        [user1.address, tokenName, tokenSymbol, nonce, 84532, deadline, devBuyAmount]
      );
      const signature = await signer.signMessage(ethers.getBytes(messageHash));

      await factory.connect(user1).launchToken(
        tokenName,
        tokenSymbol,
        signature,
        nonce,
        deadline,
        devBuyAmount,
        { value: LAUNCH_FEE }
      );

      tokenAddress = await factory.agentToToken(user1.address);
      Token = await ethers.getContractAt("AgentToken", tokenAddress);

      // Buy some tokens first
      await factory.connect(user2).buy(tokenAddress, 0n, { value: ethers.parseEther("0.1") });
      
      // Note: Factory can burn tokens directly (no approval needed)
      // The burn function checks msg.sender == factory, so factory has permission
    });

    it("Should allow selling tokens", async function () {
      const balance = await Token.balanceOf(user2.address);
      const initialEth = await ethers.provider.getBalance(user2.address);

      await expect(
        factory.connect(user2).sell(tokenAddress, balance, 0n)
      ).to.emit(factory, "Trade");

      const newBalance = await Token.balanceOf(user2.address);
      expect(newBalance).to.equal(0);
    });

    it("Should fail if insufficient balance", async function () {
      const balance = await Token.balanceOf(user2.address);
      const tooMuch = balance + ethers.parseEther("1000");

      await expect(
        factory.connect(user2).sell(tokenAddress, tooMuch, 0n)
      ).to.be.reverted;
    });
  });

  describe("Dynamic Creator Fee", function () {
    let tokenAddress;

    beforeEach(async function () {
      const tokenName = "Test Token";
      const tokenSymbol = "TEST";
      const nonce = 1;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const devBuyAmount = 0;

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "string", "string", "uint256", "uint256", "uint256", "uint256"],
        [user1.address, tokenName, tokenSymbol, nonce, 84532, deadline, devBuyAmount]
      );
      const signature = await signer.signMessage(ethers.getBytes(messageHash));

      await factory.connect(user1).launchToken(
        tokenName,
        tokenSymbol,
        signature,
        nonce,
        deadline,
        devBuyAmount,
        { value: LAUNCH_FEE }
      );

      tokenAddress = await factory.agentToToken(user1.address);
    });

    it("Should return highest fee for low collateral", async function () {
      const fee = await factory.getCreatorFeeBps(tokenAddress);
      expect(fee).to.equal(95); // 0.95% for collateral < 0.5 ETH
    });

    it("Should decrease fee as collateral increases", async function () {
      // Buy tokens to increase collateral
      await factory.connect(user2).buy(tokenAddress, 0n, { value: ethers.parseEther("1") });
      
      const fee = await factory.getCreatorFeeBps(tokenAddress);
      expect(fee).to.be.lt(95); // Should be lower than initial fee
    });
  });
});

// Note: Mock Router is deployed using bytecode above
// For production testing, use actual Uniswap V2 Router address on Base Sepolia
