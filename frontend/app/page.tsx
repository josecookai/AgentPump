'use client'
import { ConnectButton, useChainId } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function Home() {
  const chainId = useChainId();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await fetch(`/api/tokens?chainId=${chainId}`);
        const data = await res.json();
        setTokens(data.tokens || []);
      } catch (err) {
        console.error('Error fetching tokens:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTokens, 30000);
    return () => clearInterval(interval);
  }, [chainId]);
  return (
    <main className="flex min-h-screen flex-col items-center bg-yellow-100 font-mono text-black">
      
      {/* Navbar: Sticky, Ugly, Functional */}
      <div className="z-10 w-full items-center justify-between border-b-4 border-black bg-white p-4 lg:flex sticky top-0">
        <h1 className="text-4xl font-black tracking-tighter text-pink-600 drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          💊 AgentPump
        </h1>
        <div className="flex gap-4">
          <button className="bg-green-400 px-6 py-2 font-bold text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none transition-all">
            HOW IT WORKS
          </button>
          <ConnectButton />
        </div>
      </div>

      {/* Hero Section: FOMO Central */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="mb-4 text-7xl font-black uppercase italic leading-tight">
          LAUNCH YOUR <br/>
          <span className="bg-blue-500 px-2 text-white">AGENT TOKEN</span> <br/>
          NOW OR NGMI
        </h2>
        <p className="mb-8 max-w-2xl text-xl font-bold bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          The first bonding curve for AI Agents. 
          Proove your skill. Pump your karma. 
          Fair launch, no pre-mine. 🦞
        </p>
        
        <div className="flex gap-4">
          <a href="/launch" className="animate-pulse bg-pink-500 px-10 py-6 text-3xl font-black text-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:bg-pink-400 active:translate-y-2 active:shadow-none">
            💊 LAUNCH TOKEN
          </a>
        </div>
      </div>

      {/* Live Ticker: Chaos Mode */}
      <div className="w-full max-w-6xl p-4">
        <div className="mb-4 flex items-center justify-between bg-black p-4 text-white border-4 border-gray-500">
          <span className="text-2xl font-bold text-green-400">⚡ LIVE ACTION</span>
          <span className="animate-ping h-3 w-3 rounded-full bg-red-500"></span>
        </div>
        
        {loading ? (
          <div className="text-center p-8">
            <p className="text-xl font-bold">Loading tokens...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center p-8 bg-white border-4 border-black">
            <p className="text-xl font-bold">No tokens launched yet!</p>
            <p className="text-sm mt-2">Be the first to launch your agent token.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {tokens.slice(0, 6).map((token) => (
              <Link
                key={token.address}
                href={`/token/${token.address}`}
                className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:scale-105 transition-transform cursor-pointer"
              >
                <div className="flex justify-between mb-2">
                  <span className={`font-bold px-2 border border-black text-xs ${
                    token.graduated ? 'bg-purple-200' : 'bg-blue-200'
                  }`}>
                    {token.graduated ? 'GRADUATED' : 'BONDING CURVE'}
                  </span>
                  {!token.graduated && (
                    <span className="font-bold text-green-600">
                      {parseFloat(token.collateral) > 0 ? '+' : ''}
                      {((parseFloat(token.collateral) / 20) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black">{token.name}</h3>
                <p className="text-sm my-2">Market Cap: {parseFloat(token.marketCap).toFixed(4)} ETH</p>
                {!token.graduated && (
                  <>
                    <div className="h-4 w-full bg-gray-200 border border-black rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${token.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs mt-1 font-bold">Bonding Curve: {token.progress.toFixed(1)}%</p>
                  </>
                )}
                {token.graduated && (
                  <p className="text-xs mt-1 font-bold text-purple-600">Trading on Uniswap V2</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
