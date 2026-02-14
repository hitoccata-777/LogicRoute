'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Get userId from localStorage
      let userId = localStorage.getItem('logiclue_user_id') || 'debug_user';

      try {
        const response = await fetch(`/api/stats?userId=${userId}`);
        const result = await response.json();
        
        if (result.success) {
          setStats(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Calculate max count for bar scaling
  const maxCount = stats?.byErrorType?.length > 0 
    ? Math.max(...stats.byErrorType.map((e: any) => e.count))
    : 1;

  // Render stars for average difficulty
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          if (star <= fullStars) {
            return <span key={star} className="text-yellow-400 text-lg">★</span>;
          } else if (star === fullStars + 1 && hasHalfStar) {
            return <span key={star} className="text-yellow-400 text-lg">☆</span>;
          } else {
            return <span key={star} className="text-gray-300 text-lg">★</span>;
          }
        })}
        <span className="ml-2 text-gray-600 text-sm">{rating.toFixed(1)}/5</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading statistics...</p>
      </div>
    );
  }

  if (!stats || stats.overview.totalQuestions === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No questions analyzed yet</p>
          <button onClick={() => router.push('/')} className="text-indigo-600 hover:underline">
            Analyze your first question
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600 mb-2">Your Statistics</h1>
          <p className="text-gray-600">Track your progress and identify areas for improvement</p>
        </div>

        {/* Section 1: Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Questions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Total Questions</div>
            <div className="text-3xl font-bold text-gray-900">{stats.overview.totalQuestions}</div>
          </div>

          {/* Correct Count */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Correct</div>
            <div className="text-3xl font-bold text-green-600">{stats.overview.correctCount}</div>
          </div>

          {/* Accuracy */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Accuracy</div>
            <div className="text-3xl font-bold text-indigo-600">{stats.overview.accuracy.toFixed(1)}%</div>
          </div>

          {/* Avg Difficulty */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm font-medium text-gray-500 mb-2">Avg Difficulty</div>
            <div className="mt-1">
              {renderStars(stats.overview.avgDifficulty)}
            </div>
          </div>
        </div>

        {/* Section 2: Common Errors */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Your Most Common Errors</h2>
          
          <div className="space-y-4">
            {stats.byErrorType && stats.byErrorType.length > 0 ? (
              stats.byErrorType.map((error: any, index: number) => {
              const percentage = (error.count / maxCount) * 100;
              // Create gradient: darker indigo for higher counts
              const intensity = Math.min(100, 40 + (percentage * 0.6)); // Range from 40% to 100% opacity
              
              return (
                <button
                  key={error.errorType}
                  className="w-full text-left group hover:bg-gray-50 p-3 rounded-lg transition-colors"
                  onClick={() => {
                    // Future: navigate to error detail page
                    console.log(`Navigate to error detail: ${error.errorType}`);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{error.display}</span>
                    <span className="text-sm font-semibold text-indigo-600">{error.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 group-hover:opacity-90"
                      style={{
                        width: `${percentage}%`,
                        background: `linear-gradient(90deg, rgb(79, 70, 229) ${intensity}%, rgb(99, 102, 241) 100%)`
                      }}
                    />
                  </div>
                </button>
              );
            })
            ) : (
              <p className="text-gray-500 text-center py-4">No errors to display yet</p>
            )}
          </div>
        </div>

        {/* Section 3: Simple Visual Placeholder */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Detailed Analysis</h2>
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Detailed analysis coming soon...</p>
            <p className="text-sm mt-2">Radar charts and advanced visualizations will be available here</p>
          </div>
        </div>

        {/* Bottom Button */}
        <div className="flex justify-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
