'use client'
import { useState } from 'react';

export default function Launch() {
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');

  const handleLaunch = () => {
    console.log("Launching", name, ticker);
    // TODO: Wagmi WriteContract
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold mb-8">Launch Agent Token</h1>
      <input 
        className="border p-2 mb-4 text-black" 
        placeholder="Agent Name" 
        onChange={(e) => setName(e.target.value)} 
      />
      <input 
        className="border p-2 mb-4 text-black" 
        placeholder="Ticker (e.g. EVA)" 
        onChange={(e) => setTicker(e.target.value)} 
      />
      <button 
        className="bg-blue-500 text-white p-2 rounded"
        onClick={handleLaunch}
      >
        Deploy on Base
      </button>
    </div>
  )
}
