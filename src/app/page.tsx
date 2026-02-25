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
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      textarea?.focus();
    }, 50);
  };

  const handleSubmit = async () => {
    if (!argument.trim()) {
      alert('Please paste the question text');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const requestBody = {
        text: argument,
        mode: 'exam',
      };

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to extract data');
      }

      const result = await response.json();

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
    setSubmitError('');
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="max-w-[1120px] mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-3">
            LogiClue
          </h1>
          <p className="text-slate-600 text-base sm:text-lg lg:text-xl">
            Understand where your logical reasoning went wrong
          </p>
        </div>
      </section>

      {/* Main Input Card */}
      <section className="px-4 sm:px-6 lg:px-8 pb-14">
        <div className="max-w-[1120px] mx-auto">
          <div className="bg-white rounded-[28px] border border-slate-200 shadow-[0_12px_32px_rgba(15,23,42,0.06)] p-6 sm:p-7 lg:p-8">
            <label className="block text-xl font-semibold text-slate-900 mb-4">
              Your Question
            </label>

            <textarea
              value={argument}
              onChange={(e) => setArgument(e.target.value)}
              placeholder="Paste the full question here: description, question stem, and all answer choices..."
              className="w-full min-h-[340px] p-5 bg-slate-50 border-2 border-slate-300 rounded-2xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 focus:bg-white resize-y text-base leading-relaxed text-slate-900 placeholder:text-slate-400 transition-all duration-200"
            />

            <p className="text-sm text-slate-500 mt-3">
              💡 Include the complete question with all context and answer options
            </p>

            <p className="text-slate-400 text-xs sm:text-sm mt-4 leading-relaxed">
              Please describe in your own words. Do not paste copyrighted text. Users are solely responsible for their own inputs.
            </p>

            <div className="flex flex-wrap gap-3 justify-between items-center mt-6">
              <button
                onClick={handleTryExample}
                disabled={isSubmitting}
                className="px-5 py-2.5 border-2 border-slate-300 bg-white text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                Try Example
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleClear}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-slate-600 hover:text-slate-900 transition-colors duration-200 disabled:opacity-40 font-medium text-sm"
                >
                  Clear
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !argument.trim()}
                  className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl px-7 py-2.5 text-base font-semibold shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 min-w-[130px]"
                >
                  {isSubmitting ? (
                    <>
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
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
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
              <p className="text-red-500 text-sm text-right mt-3">{submitError}</p>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <div className="w-full bg-slate-900 py-20 px-6 sm:px-8 lg:px-12">
  <div className="max-w-[1280px] mx-auto">
    <h2 className="text-white font-bold text-5xl text-center mb-4 tracking-tight">
      What You'll Get
    </h2>
    <p className="text-slate-300 text-center text-xl mb-14">
      Clear, practical feedback to improve your reasoning
    </p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Card 1 */}
      <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-200 min-h-[320px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6 text-3xl">
          🧩
        </div>
        <h3 className="text-slate-900 text-2xl font-bold mb-4">Argument Structure</h3>
        <p className="text-slate-600 text-base leading-8">
          Visual breakdown of premises, conclusion, and logical gaps
        </p>
      </div>

      {/* Card 2 */}
      <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-200 min-h-[320px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6 text-3xl">
          🔀
        </div>
        <h3 className="text-slate-900 text-2xl font-bold mb-4">Fork Point Analysis</h3>
        <p className="text-slate-600 text-base leading-8">
          See where your reasoning split from the correct path, and why
        </p>
      </div>

      {/* Card 3 */}
      <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-200 min-h-[320px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6 text-3xl">
          🎯
        </div>
        <h3 className="text-slate-900 text-2xl font-bold mb-4">Skill Takeaway</h3>
        <p className="text-slate-600 text-base leading-8">
          Get one targeted insight you can apply on your next question
        </p>
      </div>
    </div>
   </div>
 </div>
</main>
);
}