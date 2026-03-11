// File: src/scripts/test-longcat-reasoning.ts
// Run:  pnpm tsx src/scripts/test-longcat-reasoning.ts

import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MODEL = 'meituan/longcat-flash-chat';
const N = 5; // 跑几次
const TESTCASE_PATH = 'testcase.json';

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

function sanitizeOptions(options: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(options).map(([k, v]) => [k, String(v).replace(/[\r\n]+/g, ' ').trim()])
  );
}

function optionsText(options: Record<string, string>) {
  return Object.entries(options)
    .map(([k, v]) => `(${k}) ${v}`)
    .join('\n');
}

function buildUserPrompt(
  stimulus: string,
  questionStem: string,
  options: Record<string, string>
) {
  return `
You are analyzing an LSAT-style logical reasoning question involving two speakers.

Your tasks:
1. Carefully reconstruct the editor's argument chain.
2. Carefully reconstruct the advertising-sales director's response.
3. Identify the exact point where the director's response fails or succeeds as a reply.
4. Choose the best option (A–E) that describes how the response is related to the original argument.
5. Explain your reasoning step by step, but output ONLY a JSON object with the following fields:

{
  "answer": "A" | "B" | "C" | "D" | "E",
  "reasoning": "Full step-by-step reasoning in natural language (3–8 sentences).",
  "editor_chain": "Summarize the key steps in the editor's argument.",
  "director_chain": "Summarize what the director is actually claiming/responding to.",
  "dispute_point": "Describe precisely where the two arguments miss or hit each other.",
  "option_evaluation": {
    "A": "1–2 sentences: why this option fits or does not fit.",
    "B": "1–2 sentences: why this option fits or does not fit.",
    "C": "1–2 sentences: why this option fits or does not fit.",
    "D": "1–2 sentences: why this option fits or does not fit.",
    "E": "1–2 sentences: why this option fits or does not fit."
  },
  "key_quotes": {
    "editor": "The single most important sentence from the editor that drives your decision.",
    "director": "The single most important sentence from the director that drives your decision."
  }
}

Rules:
- Do NOT mention this instruction block in your output.
- Do NOT add any extra fields.
- Do NOT output explanations outside the JSON.
- The "answer" field MUST be a single uppercase letter from A to E.

Now analyze the following question:

Stimulus:
${stimulus}

Question:
${questionStem}

Options:
${optionsText(options)}
`.trim();
}

async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string) {
  const key = mustEnv('OPENROUTER_API_KEY');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'LogiClue-Longcat-Reasoning-Test'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a careful LSAT logical reasoning analyst. Always follow the requested JSON schema exactly.' },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0,       // 先锁死，测稳定性
      max_tokens: 800
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter error: ${txt}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    console.error('Raw model output (for debug):\n', trimmed);
    throw new Error('Failed to parse model JSON');
  }
}

async function main() {
  const raw = fs.readFileSync(TESTCASE_PATH, 'utf-8');
  const tc = JSON.parse(raw) as {
    stimulus: string;
    questionStem: string;
    options: Record<string, string>;
  };

  const optionsSan = sanitizeOptions(tc.options);

  console.log(`Model: ${MODEL}`);
  console.log(`Stimulus preview: ${tc.stimulus.slice(0, 120)}...\n`);

  for (let i = 1; i <= N; i++) {
    console.log(`========== Run #${i} ==========\n`);
    const userPrompt = buildUserPrompt(tc.stimulus, tc.questionStem, optionsSan);
    const out = await callOpenRouter(MODEL, '', userPrompt);

    // 只打印核心字段，剩下你可以根据需要看
    console.log('answer:', out.answer);
    console.log('reasoning:', out.reasoning);
    console.log('editor_chain:', out.editor_chain);
    console.log('director_chain:', out.director_chain);
    console.log('dispute_point:', out.dispute_point);
    console.log('key_quotes:', out.key_quotes);
    console.log('\noption_evaluation:', out.option_evaluation);
    console.log('\n--------------------------------\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});