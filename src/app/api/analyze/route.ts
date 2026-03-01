// File: src/app/api/analyze/route.ts
// LogiClue Analyze API — SOP v1.0

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import crypto from 'crypto';
import SOP_SYSTEM_PROMPT from '../../../lib/sopPrompt';
import { classifyQuestion } from '../../../lib/questionClassifier';

// ============================================
// BUILD USER MESSAGE (question-specific content only)
// ============================================
function buildUserMessage(
  stimulus: string,
  questionStem: string,
  options: Record<string, string>,
  userChoice: string,
  correctAnswer?: string,
  additionalContext?: {
    altChoice?: string;
    rationaleTag?: string;
    rationaleText?: string;
    userDifficulty?: number;
  }
): string {

  // Pre-classify question type
  const { type, family, primaryMethods } = classifyQuestion(questionStem);

  // Build options string (sanitize newlines within option text)
  const optionsText = Object.entries(options)
    .map(([letter, text]) => `(${letter}) ${String(text).replace(/[\r\n]+/g, ' ').trim()}`)
    .join('\n');

  // Build user context
  let userContext = '';
  if (additionalContext) {
    if (additionalContext.altChoice) {
      userContext += `\nUser was torn between ${userChoice} and ${additionalContext.altChoice}.`;
    }
    if (additionalContext.rationaleTag) {
      userContext += `\nUser's self-reported issue: ${additionalContext.rationaleTag}`;
    }
    if (additionalContext.rationaleText) {
      userContext += `\nUser's explanation: "${additionalContext.rationaleText}"`;
    }
  }

  return `## QUESTION TO ANALYZE

**Stimulus:**
${stimulus}

**Question:**
${questionStem}

**Options:**
${optionsText}

**User selected:** ${userChoice}
${correctAnswer ? `**Correct answer:** ${correctAnswer}` : ''}
${userContext}

**Pre-classified:** type=${type}, family=${family}, suggested_methods=[${primaryMethods.join(', ')}]
(You may override the suggested method based on stimulus content.)

## YOUR TASK

Follow the execution flow strictly:
1. Step 1: Extract structure (X/Y/Bridge/Gap)
2. Step 2: Faithfulness check
3. Step 3: Core judgment (≤25 words, must echo correct answer)
4. Step 4: Confirm question type
5. Step 5: Select correct answer + reasoning
6. Step 6: Label every wrong option with option_error (L1+L2) and user_error (L1+L2)
7. Select method and draw diagram
8. Generate narrative (trap/action/next_time) for user's chosen option
9. Output strict JSON (no markdown wrapper)

CRITICAL: Your ENTIRE response must be a single JSON object. Do NOT output a diagram or any text outside the JSON. The diagram goes INSIDE the "diagram" field of the JSON. Start your response with { and end with }.
`;
}

// ============================================
// MAIN API HANDLER
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      stimulus,
      questionStem,
      options,
      userChoice,
      correctAnswer,
      sourceId,
      altChoice,
      rationaleTag,
      rationaleText,
      userDifficulty,
    } = body;

    // Validate required fields
    if (!stimulus || !questionStem || !options || !userChoice) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: stimulus, questionStem, options, userChoice' },
        { status: 400 }
      );
    }

    // Build messages — SOP as system, question as user
    const userMessage = buildUserMessage(
      stimulus,
      questionStem,
      options,
      userChoice,
      correctAnswer,
      { altChoice, rationaleTag, rationaleText, userDifficulty }
    );

    // Call OpenRouter API with Sonnet 4.5
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'LogiClue'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          {
            role: 'system',
            content: SOP_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 8000,
        temperature: 0.1
      })
    });

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error('OpenRouter error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Analysis service error: ' + errorText },
        { status: 500 }
      );
    }

    const responseData = await openRouterResponse.json();
    const content = responseData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Empty response from analysis service' },
        { status: 500 }
      );
    }

    // Parse JSON from response
    let analysis;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw content:', content);
      return NextResponse.json(
        { success: false, error: 'Failed to parse analysis response', rawContent: content },
        { status: 500 }
      );
    }

    // ============================================
    // SAVE TO DATABASE
    // ============================================
    
    const contentHash = crypto
      .createHash('md5')
      .update(stimulus + questionStem)
      .digest('hex');

    const { data: existingQuestion } = await supabase
      .from('questions')
      .select('id')
      .eq('content_hash', contentHash)
      .single();

    let questionId = existingQuestion?.id;

    if (!questionId) {
      const { data: newQuestion, error: questionError } = await supabase
        .from('questions')
        .insert({
          stimulus,
          question_stem: questionStem,
          options,
          correct_answer: correctAnswer || analysis.correct_option?.label,
          source_type: sourceId ? 'user' : 'llm',
          answer_conflict: correctAnswer && correctAnswer !== analysis.correct_option?.label,
          source_id: sourceId || null,
          content_hash: contentHash
        })
        .select('id')
        .single();

      if (questionError) {
        console.error('Error saving question:', questionError);
      } else {
        questionId = newQuestion?.id;
      }
    }

    if (questionId) {
      // Save analysis
      await supabase.from('analyses').upsert({
        question_id: questionId,
        method: analysis.method || 'unknown',
        diagram: analysis.diagram || '',
        steps: analysis.structure || {},
        summary: analysis.core_judgment,
        faithfulness_check: analysis.faithfulness_check,
        takeaway: analysis.narrative?.next_time
      }, { onConflict: 'question_id' });

      // Save option analyses
      const correctLabel = analysis.correct_option?.label;
      if (correctLabel && options) {
        for (const letter of Object.keys(options)) {
          const isCorrect = letter === correctLabel;
          
          // Find this option's error data from wrong_options array
          const wrongOptionData = analysis.wrong_options?.find(
            (wo: { label: string }) => wo.label === letter
          );

          await supabase.from('option_analyses').upsert({
            question_id: questionId,
            option_letter: letter,
            is_correct: isCorrect,
            content_brief: isCorrect ? analysis.correct_option?.reason : wrongOptionData?.claims,
            why_correct: isCorrect ? analysis.correct_option : null,
            error: !isCorrect ? {
              why_wrong: wrongOptionData?.why_wrong,
              match_trigger: wrongOptionData?.match_trigger,
            } : null,
            // Keep narrative for user's chosen option
            narrative: letter === userChoice && !isCorrect ? analysis.narrative : null
          }, { onConflict: 'question_id,option_letter' });
        }
      }
    }

    analysis.questionId = questionId;

    return NextResponse.json({ success: true, data: analysis });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Analysis failed: ' + errorMessage },
      { status: 500 }
    );
  }
}