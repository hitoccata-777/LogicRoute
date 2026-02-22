'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [argument, setArgument] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // TODO: Process image with OCR if needed
      alert('Image upload feature coming soon!');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!argument.trim()) {
      alert('Please paste the argument text');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      // Prepare request body
      const requestBody = {
        text: argument,
        mode: 'exam'
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
      sessionStorage.setItem('inputMode', 'exam');
      sessionStorage.setItem('extractedData', JSON.stringify(result));
      sessionStorage.setItem('questionText', argument);

      router.push('/input');
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setArgument('');
    setImageFile(null);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-center py-12 max-w-3xl mx-auto px-4">
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">LogiClue</h1>
        <p className="text-gray-600 text-lg mt-4">
          Understand where your logical reasoning went wrong
        </p>
      </div>

      {/* Main Input Section */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* The Argument */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              The Argument
            </label>
            <textarea
              value={argument}
              onChange={(e) => setArgument(e.target.value)}
              placeholder="Paste the full question here: stimulus, question stem, and all answer choices (A-E)..."
              className="w-full min-h-[300px] p-4 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y text-base text-gray-900 placeholder:text-gray-400 transition-all"
            />
            <p className="text-sm text-gray-500 mt-2">
              💡 Paste the complete question including all context and answer options
            </p>
          </div>

          {/* Image Upload (Small, Secondary) */}
          <div className="mt-6">
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
            {imageFile && (
              <span className="ml-3 text-sm text-gray-600">
                {imageFile.name}
              </span>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-gray-400 text-xs mt-6 text-center">
            Please describe in your own words. Do not paste copyrighted text. Users are solely responsible for their own inputs.
          </p>

          {/* Buttons */}
          <div className="flex gap-3 justify-end mt-8">
            <button
              onClick={handleClear}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-gray-600 hover:text-gray-900 text-base transition-colors disabled:opacity-40"
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !argument.trim()}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-8 py-2.5 text-base font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-w-[140px]"
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
                'Analyze'
              )}
            </button>
          </div>
          
          {submitError && (
            <p className="text-red-500 text-sm text-right mt-2">{submitError}</p>
          )}
        </div>
      </div>

      {/* What You'll Get Section */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-gray-700 font-semibold text-sm text-center mb-6 tracking-widest uppercase">
          What you'll get
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 text-center">
            <div className="text-4xl mb-3">🧩</div>
            <h3 className="font-semibold text-gray-900 text-base mb-2">Argument Structure</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Visual breakdown of premises, conclusion, and logical gaps
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 text-center">
            <div className="text-4xl mb-3">🔀</div>
            <h3 className="font-semibold text-gray-900 text-base mb-2">Fork Point Analysis</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Exactly where and why your reasoning diverged from the correct path
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="font-semibold text-gray-900 text-base mb-2">Skill Takeaway</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              One targeted insight to improve your logical reasoning
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
