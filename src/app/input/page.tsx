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
  const [inputMode, setInputMode] = useState<'exam' | 'argument'>('exam');
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

  // Exam mode fields
  const [stimulus, setStimulus] = useState('');
  const [questionStem, setQuestionStem] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [optionE, setOptionE] = useState('');
  const [userChoice, setUserChoice] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [hesitatedChoice, setHesitatedChoice] = useState('');
  const [hesitationReason, setHesitationReason] = useState('');
  const [hesitationReasonText, setHesitationReasonText] = useState('');
  const [sourceId, setSourceId] = useState('');

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
        
        // Pre-fill exam mode fields if available
        if (data.stimulus) {
          setStimulus(data.stimulus);
        }
        if (data.questionStem) {
          setQuestionStem(data.questionStem);
          setQuestion(data.questionStem); // Also set for argument mode
        }
        if (data.options) {
          setOptionA(data.options.A || '');
          setOptionB(data.options.B || '');
          setOptionC(data.options.C || '');
          setOptionD(data.options.D || '');
          setOptionE(data.options.E || '');
        }
        
        // Pre-fill argument mode fields
        if (data.description) {
          setDescription(data.description);
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
    if (inputMode === 'exam') {
      setStimulus('');
      setQuestionStem('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setOptionE('');
      setUserChoice('');
      setCorrectAnswer('');
      setHesitatedChoice('');
      setHesitationReason('');
      setHesitationReasonText('');
      setSourceId('');
      setDifficulty(0);
    } else if (mode === 'argument') {
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
      let requestBody;
      
      if (inputMode === 'exam') {
        // Exam mode payload
        requestBody = {
          stimulus,
          questionStem,
          options: {
            A: optionA,
            B: optionB,
            C: optionC,
            D: optionD,
            E: optionE
          },
          userChoice,
          correctAnswer: correctAnswer || undefined,
          hesitatedChoice: hesitatedChoice || undefined,
          hesitationReason: hesitationReason || undefined,
          hesitationReasonText: hesitationReasonText || undefined,
          userDifficulty: difficulty || undefined,
          sourceId: sourceId || undefined,
          userId,
          mode: 'exam'
        };
      } else {
        // Argument mode payload
        requestBody = {
          description: mode === 'argument' ? description : argumentText,
          question: mode === 'argument' ? question : '',
          userAnswerDescription: mode === 'argument' ? userAnswerDescription : unsurePart,
          userReasoning: mode === 'argument' ? userReasoning : issueThought,
          userDifficulty: mode === 'argument' ? (difficulty || undefined) : undefined,
          userId: userId,
          sourceId: undefined,
          mode: inputMode === 'argument' ? 'argument' : mode
        };
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success) {
        sessionStorage.setItem('analysisResult', JSON.stringify(result.data));
        // Store input data for reference
        const inputData = inputMode === 'exam'
          ? { stimulus, questionStem, options: { A: optionA, B: optionB, C: optionC, D: optionD, E: optionE }, userChoice, correctAnswer, hesitatedChoice, hesitationReason, hesitationReasonText, difficulty, sourceId, mode: 'exam' }
          : mode === 'argument'
          ? { description, question, userAnswerDescription, userReasoning, difficulty, mode: 'argument' }
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

        {/* Input Mode Toggle */}
        <div className="flex gap-2 mb-6 bg-white rounded-xl p-1 shadow-sm border border-[#E5EBE9]">
          <button
            onClick={() => setInputMode('exam')}
            className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
              inputMode === 'exam'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Exam Mode
          </button>
          <button
            onClick={() => setInputMode('argument')}
            className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
              inputMode === 'argument'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Argument Mode
          </button>
        </div>

        {inputMode === 'exam' ? (
          <>
            {/* Exam Mode - Question Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1B4D3E] mb-6">Question</h2>
              
              <div className="space-y-6">
                {/* Stimulus */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Stimulus
                  </label>
                  <textarea
                    value={stimulus}
                    onChange={(e) => setStimulus(e.target.value)}
                    placeholder="The passage or context..."
                    className="w-full min-h-[120px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                  />
                </div>

                {/* Question Stem */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Question Stem
                  </label>
                  <textarea
                    value={questionStem}
                    onChange={(e) => setQuestionStem(e.target.value)}
                    placeholder="The question being asked..."
                    className="w-full min-h-[80px] p-4 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                  />
                </div>

                {/* Options */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-3">
                    Answer Choices
                  </label>
                  <div className="space-y-3">
                    {[
                      { label: 'A', value: optionA, setter: setOptionA },
                      { label: 'B', value: optionB, setter: setOptionB },
                      { label: 'C', value: optionC, setter: setOptionC },
                      { label: 'D', value: optionD, setter: setOptionD },
                      { label: 'E', value: optionE, setter: setOptionE }
                    ].map((option) => (
                      <div key={option.label} className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-8 h-10 flex items-center justify-center font-semibold text-gray-700 bg-gray-100 rounded-lg">
                          {option.label}
                        </span>
                        <input
                          type="text"
                          value={option.value}
                          onChange={(e) => option.setter(e.target.value)}
                          placeholder={`Option ${option.label}...`}
                          className="flex-1 p-2.5 bg-[#FAFCFB] border border-[#E5EBE9] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Exam Mode - User Input Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBE9] p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1B4D3E] mb-6">Your Response</h2>
              
              <div className="space-y-6">
                {/* Source ID */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Source ID <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    placeholder="e.g. PT147-S1-Q21"
                    className="w-full p-3 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Your Choice and Correct Answer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-2">
                      Your Choice <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={userChoice}
                      onChange={(e) => setUserChoice(e.target.value)}
                      className="w-full p-3 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-2">
                      Correct Answer <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <select
                      value={correctAnswer}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      className="w-full p-3 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>
                    </select>
                  </div>
                </div>

                {/* Hesitated Choice */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Hesitated Choice <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={hesitatedChoice}
                    onChange={(e) => setHesitatedChoice(e.target.value)}
                    className="w-full p-3 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </div>

                {/* Hesitation Reason */}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2">
                    Hesitation Reason <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={hesitationReason}
                    onChange={(e) => setHesitationReason(e.target.value)}
                    className="w-full p-3 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                </div>

                {/* Other Reason Text */}
                {hesitationReason === 'Other' && (
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-2">
                      Please specify
                    </label>
                    <input
                      type="text"
                      value={hesitationReasonText}
                      onChange={(e) => setHesitationReasonText(e.target.value)}
                      placeholder="Describe your hesitation..."
                      className="w-full p-3 bg-[#FAFCFB] border border-[#E5EBE9] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                )}

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
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-500'
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
        ) : mode === 'argument' ? (
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
            disabled={
              isLoading || 
              (inputMode === 'exam' && (!userChoice || !stimulus || !questionStem)) ||
              (inputMode === 'argument' && mode === 'argument' && !description && !question)
            }
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
