import type { NextApiRequest, NextApiResponse } from 'next'
import { createPublicClient, http, formatEther } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { FACTORY_ABI } from '@/lib/contract'
import { erc20Abi } from 'viem'

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`

interface TokenInfo {
  address: string
  name: string
  symbol: string
  creator: string
  collateral: string
  price: string
  marketCap: string
  progress: number
  graduated: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Log request for debugging
  console.log(`[${new Date().toISOString()}] Tokens API called:`, {
    method: req.method,
    chainId: req.query.chainId,
  });

  if (req.method !== 'GET') {
    console.error('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const chainId = parseInt(req.query.chainId as string) || 8453
    const chain = chainId === 84532 ? baseSepolia : base
    
    console.log(`Using chain: ${chain.name} (chainId: ${chainId})`);
    
    const client = createPublicClient({
      chain,
      transport: http(),
    })

    if (!FACTORY_ADDRESS || FACTORY_ADDRESS === '0x0000000000000000000000000000000000000000') {
      console.warn('FACTORY_ADDRESS not configured, returning empty tokens list');
      return res.status(200).json({ tokens: [] })
    }

    // Get TokenLaunched events to find all tokens
    const fromBlock = BigInt(0) // Start from genesis, or use a more recent block
    const toBlock = 'latest' as const

    const logs = await client.getLogs({
      address: FACTORY_ADDRESS,
      event: {
        type: 'event',
        name: 'TokenLaunched',
        inputs: [
          { indexed: true, name: 'token', type: 'address' },
          { indexed: true, name: 'creator', type: 'address' },
          { indexed: false, name: 'symbol', type: 'string' },
          { indexed: false, name: 'timestamp', type: 'uint256' },
        ],
      },
      fromBlock,
      toBlock,
    })

    const tokens: TokenInfo[] = []

    for (const log of logs) {
      try {
        const tokenAddress = log.args.token as `0x${string}`
        const creator = log.args.creator as string

        // Read token info
        const [name, symbol, totalSupply] = await Promise.all([
          client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'name',
          }),
          client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'symbol',
          }),
          client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'totalSupply',
          }),
        ])

        // Read factory data
        const [collateral, graduated, currentPrice] = await Promise.all([
          client.readContract({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: 'tokenCollateral',
            args: [tokenAddress],
          }),
          client.readContract({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: 'graduated',
            args: [tokenAddress],
          }),
          client.readContract({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: 'getCurrentPrice',
            args: [tokenAddress],
          }),
        ])

        const collateralEth = formatEther(collateral as bigint)
        const priceEth = formatEther(currentPrice as bigint)
        const marketCapEth = formatEther((currentPrice as bigint * totalSupply as bigint) / BigInt(10 ** 18))
        const progress = graduated ? 100 : Math.min(Number((collateral as bigint * 100n) / (20n * 10n ** 18n)), 100)

        tokens.push({
          address: tokenAddress,
          name: name as string,
          symbol: symbol as string,
          creator,
          collateral: collateralEth,
          price: priceEth,
          marketCap: marketCapEth,
          progress,
          graduated: graduated as boolean,
        })
      } catch (err: any) {
        console.error(`Error processing token ${log.args.token}:`, {
          error: err.message,
          tokenAddress: log.args.token,
        });
        // Continue with next token - don't fail entire request
      }
    }

    // Sort by market cap descending
    tokens.sort((a, b) => parseFloat(b.marketCap) - parseFloat(a.marketCap))

    console.log(`Successfully fetched ${tokens.length} tokens`);
    res.status(200).json({ tokens })
  } catch (error: any) {
    // Enhanced error logging
    console.error(`[${new Date().toISOString()}] Error fetching tokens:`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      chainId: req.query.chainId,
    });

    // Handle specific error types
    if (error.name === 'RpcRequestError' || error.code === 'NETWORK_ERROR') {
      return res.status(503).json({ 
        error: 'Network error',
        message: 'Unable to connect to blockchain. Please try again later.'
      });
    }

    if (error.message?.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'Blockchain request timed out. Please try again.'
      });
    }

    // Generic error response
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while fetching tokens. Please try again.',
      // Only include error message in development
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
}
