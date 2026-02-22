// File: src/app/api/analyze/route.ts
// LogiClue Analyze API - Integrates SOP Framework

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import crypto from 'crypto';
import SOP_SYSTEM_PROMPT from '../../../lib/sopPrompt';
import DIAGRAM_TEMPLATES, { METHOD_DESCRIPTIONS } from '../../../lib/diagramTemplates';
import { SCENE_DECISION_TREE, selectMethod } from '../../../lib/sceneDecisionTree';
import ERROR_TYPES, { getErrorCodes } from '../../../lib/errorTypes';

// ============================================
// BUILD THE FULL PROMPT
// ============================================
function buildAnalysisPrompt(
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
  
  // Pre-select method based on question stem and stimulus
  const suggestedMethod = selectMethod(questionStem, stimulus);
  
  // Build options string
  const optionsText = Object.entries(options)
    .map(([letter, text]) => `(${letter}) ${text}`)
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

  return `
${SOP_SYSTEM_PROMPT}

---

## AVAILABLE DIAGRAM TEMPLATES

${Object.entries(METHOD_DESCRIPTIONS).map(([key, desc]) => `- **${key}**: ${desc}`).join('\n')}

---

## ERROR TYPES TO USE

When classifying user's error, use one of these codes:
${getErrorCodes().join(', ')}

---

## QUESTION TO ANALYZE

**Stimulus:**
${stimulus}

**Question:**
${questionStem}

**Options:**
${optionsText}

**User selected:** ${userChoice}
${correctAnswer ? `**Correct answer:** ${correctAnswer}` : ''}
${userContext}

**Suggested method based on triggers:** ${suggestedMethod}

---

## YOUR TASK

1. Confirm or override the suggested method based on stimulus content
2. Draw a diagram using the appropriate template that makes the answer obvious
3. Identify the gap/key insight
4. If user chose wrong, provide empathetic feedback (fork_point, user_reasoning, bridge_to_correct)
5. Output valid JSON following the schema

## OUTPUT FORMAT (JSON only, no markdown wrapper)

{
  "method": "river_crossing | venn | formula | highlight | ...",
  "diagram": "ASCII diagram (use template)",
  "analysis": {
    "X_bank": "premise/evidence",
    "Y_bank": "conclusion",
    "gap": "hidden assumption or key insight",
    "key_insight": "one sentence why correct answer works"
  },
  "correctAnswer": "A|B|C|D|E",
  "isCorrect": true/false,
  "correctAnswerExplanation": {
    "brief": "1-2 sentences",
    "flipTest": "If this were false, the argument would..."
  },
  "userChoiceFeedback": {
    "errorType": "one of 13 codes or null if correct",
    "fork_point": "where thinking diverged",
    "user_reasoning": "why their logic made sense",
    "bridge_to_correct": "path to correct thinking"
  },
  "trapAnalysis": {
    "option": "letter of trap option",
    "attraction": "why tempting",
    "flaw": "why wrong"
  },
  "takeaway": "one transferable principle"
}
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

    // Build the prompt
    const analysisPrompt = buildAnalysisPrompt(
      stimulus,
      questionStem,
      options,
      userChoice,
      correctAnswer,
      { altChoice, rationaleTag, rationaleText, userDifficulty }
    );

    // Call OpenRouter API
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'LogiClue'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
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
      // Remove potential markdown code blocks
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
    
    // Generate content hash for deduplication
    const contentHash = crypto
      .createHash('md5')
      .update(stimulus + questionStem)
      .digest('hex');

    // Check if question already exists
    const { data: existingQuestion } = await supabase
      .from('questions')
      .select('id')
      .eq('content_hash', contentHash)
      .single();

    let questionId = existingQuestion?.id;

    // Create question if not exists
    if (!questionId) {
      const { data: newQuestion, error: questionError } = await supabase
        .from('questions')
        .insert({
          stimulus,
          question_stem: questionStem,
          options,
          correct_answer: correctAnswer || analysis.correctAnswer,
          source_type: sourceId ? 'user' : 'llm',
          answer_conflict: correctAnswer && correctAnswer !== analysis.correctAnswer,
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

    // Save analysis
    if (questionId) {
      await supabase.from('analyses').upsert({
        question_id: questionId,
        method: analysis.method || 'unknown',
        diagram: analysis.diagram || '',
        steps: analysis.analysis || {},
        summary: analysis.correctAnswerExplanation?.flipTest,
        skill_point: analysis.takeaway,
        takeaway: analysis.takeaway
      }, { onConflict: 'question_id' });

      // Save option analyses
      if (analysis.correctAnswer && options) {
        for (const letter of Object.keys(options)) {
          const isCorrect = letter === analysis.correctAnswer;
          await supabase.from('option_analyses').upsert({
            question_id: questionId,
            option_letter: letter,
            is_correct: isCorrect,
            content_brief: isCorrect ? analysis.correctAnswerExplanation?.brief : null,
            why_correct: isCorrect ? analysis.correctAnswerExplanation : null,
            error: !isCorrect && letter === userChoice ? { 
              error_type: analysis.userChoiceFeedback?.errorType,
              fork_point: analysis.userChoiceFeedback?.fork_point,
              user_reasoning: analysis.userChoiceFeedback?.user_reasoning,
              bridge_to_correct: analysis.userChoiceFeedback?.bridge_to_correct
            } : null
          }, { onConflict: 'question_id,option_letter' });
        }
      }
    }

    // Add questionId to response
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