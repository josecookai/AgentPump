#!/usr/bin/env node

/**
 * Deployment Readiness Check Script
 * Checks if all requirements are met before deployment
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const checks = {
  backend: [],
  frontend: [],
  warnings: [],
  errors: []
};

console.log('🔍 Checking deployment readiness...\n');

// Check backend .env file
const backendEnvPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(backendEnvPath)) {
  checks.backend.push('✅ Backend .env file exists');
  
  // Check required variables
  const requiredBackendVars = ['PRIVATE_KEY', 'SIGNER_ADDRESS', 'UNISWAP_V2_ROUTER'];
  requiredBackendVars.forEach(varName => {
    if (process.env[varName] && process.env[varName] !== `your_${varName.toLowerCase()}_here` && process.env[varName] !== '0x0000000000000000000000000000000000000000') {
      checks.backend.push(`✅ ${varName} is set`);
    } else {
      checks.errors.push(`❌ ${varName} is not configured`);
    }
  });
  
  // Check optional variables
  if (process.env.BASESCAN_API_KEY && process.env.BASESCAN_API_KEY !== 'your_etherscan_key_for_verification') {
    checks.backend.push('✅ BASESCAN_API_KEY is set (optional)');
  } else {
    checks.warnings.push('⚠️  BASESCAN_API_KEY not set (contract verification will be skipped)');
  }
} else {
  checks.errors.push('❌ Backend .env file not found. Run: cp .env.example .env');
}

// Check frontend .env file
const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env');
if (fs.existsSync(frontendEnvPath)) {
  checks.frontend.push('✅ Frontend .env file exists');
  
  // Check required variables
  const requiredFrontendVars = ['NEXT_PUBLIC_FACTORY_ADDRESS', 'NEXT_PUBLIC_WALLET_CONNECT_ID', 'SIGNER_PRIVATE_KEY'];
  requiredFrontendVars.forEach(varName => {
    if (process.env[varName] && 
        process.env[varName] !== '...' && 
        !process.env[varName].includes('your_') &&
        process.env[varName] !== '0x0000000000000000000000000000000000000000') {
      checks.frontend.push(`✅ ${varName} is set`);
    } else {
      if (varName === 'NEXT_PUBLIC_FACTORY_ADDRESS') {
        checks.warnings.push(`⚠️  ${varName} not set (will be set after contract deployment)`);
      } else {
        checks.errors.push(`❌ ${varName} is not configured`);
      }
    }
  });
  
  // Check optional variables
  if (process.env.MOLTBOOK_READ_KEY && process.env.MOLTBOOK_READ_KEY.startsWith('moltbook_sk_')) {
    checks.frontend.push('✅ MOLTBOOK_READ_KEY is set (optional)');
  } else {
    checks.warnings.push('⚠️  MOLTBOOK_READ_KEY not set (Moltbook verification will not work)');
  }
} else {
  checks.warnings.push('⚠️  Frontend .env file not found. Run: cd frontend && cp .env.example .env');
}

// Check node_modules
const backendNodeModules = path.join(__dirname, '..', 'node_modules');
const frontendNodeModules = path.join(__dirname, '..', 'frontend', 'node_modules');

if (fs.existsSync(backendNodeModules)) {
  checks.backend.push('✅ Backend dependencies installed');
} else {
  checks.errors.push('❌ Backend dependencies not installed. Run: npm install');
}

if (fs.existsSync(frontendNodeModules)) {
  checks.frontend.push('✅ Frontend dependencies installed');
} else {
  checks.warnings.push('⚠️  Frontend dependencies not installed. Run: cd frontend && npm install');
}

// Check compiled contracts
const artifactsPath = path.join(__dirname, '..', 'artifacts');
if (fs.existsSync(artifactsPath)) {
  checks.backend.push('✅ Contracts compiled (artifacts directory exists)');
} else {
  checks.warnings.push('⚠️  Contracts not compiled. Run: npx hardhat compile');
}

// Check package.json engines
const frontendPackageJson = path.join(__dirname, '..', 'frontend', 'package.json');
if (fs.existsSync(frontendPackageJson)) {
  const pkg = JSON.parse(fs.readFileSync(frontendPackageJson, 'utf8'));
  if (pkg.engines && pkg.engines.node) {
    checks.frontend.push(`✅ Node.js version specified: ${pkg.engines.node}`);
  }
}

// Check railway.json
const railwayJson = path.join(__dirname, '..', 'frontend', 'railway.json');
if (fs.existsSync(railwayJson)) {
  checks.frontend.push('✅ railway.json exists');
}

// Print results
console.log('📦 Backend Checks:');
checks.backend.forEach(check => console.log(`  ${check}`));

console.log('\n🌐 Frontend Checks:');
checks.frontend.forEach(check => console.log(`  ${check}`));

if (checks.warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  checks.warnings.forEach(warning => console.log(`  ${warning}`));
}

if (checks.errors.length > 0) {
  console.log('\n❌ Errors (must fix before deployment):');
  checks.errors.forEach(error => console.log(`  ${error}`));
  console.log('\n❌ Deployment not ready. Please fix the errors above.');
  process.exit(1);
} else {
  console.log('\n✅ All critical checks passed!');
  if (checks.warnings.length > 0) {
    console.log('⚠️  Some warnings exist, but deployment can proceed.');
  }
  console.log('\n📚 Next steps:');
  console.log('  1. Review DEPLOYMENT_QUICKSTART.md for deployment steps');
  console.log('  2. Deploy contract: npx hardhat run scripts/deploy.js --network baseSepolia');
  console.log('  3. Update NEXT_PUBLIC_FACTORY_ADDRESS in frontend/.env');
  console.log('  4. Deploy to Railway: Follow DEPLOY_RAILWAY.md');
  process.exit(0);
}
