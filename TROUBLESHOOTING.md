# 常见问题排查指南

本指南提供 AgentPump 项目常见问题的详细排查步骤和解决方案。

## 📋 目录

1. [部署问题](#1-部署问题)
2. [智能合约问题](#2-智能合约问题)
3. [前端问题](#3-前端问题)
4. [API 问题](#4-api-问题)
5. [Railway 部署问题](#5-railway-部署问题)
6. [测试问题](#6-测试问题)
7. [网络问题](#7-网络问题)
8. [性能问题](#8-性能问题)

---

## 1. 部署问题

### 1.1 部署失败 - Insufficient funds

**错误信息**:
```
Error: insufficient funds for gas * price + value
```

**可能原因**:
- 账户余额不足
- Gas price 设置过高
- 交易 value 太大

**解决方案**:

1. **检查账户余额**:
```bash
# 在 Hardhat console 中
const balance = await ethers.provider.getBalance("0xYourAddress");
console.log("Balance:", ethers.formatEther(balance), "ETH");
```

2. **获取更多测试 ETH**:
- Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- 确保有至少 0.01 ETH

3. **降低 Gas Price**（如果手动设置）:
```javascript
// 在 hardhat.config.js 中移除固定 gasPrice
// 让 EIP-1559 自动处理
```

### 1.2 部署失败 - Invalid Uniswap Router

**错误信息**:
```
Error: Invalid Uniswap router
```

**可能原因**:
- Router 地址格式错误
- Base Sepolia 上没有 Uniswap V2
- Router 地址不存在

**解决方案**:

1. **检查 Router 地址格式**:
```bash
# 地址应该是 42 字符，以 0x 开头
echo $UNISWAP_V2_ROUTER
```

2. **查找 Base Sepolia Router 地址**:
- 检查 Base 官方文档
- 或使用 Mock Router 用于测试

3. **使用 Mock Router**（测试用）:
```javascript
// 在测试中使用 Mock Router
const MockRouter = await deployMockRouter();
const factory = await Factory.deploy(signer.address, MockRouter.address);
```

### 1.3 部署失败 - Network error

**错误信息**:
```
Error: network error
Error: could not detect network
```

**可能原因**:
- RPC URL 不正确
- 网络连接问题
- RPC 端点不可用

**解决方案**:

1. **检查 RPC URL**:
```javascript
// hardhat.config.js
baseSepolia: {
  url: "https://sepolia.base.org", // 确认 URL 正确
  accounts: [process.env.PRIVATE_KEY],
}
```

2. **尝试其他 RPC 端点**:
```javascript
// 备选 RPC URLs
url: "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
url: "https://base-sepolia.infura.io/v3/YOUR_KEY"
```

3. **检查网络连接**:
```bash
curl https://sepolia.base.org
```

### 1.4 合约验证失败

**错误信息**:
```
Error: Contract verification failed
```

**可能原因**:
- API Key 错误
- 合约已验证
- 构造函数参数不匹配

**解决方案**:

1. **检查 API Key**:
```bash
echo $BASESCAN_API_KEY
```

2. **检查合约是否已验证**:
- 在 Basescan 上查看合约
- 如果已验证，可以忽略错误

3. **手动验证**:
```bash
npx hardhat verify --network baseSepolia \
  <CONTRACT_ADDRESS> \
  <CONSTRUCTOR_ARG1> \
  <CONSTRUCTOR_ARG2>
```

---

## 2. 智能合约问题

### 2.1 Launch Token 失败

#### 2.1.1 Invalid signature

**错误信息**:
```
Error: Invalid signature
```

**排查步骤**:

1. **检查签名生成**:
```javascript
// 确认消息哈希包含所有参数
const messageHash = keccak256(abi.encodePacked(
  walletAddress,
  tokenName,
  tokenSymbol,
  nonce,
  chainId,
  deadline,
  devBuyAmount
));
```

2. **检查 chainId**:
```javascript
// Base Sepolia chainId = 84532
const chainId = 84532;
```

3. **检查 nonce**:
```javascript
// nonce 必须递增
const currentNonce = await factory.nonces(userAddress);
const newNonce = currentNonce + 1n;
```

4. **检查 deadline**:
```javascript
// deadline 必须在未来
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1小时后
```

#### 2.1.2 Signature expired

**错误信息**:
```
Error: Signature expired
```

**解决方案**:
- 重新生成签名，确保 deadline 在未来
- 增加 deadline 时间（例如 1 小时）

#### 2.1.3 Already launched

**错误信息**:
```
Error: Already launched
```

**解决方案**:
- 每个地址只能创建一个 token
- 如果需要创建新 token，使用不同的地址

### 2.2 Buy/Sell 失败

#### 2.2.1 Token has graduated

**错误信息**:
```
Error: Token has graduated
```

**解决方案**:
- Token 已毕业到 Uniswap V2
- 在 Uniswap V2 上交易，而不是 bonding curve

#### 2.2.2 Slippage too high

**错误信息**:
```
Error: Slippage too high
```

**解决方案**:
- 增加 `minTokensOut` 或 `minEthOut` 的容忍度
- 或等待价格稳定后再交易

#### 2.2.3 Insufficient balance

**错误信息**:
```
Error: Insufficient balance
```

**解决方案**:
- 检查账户余额
- 确保有足够的 tokens（sell）或 ETH（buy）

### 2.3 Graduation 问题

#### 2.3.1 Graduation 不触发

**可能原因**:
- Collateral 未达到 20 ETH
- `_checkAndGraduate` 未被调用

**排查步骤**:

1. **检查 Collateral**:
```javascript
const collateral = await factory.tokenCollateral(tokenAddress);
console.log("Collateral:", ethers.formatEther(collateral), "ETH");
```

2. **手动触发检查**（如果合约有公开函数）:
```javascript
// 在 buy 后会自动检查
await factory.buy(tokenAddress, 0, { value: remainingEth });
```

#### 2.3.2 Liquidity creation failed

**错误信息**:
```
Error: Liquidity creation failed
```

**可能原因**:
- Uniswap Router 配置错误
- Token 或 ETH 数量不足
- Slippage 设置过高

**解决方案**:
- 检查 Uniswap Router 地址
- 检查 token 和 ETH 余额
- 调整 slippage 容忍度

---

## 3. 前端问题

### 3.1 钱包连接失败

**症状**:
- 点击 "Connect Wallet" 无反应
- 钱包选择器不显示

**排查步骤**:

1. **检查 WalletConnect 配置**:
```typescript
// 确认 NEXT_PUBLIC_WALLET_CONNECT_ID 已设置
console.log(process.env.NEXT_PUBLIC_WALLET_CONNECT_ID);
```

2. **检查网络配置**:
```typescript
// 确认 Base Sepolia 网络配置正确
const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
};
```

3. **检查浏览器控制台**:
- 查看是否有 JavaScript 错误
- 检查网络请求是否成功

**解决方案**:
- 重新配置 WalletConnect Project ID
- 检查网络配置
- 清除浏览器缓存

### 3.2 交易失败

**症状**:
- 交易被拒绝
- 交易失败但未显示原因

**排查步骤**:

1. **检查钱包网络**:
- 确认钱包连接到 Base Sepolia
- Chain ID 应该是 84532

2. **检查账户余额**:
- 确保有足够的 ETH 支付 gas
- 确保有足够的 tokens（如果是 sell）

3. **检查交易参数**:
- 确认合约地址正确
- 确认函数参数正确
- 确认 value 正确（如果是 payable）

**解决方案**:
- 切换到正确的网络
- 增加账户余额
- 检查交易参数
- 查看详细错误信息

### 3.3 页面加载失败

**症状**:
- 页面显示空白
- 控制台有错误

**排查步骤**:

1. **检查环境变量**:
```bash
# 确认所有 NEXT_PUBLIC_* 变量已设置
echo $NEXT_PUBLIC_FACTORY_ADDRESS
echo $NEXT_PUBLIC_WALLET_CONNECT_ID
```

2. **检查构建**:
```bash
cd frontend
npm run build
# 查看是否有构建错误
```

3. **检查浏览器控制台**:
- 查看 JavaScript 错误
- 查看网络请求错误

**解决方案**:
- 重新配置环境变量
- 重新构建应用
- 检查代码是否有语法错误

---

## 4. API 问题

### 4.1 API 返回 500 错误

**症状**:
- `/api/verify` 或 `/api/tokens` 返回 500
- 前端显示服务器错误

**排查步骤**:

1. **检查服务器日志**:
```bash
# Railway 日志
railway logs

# 或查看 Railway Web UI 中的日志
```

2. **检查环境变量**:
```bash
# 确认 SIGNER_PRIVATE_KEY 已设置
echo $SIGNER_PRIVATE_KEY

# 确认 NEXT_PUBLIC_FACTORY_ADDRESS 已设置
echo $NEXT_PUBLIC_FACTORY_ADDRESS
```

3. **检查 API 代码**:
- 查看错误堆栈跟踪
- 检查 try-catch 块
- 确认所有依赖都正确导入

**常见原因**:
- `SIGNER_PRIVATE_KEY` 未配置
- `MOLTBOOK_READ_KEY` 未配置（如果使用）
- 网络请求失败
- 签名生成失败

**解决方案**:
- 配置缺失的环境变量
- 检查 API 密钥是否正确
- 检查网络连接
- 查看详细错误日志

### 4.2 Moltbook 验证失败

**错误信息**:
```
Error: Agent not found
Error: Verification post not found yet
```

**排查步骤**:

1. **检查 Agent 名称**:
- 确认 Agent 名称正确
- 在 Moltbook 上搜索 Agent

2. **检查验证码**:
- 确认验证码已发布
- 等待 30 秒后重试（API 可能有延迟）

3. **检查 API Key**:
```bash
echo $MOLTBOOK_READ_KEY
# 确认格式正确: moltbook_sk_...
```

**解决方案**:
- 确认 Agent 名称正确
- 重新发布验证码
- 等待后重试
- 检查 API Key

### 4.3 签名生成失败

**错误信息**:
```
Error: SIGNER_PRIVATE_KEY not configured
Error: Invalid private key
```

**排查步骤**:

1. **检查私钥格式**:
```bash
# 私钥应该是 66 字符（0x + 64 hex）
echo $SIGNER_PRIVATE_KEY | wc -c
```

2. **检查私钥与地址匹配**:
```javascript
const wallet = new ethers.Wallet(privateKey);
console.log("Address:", wallet.address);
// 应该与 SIGNER_ADDRESS 匹配
```

**解决方案**:
- 确认私钥格式正确
- 确认私钥与地址匹配
- 重新配置环境变量

---

## 5. Railway 部署问题

### 5.1 构建失败

**错误信息**:
```
Build failed
npm install failed
```

**排查步骤**:

1. **检查 Node.js 版本**:
```json
// package.json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

2. **检查依赖**:
```bash
cd frontend
npm install
# 查看是否有依赖错误
```

3. **查看构建日志**:
- 在 Railway Web UI 中查看详细日志
- 查找具体错误信息

**解决方案**:
- 更新 Node.js 版本要求
- 修复依赖问题
- 检查 package.json

### 5.2 环境变量未生效

**症状**:
- 前端无法读取环境变量
- API 无法访问环境变量

**排查步骤**:

1. **检查变量名**:
- 前端变量必须以 `NEXT_PUBLIC_` 开头
- 后端变量不应有 `NEXT_PUBLIC_` 前缀

2. **检查变量值**:
- 确认值正确设置
- 确认没有多余的空格

3. **重新部署**:
- 环境变量更改后需要重新构建
- 触发新的部署

**解决方案**:
- 检查变量名格式
- 重新设置环境变量
- 触发重新部署

### 5.3 应用无法访问

**症状**:
- 404 错误
- 连接超时

**排查步骤**:

1. **检查部署状态**:
- 在 Railway Web UI 中查看部署状态
- 确认部署成功

2. **检查域名**:
- 确认域名正确
- 检查 DNS 配置（如果使用自定义域名）

3. **检查端口**:
- Railway 自动处理端口
- 确认应用监听正确端口

**解决方案**:
- 等待部署完成
- 检查域名配置
- 查看 Railway 日志

---

## 6. 测试问题

### 6.1 测试失败 - Mock Router

**错误信息**:
```
Error: Mock Router deployment failed
```

**解决方案**:
- 检查 Mock Router 实现
- 确认 Hardhat 网络正常运行
- 检查测试文件中的 Mock Router 代码

### 6.2 测试失败 - 签名验证

**错误信息**:
```
Error: Invalid signature in test
```

**解决方案**:
- 检查测试中的签名生成逻辑
- 确认 chainId 正确（84532）
- 确认 nonce、deadline 正确

### 6.3 测试超时

**错误信息**:
```
Error: Test timeout
```

**解决方案**:
- 增加测试超时时间
- 优化测试代码
- 检查是否有无限循环

---

## 7. 网络问题

### 7.1 无法连接到 Base Sepolia

**症状**:
- RPC 请求失败
- 交易无法发送

**排查步骤**:

1. **检查 RPC URL**:
```javascript
const rpcUrl = "https://sepolia.base.org";
// 测试连接
fetch(rpcUrl);
```

2. **尝试其他 RPC**:
```javascript
// Alchemy
const rpcUrl = "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY";

// Infura
const rpcUrl = "https://base-sepolia.infura.io/v3/YOUR_KEY";
```

**解决方案**:
- 使用备用 RPC 端点
- 检查网络连接
- 联系 RPC 提供商

### 7.2 交易确认慢

**症状**:
- 交易长时间未确认
- Gas price 过低

**解决方案**:
- 增加 gas price
- 等待网络拥堵缓解
- 使用 EIP-1559 自动 gas 定价

---

## 8. 性能问题

### 8.1 页面加载慢

**可能原因**:
- 图片太大
- API 请求慢
- 区块链查询慢

**解决方案**:
- 优化图片大小
- 使用 CDN
- 缓存 API 响应
- 优化区块链查询

### 8.2 API 响应慢

**可能原因**:
- Moltbook API 慢
- 区块链查询慢
- 服务器资源不足

**解决方案**:
- 添加缓存
- 优化查询
- 升级 Railway 计划
- 使用更快的 RPC

---

## 9. 调试技巧

### 9.1 使用 Hardhat Console

```bash
npx hardhat console --network baseSepolia

# 在 console 中
const factory = await ethers.getContractAt("AgentPumpFactory", "0x...");
const collateral = await factory.tokenCollateral("0x...");
console.log("Collateral:", ethers.formatEther(collateral));
```

### 9.2 查看事件日志

```javascript
const filter = factory.filters.TokenLaunched();
const events = await factory.queryFilter(filter);
console.log("Events:", events);
```

### 9.3 检查交易详情

```javascript
const tx = await factory.launchToken(...);
const receipt = await tx.wait();
console.log("Gas used:", receipt.gasUsed.toString());
console.log("Events:", receipt.logs);
```

---

## 10. 获取帮助

如果以上解决方案都无法解决问题：

1. **查看日志**:
   - Railway 日志
   - 浏览器控制台
   - Hardhat 输出

2. **检查文档**:
   - `DEPLOY_BASE_SEPOLIA.md`
   - `DEPLOY_RAILWAY.md`
   - `TESTING_GUIDE.md`

3. **联系支持**:
   - GitHub Issues
   - 项目维护者
   - Base 社区

---

**记住**: 大多数问题都有解决方案。仔细检查错误信息，查看日志，逐步排查问题。
