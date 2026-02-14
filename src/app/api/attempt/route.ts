import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      questionId,
      userChoice,
      isCorrect,
      errorType,
      userDifficulty,
      altChoice,
      altRationaleTag,
      altRationaleText,
      userCorrectAnswer,
      userNote
    } = body;

    // Generate a temp user ID (will be replaced with real auth later)
    const userId = body.userId || `temp_${Date.now()}`;

    const { data, error } = await supabase
      .from('attempts')
      .insert({
        user_id: userId,
        question_id: questionId,
        user_choice: userChoice,
        is_correct: isCorrect,
        error_type: errorType || null,
        user_difficulty: userDifficulty,
        alt_choice: altChoice || null,
        alt_rationale_tag: altRationaleTag || null,
        alt_rationale_text: altRationaleText || null,
        user_correct_answer: userCorrectAnswer || null,
        user_note: userNote || null
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving attempt:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, attemptId: data.id });

  } catch (error: any) {
    console.error('Attempt error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

