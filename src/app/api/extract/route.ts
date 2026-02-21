import { NextRequest, NextResponse } from 'next/server';

const EXTRACT_SYSTEM_PROMPT = `You are a logic analysis assistant. Extract structured information from the user's description. Return JSON only, no markdown.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, stuck, mode } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    // Build the extraction prompt
    const extractionPrompt = `Extract from this text:
TEXT: ${text}
STUCK: ${stuck || 'Not provided'}

Return this exact JSON:
{
  "description": "the core argument in 1-2 sentences",
  "questionStem": "the question being asked, or empty string if none",
  "userReasoning": "why the user thought their answer was right, or empty string if not provided",
  "mode": "${mode}"
}`;

    // Call Claude via OpenRouter
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
          { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
          { role: 'user', content: extractionPrompt }
        ],
        max_tokens: 1000
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

    // Parse JSON from response
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }

    const extracted = JSON.parse(jsonStr);

    return NextResponse.json({ success: true, data: extracted });

  } catch (error: any) {
    console.error('Extract error:', error);
    return NextResponse.json(
      { success: false, error: 'Extraction failed: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

