'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EXAMPLE_QUESTION = `Description:
A city council member argues that the new late-night bus route should be canceled because ridership has been low during its first month. However, a transit planner notes that the route was launched during a university holiday, when many regular riders were out of town. Therefore, the planner concludes that the current ridership numbers do not provide a reliable basis for deciding whether to cancel the route.

Question:
Which one of the following, if true, most strengthens the transit planner's conclusion?

Choices:
(A) The city has recently increased parking fees in the downtown area.
(B) The late-night bus route costs less to operate than several older routes.
(C) Ridership on other bus routes also tends to drop during university holidays.
(D) Some city council members have opposed public transit expansion for years.
(E) The late-night bus route serves several neighborhoods with low car ownership.`;

export default function Home() {
  const router = useRouter();
  const [argument, setArgument] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleTryExample = () => {
    setArgument(EXAMPLE_QUESTION);
    // Focus textarea after a brief delay to ensure state update
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      textarea?.focus();
    }, 50);
  };

  const handleSubmit = async () => {
    // Validation
    if (!argument.trim()) {
      alert('Please paste the question text');
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
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="w-full">
        {/* Header */}
        <div className="text-center pt-16 pb-10 px-4">
          <h1 className="text-6xl font-bold text-slate-900 tracking-tight mb-3">LogiClue</h1>
          <p className="text-slate-600 text-xl">
            Understand where your logical reasoning went wrong
          </p>
        </div>

        {/* Hero Input Area */}
        <div className="w-full max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 pb-16">
          <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-10 lg:p-12 transition-shadow hover:shadow-xl">
            <div>
              <label className="block text-2xl font-semibold text-slate-900 mb-5">
                Your Question
              </label>
              <textarea
                value={argument}
                onChange={(e) => setArgument(e.target.value)}
                placeholder="Paste the full question here: description, question stem, and all answer choices..."
                className="w-full min-h-[440px] p-6 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white resize-y text-lg leading-relaxed text-slate-900 placeholder:text-slate-400 transition-all duration-200"
              />
              <p className="text-base text-slate-500 mt-4">
                💡 Include the complete question with all context and answer options
              </p>
            </div>

            {/* Disclaimer */}
            <p className="text-slate-400 text-sm mt-6 leading-relaxed">
              Please describe in your own words. Do not paste copyrighted text. Users are solely responsible for their own inputs.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-4 justify-between items-center mt-8">
              <button
                onClick={handleTryExample}
                disabled={isSubmitting}
                className="px-7 py-3.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 hover:shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-base"
              >
                Try Example
              </button>
              
              <div className="flex gap-4">
                <button
                  onClick={handleClear}
                  disabled={isSubmitting}
                  className="px-7 py-3.5 text-slate-600 hover:text-slate-900 transition-colors duration-200 disabled:opacity-40 font-medium text-base"
                >
                  Clear
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !argument.trim()}
                  className="bg-teal-600 hover:bg-teal-700 hover:shadow-lg hover:-translate-y-0.5 text-white rounded-xl px-10 py-3.5 text-lg font-semibold shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 min-w-[160px]"
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
            </div>
            
            {submitError && (
              <p className="text-red-500 text-base text-right mt-3">{submitError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Features Section - Natural Flow Below Hero */}
      <div className="w-full bg-white border-t border-slate-200 py-20 px-6 sm:px-8 lg:px-12">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="text-slate-700 font-semibold text-sm text-center mb-12 tracking-wide uppercase">
            What you'll get
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">
            {/* Feature 1 */}
            <div className="group text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-50 rounded-2xl text-3xl mb-5 transition-all duration-200 group-hover:bg-teal-100 group-hover:scale-110">
                🧩
              </div>
              <h3 className="font-semibold text-slate-900 text-xl mb-3">
                Argument Structure
              </h3>
              <p className="text-slate-600 text-base leading-relaxed">
                Visual breakdown of premises, conclusion, and logical gaps
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-50 rounded-2xl text-3xl mb-5 transition-all duration-200 group-hover:bg-teal-100 group-hover:scale-110">
                🔀
              </div>
              <h3 className="font-semibold text-slate-900 text-xl mb-3">
                Fork Point Analysis
              </h3>
              <p className="text-slate-600 text-base leading-relaxed">
                Where and why your reasoning diverged from the correct path
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-50 rounded-2xl text-3xl mb-5 transition-all duration-200 group-hover:bg-teal-100 group-hover:scale-110">
                🎯
              </div>
              <h3 className="font-semibold text-slate-900 text-xl mb-3">
                Skill Takeaway
              </h3>
              <p className="text-slate-600 text-base leading-relaxed">
                One targeted insight to improve your logical reasoning
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
