'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'argument' | 'writing'>('argument');
  
  // Argument tab fields
  const [argument, setArgument] = useState('');
  const [whereStuck, setWhereStuck] = useState('');
  const [showArgumentHint, setShowArgumentHint] = useState(false);
  const [showStuckHint, setShowStuckHint] = useState(false);
  
  // Writing tab fields
  const [yourArgument, setYourArgument] = useState('');
  const [yourConcern, setYourConcern] = useState('');

  const handleSubmit = () => {
    if (activeTab === 'argument') {
      if (!argument) {
        alert('Please describe the argument');
        return;
      }
      sessionStorage.setItem('inputMode', 'argument');
      sessionStorage.setItem('questionText', argument);
      sessionStorage.setItem('whereStuck', whereStuck);
    } else {
      if (!yourArgument) {
        alert('Please describe your argument');
        return;
      }
      sessionStorage.setItem('inputMode', 'writing');
      sessionStorage.setItem('questionText', yourArgument);
      sessionStorage.setItem('yourConcern', yourConcern);
    }
    router.push('/input');
  };

  const handleClear = () => {
    if (activeTab === 'argument') {
      setArgument('');
      setWhereStuck('');
    } else {
      setYourArgument('');
      setYourConcern('');
    }
  };

  const handleTabChange = (tab: 'argument' | 'writing') => {
    setActiveTab(tab);
  };

  const handleTrySample = () => {
    setActiveTab('argument');
    setArgument('A philosopher argues that fair actions never injure anyone. An action does not injure anyone only if that action is just. Therefore every action that is fair must also be just. Since some merciful actions are just, some merciful actions must be fair.');
    setWhereStuck('I thought the answer was pointing out missing evidence, but it turned out to be about reversing the direction of the logic.');
  };

  return (
    <main className="min-h-screen bg-[#F4F7F5]">
      {/* Header */}
      <div className="text-center py-10 max-w-2xl mx-auto">
        <h1 className="text-6xl font-bold text-[#1B4D3E] tracking-tight">MagiClue</h1>
        <p className="text-gray-600 text-xl mt-3">Understand why your thinking diverged — not just that you got it wrong</p>
        <p className="text-gray-400 text-base mt-2">Works for any argument — exams, essays, debates, everyday reasoning</p>
      </div>

      {/* Tabs - Segmented Control Style */}
      <div className="max-w-5xl mx-auto px-12 mb-8">
        <div className="flex items-center justify-between">
          <div className="bg-white rounded-xl p-1 inline-flex shadow-sm" style={{ border: '1px solid #E5EBE9' }}>
            <button
              onClick={() => handleTabChange('argument')}
              className={`px-8 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
                activeTab === 'argument'
                  ? 'bg-[#1B4D3E] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#1B4D3E]'
              }`}
            >
              Analyze an Argument
            </button>
            <button
              onClick={() => handleTabChange('writing')}
              className={`px-8 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
                activeTab === 'writing'
                  ? 'bg-[#1B4D3E] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#1B4D3E]'
              }`}
            >
              Check My Writing
            </button>
          </div>
          
          {/* Try a Sample Button */}
          <button
            onClick={handleTrySample}
            className="text-[#2D9D78] text-base underline hover:text-[#1B4D3E] transition-colors"
          >
            Try a sample →
          </button>
        </div>
      </div>

      {/* Input Section - Full Width Feel */}
      <div className="max-w-5xl mx-auto px-12">
        {activeTab === 'argument' ? (
          <div className="space-y-6">
            {/* The Argument */}
            <div>
              <label className="block text-lg font-semibold text-[#1A1A1A] mb-3">
                The Argument <span className="text-[#2D9D78]">*</span>
              </label>
              <textarea
                value={argument}
                onChange={(e) => setArgument(e.target.value)}
                placeholder="What was being argued? (the claim and the evidence given)"
                className="w-full min-h-48 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y text-base text-[#1A1A1A] placeholder:text-gray-300 transition-all"
              />
              
              {/* Collapsible Hint */}
              <button
                onClick={() => setShowArgumentHint(!showArgumentHint)}
                className="mt-2 text-[#2D9D78] text-sm hover:text-[#1B4D3E] flex items-center gap-1 transition-colors cursor-pointer"
              >
                💡 Not sure what to write? See example {showArgumentHint ? '▲' : '▼'}
              </button>
              {showArgumentHint && (
                <div className="mt-2 p-3 bg-[#F0F7F4] rounded-lg text-gray-500 text-sm italic transition-all duration-200" style={{ border: '1px solid #E5EBE9' }}>
                  "A philosopher argues that fair actions never injure anyone, and only just actions are fair. The question asks what's wrong with this reasoning."
                </div>
              )}
            </div>

            {/* Where You Got Stuck */}
            <div className="mt-4">
              <label className="block text-lg font-semibold text-[#1A1A1A] mb-3">
                Where You Got Stuck <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </label>
              <textarea
                value={whereStuck}
                onChange={(e) => setWhereStuck(e.target.value)}
                placeholder="What made sense to you, or where did your thinking diverge?"
                className="w-full min-h-36 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y text-base text-[#1A1A1A] placeholder:text-gray-300 transition-all"
              />
              
              {/* Collapsible Hint */}
              <button
                onClick={() => setShowStuckHint(!showStuckHint)}
                className="mt-2 text-[#2D9D78] text-sm hover:text-[#1B4D3E] flex items-center gap-1 transition-colors cursor-pointer"
              >
                💡 Not sure what to write? See example {showStuckHint ? '▲' : '▼'}
              </button>
              {showStuckHint && (
                <div className="mt-2 p-3 bg-[#F0F7F4] rounded-lg text-gray-500 text-sm italic transition-all duration-200" style={{ border: '1px solid #E5EBE9' }}>
                  "I thought the answer was about missing evidence, but turns out it was about reversing the logic direction."
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Your Argument */}
            <div>
              <label className="block text-lg font-semibold text-[#1A1A1A] mb-3">
                Your Argument <span className="text-[#2D9D78]">*</span>
              </label>
              <textarea
                value={yourArgument}
                onChange={(e) => setYourArgument(e.target.value)}
                placeholder="What are you trying to argue?"
                className="w-full min-h-48 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y text-base text-[#1A1A1A] placeholder:text-gray-300 transition-all"
              />
            </div>

            {/* Your Concern */}
            <div className="mt-4">
              <label className="block text-lg font-semibold text-[#1A1A1A] mb-3">
                Your Concern <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </label>
              <textarea
                value={yourConcern}
                onChange={(e) => setYourConcern(e.target.value)}
                placeholder="What part feels weak or uncertain?"
                className="w-full min-h-36 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y text-base text-[#1A1A1A] placeholder:text-gray-300 transition-all"
              />
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-gray-300 text-sm text-center mt-3">
          Please describe in your own words. Do not paste copyrighted text. Users are solely responsible for their own inputs.
        </p>

        {/* Button Row */}
        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 text-base transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={activeTab === 'argument' ? !argument : !yourArgument}
            className="bg-[#1B4D3E] hover:bg-[#2D6A4F] text-white rounded-xl px-10 py-3.5 text-base font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all min-w-40"
          >
            {activeTab === 'argument' ? 'Analyze' : 'Check My Writing'}
          </button>
        </div>
      </div>

      {/* What You'll Get Section */}
      <div className="mt-16 max-w-5xl mx-auto px-12">
        <h2 className="text-[#1B4D3E] font-semibold text-base text-center mb-4 tracking-widest uppercase">
          What you'll get
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center" style={{ border: '1px solid #E5EBE9' }}>
            <div className="text-4xl mb-2">🧩</div>
            <h3 className="font-semibold text-[#1B4D3E] text-lg mb-1">Argument Skeleton</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Conclusion, premises, and the gap in between</p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center" style={{ border: '1px solid #E5EBE9' }}>
            <div className="text-4xl mb-2">🔀</div>
            <h3 className="font-semibold text-[#1B4D3E] text-lg mb-1">Your Thinking Fork</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Exactly where and why your reasoning diverged</p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center" style={{ border: '1px solid #E5EBE9' }}>
            <div className="text-4xl mb-2">🎯</div>
            <h3 className="font-semibold text-[#1B4D3E] text-lg mb-1">Next Practice</h3>
            <p className="text-gray-400 text-sm leading-relaxed">One targeted thing to work on next</p>
          </div>
        </div>
      </div>
    </main>
  );
}
