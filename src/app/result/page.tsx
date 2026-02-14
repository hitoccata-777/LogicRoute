'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResultPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<any>(null);
  const [expandedLayers, setExpandedLayers] = useState<{ [key: number]: boolean }>({
    2: false,
    3: false,
    4: false
  });

  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResult');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAnalysis(parsed);
        
        // Save attempt after analysis is loaded
        if (parsed.questionId) {
          saveAttempt(parsed);
        }
      } catch (e) {
        console.error('Failed to parse analysis result', e);
      }
    }
  }, []);

  const saveAttempt = async (analysisData: any) => {
    // Get userId from sessionStorage first, then localStorage
    let userId = sessionStorage.getItem('currentUserId') || localStorage.getItem('logiclue_user_id');
    
    if (!userId) {
      console.warn('No userId found, skipping attempt save');
      return;
    }

    // Get input data from sessionStorage
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

  // Helper function to render diagram content flexibly
  const renderDiagram = () => {
    if (!analysis.diagram?.content) {
      return <p className="text-gray-500 italic">No diagram available</p>;
    }

    const content = analysis.diagram.content;
    
    // If content has a description field (from API)
    if (content.description) {
      return (
        <div className="text-sm text-gray-700 whitespace-pre-wrap">
          {content.description}
        </div>
      );
    }
    
    // If content has structured fields (like joannaClaim, ruthResponse, etc.)
    return (
      <div className="space-y-2 text-sm">
        {content.joannaClaim && (
          <div className="flex items-start gap-2">
            <span className="font-semibold text-indigo-600">Joanna:</span>
            <span className="text-gray-700">{content.joannaClaim}</span>
          </div>
        )}
        {content.ruthResponse && (
          <div className="flex items-start gap-2">
            <span className="font-semibold text-indigo-600">Ruth:</span>
            <span className="text-gray-700">{content.ruthResponse}</span>
          </div>
        )}
        {content.technique && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <span className="font-semibold text-indigo-600">Technique: </span>
            <span className="text-gray-700">{content.technique}</span>
          </div>
        )}
        {/* Fallback: render all other fields */}
        {Object.entries(content).map(([key, value]) => {
          if (!['joannaClaim', 'ruthResponse', 'technique'].includes(key)) {
            return (
              <div key={key} className="flex items-start gap-2">
                <span className="font-semibold text-indigo-600 capitalize">{key}:</span>
                <span className="text-gray-700">{String(value)}</span>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
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
              {analysis.isCorrect ? 'Correct' : 'Incorrect'}
            </div>

            {/* Choice display */}
            <div className="flex gap-4 text-lg">
              <div>
                <span className="text-gray-600">You chose: </span>
                <span className="font-semibold text-gray-900">{analysis.userChoice}</span>
              </div>
              {analysis.correctAnswer && (
                <div>
                  <span className="text-gray-600">Correct answer: </span>
                  <span className="font-semibold text-gray-900">{analysis.correctAnswer}</span>
                </div>
              )}
            </div>

            {/* One-line diagnosis */}
            <div className="text-gray-700 text-lg max-w-2xl">
              {analysis.userChoiceFeedback.diagnosis}
            </div>

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
            <div className="px-6 pb-6 space-y-4 border-t border-gray-200">
              {/* Diagram */}
              {analysis.diagram && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
                    {analysis.diagram.type ? analysis.diagram.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Argument Structure'}
                  </h3>
                  {renderDiagram()}
                </div>
              )}

              {/* Why correct answer is correct */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Why {analysis.correctAnswer} is Correct</h3>
                <p className="text-gray-600 mb-2">
                  <span className="font-medium">{analysis.correctAnswerExplanation.brief}</span>
                </p>
                <p className="text-gray-700">{analysis.correctAnswerExplanation.whyCorrect}</p>
              </div>
            </div>
          )}
        </div>

        {/* Layer 3: All Options (Expandable) */}
        <div className="bg-white rounded-lg shadow-md mb-4 overflow-hidden transition-all duration-300">
          <button
            onClick={() => toggleLayer(3)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">All Options</h2>
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
            <div className="px-6 pb-6 space-y-3 border-t border-gray-200">
              {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                const option = analysis.allOptions[letter];
                const isUserChoice = letter === analysis.userChoice;
                const isCorrect = option?.isCorrect || false;
                
                return (
                  <div
                    key={letter}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isUserChoice
                        ? 'border-indigo-500 bg-indigo-50'
                        : isCorrect
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`text-lg font-bold ${
                        isCorrect ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isCorrect ? '✓' : '✗'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{letter}.</span>
                          <span className="text-gray-700">{option?.brief}</span>
                          {isUserChoice && (
                            <span className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">
                              Your Choice
                            </span>
                          )}
                        </div>
                        {option?.errorType && !isCorrect && (
                          <div className="mt-2">
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                              {option.errorType}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Layer 4: Key Takeaway (Expandable) */}
        <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden transition-all duration-300">
          <button
            onClick={() => toggleLayer(4)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900">Key Takeaway</h2>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${expandedLayers[4] ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedLayers[4] && (
            <div className="px-6 pb-6 space-y-4 border-t border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase">Skill Point</h3>
                <p className="text-gray-700">{analysis.skillPoint}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase">Takeaway</h3>
                <p className="text-gray-700">{analysis.takeaway}</p>
              </div>
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
