'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AnalysisResult {
  questionType: string;
  questionFamily: string;
  method: string;
  
  phase1: {
    step1_understanding: {
      who_says_what: string;
      why: string;
      from_where_to_where: string;
      any_jumps: string;
      what_is_asked: string;
    };
    step2_checks_triggered: string[];
    step2_check_results: string;
    step3_core_judgment: string;
    step4_correct_answer: string;
  };
  
  isCorrect: boolean;
  diagram: string;
  
  userChoiceFeedback: {
    errorType: string | null;
    errorTypeInternal: string | null;
    forkPoint: string;
    whyTempting: string;
    bridgeToCorrect: string;
    diagnosis: string;
  };
  
  hesitatedChoiceFeedback?: {
    isCorrect: boolean;
    explanation: string;
  };
  
  analysis: {
    coreGap: string;
    flipTest: string;
  };
  
  selfCheckInstruction: string;
  skillPoint: string;
  takeaway: string;
  
  userChoice: string;
  inputMode: string;
  questionId?: string;
}

export default function ResultPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<{ [key: number]: boolean }>({
    2: false,  // Understanding & Diagram
    3: false,  // Deep Analysis
    4: false   // Takeaway
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResult');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAnalysis(parsed);
        
        // Auto-expand layer 2 if answer is wrong
        if (!parsed.isCorrect) {
          setExpandedLayers(prev => ({ ...prev, 2: true }));
        }
        
        if (parsed.questionId) {
          saveAttempt(parsed);
        }
      } catch (e) {
        console.error('Failed to parse analysis result', e);
      }
    }
  }, []);

  const saveAttempt = async (analysisData: AnalysisResult) => {
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

        {/* Layer 1: Result Summary (Always Visible) */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] p-6 mb-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Correct/Wrong Badge */}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              analysis.isCorrect ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {analysis.isCorrect ? (
                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            {/* User's choice vs Correct answer */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-lg">
              <div>
                <span className="text-gray-600">Your Choice: </span>
                <span className={`font-bold ${analysis.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {analysis.userChoice}
                </span>
              </div>
              {!analysis.isCorrect && analysis.phase1?.step4_correct_answer && (
                <>
                  <span className="hidden sm:inline text-gray-400">|</span>
                  <div>
                    <span className="text-gray-600">Correct: </span>
                    <span className="font-bold text-green-600">{analysis.phase1.step4_correct_answer}</span>
                  </div>
                </>
              )}
            </div>

            {/* One-line diagnosis */}
            {analysis.userChoiceFeedback?.diagnosis && (
              <div className="text-gray-800 text-xl font-medium max-w-2xl mt-2">
                {analysis.userChoiceFeedback.diagnosis}
              </div>
            )}

            {/* Hesitated Choice Feedback */}
            {analysis.hesitatedChoiceFeedback && (
              <div className={`mt-4 p-4 rounded-xl border-2 ${
                analysis.hesitatedChoiceFeedback.isCorrect 
                  ? 'bg-green-50 border-green-300' 
                  : 'bg-amber-50 border-amber-300'
              }`}>
                <div className="text-sm font-semibold mb-1">
                  {analysis.hesitatedChoiceFeedback.isCorrect 
                    ? '✓ Your hesitated choice was correct!' 
                    : 'About your hesitated choice:'}
                </div>
                <div className="text-gray-700">{analysis.hesitatedChoiceFeedback.explanation}</div>
              </div>
            )}

            {/* Question type badge */}
            <div className="inline-block px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
              {analysis.questionType}
            </div>
          </div>
        </div>

        {/* Layer 2: Understanding & Diagram (Expandable, default expanded if wrong) */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] mb-6 overflow-hidden transition-all duration-300">
          <button
            onClick={() => toggleLayer(2)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">Understanding & Diagram</h2>
            <svg
              className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${expandedLayers[2] ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedLayers[2] && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-200 pt-6">
              
              {/* Core Judgment - Highlighted */}
              {analysis.phase1?.step3_core_judgment && (
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-6 rounded-xl shadow-lg">
                  <h3 className="text-sm font-bold uppercase tracking-wide mb-3 opacity-90">
                    🎯 Core Judgment
                  </h3>
                  <p className="text-lg leading-relaxed font-medium">
                    {analysis.phase1.step3_core_judgment}
                  </p>
                </div>
              )}

              {/* Diagram */}
              {analysis.diagram && (
                <div className="bg-gray-900 text-green-400 p-5 rounded-xl font-mono text-sm overflow-x-auto border border-gray-700">
                  <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-widest">
                    Visual Diagram
                  </h3>
                  <pre className="whitespace-pre-wrap leading-relaxed">{analysis.diagram}</pre>
                </div>
              )}

              {/* Fork Point, Why Tempting, Bridge to Correct (only if wrong) */}
              {!analysis.isCorrect && analysis.userChoiceFeedback && (
                <div className="space-y-4">
                  {/* Fork Point */}
                  {analysis.userChoiceFeedback.forkPoint && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded-r-xl">
                      <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-2">
                        🔀 Fork Point
                      </h3>
                      <p className="text-gray-800 leading-relaxed">
                        {analysis.userChoiceFeedback.forkPoint}
                      </p>
                    </div>
                  )}

                  {/* Why Tempting */}
                  {analysis.userChoiceFeedback.whyTempting && (
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-5 rounded-r-xl">
                      <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wide mb-2">
                        🎣 Why Tempting
                      </h3>
                      <p className="text-gray-800 leading-relaxed">
                        {analysis.userChoiceFeedback.whyTempting}
                      </p>
                    </div>
                  )}

                  {/* Bridge to Correct */}
                  {analysis.userChoiceFeedback.bridgeToCorrect && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-5 rounded-r-xl">
                      <h3 className="text-sm font-bold text-green-800 uppercase tracking-wide mb-2">
                        🌉 Bridge to Correct
                      </h3>
                      <p className="text-gray-800 leading-relaxed">
                        {analysis.userChoiceFeedback.bridgeToCorrect}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layer 3: Deep Analysis (Expandable, default collapsed) */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] mb-6 overflow-hidden transition-all duration-300">
          <button
            onClick={() => toggleLayer(3)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">Deep Analysis</h2>
            <svg
              className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${expandedLayers[3] ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedLayers[3] && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-200 pt-6">
              
              {/* 5-Step Understanding */}
              {analysis.phase1?.step1_understanding && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">5-Step Understanding</h3>
                  
                  <div className="space-y-3">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm font-semibold text-blue-800 mb-1">1. Who says what?</div>
                      <div className="text-gray-700">{analysis.phase1.step1_understanding.who_says_what}</div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-sm font-semibold text-purple-800 mb-1">2. Why?</div>
                      <div className="text-gray-700">{analysis.phase1.step1_understanding.why}</div>
                    </div>

                    <div className="bg-pink-50 p-4 rounded-lg">
                      <div className="text-sm font-semibold text-pink-800 mb-1">3. From where to where?</div>
                      <div className="text-gray-700">{analysis.phase1.step1_understanding.from_where_to_where}</div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-sm font-semibold text-orange-800 mb-1">4. Any jumps?</div>
                      <div className="text-gray-700">{analysis.phase1.step1_understanding.any_jumps}</div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm font-semibold text-green-800 mb-1">5. What is asked?</div>
                      <div className="text-gray-700">{analysis.phase1.step1_understanding.what_is_asked}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Faithfulness Checks */}
              {analysis.phase1?.step2_checks_triggered && analysis.phase1.step2_checks_triggered.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900">Faithfulness Checks</h3>
                  
                  {/* Check tags/pills */}
                  <div className="flex flex-wrap gap-2">
                    {analysis.phase1.step2_checks_triggered.map((check, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium"
                      >
                        {check}
                      </span>
                    ))}
                  </div>

                  {/* Check results */}
                  {analysis.phase1.step2_check_results && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-gray-700 leading-relaxed">{analysis.phase1.step2_check_results}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Analysis: Core Gap and Flip Test */}
              {analysis.analysis && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900">Analysis</h3>
                  
                  {analysis.analysis.coreGap && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                      <div className="text-sm font-semibold text-red-800 mb-1">Core Gap</div>
                      <div className="text-gray-700">{analysis.analysis.coreGap}</div>
                    </div>
                  )}

                  {analysis.analysis.flipTest && (
                    <div className="bg-teal-50 border-l-4 border-teal-400 p-4 rounded-r-lg">
                      <div className="text-sm font-semibold text-teal-800 mb-1">Flip Test</div>
                      <div className="text-gray-700">{analysis.analysis.flipTest}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Layer 4: Takeaway (Expandable, default collapsed) */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] mb-6 overflow-hidden transition-all duration-300">
          <button
            onClick={() => toggleLayer(4)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">Takeaway</h2>
            <svg
              className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${expandedLayers[4] ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedLayers[4] && (
            <div className="px-6 pb-6 space-y-5 border-t border-gray-200 pt-6">
              
              {/* Skill Point */}
              {analysis.skillPoint && (
                <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
                  <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wide mb-2">
                    🎯 Skill Point
                  </h3>
                  <p className="text-gray-800 leading-relaxed">{analysis.skillPoint}</p>
                </div>
              )}

              {/* Takeaway */}
              {analysis.takeaway && (
                <div className="bg-green-50 p-5 rounded-xl border border-green-200">
                  <h3 className="text-sm font-bold text-green-800 uppercase tracking-wide mb-2">
                    💡 Takeaway
                  </h3>
                  <p className="text-gray-800 text-lg leading-relaxed font-medium">{analysis.takeaway}</p>
                </div>
              )}

              {/* Self-Check Instruction */}
              {analysis.selfCheckInstruction && (
                <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
                  <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-2">
                    🔍 Next time you see this type of question...
                  </h3>
                  <p className="text-gray-800 leading-relaxed">{analysis.selfCheckInstruction}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 bg-[#1B4D3E] text-white text-base font-medium rounded-xl hover:bg-[#2D6A4F] transition-colors shadow-sm"
          >
            Try Another
          </button>
          <button
            onClick={() => router.push('/stats')}
            className="px-8 py-3 border-2 border-[#1B4D3E] rounded-xl text-[#1B4D3E] text-base font-medium hover:bg-[#F0F7F4] transition-colors"
          >
            View Stats
          </button>
        </div>
      </div>
    </main>
  );
}
