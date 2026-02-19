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
          <h1 className="text-3xl font-bold text-indigo-600 mb-2">Analysis Result</h1>
          <p className="text-gray-600">Review your performance and learn from the analysis</p>
        </div>

        {/* Layer 1: Always Visible - Result Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Big indicator */}
            <div className={`text-6xl font-bold ${analysis.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {analysis.isCorrect ? '✓' : '✗'}
            </div>
            
            <div className={`text-2xl font-semibold ${analysis.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {analysis.isCorrect ? 'Correct' : 'Your thinking forked here'}
            </div>

            {/* Choice display */}
            <div className="flex gap-4 text-lg">
              <div>
                <span className="text-gray-600">You chose: </span>
                <span className="font-semibold text-gray-900">{analysis.userChoice}</span>
              </div>
            </div>

            {/* One-line diagnosis */}
            {analysis.userChoiceFeedback?.diagnosis && (
              <div className="text-gray-700 text-lg max-w-2xl">
                {analysis.userChoiceFeedback.diagnosis}
              </div>
            )}

            {/* Question type badge */}
            <div className="inline-block px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
              {analysis.questionType}
            </div>
          </div>
        </div>

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
              
              {/* Diagram - Now handles string format */}
              {analysis.diagram && (
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                    Diagram
                  </h3>
                  <pre className="whitespace-pre-wrap">{analysis.diagram}</pre>
                </div>
              )}

              {/* Fork Point Feedback - NEW */}
              {analysis.userChoiceFeedback && !analysis.isCorrect && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">
                    Where Your Thinking Forked
                  </h3>
                  
                  {analysis.userChoiceFeedback.forkPoint && (
                    <div>
                      <span className="text-amber-700 font-medium">Fork Point: </span>
                      <span className="text-gray-700">{analysis.userChoiceFeedback.forkPoint}</span>
                    </div>
                  )}
                  
                  {analysis.userChoiceFeedback.userReasoning && (
                    <div>
                      <span className="text-amber-700 font-medium">Your Logic: </span>
                      <span className="text-gray-700">{analysis.userChoiceFeedback.userReasoning}</span>
                    </div>
                  )}
                  
                  {analysis.userChoiceFeedback.bridgeToCorrect && (
                    <div>
                      <span className="text-amber-700 font-medium">Bridge to Correct: </span>
                      <span className="text-gray-700">{analysis.userChoiceFeedback.bridgeToCorrect}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Trap Analysis - NEW */}
              {analysis.trapAnalysis && !analysis.isCorrect && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-red-800 uppercase tracking-wide">
                    Why Option {analysis.trapAnalysis.option} is Tempting
                  </h3>
                  <div>
                    <span className="text-red-700 font-medium">Attractive because: </span>
                    <span className="text-gray-700">{analysis.trapAnalysis.whyAttractive}</span>
                  </div>
                  <div>
                    <span className="text-red-700 font-medium">But wrong because: </span>
                    <span className="text-gray-700">{analysis.trapAnalysis.whyWrong}</span>
                  </div>
                </div>
              )}

              {/* Where to Look */}
              {analysis.selfCheckInstruction && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide">
                    Where to Look
                  </h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{analysis.selfCheckInstruction}</p>
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
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase">Skill Point</h3>
                  <p className="text-gray-700">{analysis.skillPoint}</p>
                </div>
              )}
              {analysis.takeaway && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-indigo-700 mb-2 uppercase">💡 Remember This</h3>
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
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Another
          </button>
          <button
            onClick={() => router.push('/stats')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Stats
          </button>
        </div>
      </div>
    </main>
  );
}
