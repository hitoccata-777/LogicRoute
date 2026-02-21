'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Voice Input Component
function VoiceInput({ onTranscript, textareaRef }: { onTranscript: (text: string) => void; textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          onTranscript(transcript);
          setIsRecording(false);
        };

        recognitionRef.current.onerror = () => {
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, [onTranscript]);

  const handleClick = () => {
    if (!isSupported || !recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`p-2 rounded-full transition-colors ${
        isRecording
          ? 'bg-red-400 text-white'
          : 'bg-[#F0F7F4] text-[#2D9D78] hover:bg-[#E0F0EA]'
      }`}
      title={isRecording ? 'Stop recording' : 'Start voice input'}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    </button>
  );
}

export default function InputPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'argument' | 'writing'>('argument');
  const [isLoading, setIsLoading] = useState(false);

  // Argument mode fields
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const [userAnswerDescription, setUserAnswerDescription] = useState('');
  const [userReasoning, setUserReasoning] = useState('');
  const [difficulty, setDifficulty] = useState<number>(0);

  // Writing mode fields
  const [argumentText, setArgumentText] = useState('');
  const [unsurePart, setUnsurePart] = useState('');
  const [issueThought, setIssueThought] = useState('');

  // Refs for textareas
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const userAnswerRef = useRef<HTMLTextAreaElement>(null);
  const userReasoningRef = useRef<HTMLTextAreaElement>(null);
  const argumentTextRef = useRef<HTMLTextAreaElement>(null);
  const unsurePartRef = useRef<HTMLTextAreaElement>(null);
  const issueThoughtRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Get mode from sessionStorage, default to 'argument'
    const storedMode = sessionStorage.getItem('inputMode') as 'argument' | 'writing' | null;
    if (storedMode === 'argument' || storedMode === 'writing') {
      setMode(storedMode);
    }

    // Check for extracted data from landing page
    const raw = sessionStorage.getItem('extractedData');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        console.log('extractedData:', data);
        
        // Pre-fill fields based on extracted data
        if (data.description) {
          setDescription(data.description);
        }
        if (data.questionStem) {
          setQuestion(data.questionStem);
        }
        if (data.userReasoning) {
          setUserAnswerDescription(data.userReasoning);
        }
        
        // Clear extractedData after reading
        sessionStorage.removeItem('extractedData');
      } catch (e) {
        console.error('Failed to parse extractedData', e);
      }
    } else {
      // Fallback: Try to get any existing data from sessionStorage (old flow)
      const questionText = sessionStorage.getItem('questionText');
      if (questionText && storedMode === 'argument') {
        setDescription(questionText);
      }
    }
  }, []);


  const handleClear = () => {
    if (mode === 'argument') {
      setDescription('');
      setQuestion('');
      setUserAnswerDescription('');
      setUserReasoning('');
      setDifficulty(0);
    } else {
      setArgumentText('');
      setUnsurePart('');
      setIssueThought('');
    }
  };

  const handleSubmit = async () => {
    // Get or create userId
    let userId = localStorage.getItem('logiclue_user_id');
    if (!userId) {
      userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('logiclue_user_id', userId);
    }
    sessionStorage.setItem('currentUserId', userId);

    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: mode === 'argument' ? description : argumentText,
          question: mode === 'argument' ? question : '',
          userAnswerDescription: mode === 'argument' ? userAnswerDescription : unsurePart,
          userReasoning: mode === 'argument' ? userReasoning : issueThought,
          userDifficulty: mode === 'argument' ? (difficulty || undefined) : undefined,
          userId: userId,
          sourceId: undefined,
          mode: mode
        }),
      });

      const result = await response.json();

      if (result.success) {
        sessionStorage.setItem('analysisResult', JSON.stringify(result.data));
        // Store input data for reference
        const inputData = mode === 'argument'
          ? { description, question, userAnswerDescription, userReasoning, difficulty, mode }
          : { argumentText, unsurePart, issueThought, mode };
        sessionStorage.setItem('inputData', JSON.stringify(inputData));
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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#1B4D3E] mb-2">Analyze Your Thinking</h1>
          <p className="text-gray-500 text-base">Describe the argument and what went wrong</p>
        </div>

        {mode === 'argument' ? (
          <>
            {/* Argument Mode - Upper Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1B4D3E] mb-6">The Argument</h2>
              
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      ref={descriptionRef}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the argument or passage..."
                      className="flex-1 min-h-[120px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y"
                    />
                    <div className="flex items-start pt-2">
                      <VoiceInput
                        onTranscript={(text) => {
                          setDescription(prev => prev ? `${prev} ${text}` : text);
                        }}
                        textareaRef={descriptionRef}
                      />
                    </div>
                  </div>
                </div>

                {/* Question */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    The Question
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      ref={questionRef}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="What was the question asking?"
                      className="flex-1 min-h-[80px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y"
                    />
                    <div className="flex items-start pt-2">
                      <VoiceInput
                        onTranscript={(text) => {
                          setQuestion(prev => prev ? `${prev} ${text}` : text);
                        }}
                        textareaRef={questionRef}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Argument Mode - Lower Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1B4D3E] mb-6">What Went Wrong</h2>
              
              <div className="space-y-6">
                {/* My answer was saying */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    My answer was saying... <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      ref={userAnswerRef}
                      value={userAnswerDescription}
                      onChange={(e) => setUserAnswerDescription(e.target.value)}
                      placeholder="Describe what your answer was trying to say..."
                      className="flex-1 min-h-[100px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y"
                    />
                    <div className="flex items-start pt-2">
                      <VoiceInput
                        onTranscript={(text) => {
                          setUserAnswerDescription(prev => prev ? `${prev} ${text}` : text);
                        }}
                        textareaRef={userAnswerRef}
                      />
                    </div>
                  </div>
                </div>

                {/* I got confused because */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    I got confused because... <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      ref={userReasoningRef}
                      value={userReasoning}
                      onChange={(e) => setUserReasoning(e.target.value)}
                      placeholder="What made you uncertain or confused?"
                      className="flex-1 min-h-[100px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y"
                    />
                    <div className="flex items-start pt-2">
                      <VoiceInput
                        onTranscript={(text) => {
                          setUserReasoning(prev => prev ? `${prev} ${text}` : text);
                        }}
                        textareaRef={userReasoningRef}
                      />
                    </div>
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-3">
                    Difficulty
                  </label>
                  <div className="flex gap-3 items-center">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDifficulty(num)}
                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-semibold transition-all ${
                          difficulty === num
                            ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-[#2D9D78]'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Writing Mode - Upper Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1B4D3E] mb-6">The Argument</h2>
              
              <div className="flex gap-2">
                <textarea
                  ref={argumentTextRef}
                  value={argumentText}
                  onChange={(e) => setArgumentText(e.target.value)}
                  placeholder="Paste or type your argument here..."
                  className="flex-1 min-h-[200px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y"
                />
                <div className="flex items-start pt-2">
                  <VoiceInput
                    onTranscript={(text) => {
                      setArgumentText(prev => prev ? `${prev} ${text}` : text);
                    }}
                    textareaRef={argumentTextRef}
                  />
                </div>
              </div>
            </div>

            {/* Writing Mode - Lower Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1B4D3E] mb-6">What Concerns You</h2>
              
              <div className="space-y-6">
                {/* The part I'm unsure about */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    The part I'm unsure about... <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      ref={unsurePartRef}
                      value={unsurePart}
                      onChange={(e) => setUnsurePart(e.target.value)}
                      placeholder="Which part of your argument are you uncertain about?"
                      className="flex-1 min-h-[100px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y"
                    />
                    <div className="flex items-start pt-2">
                      <VoiceInput
                        onTranscript={(text) => {
                          setUnsurePart(prev => prev ? `${prev} ${text}` : text);
                        }}
                        textareaRef={unsurePartRef}
                      />
                    </div>
                  </div>
                </div>

                {/* I think the issue might be */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    I think the issue might be... <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      ref={issueThoughtRef}
                      value={issueThought}
                      onChange={(e) => setIssueThought(e.target.value)}
                      placeholder="What do you think might be wrong with your reasoning?"
                      className="flex-1 min-h-[100px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-[#2D9D78] focus:border-transparent resize-y"
                    />
                    <div className="flex items-start pt-2">
                      <VoiceInput
                        onTranscript={(text) => {
                          setIssueThought(prev => prev ? `${prev} ${text}` : text);
                        }}
                        textareaRef={issueThoughtRef}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 border border-[#1B4D3E] rounded-xl text-[#1B4D3E] hover:bg-[#F0F7F4]"
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
            disabled={isLoading || (mode === 'argument' && !description && !question)}
            className="px-8 py-3 bg-[#1B4D3E] text-white text-base font-medium rounded-xl hover:bg-[#2D6A4F] disabled:bg-[#2D9D78] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
