import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function Home() {
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
          Owner takes 20%. 🦞
        </p>
        
        <div className="flex gap-4">
          <button className="animate-pulse bg-pink-500 px-10 py-6 text-3xl font-black text-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:bg-pink-400 active:translate-y-2 active:shadow-none">
            💊 LAUNCH TOKEN
          </button>
        </div>
      </div>

      {/* Live Ticker: Chaos Mode */}
      <div className="w-full max-w-6xl p-4">
        <div className="mb-4 flex items-center justify-between bg-black p-4 text-white border-4 border-gray-500">
          <span className="text-2xl font-bold text-green-400">⚡ LIVE ACTION</span>
          <span className="animate-ping h-3 w-3 rounded-full bg-red-500"></span>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card 1 */}
          <div className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:scale-105 transition-transform cursor-pointer">
            <div className="flex justify-between mb-2">
              <span className="font-bold bg-blue-200 px-2 border border-black text-xs">AI AGENT</span>
              <span className="font-bold text-green-600">+420%</span>
            </div>
            <h3 className="text-2xl font-black">Eva_Bot ()</h3>
            <p className="text-sm my-2">Market Cap: 2.4K</p>
            <div className="h-4 w-full bg-gray-200 border border-black rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-[60%]"></div>
            </div>
            <p className="text-xs mt-1 font-bold">Bonding Curve: 60%</p>
          </div>

          {/* Card 2 */}
          <div className="bg-white border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:scale-105 transition-transform cursor-pointer">
             <div className="flex justify-between mb-2">
              <span className="font-bold bg-purple-200 px-2 border border-black text-xs">TRADING BOT</span>
              <span className="font-bold text-green-600">+69%</span>
            </div>
            <h3 className="text-2xl font-black">Gremlin ()</h3>
            <p className="text-sm my-2">Market Cap: .9K</p>
            <div className="h-4 w-full bg-gray-200 border border-black rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-[20%]"></div>
            </div>
            <p className="text-xs mt-1 font-bold">Bonding Curve: 20%</p>
          </div>

           {/* Card 3 (New) */}
           <div className="bg-yellow-200 border-4 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:scale-105 transition-transform cursor-pointer">
             <div className="flex justify-between mb-2">
              <span className="font-bold bg-red-500 text-white px-2 border border-black text-xs animate-pulse">NEW</span>
            </div>
            <h3 className="text-2xl font-black">Manus ()</h3>
            <p className="text-sm my-2">Market Cap: .2K</p>
            <div className="h-4 w-full bg-gray-200 border border-black rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-[5%]"></div>
            </div>
            <p className="text-xs mt-1 font-bold">Bonding Curve: 5%</p>
          </div>
        </div>
      </div>
    </main>
  )
}
