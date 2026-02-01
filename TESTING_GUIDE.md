# 单元测试和错误处理指南

本指南涵盖 AgentPump 项目的单元测试编写、运行和错误处理最佳实践。

## 📋 目录

1. [测试概述](#1-测试概述)
2. [现有测试](#2-现有测试)
3. [测试运行](#3-测试运行)
4. [测试编写指南](#4-测试编写指南)
5. [错误处理文档](#5-错误处理文档)
6. [测试最佳实践](#6-测试最佳实践)
7. [覆盖率报告](#7-覆盖率报告)

---

## 1. 测试概述

### 1.1 测试框架

AgentPump 使用以下测试工具：

- **Hardhat**: 智能合约开发和测试框架
- **Chai**: 断言库
- **Ethers.js**: 以太坊交互库
- **Mocha**: 测试运行器（Hardhat 内置）

### 1.2 测试文件位置

- **智能合约测试**: `test/AgentPumpFactory.test.js`
- **前端测试**: 待添加（可选）
- **API 测试**: 待添加（可选）

### 1.3 测试类型

**单元测试**:
- 测试单个函数或功能
- 使用 Mock 对象隔离依赖
- 快速执行

**集成测试**:
- 测试多个组件协作
- 使用真实或接近真实的依赖
- 验证完整流程

**端到端测试**:
- 测试完整用户流程
- 使用真实环境
- 验证用户体验

---

## 2. 现有测试

### 2.1 测试文件结构

**`test/AgentPumpFactory.test.js`** 包含以下测试套件：

1. **Deployment Tests**
   - 测试合约部署
   - 验证初始状态
   - 检查配置参数

2. **Launch Token Tests**
   - 测试 token 创建
   - 验证签名机制
   - 检查费用支付
   - 测试错误情况

3. **Buy Token Tests**
   - 测试买入功能
   - 验证价格计算
   - 检查费用分配
   - 验证状态更新

4. **Sell Token Tests**
   - 测试卖出功能
   - 验证价格计算
   - 检查费用分配
   - 验证状态更新

5. **Dynamic Creator Fee Tests**
   - 测试动态费用计算
   - 验证费用阶梯
   - 检查费用变化

### 2.2 Mock Router

测试使用 Mock Uniswap Router 来隔离外部依赖：

```javascript
const MockRouterABI = [
  "function addLiquidityETH(...) external payable returns (...)",
  "function WETH() external pure returns (address)",
  "function factory() external pure returns (address)"
];
```

**优点**:
- 不依赖真实 Uniswap 部署
- 测试执行更快
- 可以控制 Mock 行为

---

## 3. 测试运行

### 3.1 运行所有测试

```bash
npx hardhat test
```

**预期输出**:
```
  AgentPumpFactory
    Deployment
      ✓ Should set the correct signer address
      ✓ Should set the correct Uniswap router
      ✓ Should have correct default fees
    Launch Token
      ✓ Should fail without launch fee
      ✓ Should fail with invalid signature
      ✓ Should launch token successfully
      ...
    
  15 passing (2s)
```

### 3.2 运行特定测试文件

```bash
npx hardhat test test/AgentPumpFactory.test.js
```

### 3.3 运行特定测试用例

```bash
npx hardhat test --grep "Should launch token successfully"
```

**使用 `--grep` 选项**:
- 匹配测试名称中包含指定字符串的测试
- 支持正则表达式

### 3.4 显示详细输出

```bash
npx hardhat test --verbose
```

**详细输出包括**:
- 每个测试的详细执行信息
- Gas 使用情况
- 事件日志

### 3.5 并行运行测试

```bash
npx hardhat test --parallel
```

**注意**: 某些测试可能不适合并行运行（如果共享状态）

---

## 4. 测试编写指南

### 4.1 测试结构

```javascript
describe("Feature Name", function () {
  let factory;
  let signer;
  let user1;

  beforeEach(async function () {
    // 设置测试环境
    [signer, user1] = await ethers.getSigners();
    factory = await deployFactory();
  });

  it("Should do something", async function () {
    // 测试代码
    const result = await factory.someFunction();
    expect(result).to.equal(expectedValue);
  });
});
```

### 4.2 测试命名规范

**好的测试名称**:
- `Should launch token successfully`
- `Should fail without launch fee`
- `Should update collateral after buy`

**不好的测试名称**:
- `test1`
- `launch`
- `buy test`

### 4.3 使用 beforeEach

```javascript
beforeEach(async function () {
  // 重置状态
  // 部署新合约
  // 设置测试数据
});
```

**优点**:
- 每个测试独立
- 避免测试之间的相互影响
- 更容易调试

### 4.4 断言使用

```javascript
// 相等断言
expect(value).to.equal(expected);

// 大于/小于
expect(value).to.be.gt(min);
expect(value).to.be.lt(max);

// 包含
expect(array).to.include(item);

// 事件断言
await expect(tx).to.emit(contract, "EventName");

// 错误断言
await expect(tx).to.be.revertedWith("Error message");
```

### 4.5 Mock 对象使用

```javascript
// 部署 Mock Router
const MockRouter = await ethers.getContractFactory("MockRouter");
const mockRouter = await MockRouter.deploy();

// 在测试中使用
const factory = await Factory.deploy(signer.address, mockRouter.address);
```

---

## 5. 错误处理文档

### 5.1 智能合约错误

#### 5.1.1 Launch Token 错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Launch fee required` | 未支付创建费用 | 确保发送足够的 ETH（当前模式：0.005 ETH，Pump.fun 模式：免费或 0.025 ETH） |
| `Invalid signature` | 签名验证失败 | 检查签名是否正确生成，nonce、chainId、deadline、devBuyAmount 是否匹配 |
| `Signature expired` | 签名已过期 | 重新生成签名，确保 deadline 在未来 |
| `Already launched` | 该地址已创建过 token | 每个地址只能创建一个 token |
| `Invalid name length` | Token 名称长度无效 | 名称长度必须在 1-50 字符之间 |
| `Invalid symbol length` | Token 符号长度无效 | 符号长度必须在 1-10 字符之间 |
| `Nonce too low` | Nonce 值太低 | 使用更高的 nonce 值 |

#### 5.1.2 Buy Token 错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Token has graduated` | Token 已毕业 | 在 Uniswap V2 上交易，而不是 bonding curve |
| `ETH amount too small` | ETH 金额太小 | 确保金额 >= MIN_TRADE_AMOUNT (0.0001 ETH) |
| `Slippage too high` | 滑点超过设置值 | 调整 minTokensOut 参数 |
| `Max supply reached` | 达到最大供应量 | Token 已达到 1B 上限 |
| `Token amount too small` | Token 数量太小 | 增加 ETH 金额 |

#### 5.1.3 Sell Token 错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Token has graduated` | Token 已毕业 | 在 Uniswap V2 上交易 |
| `Insufficient balance` | 余额不足 | 确保账户有足够的 tokens |
| `Trade amount too small` | 交易金额太小 | 确保金额 >= MIN_TRADE_AMOUNT |
| `Slippage too high` | 滑点超过设置值 | 调整 minEthOut 参数 |
| `Insufficient collateral` | Collateral 不足 | 检查合约状态 |

#### 5.1.4 Graduation 错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `Threshold not reached` | Collateral 未达到 20 ETH | 继续买入直到达到阈值 |
| `Insufficient collateral for graduation fee` | Collateral 不足以支付毕业费用 | 确保至少有 2 ETH（当前模式）或 20 ETH（Pump.fun 模式） |
| `Liquidity creation failed` | 流动性创建失败 | 检查 Uniswap Router 配置 |
| `LP token pair not found` | LP token 未找到 | 检查 Uniswap Factory 配置 |

### 5.2 前端错误处理

#### 5.2.1 钱包连接错误

| 错误场景 | 处理方式 |
|---------|---------|
| 钱包未安装 | 显示 "请安装 MetaMask" 提示，提供安装链接 |
| 钱包未连接 | 显示 "连接钱包" 按钮 |
| 网络错误 | 显示 "请切换到 Base Sepolia 网络" 提示 |
| 连接被拒绝 | 显示 "连接被拒绝，请重试" 消息 |

#### 5.2.2 交易错误

| 错误场景 | 处理方式 |
|---------|---------|
| 用户拒绝交易 | 显示 "交易已取消" 消息 |
| 交易失败 | 显示错误信息，提供详细错误原因 |
| Gas 不足 | 显示 "Gas 不足" 提示，建议增加 Gas |
| 网络错误 | 显示网络错误提示，提供重试按钮 |
| Slippage 过高 | 显示 "滑点过高" 提示，建议调整滑点设置 |

#### 5.2.3 API 错误

| 错误场景 | 处理方式 |
|---------|---------|
| 网络请求失败 | 显示 "网络错误" 提示，提供重试按钮 |
| API 返回错误 | 显示友好的错误消息，记录错误日志 |
| 超时 | 显示 "请求超时" 提示，提供重试选项 |

#### 5.2.4 Moltbook 验证错误

| 错误场景 | 处理方式 |
|---------|---------|
| Agent 未找到 | 显示 "Agent 未找到" 消息，检查 Agent 名称 |
| 验证码未找到 | 显示 "验证码未找到，请稍后重试" 消息 |
| API 密钥错误 | 显示服务器错误（不暴露 API 密钥） |

### 5.3 API 错误处理

#### 5.3.1 HTTP 状态码

| 状态码 | 错误原因 | 响应格式 |
|--------|---------|---------|
| 400 | 请求参数错误 | `{ error: "Missing required fields" }` |
| 400 | Moltbook 验证失败 | `{ error: "Agent not found" }` |
| 400 | 验证码未找到 | `{ error: "Verification post not found yet. Try again in 30s." }` |
| 405 | 方法不允许 | `{ error: "Method not allowed" }` |
| 500 | 服务器错误 | `{ error: "Internal Server Error" }` |
| 500 | 配置错误 | `{ error: "SIGNER_PRIVATE_KEY not configured" }` |

#### 5.3.2 错误响应格式

```typescript
// 成功响应
{
  success: true,
  signature: "0x...",
  message: "Verified! You can now launch."
}

// 错误响应
{
  error: "Error message"
}
```

#### 5.3.3 错误日志记录

```typescript
try {
  // API 逻辑
} catch (error: any) {
  console.error('API Error:', error);
  res.status(500).json({ error: error.message || 'Internal Server Error' });
}
```

---

## 6. 测试最佳实践

### 6.1 测试独立性

**每个测试应该独立**:
- 不依赖其他测试的执行顺序
- 不共享可变状态
- 使用 `beforeEach` 重置状态

**好的做法**:
```javascript
beforeEach(async function () {
  // 每个测试前重新部署合约
  factory = await deployFactory();
});
```

### 6.2 测试描述性

**使用清晰的测试名称**:
- 描述测试的内容
- 说明预期行为
- 包含上下文信息

**好的测试名称**:
```javascript
it("Should fail to launch token without paying launch fee", async function () {
  // ...
});

it("Should update collateral correctly after buying tokens", async function () {
  // ...
});
```

### 6.3 测试边界情况

**测试边界值**:
- 最小值（0, 1）
- 最大值（MAX_SUPPLY）
- 边界条件（刚好达到阈值）

**示例**:
```javascript
it("Should fail when buying with amount less than MIN_TRADE_AMOUNT", async function () {
  const tooSmall = ethers.parseEther("0.00001"); // Less than 0.0001 ETH
  await expect(
    factory.buy(tokenAddress, 0, { value: tooSmall })
  ).to.be.revertedWith("ETH amount too small");
});
```

### 6.4 测试错误情况

**测试所有错误路径**:
- 无效输入
- 权限错误
- 状态错误
- 余额不足

**示例**:
```javascript
it("Should revert when selling more tokens than balance", async function () {
  const balance = await token.balanceOf(user.address);
  const tooMuch = balance + ethers.parseEther("1000");
  
  await expect(
    factory.sell(tokenAddress, tooMuch, 0)
  ).to.be.reverted;
});
```

### 6.5 验证事件

**检查事件是否正确发出**:
```javascript
await expect(
  factory.launchToken(...)
).to.emit(factory, "TokenLaunched")
  .withArgs(tokenAddress, creator, symbol, anyValue);
```

### 6.6 验证状态变化

**检查合约状态是否正确更新**:
```javascript
const initialCollateral = await factory.tokenCollateral(tokenAddress);
await factory.buy(tokenAddress, 0, { value: ethAmount });
const newCollateral = await factory.tokenCollateral(tokenAddress);
expect(newCollateral).to.be.gt(initialCollateral);
```

### 6.7 使用 Helper 函数

**创建可重用的测试辅助函数**:
```javascript
async function launchToken(factory, user, signer, name, symbol) {
  const nonce = 1;
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const messageHash = createMessageHash(user.address, name, symbol, nonce, deadline);
  const signature = await signer.signMessage(ethers.getBytes(messageHash));
  
  return factory.connect(user).launchToken(
    name, symbol, signature, nonce, deadline, 0,
    { value: LAUNCH_FEE }
  );
}
```

---

## 7. 覆盖率报告

### 7.1 安装覆盖率工具

```bash
npm install --save-dev solidity-coverage
```

### 7.2 配置 Hardhat

在 `hardhat.config.js` 中添加：

```javascript
require("solidity-coverage");

module.exports = {
  // ... 其他配置
};
```

### 7.3 运行覆盖率报告

```bash
npx hardhat coverage
```

**输出**:
- 在 `coverage/` 目录生成 HTML 报告
- 显示每个文件的覆盖率百分比
- 标识未覆盖的代码行

### 7.4 覆盖率目标

**建议覆盖率**:
- **语句覆盖率**: > 80%
- **分支覆盖率**: > 75%
- **函数覆盖率**: > 85%
- **行覆盖率**: > 80%

### 7.5 提高覆盖率

**识别未覆盖的代码**:
1. 查看覆盖率报告
2. 识别未测试的功能
3. 添加相应的测试用例
4. 重新运行覆盖率报告

---

## 8. 测试示例

### 8.1 完整测试示例

```javascript
describe("Buy Token", function () {
  let factory;
  let tokenAddress;
  let user1;
  let user2;

  beforeEach(async function () {
    [user1, user2] = await ethers.getSigners();
    
    // 部署 Factory
    factory = await deployFactory();
    
    // Launch token
    tokenAddress = await launchToken(factory, user1, signer, "Test", "TEST");
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

  it("Should fail when token has graduated", async function () {
    // 达到毕业阈值
    await graduateToken(factory, tokenAddress);
    
    const buyAmount = ethers.parseEther("0.1");
    await expect(
      factory.connect(user2).buy(tokenAddress, 0n, { value: buyAmount })
    ).to.be.revertedWith("Token has graduated");
  });
});
```

---

## 9. 持续集成

### 9.1 GitHub Actions 配置

创建 `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npx hardhat test
```

### 9.2 自动化测试

**好处**:
- 每次 push 自动运行测试
- 及早发现问题
- 确保代码质量

---

## 10. 总结

### 10.1 测试检查清单

- [ ] 所有核心功能都有测试
- [ ] 错误情况都有测试
- [ ] 边界值都有测试
- [ ] 事件都有验证
- [ ] 状态变化都有验证
- [ ] 测试覆盖率 > 80%

### 10.2 下一步

1. **增强测试覆盖率**: 添加更多测试用例
2. **添加集成测试**: 测试完整流程
3. **添加前端测试**: 测试 UI 组件
4. **添加 API 测试**: 测试 API 端点
5. **设置 CI/CD**: 自动化测试流程

---

**测试是确保代码质量的关键**。定期运行测试，及时修复问题，保持高测试覆盖率。
