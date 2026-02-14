'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      setInputText(''); // Clear text when image is selected
    }
  };

  const handleClear = () => {
    setInputText('');
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = () => {
    if (inputText.trim() || selectedImage) {
      // Store data for the input page
      if (inputText.trim()) {
        // Pass text via URL search params
        const params = new URLSearchParams();
        params.set('text', inputText.trim());
        router.push(`/input?${params.toString()}`);
      } else if (selectedImage) {
        // Store image in sessionStorage temporarily
        // Convert image to base64 for storage
        const reader = new FileReader();
        reader.onloadend = () => {
          sessionStorage.setItem('uploadedImage', reader.result as string);
          sessionStorage.setItem('uploadedImageName', selectedImage.name);
          router.push('/input?type=image');
        };
        reader.readAsDataURL(selectedImage);
      }
    }
  };

  const handleUploadImageClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">LogicRoute</h1>
          <p className="text-lg text-gray-600">Master your logic, one question at a time</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
          {/* Input Area */}
          <div className="space-y-4">
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (selectedImage) {
                  setSelectedImage(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }
              }}
              placeholder="Paste your logical reasoning question here... Include the passage, question, and all answer choices (A-E)"
              className="w-full min-h-[200px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y text-gray-900 placeholder-gray-500"
            />

            {/* Image Upload Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
              <span className="text-sm text-gray-600">Or upload an image</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={handleUploadImageClick}
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                Choose File
              </button>
              {selectedImage && (
                <span className="text-sm text-gray-600">
                  Selected: {selectedImage.name}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleUploadImageClick}
              className="px-6 py-3 text-sm font-medium text-indigo-600 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Upload Image
            </button>
            <button
              onClick={handleClear}
              className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!inputText.trim() && !selectedImage}
              className="px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-1 sm:flex-initial"
            >
              Analyze
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

