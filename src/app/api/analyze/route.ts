// File: src/app/api/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import crypto from 'crypto';
import { classifyQuestion } from '../../../lib/questionClassifier';
import JUDGE_SYSTEM_PROMPT from '../../../lib/judgePrompt';
import TUTOR_SYSTEM_PROMPT from '../../../lib/tutorPrompt';

// ============================================
// HELPERS
// ============================================

function sanitizeOptions(options: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(options).map(([letter, text]) => [
      letter,
      String(text).replace(/[\r\n]+/g, ' ').trim()
    ])
  );
}

function buildJudgeUserMessage(
  stimulus: string,
  questionStem: string,
  options: Record<string, string>,
  userChoice: string,
  correctAnswer?: string
): string {
  const { type, family, primaryMethods } = classifyQuestion(questionStem);
  const sanitizedOptions = sanitizeOptions(options);

  const optionsText = Object.entries(sanitizedOptions)
    .map(([letter, text]) => `(${letter}) ${text}`)
    .join('\n');

  return `## QUESTION

Stimulus:
${stimulus}

Question:
${questionStem}

Options:
${optionsText}

User selected: ${userChoice}
${correctAnswer ? `Correct answer provided by user: ${correctAnswer}` : ''}

Pre-classification:
type=${type}
family=${family}
suggested_methods=[${primaryMethods.join(', ')}]

Task:
- determine question_family
- select method
- extract structure
- run faithfulness-check
- produce core_judgment
- select correct_option

Return strict JSON only.`;
}

function buildTutorUserMessage(
  stimulus: string,
  questionStem: string,
  options: Record<string, string>,
  userChoice: string,
  judgeResult: any,
  additionalContext?: {
    altChoice?: string;
    rationaleTag?: string;
    rationaleText?: string;
    userDifficulty?: number;
  }
): string {
  const sanitizedOptions = sanitizeOptions(options);

  const optionsText = Object.entries(sanitizedOptions)
    .map(([letter, text]) => `(${letter}) ${text}`)
    .join('\n');

  let userContext = '';
  if (additionalContext?.altChoice) {
    userContext += `\nUser was torn between ${userChoice} and ${additionalContext.altChoice}.`;
  }
  if (additionalContext?.rationaleTag) {
    userContext += `\nUser's self-reported issue: ${additionalContext.rationaleTag}`;
  }
  if (additionalContext?.rationaleText) {
    userContext += `\nUser's explanation: "${additionalContext.rationaleText}"`;
  }
  if (additionalContext?.userDifficulty) {
    userContext += `\nUser difficulty: ${additionalContext.userDifficulty}`;
  }

  return `## ORIGINAL QUESTION

Stimulus:
${stimulus}

Question:
${questionStem}

Options:
${optionsText}

User selected: ${userChoice}
${userContext}

## JUDGE RESULT (MUST FOLLOW)

${JSON.stringify(judgeResult, null, 2)}

Task:
- do NOT re-solve the question
- do NOT change method
- do NOT change correct answer
- explain the wrong options, especially the user's chosen option
- generate final user-facing diagram using Judge-selected method
- generate narrative.trap / action / next_time

Return strict JSON only.`;
}

async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string, temperature = 0.1, max_tokens = 8000) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'LogiClue'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens,
      temperature
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error (${model}): ${errorText}`);
  }

  const responseData = await response.json();
  const content = responseData.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`Empty response from model: ${model}`);
  }

  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error(`JSON parse error for ${model}:`, content);
    throw new Error(`Failed to parse ${model} response`);
  }
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

    if (!stimulus || !questionStem || !options || !userChoice) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: stimulus, questionStem, options, userChoice' },
        { status: 400 }
      );
    }

    const sanitizedOptions = sanitizeOptions(options);

    // --------------------------------------------
    // 1) Judge
    // --------------------------------------------
    const judgeUserMessage = buildJudgeUserMessage(
      stimulus,
      questionStem,
      sanitizedOptions,
      userChoice,
      correctAnswer
    );

    const judgeResult = await callOpenRouter(
      'meituan/longcat-flash-chat',
      JUDGE_SYSTEM_PROMPT,
      judgeUserMessage,
      0.1,
      5000
    );

    // Minimal validation
    if (
      !judgeResult?.question_family ||
      !judgeResult?.method ||
      !judgeResult?.core_judgment ||
      !judgeResult?.correct_option?.label
    ) {
      return NextResponse.json(
        { success: false, error: 'Judge result missing required fields', judgeResult },
        { status: 500 }
      );
    }

    // --------------------------------------------
    // 2) Tutor
    // --------------------------------------------
    const tutorUserMessage = buildTutorUserMessage(
      stimulus,
      questionStem,
      sanitizedOptions,
      userChoice,
      judgeResult,
      { altChoice, rationaleTag, rationaleText, userDifficulty }
    );

    const tutorResult = await callOpenRouter(
      'meituan/longcat-flash-chat',
      TUTOR_SYSTEM_PROMPT,
      tutorUserMessage,
      0.1,
      6000
    );

    if (!tutorResult?.diagram || !tutorResult?.narrative) {
      return NextResponse.json(
        { success: false, error: 'Tutor result missing required fields', tutorResult },
        { status: 500 }
      );
    }

    // --------------------------------------------
    // 3) Compose final payload (compat mode)
    // --------------------------------------------
    const finalAnalysis = {
      question_family: judgeResult.question_family,
      method: judgeResult.method,
      core_judgment: judgeResult.core_judgment,
      correct_option: judgeResult.correct_option,

      structure: judgeResult.structure || {},
      faithfulness_check: judgeResult.faithfulness_check || '',
      _reasoning_trace: judgeResult._reasoning_trace || {},

      isCorrect: judgeResult.correct_option.label === userChoice,
      userChoice,

      diagram: tutorResult.diagram || '',
      wrong_options: tutorResult.wrong_options || [],
      narrative: tutorResult.narrative || {},

      // keep compatibility
      questionId: null as string | null,
    };

    // --------------------------------------------
    // 4) Save to DB
    // --------------------------------------------
    const contentHash = crypto
      .createHash('md5')
      .update(questionStem + JSON.stringify(sanitizedOptions))
      .digest('hex');

    const { data: existingQuestion } = await supabase
      .from('questions')
      .select('id')
      .eq('source_id', sourceId || contentHash)
      .single();

    let questionId = existingQuestion?.id;

    if (!questionId) {
      const { data: newQuestion, error: questionError } = await supabase
        .from('questions')
        .insert({
          question_type: classifyQuestion(questionStem).type,
          question_family: judgeResult.question_family,
          source_id: sourceId || contentHash,
          user_description: stimulus,
          user_question: questionStem,
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
      await supabase.from('analyses').upsert({
        question_id: questionId,
        method: judgeResult.method || 'unknown',
        steps: judgeResult.structure || {},
        summary: judgeResult.core_judgment || null,
        faithfulness_check: judgeResult.faithfulness_check || null,
        takeaway: tutorResult.narrative?.next_time || null
      }, { onConflict: 'question_id' });

      const correctLabel = judgeResult.correct_option?.label;

      if (correctLabel && sanitizedOptions) {
        for (const letter of Object.keys(sanitizedOptions)) {
          const isCorrect = letter === correctLabel;
          const wrongOptionData = tutorResult.wrong_options?.find(
            (wo: { label: string }) => wo.label === letter
          );

          await supabase.from('option_analyses').upsert({
            question_id: questionId,
            option_letter: letter,
            is_correct: isCorrect,
            content_brief: isCorrect ? judgeResult.correct_option?.reason : wrongOptionData?.claims,
            why_correct: isCorrect ? judgeResult.correct_option : null,
            error: !isCorrect ? {
              why_wrong: wrongOptionData?.why_wrong,
              match_trigger: wrongOptionData?.match_trigger,
            } : null,
            narrative: letter === userChoice && !isCorrect ? tutorResult.narrative : null
          }, { onConflict: 'question_id,option_letter' });
        }
      }
    }

    finalAnalysis.questionId = questionId;

    // keep debug compatibility
    const debugOptionsSent: Record<string, { raw: string; sanitized: string }> = {};
    for (const [letter, text] of Object.entries(options)) {
      debugOptionsSent[letter] = {
        raw: String(text),
        sanitized: String(text).replace(/[\r\n]+/g, ' ').trim()
      };
    }
    (finalAnalysis as any)._debug_options_sent = debugOptionsSent;

    return NextResponse.json({ success: true, data: finalAnalysis });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Analysis failed: ' + errorMessage },
      { status: 500 }
    );
  }
}