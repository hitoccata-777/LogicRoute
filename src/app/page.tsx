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

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = (fieldSetter: (val: string) => void, currentValue: string) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Please use Chrome.');
      return;
    }
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      fieldSetter(currentValue + ' ' + transcript);
      setIsRecording(false);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      setIsRecording(false);
    };
    
    recognition.onend = () => setIsRecording(false);
    
    setIsRecording(true);
    recognition.start();
  };

  const handleSubmit = async () => {
    // Validation
    if (activeTab === 'argument') {
      if (!argument) {
        alert('Please describe the argument');
        return;
      }
    } else {
      if (!yourArgument) {
        alert('Please describe your argument');
        return;
      }
    }

    // Reset error state
    setSubmitError('');
    setIsSubmitting(true);

    try {
      // Prepare request body
      const requestBody = {
        text: activeTab === 'argument' ? argument : yourArgument,
        stuck: activeTab === 'argument' ? whereStuck : yourConcern,
        mode: activeTab
      };

      // Call extract API
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to extract data');
      }

      const result = await response.json();

      // Store extracted data and navigate
      sessionStorage.setItem('inputMode', activeTab);
      sessionStorage.setItem('extractedData', JSON.stringify(result));
      
      // Also store original inputs for backward compatibility
      if (activeTab === 'argument') {
        sessionStorage.setItem('questionText', argument);
        sessionStorage.setItem('whereStuck', whereStuck);
      } else {
        sessionStorage.setItem('questionText', yourArgument);
        sessionStorage.setItem('yourConcern', yourConcern);
      }

      router.push('/input');
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
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
              <div className="relative">
                <textarea
                  value={argument}
                  onChange={(e) => setArgument(e.target.value)}
                  placeholder="What was being argued? (the claim and the evidence given)"
                  className="w-full min-h-48 p-5 pr-14 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y text-base text-[#1A1A1A] placeholder:text-gray-300 transition-all"
                />
                <button
                  type="button"
                  onClick={() => startRecording(setArgument, argument)}
                  disabled={isRecording}
                  className={`absolute right-4 top-4 p-2 rounded-full transition-colors ${
                    isRecording
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={isRecording ? 'Recording...' : 'Start voice input'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
              
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
              <div className="relative">
                <textarea
                  value={whereStuck}
                  onChange={(e) => setWhereStuck(e.target.value)}
                  placeholder="What made sense to you, or where did your thinking diverge?"
                  className="w-full min-h-36 p-5 pr-14 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y text-base text-[#1A1A1A] placeholder:text-gray-300 transition-all"
                />
                <button
                  type="button"
                  onClick={() => startRecording(setWhereStuck, whereStuck)}
                  disabled={isRecording}
                  className={`absolute right-4 top-4 p-2 rounded-full transition-colors ${
                    isRecording
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={isRecording ? 'Recording...' : 'Start voice input'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
              
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
              <div className="relative">
                <textarea
                  value={yourArgument}
                  onChange={(e) => setYourArgument(e.target.value)}
                  placeholder="What are you trying to argue?"
                  className="w-full min-h-48 p-5 pr-14 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y text-base text-[#1A1A1A] placeholder:text-gray-300 transition-all"
                />
                <button
                  type="button"
                  onClick={() => startRecording(setYourArgument, yourArgument)}
                  disabled={isRecording}
                  className={`absolute right-4 top-4 p-2 rounded-full transition-colors ${
                    isRecording
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={isRecording ? 'Recording...' : 'Start voice input'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Your Concern */}
            <div className="mt-4">
              <label className="block text-lg font-semibold text-[#1A1A1A] mb-3">
                Your Concern <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </label>
              <div className="relative">
                <textarea
                  value={yourConcern}
                  onChange={(e) => setYourConcern(e.target.value)}
                  placeholder="What part feels weak or uncertain?"
                  className="w-full min-h-36 p-5 pr-14 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y text-base text-[#1A1A1A] placeholder:text-gray-300 transition-all"
                />
                <button
                  type="button"
                  onClick={() => startRecording(setYourConcern, yourConcern)}
                  disabled={isRecording}
                  className={`absolute right-4 top-4 p-2 rounded-full transition-colors ${
                    isRecording
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={isRecording ? 'Recording...' : 'Start voice input'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-gray-300 text-sm text-center mt-3">
          Please describe in your own words. Do not paste copyrighted text. Users are solely responsible for their own inputs.
        </p>

        {/* Button Row */}
        <div className="mt-4">
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClear}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 text-base transition-colors disabled:opacity-40"
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (activeTab === 'argument' ? !argument : !yourArgument)}
              className="bg-[#1B4D3E] hover:bg-[#2D6A4F] text-white rounded-xl px-10 py-3.5 text-base font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all min-w-40 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing...
                </>
              ) : (
                activeTab === 'argument' ? 'Analyze' : 'Check My Writing'
              )}
            </button>
          </div>
          {submitError && (
            <p className="text-red-500 text-sm text-right mt-2">{submitError}</p>
          )}
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
