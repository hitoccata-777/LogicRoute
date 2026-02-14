'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ParsedQuestion {
  stimulus: string;
  question_stem: string;
  options: { [key: string]: string };
}

export default function InputPage() {
  const router = useRouter();
  const [parsedQuestion, setParsedQuestion] = useState<ParsedQuestion | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  // User inputs
  const [sourceId, setSourceId] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [yourChoice, setYourChoice] = useState('');
  const [hesitatedChoice, setHesitatedChoice] = useState('');
  const [hesitationReason, setHesitationReason] = useState('');
  const [altRationaleText, setAltRationaleText] = useState('');
  const [difficulty, setDifficulty] = useState<number>(0);

  useEffect(() => {
    // Get questionText from sessionStorage
    const questionText = sessionStorage.getItem('questionText');
    if (questionText) {
      const parsed = parseQuestion(questionText);
      setParsedQuestion(parsed);
    }
  }, []);

  const parseQuestion = (text: string): ParsedQuestion => {
    const options: { [key: string]: string } = {};
    
    // Find all option markers: (A), (B), etc. or A., B., etc.
    const optionPattern = /(?:\(([A-E])\)|([A-E])\.)\s*/g;
    const optionMatches: Array<{ letter: string; index: number }> = [];
    let match;

    while ((match = optionPattern.exec(text)) !== null) {
      const letter = match[1] || match[2];
      optionMatches.push({ letter, index: match.index });
    }

    // Extract option text between markers
    optionMatches.forEach((opt, idx) => {
      const startIndex = opt.index;
      const endIndex = idx < optionMatches.length - 1 
        ? optionMatches[idx + 1].index 
        : text.length;
      
      // Extract text after the marker (A), (B), etc. or A., B., etc.
      const optionText = text.substring(startIndex, endIndex);
      // Remove the marker itself
      const cleanedText = optionText.replace(/^[\(]?[A-E][\)\.]\s*/, '').trim();
      options[opt.letter] = cleanedText;
    });

    // Find question stem - sentence ending with ? or : right before first option
    const firstOptionIndex = optionMatches.length > 0 ? optionMatches[0].index : text.length;
    const textBeforeOptions = text.substring(0, firstOptionIndex).trim();
    
    // Find the last sentence ending with ? or :
    let question_stem = '';
    let stimulus = '';
    
    // Try to find sentence ending with ? or :
    const questionEndMatch = textBeforeOptions.match(/(.+?[?:])\s*$/);
    if (questionEndMatch) {
      question_stem = questionEndMatch[1].trim();
      const stemIndex = textBeforeOptions.lastIndexOf(question_stem);
      stimulus = textBeforeOptions.substring(0, stemIndex).trim();
    } else {
      // Fallback: if no ? or : found, try to split by sentences
      const sentences = textBeforeOptions.split(/(?<=[.!?])\s+/);
      if (sentences.length > 1) {
        question_stem = sentences[sentences.length - 1].trim();
        stimulus = sentences.slice(0, -1).join(' ').trim();
      } else {
        // If only one sentence, treat it as question stem
        question_stem = textBeforeOptions;
        stimulus = '';
      }
    }

    return {
      stimulus: stimulus || '',
      question_stem: question_stem || textBeforeOptions,
      options
    };
  };

  const handleEdit = (section: string, currentValue: string) => {
    setEditingSection(section);
    setEditValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (!parsedQuestion || !editingSection) return;

    const updated = { ...parsedQuestion };
    
    if (editingSection === 'stimulus') {
      updated.stimulus = editValue;
    } else if (editingSection === 'question_stem') {
      updated.question_stem = editValue;
    } else if (editingSection.startsWith('option_')) {
      const letter = editingSection.replace('option_', '');
      updated.options[letter] = editValue;
    }

    setParsedQuestion(updated);
    setEditingSection(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditValue('');
  };

  const handleClear = () => {
    setSourceId('');
    setCorrectAnswer('');
    setYourChoice('');
    setHesitatedChoice('');
    setHesitationReason('');
    setAltRationaleText('');
    setDifficulty(0);
  };

  const handleSubmit = () => {
    if (!yourChoice) {
      alert('Please select your choice');
      return;
    }

    // Store all data in sessionStorage
    const inputData = {
      parsedQuestion,
      sourceId,
      correctAnswer,
      yourChoice,
      hesitatedChoice,
      hesitationReason,
      altRationaleText,
      difficulty
    };

    sessionStorage.setItem('inputData', JSON.stringify(inputData));
    router.push('/result');
  };

  if (!parsedQuestion) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
          <p className="text-gray-600">No question found. Please go back and enter a question.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Home
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
          <h1 className="text-3xl font-bold text-indigo-600 mb-2">Review Question</h1>
          <p className="text-gray-600">Review the parsed question and provide your input</p>
        </div>

        {/* Parsed Content Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 space-y-6">
          {/* Stimulus */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase">Stimulus</h2>
              {editingSection !== 'stimulus' && (
                <button
                  onClick={() => handleEdit('stimulus', parsedQuestion.stimulus)}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  Edit
                </button>
              )}
            </div>
            {editingSection === 'stimulus' ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full min-h-[100px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 p-4 rounded-lg text-gray-800 whitespace-pre-wrap">
                {parsedQuestion.stimulus || <span className="text-gray-400 italic">No stimulus found</span>}
              </div>
            )}
          </div>

          {/* Question Stem */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase">Question Stem</h2>
              {editingSection !== 'question_stem' && (
                <button
                  onClick={() => handleEdit('question_stem', parsedQuestion.question_stem)}
                  className="text-xs text-indigo-600 hover:text-indigo-700"
                >
                  Edit
                </button>
              )}
            </div>
            {editingSection === 'question_stem' ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full min-h-[60px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-indigo-50 p-4 rounded-lg text-gray-800 border-l-4 border-indigo-600">
                {parsedQuestion.question_stem || <span className="text-gray-400 italic">No question stem found</span>}
              </div>
            )}
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase">Options</h2>
            </div>
            <div className="space-y-3">
              {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                <div key={letter}>
                  {editingSection === `option_${letter}` ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-700 w-6">{letter}.</span>
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 min-h-[50px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex gap-2 ml-8">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-gray-700 w-6">{letter}.</span>
                      <div className="flex-1 bg-white p-3 rounded-lg border border-gray-200 text-gray-800">
                        {parsedQuestion.options[letter] || <span className="text-gray-400 italic">No option {letter} found</span>}
                      </div>
                      <button
                        onClick={() => handleEdit(`option_${letter}`, parsedQuestion.options[letter] || '')}
                        className="text-xs text-indigo-600 hover:text-indigo-700 ml-2"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Your Input</h2>
          
          <div className="space-y-4">
            {/* Source ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source ID <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder="PT147-S1-Q21"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Correct Answer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Answer <span className="text-gray-400">(optional)</span>
              </label>
              <select
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
            </div>

            {/* Your Choice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Choice <span className="text-red-500">*</span>
              </label>
              <select
                value={yourChoice}
                onChange={(e) => setYourChoice(e.target.value)}
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
            </div>

            {/* Hesitated Choice */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hesitated Choice <span className="text-gray-400">(optional)</span>
              </label>
              <select
                value={hesitatedChoice}
                onChange={(e) => setHesitatedChoice(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
            </div>

            {/* Hesitation Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hesitation Reason <span className="text-gray-400">(optional)</span>
              </label>
              <select
                value={hesitationReason}
                onChange={(e) => setHesitationReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="Both seem right">Both seem right</option>
                <option value="Both seem wrong">Both seem wrong</option>
                <option value="Didn't understand the question">Didn't understand the question</option>
                <option value="Didn't understand the passage">Didn't understand the passage</option>
                <option value="Ran out of time">Ran out of time</option>
                <option value="Logic was confusing">Logic was confusing</option>
                <option value="Other">Other</option>
              </select>
              {hesitationReason === 'Other' && (
                <input
                  type="text"
                  value={altRationaleText}
                  onChange={(e) => setAltRationaleText(e.target.value)}
                  placeholder="Please describe..."
                  className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              )}
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setDifficulty(star)}
                    className="text-2xl focus:outline-none"
                  >
                    {star <= difficulty ? (
                      <span className="text-yellow-400">★</span>
                    ) : (
                      <span className="text-gray-300">★</span>
                    )}
                  </button>
                ))}
                {difficulty > 0 && (
                  <span className="ml-2 text-sm text-gray-600">{difficulty}/5</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-2 text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Submit
          </button>
      </div>
    </div>
    </main>
  );
}
