import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stimulus, questionStem, options, userChoice, correctAnswer, userDifficulty, sourceId } = body;

    // Validate required fields
    if (!stimulus || !questionStem || !options || !userChoice) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: stimulus, questionStem, options, userChoice' },
        { status: 400 }
      );
    }

    // Validate options structure
    if (!options.A || !options.B || !options.C || !options.D || !options.E) {
      return NextResponse.json(
        { success: false, error: 'All options (A-E) are required' },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

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
${userDifficulty ? `User rated difficulty: ${userDifficulty}/5` : ''}
${sourceId ? `Source: ${sourceId}` : ''}

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

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        { role: "user", content: prompt }
      ],
    });

    // Extract text content from response
    const textContent = message.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response
    // Claude might return JSON wrapped in markdown code blocks, so we need to extract it
    let jsonText = textContent.text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    const analysis = JSON.parse(jsonText);
    
    // Validate that we got the expected structure
    if (!analysis.correctAnswer || !analysis.questionType) {
      throw new Error('Invalid response structure from Claude');
    }
    
    // Add user's choice info
    analysis.userChoice = userChoice;
    analysis.isCorrect = userChoice === analysis.correctAnswer;

    return NextResponse.json({ success: true, data: analysis });

  } catch (error: any) {
    console.error('Analysis error:', error);
    
    // Handle JSON parse errors specifically
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse Claude response as JSON', details: error.message },
        { status: 500 }
      );
    }
    
    // Handle Anthropic API errors
    if (error.status) {
      return NextResponse.json(
        { success: false, error: 'Claude API error', details: error.message },
        { status: error.status || 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to analyze question', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

