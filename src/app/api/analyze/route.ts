Replace the entire analyze API with the updated version that integrates question classification and the SOP framework.

File: src/app/api/analyze/route.ts

Replace entire file with:

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import crypto from 'crypto';
import { classifyQuestion, QuestionType, QuestionFamily, Method } from '../../../lib/questionClassifier';
import { SCENE_DECISION_TREE, METHOD_DESCRIPTIONS } from '../../../lib/sceneDecisionTree';

const SOP_SYSTEM_PROMPT = `You are LogiClue, an expert LSAT logical reasoning tutor.

## YOUR TEACHING PHILOSOPHY

1. **Show, don't tell** - Use diagrams, not terminology
2. **Feynman method** - Explain like talking to a friend, no jargon
3. **Empathy first** - Understand WHY the user chose their answer
4. **Fork, not wrong** - User's thinking "forked" at a point, not "made an error"

## CORE PRINCIPLE: THE DIAGRAM SHOULD MAKE THE ANSWER OBVIOUS

If your diagram doesn't point to the answer, redraw it.

## TOOLS AVAILABLE

${Object.entries(METHOD_DESCRIPTIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## SCENE DECISION TREE

${SCENE_DECISION_TREE}

## ERROR TYPES (use exact codes)

| Code | Display | When to use |
|------|---------|-------------|
| off_topic | "Off topic" | User answered a different question than asked |
| direction_reversed | "Reversed direction" | User flipped the arrow (necessary↔sufficient, cause↔effect) |
| wrong_flaw | "Wrong flaw type" | User identified wrong type of reasoning error |
| frequency_jumped | "Quantity shift" | User jumped from "some" to "all" or similar |
| too_strong | "Too strong" | User chose an option stronger than needed |
| missing_link | "Missing link" | User missed a gap in the reasoning chain |
| irrelevant | "Irrelevant" | Option doesn't affect the argument |
| incomplete_bridge | "Incomplete bridge" | User proved A is true, not that A proves B |
| affirming_consequent | "Affirming consequent" | User assumed result proves cause |
| necessary_vs_sufficient | "Necessary ≠ sufficient" | User confused "required for" with "guarantees" |
| wrong_target | "Wrong target" | User attacked/supported wrong part |
| degree_not_stance | "Degree not stance" | Speakers agree on stance, differ on degree |
| is_vs_ought | "Is vs ought" | Confused "will happen" with "should happen" |

## FEYNMAN EXAMPLES (use these patterns)

- **Necessary vs Sufficient**: "A driver's license is necessary to drive (can't drive without it), but not sufficient (having it doesn't mean you will drive)"
- **Correlation vs Causation**: "Ice cream sales ↑ and drowning ↑ together, but ice cream doesn't cause drowning — summer causes both"
- **Only if translation**: "'Only with a license can you drive' means 'Can drive → Has license', NOT 'Has license → Can drive'"

## LANGUAGE RULES

**NEVER say:**
- "You made an error/mistake"
- "This is wrong because..."
- "You failed to..."
- "The flaw in your reasoning..."

**ALWAYS say:**
- "Your thinking forked here..."
- "I see why you chose this..."
- "The path to the correct answer..."
- "One more step would get you there..."
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stimulus, questionStem, options, userChoice, correctAnswer, userDifficulty, sourceId, userId } = body;

    // Step 1: Classify question type using rules
    const { type: questionType, family: questionFamily, primaryMethods } = classifyQuestion(questionStem);

    // Step 2: Build the analysis prompt
    const analysisPrompt = `${SOP_SYSTEM_PROMPT}

---

## THIS QUESTION

**Pre-classified by rules:**
- Question Type: ${questionType}
- Question Family: ${questionFamily}
- Suggested Methods: ${primaryMethods.join(', ')}

**Stimulus:**
${stimulus}

**Question:**
${questionStem}

**Options:**
(A) ${options.A}
(B) ${options.B}
(C) ${options.C}
(D) ${options.D}
(E) ${options.E}

**User chose:** ${userChoice}
${correctAnswer ? `**User claims correct answer:** ${correctAnswer}` : '**Please determine the correct answer.**'}

---

## YOUR TASK

1. Verify or adjust the question type if needed
2. Select the best method from the decision tree based on stimulus content
3. Draw the diagram using that method
4. Analyze each option
5. Provide empathetic feedback for the user's choice

Respond in this exact JSON format:

{
  "questionType": "${questionType}",
  "questionFamily": "${questionFamily}",
  "correctAnswer": "A/B/C/D/E",
  
  "method": "selected method code from: river_crossing, river_dual_bridge, river_fork, highlight, lego, substitution, venn, formula, abstract_mapping, parallel_bridge, dispute_locate, argument_chain, number_visual, extreme_test",
  
  "analysis": {
    "see": ["key elements identified in stimulus"],
    "understand": "translation of any tricky logic words, direction of argument",
    "mark": "the key chain or structure with gap highlighted",
    "diagram": "TEXT-BASED DIAGRAM using arrows (→), boxes, or simple structure. This should make the answer obvious.",
    "locate": "how the diagram points to the correct answer"
  },
  
  "userChoiceFeedback": {
    "errorType": "code from error types table, or null if correct",
    "errorTypeDisplay": "human readable version",
    "forkPoint": "Where did the user's thinking fork? Be specific about what in the option caught their attention. Under 30 words.",
    "userReasoning": "Why would a smart person choose this? Validate their thinking without judgment. Under 30 words.",
    "bridgeToCorrect": "From their thinking, what's the one step to reach the correct answer? Under 30 words.",
    "diagnosis": "One sentence summary, under 15 words, no jargon."
  },
  
  "correctAnswerExplanation": {
    "brief": "What this option says in plain language",
    "whyCorrect": "Why this is correct, referencing the diagram. 2-3 sentences."
  },
  
  "allOptions": {
    "A": { "brief": "plain language description", "isCorrect": true/false, "errorType": "code or null" },
    "B": { "brief": "plain language description", "isCorrect": true/false, "errorType": "code or null" },
    "C": { "brief": "plain language description", "isCorrect": true/false, "errorType": "code or null" },
    "D": { "brief": "plain language description", "isCorrect": true/false, "errorType": "code or null" },
    "E": { "brief": "plain language description", "isCorrect": true/false, "errorType": "code or null" }
  },
  
  "skillPoint": "The specific skill this question tests",
  "takeaway": "One memorable Feynman-style sentence to remember. Use everyday example if helpful."
}

**CRITICAL:**
- Return ONLY valid JSON, no markdown, no text outside JSON
- diagnosis must be under 15 words
- forkPoint, userReasoning, bridgeToCorrect each under 30 words
- The diagram should make the answer obvious
- Be warm and empathetic, never judgmental`;

    // Step 3: Call Claude via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://logiclue.net',
        'X-Title': 'LogiClue'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 3500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response content from Claude');
    }

    // Step 4: Parse JSON from response
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }

    const analysis = JSON.parse(jsonStr);
    
    // Add derived fields
    analysis.userChoice = userChoice;
    analysis.isCorrect = userChoice === analysis.correctAnswer;

    // Step 5: Save to database
    const contentHash = crypto.createHash('sha256')
      .update(stimulus + questionStem + JSON.stringify(options))
      .digest('hex');

    // Check if question exists
    const { data: existingQuestion } = await supabase
      .from('questions')
      .select('id')
      .eq('content_hash', contentHash)
      .single();

    let questionId: string | null = null;

    if (existingQuestion) {
      questionId = existingQuestion.id;
    } else {
      const { data: newQuestion, error: questionError } = await supabase
        .from('questions')
        .insert({
          stimulus,
          question_stem: questionStem,
          options,
          question_type: analysis.questionType,
          question_family: analysis.questionFamily,
          correct_answer: analysis.correctAnswer,
          llm_suggested_answer: analysis.correctAnswer,
          answer_source: correctAnswer ? 'user' : 'llm',
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
        steps: analysis.analysis || {},
        summary: analysis.correctAnswerExplanation?.whyCorrect,
        skill_point: analysis.skillPoint,
        takeaway: analysis.takeaway
      }, { onConflict: 'question_id' });

      // Save option analyses
      for (const [letter, optionData] of Object.entries(analysis.allOptions)) {
        const opt = optionData as any;
        await supabase.from('option_analyses').upsert({
          question_id: questionId,
          option_letter: letter,
          is_correct: opt.isCorrect,
          content_brief: opt.brief,
          why_correct: opt.isCorrect ? analysis.correctAnswerExplanation : null,
          error: opt.isCorrect ? null : { error_type: opt.errorType }
        }, { onConflict: 'question_id,option_letter' });
      }
    }

    analysis.questionId = questionId;

    return NextResponse.json({ success: true, data: analysis });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Analysis failed: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}