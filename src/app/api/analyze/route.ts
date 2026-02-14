import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stimulus, questionStem, options, userChoice, correctAnswer, userDifficulty, sourceId } = body;

    const prompt = `You are an expert LSAT logical reasoning tutor. Analyze this question and provide detailed feedback.

QUESTION:
${stimulus}

${questionStem}

(A) ${options.A}
(B) ${options.B}
(C) ${options.C}
(D) ${options.D}
(E) ${options.E}

User selected: ${userChoice}
${correctAnswer ? `User claims correct answer is: ${correctAnswer}` : 'Please determine the correct answer.'}

Respond in this exact JSON format:
{
  "correctAnswer": "A/B/C/D/E",
  "questionType": "e.g., Method of Reasoning, Weaken, Strengthen, etc.",
  "userChoiceFeedback": {
    "errorType": "one of: off_topic, direction_reversed, wrong_flaw, frequency_jumped, too_strong, missing_link, irrelevant, incomplete_bridge, affirming_consequent, necessary_vs_sufficient, wrong_target, or null if correct",
    "errorTypeDisplay": "Human readable error type",
    "diagnosis": "One sentence explaining why user's choice was wrong (or right)"
  },
  "correctAnswerExplanation": {
    "brief": "Short description of correct answer",
    "whyCorrect": "Detailed explanation of why this is correct"
  },
  "diagram": {
    "type": "argument_structure or chain or comparison",
    "content": {
      "description": "Text-based diagram or structure explanation"
    }
  },
  "allOptions": {
    "A": { "brief": "short description", "isCorrect": true/false, "errorType": "if wrong" },
    "B": { "brief": "short description", "isCorrect": true/false, "errorType": "if wrong" },
    "C": { "brief": "short description", "isCorrect": true/false, "errorType": "if wrong" },
    "D": { "brief": "short description", "isCorrect": true/false, "errorType": "if wrong" },
    "E": { "brief": "short description", "isCorrect": true/false, "errorType": "if wrong" }
  },
  "skillPoint": "The skill this question tests",
  "takeaway": "One memorable sentence to remember"
}

Return ONLY valid JSON, no other text.`;

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
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000
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

    // Parse JSON from response (handle markdown code blocks if present)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }

    const analysis = JSON.parse(jsonStr);
    
    // Add user's choice info
    analysis.userChoice = userChoice;
    analysis.isCorrect = userChoice === analysis.correctAnswer;

    return NextResponse.json({ success: true, data: analysis });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Claude API error: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
