'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const router = useRouter();

  const handleAnalyze = () => {
    if (text || image) {
      if (text) {
        sessionStorage.setItem('questionText', text);
      }
      if (image) {
        // Store image as base64 for now
        const reader = new FileReader();
        reader.onload = () => {
          sessionStorage.setItem('questionImage', reader.result as string);
          router.push('/input');
        };
        reader.readAsDataURL(image);
        return;
      }
      router.push('/input');
    }
  };

  const handleClear = () => {
    setText('');
    setImage(null);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">LogiClue</h1>
          <p className="text-gray-600">Master your logic, one question at a time</p>
        </div>

        {/* Input Area */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your logical reasoning question here... Include the passage, question, and all answer choices (A-E)"
            className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
          />

          {/* Upload Section */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <span>Or upload an image:</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="text-sm"
            />
            {image && <span className="text-indigo-600">{image.name}</span>}
          </div>

          {/* Buttons */}
          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Upload Image
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!text && !image}
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
