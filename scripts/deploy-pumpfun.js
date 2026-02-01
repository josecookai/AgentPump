const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying AgentPumpFunFactory (Pump.fun Clone)...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", (await deployer.getBalance()).toString(), "\n");

  // Get environment variables
  const SIGNER_ADDRESS = process.env.SIGNER_ADDRESS;
  const UNISWAP_V2_ROUTER = process.env.UNISWAP_V2_ROUTER;

  if (!SIGNER_ADDRESS || !UNISWAP_V2_ROUTER) {
    throw new Error("Missing required environment variables: SIGNER_ADDRESS, UNISWAP_V2_ROUTER");
  }

  console.log("📋 Configuration:");
  console.log("  - Signer Address:", SIGNER_ADDRESS);
  console.log("  - Uniswap V2 Router:", UNISWAP_V2_ROUTER);
  console.log("  - Network:", hre.network.name, "\n");

  // Deploy AgentPumpFunFactory
  console.log("📦 Deploying AgentPumpFunFactory contract...");
  const AgentPumpFunFactory = await hre.ethers.getContractFactory("AgentPumpFunFactory");
  const factory = await AgentPumpFunFactory.deploy(SIGNER_ADDRESS, UNISWAP_V2_ROUTER);
  await factory.deployed();

  console.log("✅ AgentPumpFunFactory deployed to:", factory.address);
  console.log("📊 Transaction hash:", factory.deployTransaction.hash, "\n");

  // Verify contract (if on testnet/mainnet)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    const VERIFY = process.env.VERIFY === "true";
    if (VERIFY && process.env.BASESCAN_API_KEY) {
      console.log("⏳ Waiting for block confirmations...");
      await factory.deployTransaction.wait(5);

      console.log("🔍 Verifying contract on Basescan...");
      try {
        await hre.run("verify:verify", {
          address: factory.address,
          constructorArguments: [SIGNER_ADDRESS, UNISWAP_V2_ROUTER],
        });
        console.log("✅ Contract verified!");
      } catch (error) {
        console.log("❌ Verification failed:", error.message);
      }
    }
  }

  console.log("\n📝 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Contract: AgentPumpFunFactory (Pump.fun Clone)");
  console.log("Address:", factory.address);
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🎯 Pump.fun Mode Features:");
  console.log("  ✅ Free launch (optional 0.025 ETH when creating with initial buy)");
  console.log("  ✅ 20% Creator vesting (200M tokens)");
  console.log("  ✅ Fixed fees: 0.95% Protocol + 0.30% Creator = 1.25%");
  console.log("  ✅ Graduation at 20 ETH collateral");
  console.log("  ✅ Post-graduation dynamic fees (0.30% - 1.25%)\n");

  return factory.address;
}

main()
  .then((address) => {
    console.log("✨ Deployment completed successfully!");
    console.log("📍 Factory address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
