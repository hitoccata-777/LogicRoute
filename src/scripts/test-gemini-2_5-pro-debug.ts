import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

type Question = {
  id: string;
  stimulus: string;
  questionStem: string;
  options: Record<string, string>;
};

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error('Missing OPENROUTER_API_KEY in .env.local');
}

const DATASET_PATH =
  process.argv[2] || 'src/data/judge_test_17_no_answers.json';

// 可选：命令行指定题号；不传就默认测 PT17-S2-Q22
const TARGET_ID = process.argv[3] || 'PT17-S2-Q22';

const MODEL = 'google/gemini-2.5-pro';

function buildCurrentPrompt(q: Question): string {
  return `
You are LogiClue's Judge layer.

Your job is to identify the question family, choose the best method, form a faithful core judgment, and select the correct answer.

Do not do user-facing teaching.
Do not add ideas not supported by the stimulus or options.

Core rules:
1. Understand first, then judge.
2. Stay faithful to the stimulus.
3. The chosen answer must directly match the core judgment.
4. Choose method based on the argument's actual features, not just the question stem.

Return one JSON object only:

{
  "question_family": "...",
  "method": "...",
  "core_judgment": "...",
  "correct_option": {
    "label": "A-E",
    "reason": "..."
  },
  "faithfulness_check": "pass|revised|fallback"
}

Question:
Stimulus:
${q.stimulus}

Question Stem:
${q.questionStem}

Options:
A. ${q.options.A}
B. ${q.options.B}
C. ${q.options.C}
D. ${q.options.D}
E. ${q.options.E}

Do not output markdown fences.
`.trim();
}

async function loadDataset(filePath: string): Promise<Question[]> {
  const abs = path.resolve(filePath);
  const raw = await fs.readFile(abs, 'utf-8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error('Dataset must be an array');
  }

  return data as Question[];
}

function extractTextFromResponse(data: any): string {
  const msg = data?.choices?.[0]?.message;

  if (typeof msg?.content === 'string' && msg.content.trim()) {
    return msg.content.trim();
  }

  if (Array.isArray(msg?.content)) {
    const joined = msg.content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return JSON.stringify(part);
      })
      .join('\n')
      .trim();

    if (joined) return joined;
  }

  if (typeof data?.choices?.[0]?.text === 'string' && data.choices[0].text.trim()) {
    return data.choices[0].text.trim();
  }

  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return '';
}

function extractAnswer(rawText: string): string | null {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    const candidates = [
      parsed?.correct_answer,
      parsed?.answer,
      parsed?.correct_option?.label,
      parsed?.correct_option
    ];

    for (const ans of candidates) {
      if (typeof ans === 'string') {
        const v = ans.trim().toUpperCase();
        if (/^[A-E]$/.test(v)) return v;
      }
    }
  } catch {
    // ignore
  }

  const patterns = [
    /"correct_answer"\s*:\s*"([A-E])"/i,
    /"answer"\s*:\s*"([A-E])"/i,
    /"correct_option"\s*:\s*\{[\s\S]*?"label"\s*:\s*"([A-E])"/i,
    /"correct_option"\s*:\s*"([A-E])"/i,
    /\blabel\b\s*[:=]\s*"?([A-E])"?/i,
    /\bcorrect answer\b\s*[:=]\s*"?([A-E])"?/i
  ];

  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m?.[1]) return m[1].toUpperCase();
  }

  return null;
}

async function callOpenRouter(prompt: string) {
  const started = Date.now();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Gemini 2.5 Pro Debug Probe'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 4000
    })
  });

  const latencyMs = Date.now() - started;

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = extractTextFromResponse(data);

  return { data, text, latencyMs };
}

async function run() {
  const dataset = await loadDataset(DATASET_PATH);
  const q = dataset.find(x => x.id === TARGET_ID);

  if (!q) {
    throw new Error(`Question not found: ${TARGET_ID}`);
  }

  const prompt = buildCurrentPrompt(q);
  const { data, text, latencyMs } = await callOpenRouter(prompt);
  const predicted = extractAnswer(text);

  console.log(`\n===== MODEL =====\n${MODEL}`);
  console.log(`\n===== QUESTION =====\n${q.id}`);
  console.log(`\n===== LATENCY =====\n${latencyMs}ms`);

  console.log('\n===== RAW API RESPONSE =====\n');
  console.log(JSON.stringify(data, null, 2));

  console.log('\n===== EXTRACTED TEXT =====\n');
  console.log(text || '[EMPTY TEXT]');

  console.log('\n===== EXTRACTED ANSWER =====\n');
  console.log(predicted ?? 'null');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});