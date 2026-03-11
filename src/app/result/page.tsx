'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AnalysisResult, WrongOptionAnalysis } from '../../types/analysis';

export default function ResultPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [expandedLayers, setExpandedLayers] = useState<{ [key: number]: boolean }>({
    2: false,
    3: false,
    4: false,
    5: false,  // Debug: options sent
    6: false   // Debug: reasoning trace
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResult');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAnalysis(parsed);

        // Auto-expand all layers if wrong (test mode: see everything)
        if (!parsed.isCorrect) {
          setExpandedLayers({ 2: true, 3: true, 4: true });
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
    const userId = sessionStorage.getItem('currentUserId') || localStorage.getItem('logiclue_user_id');
    if (!userId) return;

    const inputDataStr = sessionStorage.getItem('inputData');
    if (!inputDataStr) return;

    try {
      const inputData = JSON.parse(inputDataStr);
      // Find user's chosen option in wrong_options for error type
      const userWrongOption = analysisData.wrong_options?.find(
        (wo: WrongOptionAnalysis) => wo.label === analysisData.userChoice
      );

      await fetch('/api/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          questionId: analysisData.questionId,
          userChoice: analysisData.userChoice,
          isCorrect: analysisData.isCorrect,
          errorType: userWrongOption?.match_trigger || null,
          userDifficulty: inputData.difficulty || null,
          altChoice: inputData.hesitatedChoice || null,
          altRationaleTag: inputData.hesitationReason || null,
          altRationaleText: inputData.altRationaleText || null,
          userCorrectAnswer: inputData.correctAnswer || null,
          userNote: null
        })
      });
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
          <button onClick={() => router.push('/')} className="text-indigo-600 hover:underline">
            Go back to home
          </button>
        </div>
      </div>
    );
  }

  // Find user's chosen wrong option for highlighting
  const userWrongOption = analysis.wrong_options?.find(
    (wo) => wo.label === analysis.userChoice
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1B4D3E] mb-2">Analysis Result</h1>
          <p className="text-gray-600">Review your performance and learn from the analysis</p>
        </div>

        {/* ============================================ */}
        {/* Layer 1: Result Summary (Always Visible)    */}
        {/* ============================================ */}
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

            {/* User choice vs Correct */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-lg">
              <div>
                <span className="text-gray-600">Your Choice: </span>
                <span className={`font-bold ${analysis.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {analysis.userChoice}
                </span>
              </div>
              {!analysis.isCorrect && analysis.correct_option?.label && (
                <>
                  <span className="hidden sm:inline text-gray-400">|</span>
                  <div>
                    <span className="text-gray-600">Correct: </span>
                    <span className="font-bold text-green-600">{analysis.correct_option.label}</span>
                  </div>
                </>
              )}
            </div>

            {/* Core Judgment as headline */}
            {analysis.core_judgment && (
              <div className="text-gray-800 text-xl font-medium max-w-2xl mt-2">
                {analysis.core_judgment}
              </div>
            )}

            {/* Question type + method badges */}
            <div className="flex gap-2">
              <span className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                {analysis.question_family}
              </span>
              <span className="px-4 py-2 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                {analysis.method}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* Layer 2: Diagram + Structure                */}
        {/* ============================================ */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] mb-6 overflow-hidden">
          <button
            onClick={() => toggleLayer(2)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">Understanding & Diagram</h2>
            <svg
              className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${expandedLayers[2] ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedLayers[2] && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-200 pt-6">

              {/* Diagram */}
              {analysis.diagram && (
                <div className="bg-gray-900 text-green-400 p-5 rounded-xl font-mono text-sm overflow-x-auto border border-gray-700">
                  <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-widest">
                    Visual Diagram
                  </h3>
                  <pre className="whitespace-pre-wrap leading-relaxed">{analysis.diagram}</pre>
                </div>
              )}

              {/* Structure */}
              {analysis.structure && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900">Structure</h3>
                  {Object.entries(analysis.structure).map(([key, value]) => {
                    if (!value) return null;
                    
                    // Handle nested objects (e.g., {premises, conclusion})
                    const displayValue = typeof value === 'object' && value !== null
                      ? JSON.stringify(value, null, 2)
                      : String(value);
                    
                    // Color coding by key type
                    const colors: Record<string, string> = {
                      x: 'blue', y: 'purple', bridge: 'teal', gap: 'red',
                      editor_x: 'blue', editor_y: 'purple', editor_bridge: 'teal', editor_gap: 'red',
                      director_x: 'blue', director_y: 'purple', director_bridge: 'teal', director_gap: 'red',
                    };
                    const color = colors[key] || 'gray';
                    return (
                      <div key={key} className={`bg-${color}-50 border-l-4 border-${color}-400 p-4 rounded-r-lg`}>
                        <div className={`text-sm font-semibold text-${color}-800 mb-1`}>
                          {key.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="text-gray-700 whitespace-pre-wrap">{displayValue}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Faithfulness Check */}
              {analysis.faithfulness_check && (
                <div className={`p-4 rounded-lg border ${
                  analysis.faithfulness_check.startsWith('pass')
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="text-sm font-semibold mb-1">
                    {analysis.faithfulness_check.startsWith('pass') ? '✓' : '✗'} Faithfulness Check
                  </div>
                  <div className="text-gray-700">{analysis.faithfulness_check}</div>
                </div>
              )}

              {/* Narrative: Trap / Action / Next Time */}
              {!analysis.isCorrect && analysis.narrative && (
                <div className="space-y-4">
                  {analysis.narrative.trap && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded-r-xl">
                      <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-2">
                        🪤 Why it felt right
                      </h3>
                      <p className="text-gray-800 leading-relaxed">{analysis.narrative.trap}</p>
                    </div>
                  )}

                  {analysis.narrative.action && (
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-5 rounded-r-xl">
                      <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wide mb-2">
                        🔍 Feeling vs. Logic
                      </h3>
                      <p className="text-gray-800 leading-relaxed">{analysis.narrative.action}</p>
                    </div>
                  )}

                  {analysis.narrative.next_time && (
                    <div className="bg-green-50 border-l-4 border-green-500 p-5 rounded-r-xl">
                      <h3 className="text-sm font-bold text-green-800 uppercase tracking-wide mb-2">
                        🎯 Check Action
                      </h3>
                      <p className="text-gray-800 leading-relaxed">{analysis.narrative.next_time}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* Layer 3: All Options Analysis (Test Mode)   */}
        {/* ============================================ */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] mb-6 overflow-hidden">
          <button
            onClick={() => toggleLayer(3)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">All Options Analysis</h2>
            <svg
              className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${expandedLayers[3] ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedLayers[3] && (
            <div className="px-6 pb-6 space-y-4 border-t border-gray-200 pt-6">

              {/* Correct Option */}
              {analysis.correct_option && (
                <div className="bg-green-50 border-2 border-green-300 p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-700 font-bold text-lg">{analysis.correct_option.label}</span>
                    <span className="px-2 py-0.5 bg-green-200 text-green-800 rounded text-xs font-bold">CORRECT</span>
                  </div>
                  <p className="text-gray-800">{analysis.correct_option.reason}</p>
                </div>
              )}

              {/* All Wrong Options */}
              {analysis.wrong_options?.map((wo: WrongOptionAnalysis) => {
                const isUserChoice = wo.label === analysis.userChoice;
                return (
                  <div
                    key={wo.label}
                    className={`p-5 rounded-xl border-2 ${
                      isUserChoice
                        ? 'bg-red-50 border-red-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Option header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`font-bold text-lg ${isUserChoice ? 'text-red-700' : 'text-gray-700'}`}>
                        {wo.label}
                      </span>
                      {isUserChoice && (
                        <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded text-xs font-bold">
                          YOUR CHOICE
                        </span>
                      )}
                      {/* Match trigger tag */}
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                        {wo.match_trigger}
                      </span>
                    </div>

                    {/* Claims */}
                    <p className="text-gray-700 mb-2 italic">{wo.claims}</p>

                    {/* Why wrong */}
                    <p className="text-gray-800 text-sm">{wo.why_wrong}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* Layer 4: Takeaway                           */}
        {/* ============================================ */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] mb-6 overflow-hidden">
          <button
            onClick={() => toggleLayer(4)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">Takeaway</h2>
            <svg
              className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${expandedLayers[4] ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedLayers[4] && (
            <div className="px-6 pb-6 space-y-5 border-t border-gray-200 pt-6">
              {analysis.narrative?.next_time && (
                <div className="bg-green-50 p-5 rounded-xl border border-green-200">
                  <h3 className="text-sm font-bold text-green-800 uppercase tracking-wide mb-3">
                    🎯 Check Action
                  </h3>
                  <p className="text-gray-800 text-lg leading-relaxed font-medium">
                    {analysis.narrative.next_time}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* Layer 5: Debug — Options Sent to LLM (Test) */}
        {/* ============================================ */}
        {(analysis as any)._debug_options_sent && (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-red-300 mb-6 overflow-hidden">
            <button
              onClick={() => toggleLayer(5)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-red-50 transition-colors"
            >
              <h2 className="text-xl font-bold text-red-700">🔧 Debug: Options Sent to LLM</h2>
              <svg
                className={`w-6 h-6 text-red-500 transition-transform duration-300 ${expandedLayers[5] ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedLayers[5] && (
              <div className="px-6 pb-6 space-y-3 border-t border-red-200 pt-4">

                {/* LLM Thinking Chain */}
                {(analysis as any)._debug_thinking && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300 mb-4">
                    <div className="font-bold text-yellow-800 mb-2">🧠 LLM Thinking Chain (Extended Thinking)</div>
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap max-h-[600px] overflow-y-auto leading-relaxed">
                      {(analysis as any)._debug_thinking}
                    </pre>
                  </div>
                )}

                {/* Options sent to LLM */}
                {Object.entries((analysis as any)._debug_options_sent).map(([letter, data]: [string, any]) => (
                  <div key={letter} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="font-bold text-gray-700 mb-2">Option {letter}</div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Raw (from input):</span>
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap bg-white p-2 rounded mt-1 border">{data.raw}</pre>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Sanitized (sent to LLM):</span>
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap bg-white p-2 rounded mt-1 border">{data.sanitized}</pre>
                      </div>
                      {data.raw !== data.sanitized && (
                        <div className="text-xs text-red-600 font-medium">⚠ Newlines were removed during sanitization</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* Layer 6: Debug — LLM Reasoning Trace         */}
        {/* ============================================ */}
        {(analysis as any)._reasoning_trace && (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-orange-300 mb-6 overflow-hidden">
            <button
              onClick={() => toggleLayer(6)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-orange-50 transition-colors"
            >
              <h2 className="text-xl font-bold text-orange-700">🧠 Debug: LLM Reasoning Trace</h2>
              <svg
                className={`w-6 h-6 text-orange-500 transition-transform duration-300 ${expandedLayers[6] ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedLayers[6] && (
              <div className="px-6 pb-6 space-y-4 border-t border-orange-200 pt-4">

                {/* Gap isolation */}
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="text-xs font-bold text-yellow-700 uppercase mb-2">Step 3: Gap Isolated</div>
                  <p className="text-gray-800 text-sm">{(analysis as any)._reasoning_trace.step3_gap_isolated}</p>
                </div>

                {/* Elimination trace */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase">Step 5: Option Elimination</div>
                  {(analysis as any)._reasoning_trace.step5_elimination?.map((item: any) => (
                    <div
                      key={item.option}
                      className={`p-3 rounded-lg border text-sm ${
                        item.verdict === 'keep'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className={`font-bold mr-2 ${item.verdict === 'keep' ? 'text-green-700' : 'text-gray-500'}`}>
                        {item.option}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded mr-2 ${
                        item.verdict === 'keep'
                          ? 'bg-green-200 text-green-800'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {item.verdict}
                      </span>
                      <span className="text-gray-700">{item.because}</span>
                    </div>
                  ))}
                </div>

                {/* Final choice reasoning */}
                {(analysis as any)._reasoning_trace.step5_final_choice && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-xs font-bold text-blue-700 uppercase mb-2">Final Decision</div>
                    <p className="text-gray-800 text-sm">{(analysis as any)._reasoning_trace.step5_final_choice}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
