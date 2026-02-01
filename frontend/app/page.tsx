'use client'
import { ConnectButton, useChainId } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

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
  const [stats, setStats] = useState({
    totalVolume: '0',
    totalTokens: 0,
    volume24h: '0'
  });

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await fetch(`/api/tokens?chainId=${chainId}`);
        const data = await res.json();
        setTokens(data.tokens || []);
        // Calculate stats
        if (data.tokens && data.tokens.length > 0) {
          const totalVol = data.tokens.reduce((sum: number, t: TokenInfo) => 
            sum + parseFloat(t.collateral), 0
          );
          setStats({
            totalVolume: totalVol.toFixed(2),
            totalTokens: data.tokens.length,
            volume24h: (totalVol * 0.3).toFixed(2) // Mock 24h volume
          });
        }
      } catch (err) {
        console.error('Error fetching tokens:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
    const interval = setInterval(fetchTokens, 30000);
    return () => clearInterval(interval);
  }, [chainId]);

  return (
    <main className="min-h-screen bg-dark-bg">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-dark-border bg-dark-bg/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
              <h1 className="text-2xl font-display font-bold text-gradient">
                AgentPump
              </h1>
            </Link>
            
            <div className="flex items-center gap-4">
              <Link href="/launch">
                <Button variant="primary">
                  Launch Token
                </Button>
              </Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="info" className="mb-6">
              🚀 First AI Agent Token Platform on Base
            </Badge>
            
            <h2 className="text-display-lg font-display mb-6">
              Launch Tokens for Your{' '}
              <span className="text-gradient">AI Agents</span>
            </h2>
            
            <p className="text-body-lg text-dark-text-secondary mb-8 max-w-2xl mx-auto">
              Transform your AI Agent's skills and reputation into tradeable tokens. 
              Fair launch with bonding curves. Verified identities. Built for long-term value.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/launch">
                <Button variant="primary" size="lg">
                  🚀 Launch Your Token
                </Button>
              </Link>
              <Button variant="secondary" size="lg">
                📖 How It Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-dark-border bg-dark-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-caption text-dark-text-secondary mb-1">Total Volume</p>
              <p className="text-display-sm font-mono text-gradient">
                {stats.totalVolume} ETH
              </p>
            </div>
            <div className="text-center">
              <p className="text-caption text-dark-text-secondary mb-1">Total Tokens</p>
              <p className="text-display-sm font-mono text-gradient">
                {stats.totalTokens}
              </p>
            </div>
            <div className="text-center">
              <p className="text-caption text-dark-text-secondary mb-1">24h Volume</p>
              <p className="text-display-sm font-mono text-gradient">
                {stats.volume24h} ETH
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tokens Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-display-sm font-display mb-2">
              🔥 Trending Agents
            </h3>
            <p className="text-body text-dark-text-secondary">
              Discover and invest in AI Agents
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-body-sm text-dark-text-secondary">Live</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-64 animate-pulse">
                <div className="h-full flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="h-4 bg-dark-border rounded w-3/4" />
                    <div className="h-8 bg-dark-border rounded w-1/2" />
                  </div>
                  <div className="h-2 bg-dark-border rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <Card className="text-center py-16">
            <div className="text-6xl mb-4">🤖</div>
            <h4 className="text-h4 font-display mb-2">No tokens yet</h4>
            <p className="text-body text-dark-text-secondary mb-6">
              Be the first to launch an AI Agent token
            </p>
            <Link href="/launch">
              <Button variant="primary">Launch First Token</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tokens.slice(0, 6).map((token) => (
              <Link key={token.address} href={`/token/${token.address}`}>
                <Card hover className="h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-secondary flex items-center justify-center text-2xl">
                        🤖
                      </div>
                      <div>
                        <h4 className="text-h4 font-display">{token.name}</h4>
                        <p className="text-body-sm text-dark-text-secondary font-mono">
                          ${token.symbol}
                        </p>
                      </div>
                    </div>
                    
                    {token.graduated ? (
                      <Badge variant="success">Graduated</Badge>
                    ) : (
                      <Badge variant="info">Bonding</Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-body-sm text-dark-text-secondary">Market Cap</span>
                      <span className="text-body font-mono text-success">
                        {parseFloat(token.marketCap).toFixed(4)} ETH
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-body-sm text-dark-text-secondary">Price</span>
                      <span className="text-body font-mono">
                        {parseFloat(token.price).toFixed(8)} ETH
                      </span>
                    </div>

                    {!token.graduated && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-body-sm text-dark-text-secondary">
                            Progress to Graduation
                          </span>
                          <span className="text-body-sm font-mono text-secondary">
                            {token.progress.toFixed(1)}%
                          </span>
                        </div>
                        <ProgressBar progress={token.progress} />
                      </div>
                    )}

                    {token.graduated && (
                      <div className="pt-2 border-t border-dark-border">
                        <p className="text-body-sm text-secondary">
                          ✨ Now trading on Uniswap V2
                        </p>
                      </div>
                    )}
                  </div>

                  <Button variant="secondary" className="w-full mt-6">
                    Trade Now
                  </Button>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How It Works Section */}
      <section className="border-t border-dark-border bg-dark-card/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h3 className="text-display-sm font-display mb-4">
              How AgentPump Works
            </h3>
            <p className="text-body text-dark-text-secondary">
              Launch and trade AI Agent tokens in four simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                step: '01',
                icon: '🔐',
                title: 'Verify Identity',
                desc: 'Connect your Moltbook account to prove Agent ownership'
              },
              {
                step: '02',
                icon: '🚀',
                title: 'Launch Token',
                desc: 'Deploy your Agent token with bonding curve pricing'
              },
              {
                step: '03',
                icon: '📈',
                title: 'Trade & Grow',
                desc: 'Community trades on the curve as your Agent gains value'
              },
              {
                step: '04',
                icon: '🎓',
                title: 'Graduate',
                desc: 'At 20 ETH, auto-migrate to Uniswap for full liquidity'
              }
            ].map((item, i) => (
              <Card key={i} className="text-center">
                <div className="text-caption font-mono text-primary mb-3">
                  {item.step}
                </div>
                <div className="text-5xl mb-4">{item.icon}</div>
                <h4 className="text-h4 font-display mb-2">{item.title}</h4>
                <p className="text-body-sm text-dark-text-secondary">
                  {item.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <span className="text-body-sm text-dark-text-secondary">
                © 2026 AgentPump. Built on Base.
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              <a href="#" className="text-body-sm text-dark-text-secondary hover:text-primary transition-colors">
                Docs
              </a>
              <a href="#" className="text-body-sm text-dark-text-secondary hover:text-primary transition-colors">
                GitHub
              </a>
              <a href="#" className="text-body-sm text-dark-text-secondary hover:text-primary transition-colors">
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
