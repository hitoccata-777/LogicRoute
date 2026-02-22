'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InputPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Main fields
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const [answerChoices, setAnswerChoices] = useState('');
  const [userChoice, setUserChoice] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [hesitatedChoice, setHesitatedChoice] = useState('');
  const [hesitationReason, setHesitationReason] = useState('');
  const [hesitationReasonText, setHesitationReasonText] = useState('');
  const [difficulty, setDifficulty] = useState<number>(0);

  useEffect(() => {
    // Parse questionText from sessionStorage
    const questionText = sessionStorage.getItem('questionText');
    if (questionText) {
      parseQuestionText(questionText);
    }

    // Also check for extractedData (from API)
    const raw = sessionStorage.getItem('extractedData');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        console.log('extractedData:', data);
        
        if (data.stimulus) {
          setDescription(data.stimulus);
        }
        if (data.questionStem) {
          setQuestion(data.questionStem);
        }
        if (data.options) {
          // Convert options object to text format
          const optionsText = Object.entries(data.options)
            .map(([key, value]) => `(${key}) ${value}`)
            .join('\n');
          setAnswerChoices(optionsText);
        }
        
        sessionStorage.removeItem('extractedData');
      } catch (e) {
        console.error('Failed to parse extractedData', e);
      }
    }
  }, []);

  const parseQuestionText = (text: string) => {
    // Find answer choices by pattern: (A), (B), etc. or A., B., etc.
    const optionPattern = /\(([A-E])\)|^([A-E])\./gm;
    const matches = [...text.matchAll(optionPattern)];
    
    if (matches.length > 0) {
      // Find the first option position
      const firstOptionIndex = matches[0].index || 0;
      
      // Everything before options
      const beforeOptions = text.substring(0, firstOptionIndex).trim();
      
      // Find question (sentence ending with ?)
      const questionMatch = beforeOptions.match(/[^.!?]*\?[^.!?]*/g);
      const lastQuestion = questionMatch ? questionMatch[questionMatch.length - 1].trim() : '';
      
      if (lastQuestion) {
        // Description is everything before the question
        const questionIndex = beforeOptions.lastIndexOf(lastQuestion);
        const desc = beforeOptions.substring(0, questionIndex).trim();
        setDescription(desc);
        setQuestion(lastQuestion);
      } else {
        // No question found, treat all as description
        setDescription(beforeOptions);
      }
      
      // Extract answer choices
      const optionsText = text.substring(firstOptionIndex).trim();
      setAnswerChoices(optionsText);
    } else {
      // No options found, treat as description
      setDescription(text);
    }
  };

  const handleClear = () => {
    setDescription('');
    setQuestion('');
    setAnswerChoices('');
    setUserChoice('');
    setCorrectAnswer('');
    setHesitatedChoice('');
    setHesitationReason('');
    setHesitationReasonText('');
    setDifficulty(0);
  };

  const handleSubmit = async () => {
    // Validation
    if (!description.trim() || !question.trim()) {
      alert('Please fill in Description and Question');
      return;
    }
    if (!userChoice) {
      alert('Please select your answer');
      return;
    }

    // Get or create userId
    let userId = localStorage.getItem('logiclue_user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('logiclue_user_id', userId);
    }
    sessionStorage.setItem('currentUserId', userId);

    setIsLoading(true);

    try {
      // Parse answer choices into options object
      const options: { [key: string]: string } = {};
      const lines = answerChoices.split('\n');
      lines.forEach(line => {
        const match = line.match(/\(([A-E])\)\s*(.+)|^([A-E])[.)\s]+(.+)/);
        if (match) {
          const letter = match[1] || match[3];
          const text = match[2] || match[4];
          if (letter && text) {
            options[letter] = text.trim();
          }
        }
      });

      const requestBody = {
        stimulus: description,
        questionStem: question,
        options,
        userChoice,
        correctAnswer: correctAnswer || undefined,
        hesitatedChoice: hesitatedChoice || undefined,
        hesitationReason: hesitationReason || undefined,
        hesitationReasonText: hesitationReasonText || undefined,
        userDifficulty: difficulty || undefined,
        userId,
        mode: 'exam'
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success) {
        sessionStorage.setItem('analysisResult', JSON.stringify(result.data));
        sessionStorage.setItem('inputData', JSON.stringify({
          description,
          question,
          answerChoices,
          userChoice,
          correctAnswer,
          hesitatedChoice,
          hesitationReason,
          hesitationReasonText,
          difficulty,
          mode: 'exam'
        }));
        router.push('/result');
      } else {
        alert('Analysis failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to connect to server');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Review Your Answer</h1>
          <p className="text-slate-600 text-base">Edit the question details and tell us about your thinking</p>
        </div>

        {/* Question Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Question</h2>
          
          <div className="space-y-5">
            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="The passage or context..."
                className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y text-slate-900"
              />
            </div>

            {/* Question */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="The question being asked..."
                className="w-full min-h-[80px] p-4 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y text-slate-900"
              />
            </div>

            {/* Answer Choices */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Answer Choices
              </label>
              <textarea
                value={answerChoices}
                onChange={(e) => setAnswerChoices(e.target.value)}
                placeholder="(A) First option&#10;(B) Second option&#10;(C) Third option&#10;(D) Fourth option&#10;(E) Fifth option"
                className="w-full min-h-[140px] p-4 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y text-slate-900 font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Format: (A) option text, one per line
              </p>
            </div>
          </div>
        </div>

        {/* Your Response Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Your Response</h2>
          
          <div className="space-y-6">
            {/* Your Answer */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Your Answer <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setUserChoice(letter)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                      userChoice === letter
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-600 hover:border-teal-400'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            {/* Correct Answer */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Correct Answer <span className="text-slate-400 text-xs font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {['A', 'B', 'C', 'D', 'E', 'Unknown'].map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setCorrectAnswer(letter === 'Unknown' ? '' : letter)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                      (letter === 'Unknown' && !correctAnswer) || correctAnswer === letter
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-600 hover:border-teal-400'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            {/* Hesitated Between */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Hesitated Between <span className="text-slate-400 text-xs font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {['A', 'B', 'C', 'D', 'E', 'None'].map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setHesitatedChoice(letter === 'None' ? '' : letter)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                      (letter === 'None' && !hesitatedChoice) || hesitatedChoice === letter
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-600 hover:border-teal-400'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            {/* Hesitation Reason */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Hesitation Reason <span className="text-slate-400 text-xs font-normal">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Both seem right',
                  'Both seem wrong',
                  'Didn\'t understand',
                  'Ran out of time',
                  'Logic confusing',
                  'Other'
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setHesitationReason(reason)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all text-left ${
                      hesitationReason === reason
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-600 hover:border-teal-400'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Other Reason Text */}
            {hesitationReason === 'Other' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Please specify
                </label>
                <input
                  type="text"
                  value={hesitationReasonText}
                  onChange={(e) => setHesitationReasonText(e.target.value)}
                  placeholder="Describe your hesitation..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-900"
                />
              </div>
            )}

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Difficulty
              </label>
              <div className="flex gap-2 items-center">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setDifficulty(num)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      difficulty >= num
                        ? 'text-yellow-500'
                        : 'text-slate-300 hover:text-yellow-400'
                    }`}
                  >
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 border-2 border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors font-medium"
          >
            Back
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-2.5 text-slate-500 hover:text-slate-700 transition-colors font-medium"
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !description.trim() || !question.trim() || !userChoice}
            className="px-8 py-2.5 bg-teal-600 text-white text-base font-medium rounded-xl hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isLoading && (
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            {isLoading ? 'Analyzing...' : 'Analyze My Thinking'}
          </button>
        </div>
      </div>
    </main>
  );
}
