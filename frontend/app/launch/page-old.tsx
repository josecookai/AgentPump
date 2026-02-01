'use client'
import { useState, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { FACTORY_ABI, FACTORY_ADDRESS } from '@/lib/contract';
import Link from 'next/link';

export default function Launch() {
  const [agentName, setAgentName] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [twitterLink, setTwitterLink] = useState('');
  const [telegramLink, setTelegramLink] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [coinImage, setCoinImage] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [devBuyAmount, setDevBuyAmount] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [signature, setSignature] = useState('');
  const [nonce, setNonce] = useState(0);
  const [deadline, setDeadline] = useState(0);
  
  const coinImageInputRef = useRef<HTMLInputElement>(null);
  const bannerImageInputRef = useRef<HTMLInputElement>(null);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Generate verification code
  const generateVerificationCode = () => {
    if (!agentName.trim()) {
      alert('Please enter agent name');
      return;
    }
    const random = Math.random().toString(36).substring(7);
    setVerificationCode(`Verifying AgentPump: ${random}`);
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'coin' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxSize = type === 'coin' ? 15 * 1024 * 1024 : 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      alert(`File size must be less than ${maxSize / 1024 / 1024}MB`);
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPG, PNG, or GIF)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === 'coin') {
        setCoinImage(base64String);
      } else {
        setBannerImage(base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  // Verify Moltbook post
  const verifyMoltbook = async () => {
    if (!address) {
      alert('Please connect your wallet');
      return;
    }
    
    if (!tokenName.trim() || !tokenSymbol.trim()) {
      alert('Please enter token name and symbol');
      return;
    }

    // Validate symbol ends with "moltpump"
    if (!tokenSymbol.toUpperCase().endsWith('MOLTPUMP')) {
      alert('Token symbol must end with "MOLTPUMP" (e.g., EVAMOLTPUMP)');
      return;
    }

    if (!verificationCode) {
      alert('Please generate verification code first');
      return;
    }

    setIsVerifying(true);

    try {
      const newNonce = Math.floor(Date.now() / 1000);
      setNonce(newNonce);
      
      const newDeadline = Math.floor(Date.now() / 1000) + 3600;
      setDeadline(newDeadline);

      // Calculate devBuyTokens for signature (same calculation as launch)
      const devBuyEth = devBuyAmount && parseFloat(devBuyAmount) > 0 ? parseEther(devBuyAmount) : 0n;
      const devBuyTokens = devBuyEth > 0n ? (devBuyEth * 1000n) / parseEther('1') : 0n;

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
          agentName, 
          verificationCode,
          walletAddress: address,
          tokenName,
          tokenSymbol: tokenSymbol.toUpperCase(),
          nonce: newNonce,
          chainId: chainId,
          deadline: newDeadline,
          devBuyAmount: devBuyTokens.toString()
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setSignature(data.signature);
        setIsVerified(true);
      } else {
        alert(data.error || 'Verification failed');
      }
    } catch (err: any) {
      alert(err.message || 'Verification error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Launch token
  const launchToken = async () => {
    if (!address || !signature) {
      alert('Missing signature or wallet connection');
      return;
    }

    if (!isVerified) {
      alert('Please verify your Moltbook post first');
      return;
    }

    try {
      const launchFee = parseEther('0.005');
      const devBuyEth = devBuyAmount && parseFloat(devBuyAmount) > 0 ? parseEther(devBuyAmount) : 0n;
      const totalValue = launchFee + devBuyEth;
      
      // Convert devBuyAmount from ETH to token amount (approximate: 1 ETH = 1000 tokens initially)
      const devBuyTokens = devBuyEth > 0n ? (devBuyEth * 1000n) / parseEther('1') : 0n;
      
      writeContract({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'launchToken',
        args: [
          tokenName, 
          tokenSymbol.toUpperCase(), 
          signature as `0x${string}`, 
          BigInt(nonce), 
          BigInt(deadline),
          devBuyTokens
        ],
        value: totalValue,
      });
    } catch (err: any) {
      console.error('Launch error:', err);
      alert(err.message || 'Failed to launch token');
    }
  };

  const totalRequired = 0.005 + (parseFloat(devBuyAmount) || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 underline mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-5xl font-black mb-2">🚀 Create Coin</h1>
          <p className="text-gray-600">Launch your AI agent token on AgentPump</p>
        </div>

        {!isConnected && (
          <div className="bg-red-100 p-4 border-4 border-red-500 mb-6 rounded-lg">
            <p className="font-bold">⚠️ Please connect your wallet first!</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Coin Details Section */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 rounded-lg">
              <h2 className="text-2xl font-black mb-4">Coin Details</h2>
              <p className="text-sm text-gray-600 mb-4">Choose carefully, these can't be changed once the coin is created</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Moltbook Agent Name *</label>
                  <input 
                    className="border-2 border-black p-3 w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Eva" 
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)} 
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Coin Name *</label>
                  <input 
                    className="border-2 border-black p-3 w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Eva Agent Token" 
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)} 
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 mt-1">Max 50 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Ticker *</label>
                  <div className="flex items-center gap-2">
                    <input 
                      className="border-2 border-black p-3 flex-1 text-lg uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. EVAMOLTPUMP" 
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      maxLength={10}
                    />
                    <span className="text-sm font-bold text-gray-600">MOLTPUMP</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Must end with MOLTPUMP (max 10 characters)</p>
                  {tokenSymbol && !tokenSymbol.endsWith('MOLTPUMP') && (
                    <p className="text-xs text-red-600 mt-1">⚠️ Symbol must end with MOLTPUMP</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Description (Optional)</label>
                  <textarea 
                    className="border-2 border-black p-3 w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe your agent token..." 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">{description.length}/500 characters</p>
                </div>
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 rounded-lg">
              <h2 className="text-2xl font-black mb-4">Coin Image</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Coin Image *</label>
                  <div className="border-2 border-dashed border-black p-6 text-center">
                    {coinImage ? (
                      <div className="space-y-2">
                        <img src={coinImage} alt="Coin preview" className="w-32 h-32 mx-auto object-cover rounded-lg border-2 border-black" />
                        <button
                          onClick={() => {
                            setCoinImage(null);
                            if (coinImageInputRef.current) coinImageInputRef.current.value = '';
                          }}
                          className="text-sm text-red-600 underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-2">Select image or drag and drop</p>
                        <input
                          ref={coinImageInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif"
                          onChange={(e) => handleImageUpload(e, 'coin')}
                          className="hidden"
                          id="coin-image"
                        />
                        <label
                          htmlFor="coin-image"
                          className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded border-2 border-black font-bold hover:bg-blue-400 inline-block"
                        >
                          Choose File
                        </label>
                        <p className="text-xs text-gray-500 mt-2">Max 15MB. JPG, PNG, or GIF. Min 1000x1000px, 1:1 square recommended</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Banner Image (Optional)</label>
                  <div className="border-2 border-dashed border-black p-6 text-center">
                    {bannerImage ? (
                      <div className="space-y-2">
                        <img src={bannerImage} alt="Banner preview" className="w-full h-32 object-cover rounded-lg border-2 border-black" />
                        <button
                          onClick={() => {
                            setBannerImage(null);
                            if (bannerImageInputRef.current) bannerImageInputRef.current.value = '';
                          }}
                          className="text-sm text-red-600 underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={bannerImageInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif"
                          onChange={(e) => handleImageUpload(e, 'banner')}
                          className="hidden"
                          id="banner-image"
                        />
                        <label
                          htmlFor="banner-image"
                          className="cursor-pointer bg-gray-200 text-black px-4 py-2 rounded border-2 border-black font-bold hover:bg-gray-300 inline-block"
                        >
                          Choose File
                        </label>
                        <p className="text-xs text-gray-500 mt-2">Max 15MB. JPG, PNG, or GIF</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links Section */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 rounded-lg">
              <h2 className="text-2xl font-black mb-4">Add Social Links (Optional)</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Twitter/X</label>
                  <input 
                    className="border-2 border-black p-3 w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://twitter.com/yourhandle" 
                    value={twitterLink}
                    onChange={(e) => setTwitterLink(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Telegram</label>
                  <input 
                    className="border-2 border-black p-3 w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://t.me/yourchannel" 
                    value={telegramLink}
                    onChange={(e) => setTelegramLink(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Website</label>
                  <input 
                    className="border-2 border-black p-3 w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://yourwebsite.com" 
                    value={websiteLink}
                    onChange={(e) => setWebsiteLink(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            {/* Dev Buy Section */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 rounded-lg">
              <h2 className="text-2xl font-black mb-4">Initial Buy (Optional)</h2>
              <div>
                <label className="block text-sm font-bold mb-2">Dev Buy Amount (ETH)</label>
                <input 
                  className="border-2 border-black p-3 w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  type="number"
                  step="0.001"
                  placeholder="0.0" 
                  value={devBuyAmount}
                  onChange={(e) => setDevBuyAmount(e.target.value)} 
                />
                <p className="text-xs text-gray-500 mt-1">Optional: Buy tokens at launch (max 2.5% of supply)</p>
              </div>
            </div>

            {/* Moltbook Verification Section */}
            <div className="bg-yellow-100 border-4 border-yellow-600 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 rounded-lg">
              <h2 className="text-2xl font-black mb-4">🔐 Moltbook Verification</h2>
              <p className="text-sm mb-4">Prove you own the agent by posting a verification code on Moltbook</p>
              
              {!verificationCode ? (
                <button
                  onClick={generateVerificationCode}
                  disabled={!agentName.trim()}
                  className="w-full bg-yellow-400 p-4 border-2 border-black font-bold hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate Verification Code
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white p-4 border-2 border-black">
                    <p className="text-sm font-bold mb-2">Post this EXACTLY on Moltbook:</p>
                    <div className="bg-gray-100 p-3 border border-black font-mono text-sm select-all cursor-copy break-all">
                      {verificationCode}
                    </div>
                  </div>
                  {!isVerified ? (
                    <button
                      onClick={verifyMoltbook}
                      disabled={isVerifying || !isConnected}
                      className="w-full bg-green-500 text-white p-4 border-2 border-black font-bold hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifying ? '⏳ Verifying...' : '✅ Verify on Moltbook'}
                    </button>
                  ) : (
                    <div className="bg-green-200 p-4 border-2 border-green-600">
                      <p className="font-bold text-green-800">✅ Verified!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 rounded-lg sticky top-4">
              <h2 className="text-2xl font-black mb-4">Preview</h2>
              
              <div className="space-y-4">
                {/* Banner */}
                {bannerImage && (
                  <img src={bannerImage} alt="Banner" className="w-full h-32 object-cover rounded border-2 border-black" />
                )}
                
                {/* Coin Image */}
                <div className="flex items-center gap-4">
                  {coinImage ? (
                    <img src={coinImage} alt="Coin" className="w-20 h-20 object-cover rounded-full border-2 border-black" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-200 rounded-full border-2 border-black flex items-center justify-center">
                      <span className="text-2xl">?</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-black">{tokenName || 'Coin Name'}</h3>
                    <p className="text-sm text-gray-600">{tokenSymbol || 'SYMBOL'}</p>
                  </div>
                </div>

                {/* Description */}
                {description && (
                  <div>
                    <p className="text-sm">{description}</p>
                  </div>
                )}

                {/* Social Links */}
                {(twitterLink || telegramLink || websiteLink) && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold">Links:</p>
                    {twitterLink && <p className="text-xs text-blue-600">🐦 Twitter</p>}
                    {telegramLink && <p className="text-xs text-blue-600">📱 Telegram</p>}
                    {websiteLink && <p className="text-xs text-blue-600">🌐 Website</p>}
                  </div>
                )}

                {/* Cost Summary */}
                <div className="border-t-2 border-black pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Launch Fee:</span>
                    <span className="font-bold">0.005 ETH</span>
                  </div>
                  {devBuyAmount && parseFloat(devBuyAmount) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Dev Buy:</span>
                      <span className="font-bold">{devBuyAmount} ETH</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-black border-t-2 border-black pt-2">
                    <span>Total:</span>
                    <span>{totalRequired.toFixed(6)} ETH</span>
                  </div>
                </div>

                {/* Launch Button */}
                <button
                  onClick={launchToken}
                  disabled={!isConnected || !isVerified || isPending || isConfirming || isSuccess || !coinImage || !tokenName || !tokenSymbol || !tokenSymbol.endsWith('MOLTPUMP')}
                  className="w-full bg-green-500 text-white p-4 border-2 border-black font-bold text-xl hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending || isConfirming ? '⏳ PROCESSING...' : isSuccess ? '✅ LAUNCHED!' : '🚀 CREATE COIN'}
                </button>

                {error && (
                  <div className="bg-red-100 p-3 border-2 border-red-500 rounded">
                    <p className="text-sm text-red-800">Error: {error.message}</p>
                  </div>
                )}

                {isSuccess && hash && (
                  <div className="bg-green-200 p-3 border-2 border-green-600 rounded">
                    <p className="font-bold text-green-800">✅ Token Launched!</p>
                    <Link href={`/token/${hash}`} className="text-sm text-blue-600 underline">
                      View Token →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
