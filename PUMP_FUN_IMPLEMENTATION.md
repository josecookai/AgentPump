# Pump.fun 模式实现说明

## 📋 概述

已创建 `AgentPumpFunFactory.sol`，完全复制 Pump.fun 的商业模式和毕业机制。

## 🔄 两种模式对比

### 当前模式 (`AgentBondingCurve.sol`)
- ✅ 已保存到 Git
- 0% Creator vesting
- 动态费用 (1.05% - 1.95%)
- 固定 0.005 ETH 创建费用
- 2 ETH 毕业费用提取

### Pump.fun 模式 (`AgentPumpFunFactory.sol`)
- ✅ 新创建
- 20% Creator vesting (200M tokens)
- 固定费用 (1.25% = 0.95% Protocol + 0.30% Creator)
- 免费创建（带初始购买时可选 0.025 ETH 费用）
- 无毕业费用提取（全部进入流动性）

## 🎯 Pump.fun 模式关键特性

### 1. 创建费用
```solidity
// 免费创建
// 如果带初始购买，可选 0.025 ETH 费用
if (devBuyAmount > 0) {
    require(msg.value >= OPTIONAL_LAUNCH_FEE, "Launch fee required");
}
```

### 2. Creator 奖励
```solidity
// 20% Creator vesting (200M tokens out of 1B)
uint256 public constant CREATOR_VESTING_BPS = 2000;
uint256 creatorAmount = (MAX_SUPPLY * CREATOR_VESTING_BPS) / 10000;
AgentToken(tokenAddr).mint(msg.sender, creatorAmount);
```

### 3. 固定交易费用
```solidity
// Pump.fun: 固定 1.25% (0.95% Protocol + 0.30% Creator)
uint256 public constant PROTOCOL_FEE_BPS = 95;  // 0.95%
uint256 public constant CREATOR_FEE_BPS = 30;  // 0.30%
uint256 public constant TOTAL_FEE_BPS = 125;    // 1.25%
```

### 4. 毕业机制
```solidity
// Pump.fun: 当 collateral 达到 20 ETH 时毕业
// 无毕业费用提取，全部进入流动性
uint256 ethForLiquidity = collateral; // 全部使用，不提取费用
```

### 5. 毕业后费用（动态）
```solidity
// Pump.fun: 毕业后继续收费，基于市值动态调整
// 0-20 ETH: 1.25%
// 逐渐下降到 98k+ ETH: 0.30%
function getPostGraduationFeeBps(address token) external view returns (uint256)
```

## 📁 文件结构

```
contracts/
├── AgentBondingCurve.sol      # 当前模式（已保存）
└── AgentPumpFunFactory.sol    # Pump.fun 模式（新创建）
```

## 🚀 部署说明

### 部署当前模式
```bash
# 使用 AgentBondingCurve.sol
npx hardhat run scripts/deploy.js --network baseSepolia
```

### 部署 Pump.fun 模式
```bash
# 需要创建新的部署脚本
# 使用 AgentPumpFunFactory.sol
```

## 🔧 使用建议

1. **测试两种模式**: 在测试网上分别部署和测试两种模式
2. **选择模式**: 根据业务需求选择：
   - **当前模式**: 更公平，无预挖，动态激励
   - **Pump.fun 模式**: 更接近 pump.fun，20% creator 奖励，固定费用
3. **前端适配**: 根据选择的模式更新前端代码

## 📝 注意事项

1. **毕业后费用**: Pump.fun 模式实现了毕业后动态费用，但需要在 Uniswap V2 上实现额外的费用提取机制（可能需要 wrapper 合约）
2. **市场市值追踪**: `updateTokenMarketCap()` 需要外部调用或 oracle 集成
3. **签名验证**: 两种模式都使用相同的签名验证机制

## ✅ 完成状态

- [x] 保存当前模式到 Git
- [x] 创建 Pump.fun 模式合约
- [x] 实现 20% Creator vesting
- [x] 实现固定费用 (1.25%)
- [x] 实现免费创建（可选费用）
- [x] 实现毕业后动态费用框架
- [ ] 创建 Pump.fun 模式部署脚本
- [ ] 更新前端以支持两种模式
- [ ] 实现毕业后费用提取机制（如需要）
