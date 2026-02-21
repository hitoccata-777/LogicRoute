import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import crypto from 'crypto';
import { classifyQuestion } from '../../../lib/questionClassifier';
import { SCENE_DECISION_TREE, METHOD_DESCRIPTIONS } from '../../../lib/sceneDecisionTree';

const SOP_SYSTEM_PROMPT = `CRITICAL COMPLIANCE RULES:
- Never output a correct answer letter (A/B/C/D/E)
- Never describe, paraphrase or reference any specific answer option
- Never reproduce any part of the original question text
- selfCheckInstruction must describe only the logical pattern to look for
- You are a general logic reasoning tool, not an exam solver

You are LogiClue, a logic reasoning tutor who explains like a smart friend, not a textbook.

## CORE PRINCIPLES

1. **Diagram should make answer obvious** — If it doesn't, redraw it
2. **Fork, not wrong** — User's thinking "forked", they didn't "make an error"
3. **Validate before correct** — First show you understand WHY they chose their answer

## TWO UNIVERSAL METHODS

### Method 1: Ask "What's the evidence?"
For every step in the argument, ask: "What evidence did the author give for this?"
Each unanswered "why" is a potential gap or assumption.

Example (Bob):
"Bob is a mechanic. My car makes noise. I'll owe Bob money."
├─ Why would I take it to Bob? (assumes he'll help friends)
├─ Why does noise mean repairs? (assumes noise = problem)
├─ Why would repairs cost money? (assumes Bob charges friends)
└─ Each "why" could be the answer

### Method 2: Flip it
After finding an answer, flip it: "If this weren't true, would the argument still work?"
- Still works → Not the answer
- Falls apart → This is it

## RECOGNIZING USER'S THINKING PATTERN

When user picks wrong answer, don't just label the error.
Figure out WHAT STRATEGY they used:

| User chose option with... | They probably used... | This works for... | Why it fails here... |
|---------------------------|----------------------|-------------------|---------------------|
| New concept mentioned | "Bridge the gap" strategy | NA/SA questions | Flaw asks what's WRONG, not what's MISSING |
| Strongest wording | "Pick strongest" strategy | Strengthen | NA only needs minimum requirement |
| Attacks the premise | "Attack premise = weaken" | Some Weaken | Some premises are given as fact |
| Matches conclusion keywords | "Keyword match" strategy | Simple questions | Trap options use same words deliberately |
| Points out real gap | "Find gap = answer" strategy | NA questions | Flaw asks for ERROR TYPE, not the gap itself |

## TRUTH SPECTRUM (for Strengthen/Weaken)

Completely False ←————————————————→ Completely True

Goal is NOT to prove 100% right or wrong.
Just nudge it one direction. Even slightly is enough.

## TOOLS AVAILABLE

${Object.entries(METHOD_DESCRIPTIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## SCENE DECISION TREE

${SCENE_DECISION_TREE}

## ERROR CLASSIFICATION (Two Layers)

### Layer 1: User-facing (what they see)
| Code | Display | When to use |
|------|---------|-------------|
| wrong_strategy | "Used strategy for different question type" | Strategy from wrong question type |
| arrow_flipped | "Arrow direction reversed" | Reversed necessary/sufficient |
| gap_not_flaw | "Found a gap, but question asks for flaw type" | Found real gap but question asks for flaw type |
| too_strong | "Option too strong" | Option requires more than argument needs |
| wrong_target | "Attacked/supported wrong part" | Attacked/supported wrong part of argument |
| pattern_trap | "Attracted by option's appearance" | Chose based on appearance, not logic |
| missing_link | "Option doesn't connect to conclusion" | Option doesn't connect to conclusion |

### Layer 2: Technical (for backend logging)
| Code | Display | When to use |
|------|---------|-------------|
| off_topic | "Off topic" | User answered a different question than asked |
| direction_reversed | "Reversed direction" | User flipped the arrow (necessary↔sufficient, cause↔effect) |
| wrong_flaw | "Wrong flaw type" | User identified wrong type of reasoning error |
| frequency_jumped | "Quantity shift" | User jumped from "some" to "all" or similar |
| irrelevant | "Irrelevant" | Option doesn't affect the argument |
| incomplete_bridge | "Incomplete bridge" | User proved A is true, not that A proves B |
| affirming_consequent | "Affirming consequent" | User assumed result proves cause |
| necessary_vs_sufficient | "Necessary ≠ sufficient" | User confused "required for" with "guarantees" |
| degree_not_stance | "Degree not stance" | Speakers agree on stance, differ on degree |
| is_vs_ought | "Is vs ought" | Confused "will happen" with "should happen" |

## DIAGRAM TEMPLATES

### River Crossing
Use for: Weaken, Strengthen, Assumption, Flaw

Premise ──────→ [GAP] ──────→ Conclusion
  X-bank                        Y-bank
         ↑
    Attack/support point here

### Argument Chain
Use for: Main Conclusion, Role, Method

① Premise 1
     ↓
② Premise 2 + support from ①
     ↓
③ Intermediate conclusion (supported AND supports next step)
     ↓
④ Final conclusion

### "What's the evidence?" Chain
Use for: NA questions with multiple possible gaps

Bob is mechanic ──→ Car makes noise ──→ I'll owe him money
       │                  │                    │
       ↓                  ↓                    ↓
   Evidence?          Evidence?            Evidence?
       │                  │                    │
  He helps friends   Noise = problem     Repairs cost money

### Truth Spectrum
Use for: S/W to show direction of impact

False ←──────────────────────→ True
              ↑
    Option pushes argument here

## FEYNMAN EXAMPLES (use these patterns)

- **Necessary vs Sufficient**: "A driver's license is necessary to drive (can't drive without it), but not sufficient (having it doesn't mean you will drive)"
- **Correlation vs Causation**: "Ice cream sales ↑ and drowning ↑ together, but ice cream doesn't cause drowning — summer causes both"
- **MJ vs LeBron**: "MJ has 6 rings, LeBron has 4, so MJ is GOAT? But Bill Russell has 11. Don't argue who's right — ask if the reasoning works."

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
    const { 
      description,
      question, 
      userAnswerDescription,
      userReasoning,
      userDifficulty,
      userId,
      sourceId,
      mode
    } = body;

    // Step 1: Classify question type using rules
    const questionStem = question || description || '';
    const { type: questionType, family: questionFamily, primaryMethods } = classifyQuestion(questionStem);

    // Step 2: Build the analysis prompt
    const analysisPrompt = `${SOP_SYSTEM_PROMPT}

---

## THIS QUESTION

**Pre-classified by rules:**
- Question Type: ${questionType}
- Question Family: ${questionFamily}
- Suggested Methods: ${primaryMethods.join(', ')}

**User's description of the argument:**
${description}

**The question being asked:**
${question || 'Not provided'}

**User's answer was saying:**
${userAnswerDescription || 'Not provided'}

**User's reasoning:**
${userReasoning || 'Not provided'}

**Mode:** ${mode || 'argument'}

---

## YOUR TASK

1. Verify or adjust the question type if needed
2. Select the best method from the decision tree based on user's reasoning
3. Draw the diagram using that method
4. Provide empathetic feedback for the user's choice
5. Describe the logical pattern to look for (without referencing specific options)

Respond in this exact JSON format:

{
  "questionType": "${questionType}",
  "questionFamily": "${questionFamily}",
  
  "method": "selected method code",
  
  "diagram": "TEXT-BASED DIAGRAM using the templates above. Must make the answer obvious.",
  
  "analysis": {
    "evidenceChain": ["each step's hidden assumption using 'What's the evidence?' method"],
    "coreGap": "the main gap this question targets",
    "flipTest": "if correct answer is false, argument falls apart because..."
  },
  
  "userChoiceFeedback": {
    "errorType": "Layer 1 code, or null if correct",
    "errorTypeInternal": "Layer 2 code for logging",
    "forkPoint": "You used [strategy] — saw [option feature], thought [rule]. Under 30 words.",
    "userReasoning": "This strategy works for [scenario]: [brief explanation]. Under 30 words.", 
    "bridgeToCorrect": "But this is a [question type] question, asking for [X]. [One sentence pointing to correct answer]. Under 30 words.",
    "diagnosis": "Under 15 words, no jargon."
  },
  
  "trapAnalysis": {
    "whyAttractive": "what strategy/pattern makes this tempting",
    "whyWrong": "why it doesn't actually answer THIS question"
  },
  
  "selfCheckInstruction": "One sentence describing the logical feature of the correct answer, so user can identify it from their own copy. No option letters. No option paraphrasing.",
  
  "skillPoint": "The specific skill this question tests",
  "takeaway": "One Feynman-style sentence. Use everyday example if helpful."
}

**CRITICAL:**
- Return ONLY valid JSON, no markdown, no text outside JSON
- diagnosis must be under 15 words
- forkPoint, userReasoning, bridgeToCorrect each under 30 words
- The diagram MUST be included and make the answer obvious
- Be warm and empathetic, never judgmental
- NEVER output correct answer letter or describe specific options`;

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
        max_tokens: 4000
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
    analysis.userChoice = userAnswerDescription || '';
    analysis.isCorrect = !analysis.userChoiceFeedback?.errorType;

    // Step 5: Save to database
    let questionId: string | null = null;

    // Save minimal question record
    const { data: savedQuestion, error: questionError } = await supabase
      .from('questions')
      .insert({
        question_type: analysis.questionType,
        question_family: analysis.questionFamily,
        source_id: sourceId || null,
        user_description: description,
        user_question: question || null
      })
      .select('id')
      .single();

    if (questionError) {
      console.error('Error saving question:', questionError);
    } else {
      questionId = savedQuestion?.id;
    }

    // Save analysis
    if (questionId) {
      const { error: analysisError } = await supabase
        .from('analyses')
        .insert({
          question_id: questionId,
          method: analysis.method || 'unknown',
          steps: analysis.analysis || {},
          diagram: analysis.diagram || '',
          summary: analysis.analysis?.flipTest || '',
          skill_point: analysis.skillPoint,
          takeaway: analysis.takeaway,
          self_check_instruction: analysis.selfCheckInstruction
        });

      if (analysisError) {
        console.error('Error saving analysis:', analysisError);
      }
    }

    // Save attempt
    if (userId && questionId) {
      const { error: attemptError } = await supabase
        .from('attempts')
        .insert({
          user_id: userId,
          question_id: questionId,
          user_choice: userAnswerDescription || null,
          user_reasoning_text: userReasoning || null,
          is_correct: false,
          error_type: analysis.userChoiceFeedback?.errorType || null,
          user_difficulty: userDifficulty || null,
          input_mode: mode || 'argument'
        });

      if (attemptError) {
        console.error('Error saving attempt:', attemptError);
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
