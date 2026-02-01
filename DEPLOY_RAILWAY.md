# Railway 前端和后端部署指南

本指南将帮助你完成 AgentPump 前端和 API 后端在 Railway 平台的部署。

## 📋 目录

1. [Railway 账号准备](#1-railway-账号准备)
2. [部署前准备](#2-部署前准备)
3. [方法1: Railway Web UI 部署](#3-方法1-railway-web-ui-部署)
4. [方法2: Railway CLI 部署](#4-方法2-railway-cli-部署)
5. [环境变量配置](#5-环境变量配置)
6. [API 后端说明](#6-api-后端说明)
7. [部署后检查](#7-部署后检查)
8. [监控和日志](#8-监控和日志)
9. [常见问题](#9-常见问题)
10. [更新部署](#10-更新部署)

---

## 1. Railway 账号准备

### 1.1 注册 Railway 账号

1. 访问 https://railway.app
2. 点击 "Start a New Project"
3. 使用 GitHub 账号登录（推荐）
4. 授权 Railway 访问你的 GitHub 仓库

### 1.2 Railway 免费额度

Railway 提供：
- **$5/月免费额度**（通常足够测试使用）
- **按量付费**：超出免费额度后按使用量付费
- **暂停功能**：可以暂停服务节省费用

### 1.3 安装 Railway CLI（可选）

如果你想使用 CLI 部署：

```bash
npm i -g @railway/cli
railway login
```

**注意**: CLI 是可选的，Web UI 也可以完成所有操作。

---

## 2. 部署前准备

### 2.1 确认智能合约已部署

**必需**: 在部署前端之前，必须先部署智能合约到 Base Sepolia。

参考 `DEPLOY_BASE_SEPOLIA.md` 完成合约部署。

**记录以下信息**:
- Factory 合约地址（`NEXT_PUBLIC_FACTORY_ADDRESS`）
- 签名者地址（用于 `SIGNER_ADDRESS`）
- 签名者私钥（用于 `SIGNER_PRIVATE_KEY`）

### 2.2 确认前端配置

检查以下文件是否存在且配置正确：

**`frontend/package.json`**:
```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

**`frontend/next.config.js`**:
```javascript
const nextConfig = {
  output: 'standalone', // Railway 部署优化
  // ...
}
```

**`frontend/railway.json`**:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 2.3 获取 WalletConnect Project ID

1. 访问 https://cloud.walletconnect.com
2. 登录或注册账号
3. 创建新项目
4. 选择 "App" 类型
5. 复制 **Project ID**

**注意**: Project ID 将用于 `NEXT_PUBLIC_WALLET_CONNECT_ID` 环境变量。

### 2.4 准备环境变量

准备以下环境变量（将在 Railway 中配置）：

**必需变量**:
```
NEXT_PUBLIC_FACTORY_ADDRESS=0x... # 从合约部署获取
NEXT_PUBLIC_WALLET_CONNECT_ID=your_walletconnect_project_id
SIGNER_PRIVATE_KEY=0x... # 与SIGNER_ADDRESS对应的私钥
```

**可选变量**:
```
MOLTBOOK_READ_KEY=moltbook_sk_... # Moltbook API密钥
NEXT_PUBLIC_ALCHEMY_KEY=your_alchemy_key # Alchemy RPC密钥
```

---

## 3. 方法1: Railway Web UI 部署

### 3.1 创建新项目

1. 登录 Railway Web UI
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择你的 AgentPump GitHub 仓库
5. 点击 "Deploy Now"

### 3.2 配置项目设置

**设置 Root Directory**:
1. 进入项目设置（点击项目名称）
2. 找到 "Settings" 标签
3. 找到 "Root Directory" 设置
4. 设置为 `frontend`
5. 保存更改

**Railway 会自动检测**:
- Next.js 项目类型
- Node.js 版本要求
- Build 和 Start 命令

### 3.3 配置环境变量

1. 在项目页面，点击 "Variables" 标签
2. 点击 "New Variable" 添加变量
3. 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEXT_PUBLIC_FACTORY_ADDRESS` | `0x...` | Factory合约地址（必需） |
| `NEXT_PUBLIC_WALLET_CONNECT_ID` | `your_id` | WalletConnect项目ID（必需） |
| `SIGNER_PRIVATE_KEY` | `0x...` | 签名私钥（必需，仅API使用） |
| `MOLTBOOK_READ_KEY` | `moltbook_sk_...` | Moltbook API密钥（可选） |
| `NEXT_PUBLIC_ALCHEMY_KEY` | `your_key` | Alchemy RPC密钥（可选） |

**重要提示**:
- `NEXT_PUBLIC_*` 变量会暴露给前端，不要放敏感信息
- `SIGNER_PRIVATE_KEY` 不会暴露给前端，只在服务器端API路由使用
- 环境变量更改后需要重新部署才能生效

### 3.4 触发部署

**自动部署**:
- Railway 会在检测到 GitHub push 后自动部署
- 或点击 "Redeploy" 手动触发

**首次部署**:
- 配置环境变量后，Railway 会自动开始构建
- 等待 2-5 分钟完成部署

### 3.5 获取部署 URL

部署完成后：

1. 在项目页面找到 "Settings" → "Networking"
2. Railway 会提供一个 `.railway.app` 域名
3. 点击域名可以访问应用

**自定义域名**（可选）:
- 在 "Networking" 设置中添加自定义域名
- 配置 DNS 记录指向 Railway

---

## 4. 方法2: Railway CLI 部署

### 4.1 安装和登录

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login
```

### 4.2 初始化项目

```bash
# 进入前端目录
cd frontend

# 初始化 Railway 项目
railway init
```

**选择选项**:
- 创建新项目或连接到现有项目
- 选择项目名称

### 4.3 设置环境变量

```bash
# 设置必需的环境变量
railway variables set NEXT_PUBLIC_FACTORY_ADDRESS=0x...
railway variables set NEXT_PUBLIC_WALLET_CONNECT_ID=your_id
railway variables set SIGNER_PRIVATE_KEY=0x...

# 设置可选的环境变量
railway variables set MOLTBOOK_READ_KEY=moltbook_sk_...
railway variables set NEXT_PUBLIC_ALCHEMY_KEY=your_key
```

**查看所有变量**:
```bash
railway variables
```

### 4.4 部署

```bash
# 部署到 Railway
railway up
```

**部署过程**:
- Railway 会构建 Next.js 应用
- 上传构建产物
- 启动应用服务器

### 4.5 查看部署状态

```bash
# 查看部署日志
railway logs

# 查看部署历史
railway status
```

---

## 5. 环境变量配置

### 5.1 环境变量说明

**前端变量**（`NEXT_PUBLIC_*`）:
- 这些变量会暴露给浏览器
- 用于前端配置和连接区块链

**后端变量**（无 `NEXT_PUBLIC_` 前缀）:
- 这些变量只在服务器端可用
- 用于 API 路由和签名生成

### 5.2 必需变量详解

**`NEXT_PUBLIC_FACTORY_ADDRESS`**:
- Factory 合约地址（从 Base Sepolia 部署获取）
- 格式: `0x...`（42 字符）
- 用于前端连接合约

**`NEXT_PUBLIC_WALLET_CONNECT_ID`**:
- WalletConnect Project ID
- 从 https://cloud.walletconnect.com 获取
- 用于钱包连接功能

**`SIGNER_PRIVATE_KEY`**:
- 用于生成 `launchToken` 签名的私钥
- 必须与合约部署时的 `SIGNER_ADDRESS` 对应
- **重要**: 不要暴露给前端，只在 API 路由使用

### 5.3 可选变量详解

**`MOLTBOOK_READ_KEY`**:
- Moltbook API 密钥
- 格式: `moltbook_sk_...`
- 用于验证 Agent 身份

**`NEXT_PUBLIC_ALCHEMY_KEY`**:
- Alchemy RPC API 密钥
- 用于连接 Base Sepolia 网络
- 如果不设置，会使用公共 RPC

### 5.4 环境变量验证

部署后，检查环境变量是否正确加载：

1. 访问应用首页
2. 打开浏览器开发者工具
3. 检查控制台是否有错误
4. 检查网络请求是否正常

---

## 6. API 后端说明

### 6.1 Next.js API Routes

AgentPump 使用 Next.js API Routes 作为后端：

**API Routes 位置**:
- `frontend/pages/api/verify.ts` - 签名验证和 Moltbook 验证
- `frontend/pages/api/tokens.ts` - 获取 token 列表

**部署说明**:
- API Routes 自动包含在前端部署中
- 无需单独部署后端服务
- Railway 会自动处理 API 路由

### 6.2 API 端点

**`POST /api/verify`**:
- 验证 Moltbook Agent 身份
- 生成 `launchToken` 签名
- 需要 `SIGNER_PRIVATE_KEY` 和 `MOLTBOOK_READ_KEY`

**`GET /api/tokens`**:
- 获取所有已发布的 tokens
- 从区块链读取数据
- 需要 `NEXT_PUBLIC_FACTORY_ADDRESS`

### 6.3 API 环境变量要求

**必需**:
- `SIGNER_PRIVATE_KEY` - 用于生成签名
- `NEXT_PUBLIC_FACTORY_ADDRESS` - 用于读取合约数据

**可选**:
- `MOLTBOOK_READ_KEY` - 用于 Moltbook 验证
- `NEXT_PUBLIC_ALCHEMY_KEY` - 用于 RPC 连接

---

## 7. 部署后检查

### 7.1 前端功能检查

**基础功能**:
- [ ] 网站可以正常访问（无 404 错误）
- [ ] 页面加载正常（无白屏）
- [ ] CSS 样式正确加载
- [ ] JavaScript 无控制台错误

**钱包连接**:
- [ ] 点击 "Connect Wallet" 可以打开钱包选择
- [ ] 可以成功连接 MetaMask/RainbowKit
- [ ] 可以切换到 Base Sepolia 网络
- [ ] 钱包地址正确显示

**页面导航**:
- [ ] 首页可以加载（即使没有 tokens）
- [ ] Launch 页面可以打开
- [ ] Token 详情页可以访问（如果有 tokens）

### 7.2 API 功能检查

**`/api/verify` 端点**:
- [ ] 可以正常响应 POST 请求
- [ ] 签名生成正确
- [ ] Moltbook 验证正常（如果配置）

**`/api/tokens` 端点**:
- [ ] 可以正常响应 GET 请求
- [ ] 返回正确的 token 列表
- [ ] 数据格式正确

**测试方法**:
```bash
# 测试 tokens API
curl https://your-app.railway.app/api/tokens

# 测试 verify API（需要 POST 数据）
curl -X POST https://your-app.railway.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{"agentName":"test","walletAddress":"0x..."}'
```

### 7.3 区块链交互检查

**读取数据**:
- [ ] 可以读取 Factory 合约数据
- [ ] Token 列表正确显示
- [ ] 价格和费用正确计算

**发送交易**:
- [ ] 可以调用 `launchToken`
- [ ] 可以调用 `buy`
- [ ] 可以调用 `sell`
- [ ] 交易确认正常

### 7.4 完整流程测试

1. **创建 Token**:
   - 访问 Launch 页面
   - 填写 token 信息
   - 完成 Moltbook 验证
   - 提交交易
   - 确认 token 创建成功

2. **交易 Token**:
   - 访问 Token 详情页
   - 买入一些 tokens
   - 卖出一些 tokens
   - 确认余额正确更新

3. **查看数据**:
   - 首页显示新创建的 token
   - Token 详情页显示正确信息
   - 价格和费用正确计算

---

## 8. 监控和日志

### 8.1 查看日志

**Web UI**:
1. 进入项目页面
2. 点击 "Deployments" 标签
3. 选择最新的部署
4. 点击 "Logs" 查看实时日志

**CLI**:
```bash
railway logs
```

**日志内容**:
- 构建日志
- 运行时日志
- 错误日志
- API 请求日志

### 8.2 监控指标

Railway 提供以下监控：

**资源使用**:
- CPU 使用率
- 内存使用率
- 网络流量

**部署信息**:
- 部署历史
- 部署状态
- 部署时间

**访问统计**:
- 请求数量
- 响应时间
- 错误率

### 8.3 错误追踪

**常见错误**:
- 构建失败
- 运行时错误
- API 错误
- 环境变量错误

**查看错误**:
- 在日志中查找错误信息
- 检查环境变量配置
- 检查代码是否有问题

---

## 9. 常见问题

### 9.1 构建问题

**问题1: 构建失败 - Node.js 版本不匹配**
```
Error: Node.js version mismatch
```

**解决方案**:
- 确保 `package.json` 中设置了 `engines.node >= 18.0.0`
- Railway 会自动使用指定的 Node.js 版本

**问题2: 构建失败 - 依赖安装失败**
```
Error: npm install failed
```

**解决方案**:
- 检查 `package.json` 中的依赖版本
- 确保所有依赖都兼容 Node.js 18+
- 查看构建日志获取详细错误信息

**问题3: 构建超时**
```
Error: Build timeout
```

**解决方案**:
- 检查构建命令是否过长
- 优化依赖安装（使用 `npm ci`）
- 联系 Railway 支持

### 9.2 运行时问题

**问题1: 环境变量未生效**
```
Error: Environment variable not found
```

**解决方案**:
- 确保变量名正确（注意大小写）
- 确保 `NEXT_PUBLIC_*` 变量名正确
- 重新部署应用（环境变量更改后需要重新构建）

**问题2: API 路由返回 500 错误**
```
Error: Internal Server Error
```

**解决方案**:
- 检查 Railway 日志获取详细错误
- 确认 `SIGNER_PRIVATE_KEY` 已配置
- 确认 `NEXT_PUBLIC_FACTORY_ADDRESS` 已设置
- 检查 Moltbook API 密钥（如果使用）

**问题3: 无法连接 Base Sepolia**
```
Error: Network error
```

**解决方案**:
- 确认 WalletConnect 配置正确
- 检查 RPC URL 是否正确
- 可以在 Railway 环境变量中添加自定义 RPC URL

### 9.3 功能问题

**问题1: 钱包连接失败**
- **检查**: WalletConnect Project ID 是否正确
- **检查**: 网络配置是否正确
- **解决**: 重新配置 WalletConnect

**问题2: 交易失败**
- **检查**: 钱包是否连接到 Base Sepolia
- **检查**: 账户是否有足够的 ETH
- **检查**: 合约地址是否正确

**问题3: API 验证失败**
- **检查**: `SIGNER_PRIVATE_KEY` 是否正确
- **检查**: Moltbook API 密钥是否正确
- **检查**: 签名生成逻辑是否正确

---

## 10. 更新部署

### 10.1 自动部署（推荐）

**GitHub 集成**:
- Railway 连接到 GitHub 仓库后
- 每次 push 到主分支会自动触发部署
- 无需手动操作

**配置自动部署**:
1. 在项目设置中启用 GitHub 集成
2. 选择要部署的分支（通常是 `main`）
3. Railway 会自动监听 push 事件

### 10.2 手动部署

**Web UI**:
1. 进入项目页面
2. 点击 "Redeploy" 按钮
3. 选择要部署的提交
4. 确认部署

**CLI**:
```bash
railway up
```

### 10.3 回滚部署

如果新部署有问题，可以回滚到之前的版本：

1. 进入 "Deployments" 页面
2. 找到之前的成功部署
3. 点击 "Redeploy"
4. 确认回滚

---

## 11. 最佳实践

### 11.1 环境变量管理

- **使用 Railway 的变量管理**: 不要将敏感信息提交到 Git
- **区分环境**: 为测试和生产使用不同的环境变量
- **定期更新**: 定期检查和更新 API 密钥

### 11.2 监控和维护

- **定期检查日志**: 及时发现和解决问题
- **监控资源使用**: 避免超出免费额度
- **更新依赖**: 定期更新 npm 包以修复安全漏洞

### 11.3 性能优化

- **使用 CDN**: Railway 自动提供 CDN
- **优化构建**: 减少构建时间
- **缓存策略**: 合理使用 Next.js 缓存

---

## 12. 有用的链接

- **Railway 文档**: https://docs.railway.app
- **Next.js 部署**: https://nextjs.org/docs/deployment
- **Railway Discord**: https://discord.gg/railway
- **WalletConnect**: https://cloud.walletconnect.com

---

## 13. 支持

如果遇到问题：

1. 查看 Railway 日志获取详细错误信息
2. 检查 `TROUBLESHOOTING.md` 获取故障排除指南
3. 查看 Railway 文档
4. 联系 Railway 支持或项目维护者

---

**部署完成后，请记录以下信息**:
- ✅ Railway 项目 URL
- ✅ 部署时间
- ✅ 环境变量配置状态
- ✅ API 端点测试结果
- ✅ 前端功能测试结果

这些信息将用于后续维护和问题排查。
