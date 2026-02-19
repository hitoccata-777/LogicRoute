'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [text, setText] = useState('');
  const router = useRouter();

  const handleAnalyze = () => {
    if (text) {
      sessionStorage.setItem('questionText', text);
      router.push('/input');
    }
  };

  const handleClear = () => {
    setText('');
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">MagiClue</h1>
          <p className="text-gray-600">Understand why your thinking diverged — not just that you got it wrong</p>
          <p className="text-sm text-gray-500 mt-2">Works for any argument — exams, essays, debates, everyday reasoning</p>
        </div>

        {/* Input Area */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the argument in your own words — what was the conclusion, what evidence was given, and why did you think your answer made sense?"
            className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
          />

          <p className="mt-2 text-xs text-gray-500">
            Please describe in your own words. Do not paste copyrighted text. Users are solely responsible for their own inputs.
          </p>

          {/* Buttons */}
          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!text}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Analyze
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
