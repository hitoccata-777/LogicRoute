'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResultPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<any>(null);
  const [expandedLayers, setExpandedLayers] = useState<{ [key: number]: boolean }>({
    2: true,  // Auto-expand Analysis by default
    3: false
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResult');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAnalysis(parsed);
        
        if (parsed.questionId) {
          saveAttempt(parsed);
        }
      } catch (e) {
        console.error('Failed to parse analysis result', e);
      }
    }
  }, []);

  const saveAttempt = async (analysisData: any) => {
    let userId = sessionStorage.getItem('currentUserId') || localStorage.getItem('logiclue_user_id');
    
    if (!userId) {
      console.warn('No userId found, skipping attempt save');
      return;
    }

    const inputDataStr = sessionStorage.getItem('inputData');
    if (!inputDataStr) {
      console.warn('No input data found, skipping attempt save');
      return;
    }

    try {
      const inputData = JSON.parse(inputDataStr);
      
      const response = await fetch('/api/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          questionId: analysisData.questionId,
          userChoice: analysisData.userChoice,
          isCorrect: analysisData.isCorrect,
          errorType: analysisData.userChoiceFeedback?.errorType || null,
          userDifficulty: inputData.difficulty || null,
          altChoice: inputData.hesitatedChoice || null,
          altRationaleTag: inputData.hesitationReason || null,
          altRationaleText: inputData.altRationaleText || null,
          userCorrectAnswer: inputData.correctAnswer || null,
          userNote: null
        })
      });

      const result = await response.json();
      if (!result.success) {
        console.error('Failed to save attempt:', result.error);
      }
    } catch (error) {
      console.error('Error saving attempt:', error);
    }
  };

  const toggleLayer = (layerNumber: number) => {
    setExpandedLayers(prev => ({
      ...prev,
      [layerNumber]: !prev[layerNumber]
    }));
  };

  if (!analysis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No analysis data found</p>
          <button
            onClick={() => router.push('/')}
            className="text-indigo-600 hover:underline"
          >
            Go back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1B4D3E] mb-2">Analysis Result</h1>
          <p className="text-gray-600">Review your performance and learn from the analysis</p>
        </div>

        {/* Layer 1: Always Visible - Result Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Fork Visual */}
            {!analysis.isCorrect && (
              <div className="w-full max-w-md space-y-2 text-left font-mono text-sm">
                <div className="flex items-center">
                  <div className="border-l-4 border-amber-400 pl-3 py-1 text-amber-700">
                    YOUR PATH ──────────┐
                  </div>
                </div>
                <div className="flex items-center pl-20">
                  <div className="text-gray-600">
                    ├── DIVERGED HERE
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="border-l-4 border-[#2D9D78] pl-3 py-1 text-[#2D9D78]">
                    CORRECT PATH ───────┘
                  </div>
                </div>
              </div>
            )}
            
            <div className={`text-2xl font-semibold ${analysis.isCorrect ? 'text-[#2D9D78]' : 'text-[#1B4D3E]'}`}>
              {analysis.isCorrect ? 'Correct' : 'Your thinking forked here'}
            </div>

            {/* Choice display */}
            {analysis.userChoice && (
              <div className="flex gap-4 text-lg">
                <div>
                  <span className="text-gray-600">You chose: </span>
                  <span className="font-semibold text-gray-900">{analysis.userChoice}</span>
                </div>
              </div>
            )}

            {/* One-line diagnosis */}
            {analysis.userChoiceFeedback?.diagnosis && (
              <div className="text-gray-800 text-xl font-medium max-w-2xl">
                {analysis.userChoiceFeedback.diagnosis}
              </div>
            )}

            {/* Question type badge */}
            <div className="inline-block px-4 py-2 bg-[#F0F7F4] text-[#1B4D3E] rounded-full text-sm font-medium">
              {analysis.questionType}
            </div>
          </div>
        </div>

        {/* Most Warning Banner */}
        {analysis.mostWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4 flex items-start gap-3">
            <div className="text-2xl flex-shrink-0">⚠️</div>
            <p className="text-amber-800 text-base leading-relaxed">{analysis.mostWarning}</p>
          </div>
        )}

        {/* Layer 2: Analysis (Expandable) */}
        <div className="bg-white rounded-lg shadow-md mb-4 overflow-hidden transition-all duration-300">
          <button
            onClick={() => toggleLayer(2)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">Analysis</h2>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${expandedLayers[2] ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedLayers[2] && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-200 pt-4">
              
              {/* Diagram */}
              {analysis.diagram && (
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto border-l-4 border-[#2D9D78]">
                  <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-widest">
                    ARGUMENT STRUCTURE
                  </h3>
                  <pre className="whitespace-pre-wrap max-h-64 overflow-y-auto">{analysis.diagram}</pre>
                </div>
              )}

              {/* Fork Point Feedback - Hero Section */}
              {analysis.userChoiceFeedback && !analysis.isCorrect && (
                <div className="bg-[#FFFBEB] border-l-4 border-amber-400 rounded-r-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-4">
                    WHERE YOUR THINKING FORKED
                  </h3>
                  
                  {analysis.userChoiceFeedback.forkPoint && (
                    <div className="flex items-start">
                      <div className="inline-flex w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold items-center justify-center mr-2 flex-shrink-0">
                        1
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">FORK POINT</div>
                        <div className="text-gray-800 text-base mt-1">{analysis.userChoiceFeedback.forkPoint}</div>
                      </div>
                    </div>
                  )}
                  
                  {analysis.userChoiceFeedback.forkPoint && analysis.userChoiceFeedback.userReasoning && (
                    <div className="border-t border-amber-200 my-3"></div>
                  )}
                  
                  {analysis.userChoiceFeedback.userReasoning && (
                    <div className="flex items-start">
                      <div className="inline-flex w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold items-center justify-center mr-2 flex-shrink-0">
                        2
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">YOUR LOGIC</div>
                        <div className="text-gray-800 text-base mt-1">{analysis.userChoiceFeedback.userReasoning}</div>
                      </div>
                    </div>
                  )}
                  
                  {analysis.userChoiceFeedback.userReasoning && analysis.userChoiceFeedback.bridgeToCorrect && (
                    <div className="border-t border-amber-200 my-3"></div>
                  )}
                  
                  {analysis.userChoiceFeedback.bridgeToCorrect && (
                    <div className="flex items-start">
                      <div className="inline-flex w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold items-center justify-center mr-2 flex-shrink-0">
                        3
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">BRIDGE TO CORRECT</div>
                        <div className="text-gray-800 text-base mt-1">{analysis.userChoiceFeedback.bridgeToCorrect}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trap Analysis */}
              {analysis.trapAnalysis && !analysis.isCorrect && (
                <div className="bg-[#FFF5F5] border border-red-200 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-red-800 uppercase tracking-wide">
                    Why Your Answer Was Tempting
                  </h3>
                  <div>
                    <span className="text-red-700 font-bold">Attractive because: </span>
                    <span className="text-gray-700">{analysis.trapAnalysis.whyAttractive}</span>
                  </div>
                  <div>
                    <span className="text-red-700 font-bold">But wrong because: </span>
                    <span className="text-gray-700">{analysis.trapAnalysis.whyWrong}</span>
                  </div>
                </div>
              )}

              {/* Where to Look - Compass Card */}
              {analysis.selfCheckInstruction && (
                <div className="bg-[#F0F7F4] border border-[#1B4D3E] rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-bold text-[#1B4D3E] uppercase tracking-wide">
                    🧭 Where to Look
                  </h3>
                  <p className="text-gray-700 text-base leading-relaxed whitespace-pre-wrap">{analysis.selfCheckInstruction}</p>
                  <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-[#D1E8E2]">
                    Verify against the original source material
                  </p>
                </div>
              )}

              {/* Evidence Chain - NEW */}
              {analysis.analysis?.evidenceChain && analysis.analysis.evidenceChain.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide mb-2">
                    Evidence Chain (Ask "What's the evidence?")
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {analysis.analysis.evidenceChain.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                  {analysis.analysis.coreGap && (
                    <p className="mt-3 pt-3 border-t border-blue-200">
                      <span className="font-medium text-blue-800">Core Gap: </span>
                      <span className="text-gray-700">{analysis.analysis.coreGap}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layer 3: Key Takeaway (Expandable) */}
        <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden transition-all duration-300">
          <button
            onClick={() => toggleLayer(3)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">Key Takeaway</h2>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${expandedLayers[3] ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedLayers[3] && (
            <div className="px-6 pb-6 space-y-4 border-t border-gray-200 pt-4">
              {analysis.skillPoint && (
                <div>
                  <h3 className="text-sm font-semibold text-[#1B4D3E] mb-2 uppercase">🎯 Skill Point</h3>
                  <p className="text-gray-700">{analysis.skillPoint}</p>
                </div>
              )}
              {analysis.takeaway && (
                <div className="bg-[#F0F7F4] border border-[#1B4D3E] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-[#1B4D3E] mb-2 uppercase">💡 Remember This</h3>
                  <p className="text-gray-800 text-lg">{analysis.takeaway}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-[#1B4D3E] text-white rounded-lg hover:bg-[#2D6A4F] transition-colors"
          >
            Try Another
          </button>
          <button
            onClick={() => router.push('/stats')}
            className="px-6 py-2 border border-[#1B4D3E] rounded-lg text-[#1B4D3E] hover:bg-[#F0F7F4] transition-colors"
          >
            View Stats
          </button>
        </div>
      </div>
    </main>
  );
}
