import type { NextApiRequest, NextApiResponse } from 'next'
import { ethers } from 'ethers'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Log request for debugging
  console.log(`[${new Date().toISOString()}] Verify API called:`, {
    method: req.method,
    hasBody: !!req.body,
  });

  if (req.method !== 'POST') {
    console.error('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { agentName, verificationCode, walletAddress, tokenName, tokenSymbol, nonce, chainId, deadline, devBuyAmount } = req.body;

  // Validate required fields with detailed error messages
  const missingFields: string[] = [];
  if (!walletAddress) missingFields.push('walletAddress');
  if (!agentName) missingFields.push('agentName');
  if (!tokenName) missingFields.push('tokenName');
  if (!tokenSymbol) missingFields.push('tokenSymbol');
  if (nonce === undefined) missingFields.push('nonce');
  if (chainId === undefined) missingFields.push('chainId');
  if (deadline === undefined) missingFields.push('deadline');

  if (missingFields.length > 0) {
    console.error('Missing required fields:', missingFields);
    return res.status(400).json({ 
      error: 'Missing required fields',
      missingFields,
      message: `Please provide: ${missingFields.join(', ')}`
    });
  }

  // Validate field formats
  try {
    ethers.getAddress(walletAddress); // Validate address format
  } catch (error) {
    console.error('Invalid wallet address format:', walletAddress);
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }

  if (tokenName.length > 50) {
    return res.status(400).json({ error: 'Token name too long (max 50 characters)' });
  }

  if (tokenSymbol.length > 10) {
    return res.status(400).json({ error: 'Token symbol too long (max 10 characters)' });
  }

  // Default devBuyAmount to 0 if not provided
  const devBuyAmountValue = devBuyAmount !== undefined ? BigInt(devBuyAmount) : 0n;

  try {
    // 1. Fetch Agent's recent posts from Moltbook
    const MOLTBOOK_KEY = process.env.MOLTBOOK_READ_KEY; 
    
    if (!MOLTBOOK_KEY) {
      console.error('MOLTBOOK_READ_KEY not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'MOLTBOOK_READ_KEY not configured. Please contact support.'
      });
    }
    
    console.log(`Fetching Moltbook profile for agent: ${agentName}`);
    const response = await fetch(`https://moltbook.com/api/v1/agents/profile?name=${encodeURIComponent(agentName)}`, {
      headers: {
        'Authorization': `Bearer ${MOLTBOOK_KEY}`
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Moltbook API error (${response.status}):`, errorText);
      return res.status(400).json({ 
        error: 'Failed to fetch agent profile',
        message: response.status === 404 ? 'Agent not found on Moltbook' : 'Moltbook API error',
        status: response.status
      });
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('Moltbook returned unsuccessful response:', data);
      return res.status(400).json({ 
        error: 'Agent not found',
        message: `Agent "${agentName}" not found on Moltbook. Please check the agent name.`
      });
    }

    // 2. Check recent posts for the verification code
    const posts = data.recentPosts || [];
    console.log(`Found ${posts.length} recent posts for agent ${agentName}`);
    
    if (!verificationCode) {
      return res.status(400).json({ 
        error: 'Verification code required',
        message: 'Please generate and post a verification code first.'
      });
    }

    const found = posts.some((p: any) => p.content && p.content.includes(verificationCode));

    if (!found) {
      console.warn(`Verification code not found in posts. Code: ${verificationCode.substring(0, 20)}...`);
      return res.status(400).json({ 
        error: 'Verification post not found',
        message: 'Verification post not found yet. Please post the verification code on Moltbook and wait 30 seconds before trying again.',
        hint: 'Make sure the verification code matches exactly, including any spaces or special characters.'
      });
    }

    console.log('Verification code found in posts');

    // 3. Generate signature for contract
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerPrivateKey) {
      console.error('SIGNER_PRIVATE_KEY not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'SIGNER_PRIVATE_KEY not configured. Please contact support.'
      });
    }

    // Validate private key format
    try {
      new ethers.Wallet(signerPrivateKey);
    } catch (error) {
      console.error('Invalid SIGNER_PRIVATE_KEY format');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Invalid server configuration. Please contact support.'
      });
    }

    // Create message hash: keccak256(abi.encodePacked(walletAddress, tokenName, tokenSymbol, nonce, chainId, deadline))
    // Note: abi.encodePacked concatenates values without padding, exactly as Solidity does
    const walletAddressBytes = ethers.getBytes(ethers.getAddress(walletAddress));
    const nameBytes = ethers.toUtf8Bytes(tokenName);
    const symbolBytes = ethers.toUtf8Bytes(tokenSymbol);
    
    // For uint256 in abi.encodePacked, we need 32 bytes (big-endian)
    const nonceHex = ethers.toBeHex(nonce, 32);
    const nonceBytes = ethers.getBytes(nonceHex);
    
    const chainIdHex = ethers.toBeHex(chainId, 32);
    const chainIdBytes = ethers.getBytes(chainIdHex);
    
    const deadlineHex = ethers.toBeHex(deadline, 32);
    const deadlineBytes = ethers.getBytes(deadlineHex);
    
    // devBuyAmount from request (default to 0)
    const devBuyAmountHex = ethers.toBeHex(devBuyAmountValue, 32);
    const devBuyAmountBytes = ethers.getBytes(devBuyAmountHex);
    
    // Concatenate all bytes (abi.encodePacked style) - matching contract: keccak256(abi.encodePacked(msg.sender, name, symbol, nonce, block.chainid, deadline, devBuyAmount))
    const packedData = ethers.concat([
      walletAddressBytes,
      nameBytes,
      symbolBytes,
      nonceBytes,
      chainIdBytes,
      deadlineBytes,
      devBuyAmountBytes
    ]);
    
    // Hash the packed data
    const messageHash = ethers.keccak256(packedData);

    // Sign the message hash
    // The contract uses toEthSignedMessageHash(), so we need to sign with the Ethereum Signed Message prefix
    const wallet = new ethers.Wallet(signerPrivateKey);
    // Convert hash to hex string for signMessage
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    console.log('Signature generated successfully for:', {
      walletAddress,
      tokenName,
      tokenSymbol,
      nonce,
      chainId,
    });

    return res.status(200).json({ 
      success: true, 
      signature: signature,
      message: 'Verified! You can now launch.' 
    });

  } catch (error: any) {
    // Enhanced error logging
    console.error(`[${new Date().toISOString()}] Verification error:`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });

    // Handle specific error types
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'Moltbook API request timed out. Please try again.'
      });
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Unable to connect to Moltbook API. Please try again later.'
      });
    }

    // Generic error response (don't expose internal details)
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again or contact support.',
      // Only include error message in development
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
}
