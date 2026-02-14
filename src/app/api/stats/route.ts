import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    // Get all attempts for this user
    const { data: attempts, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attempts:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Calculate statistics
    const totalQuestions = attempts?.length || 0;
    const correctCount = attempts?.filter(a => a.is_correct).length || 0;
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) / 10 : 0;
    
    const difficulties = attempts?.filter(a => a.user_difficulty).map(a => a.user_difficulty) || [];
    const avgDifficulty = difficulties.length > 0 
      ? Math.round((difficulties.reduce((a, b) => a + b, 0) / difficulties.length) * 10) / 10 
      : 0;

    // Count errors by type
    const errorCounts: Record<string, number> = {};
    attempts?.forEach(a => {
      if (!a.is_correct && a.error_type) {
        errorCounts[a.error_type] = (errorCounts[a.error_type] || 0) + 1;
      }
    });

    // Convert to array and sort
    const errorTypeLabels: Record<string, string> = {
      'off_topic': 'Off topic',
      'direction_reversed': 'Reversed direction',
      'wrong_flaw': 'Wrong flaw type',
      'frequency_jumped': 'Quantity shift',
      'too_strong': 'Too strong',
      'missing_link': 'Missing link',
      'irrelevant': 'Irrelevant',
      'incomplete_bridge': 'Incomplete bridge',
      'affirming_consequent': 'Affirming consequent',
      'necessary_vs_sufficient': 'Necessary vs sufficient',
      'wrong_target': 'Wrong target',
      'degree_not_stance': 'Degree not stance',
      'is_vs_ought': 'Is vs ought'
    };

    const byErrorType = Object.entries(errorCounts)
      .map(([errorType, count]) => ({
        errorType,
        display: errorTypeLabels[errorType] || errorType,
        count
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalQuestions,
          correctCount,
          accuracy,
          avgDifficulty
        },
        byErrorType
      }
    });

  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

