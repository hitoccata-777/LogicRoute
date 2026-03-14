import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

type OptionMap = Record<string, string>;

type Question = {
  section: number;
  qnum: number;
  id: string;
  stimulus: string;
  questionStem: string;
  options: OptionMap;
};

type AnswerKey = Record<string, string>;

type ResultRow = {
  questionId: string;
  model: string;
  promptMode: 'minimal-r1-recheck';
  repeatIndex: number;
  correctAnswer: string;
  predictedAnswer: string | null;
  isCorrect: boolean;
  rawText: string;
  latencyMs: number;
  error?: string;
};

// 下次你自己只改这里就行
const TARGET_QUESTION_IDS = [
  'PT88-S1-Q25',
  'PT88-S2-Q08',
  'PT88-S2-Q10',
  'PT88-S2-Q15',
  'PT88-S2-Q21',
  'PT88-S2-Q22',
  'PT88-S2-Q24',
  'PT88-S3-Q05',
  'PT88-S3-Q18',
  'PT88-S3-Q21',
];

// 这里也可以自己改模型
// 注意：OpenRouter / 你当前账户里的准确 model id 可能会变，跑前自己核一下
const MODELS = [
  'google/gemini-2.5-pro',
  'anthropic/claude-sonnet-4.5',
  'meituan/longcat-flash-chat',
  'openai/gpt-5.2-chat',
];

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const APP_TITLE = 'LogicRoute-R1-WrongQuestion-Recheck';

function usage() {
  console.log(
    'Usage: pnpm tsx src/scripts/test-r1-wrong-questions-minimal.ts <dataset.json> <answer_key.json> [repeats]'
  );
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function loadDataset(datasetPath: string): Promise<Question[]> {
  const raw = await readJsonFile<unknown>(datasetPath);
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as any).questions)
      ? (raw as any).questions
      : null;

  if (!arr) {
    throw new Error('Dataset must be an array or { questions: [...] }');
  }

  return arr.map((q, idx) => {
    const item = q as Partial<Question>;
    const validOptions = item.options && typeof item.options === 'object'
      && ['A', 'B', 'C', 'D', 'E'].every(k => typeof item.options?.[k] === 'string');

    if (
      typeof item.section !== 'number' ||
      typeof item.qnum !== 'number' ||
      typeof item.id !== 'string' ||
      typeof item.stimulus !== 'string' ||
      typeof item.questionStem !== 'string' ||
      !validOptions
    ) {
      throw new Error(`Invalid question at index ${idx}`);
    }

    return item as Question;
  });
}

function normalizeAnswerKey(raw: unknown): AnswerKey {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if ((raw as any).answerKey && typeof (raw as any).answerKey === 'object') {
      return (raw as any).answerKey as AnswerKey;
    }
    return raw as AnswerKey;
  }
  throw new Error('Answer key must be an object or { answerKey: {...} }');
}

function buildPrompt(question: Question): string {
  const optionsText = ['A', 'B', 'C', 'D', 'E']
    .map(letter => `${letter}. ${question.options[letter]}`)
    .join('\n');

  return [
    'You are solving one LSAT Logical Reasoning multiple-choice question.',
    'Return JSON only. No markdown fences. No extra commentary.',
    'Use exactly this schema:',
    '{"correct_answer":"A|B|C|D|E","reason":"<=40 words"}',
    '',
    `Question ID: ${question.id}`,
    `Stimulus: ${question.stimulus}`,
    `Question: ${question.questionStem}`,
    'Options:',
    optionsText,
  ].join('\n');
}

async function callOpenRouter(model: string, prompt: string): Promise<{ rawText: string; latencyMs: number }> {
  if (!OPENROUTER_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY in environment');
  }

  const started = Date.now();
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': APP_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    }),
  });

  const latencyMs = Date.now() - started;
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${text}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON OpenRouter response: ${text.slice(0, 500)}`);
  }

  const rawText = json?.choices?.[0]?.message?.content ?? '';
  return { rawText, latencyMs };
}

function extractJsonBlock(rawText: string): string | null {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return rawText.slice(firstBrace, lastBrace + 1);
  }
  return null;
}

function extractPredictedAnswer(rawText: string): string | null {
  const jsonBlock = extractJsonBlock(rawText);
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock);
      const ans = parsed?.correct_answer;
      if (typeof ans === 'string' && /^[A-E]$/i.test(ans.trim())) {
        return ans.trim().toUpperCase();
      }
    } catch {
      // fall through
    }
  }

  const patterns = [
    /"correct_answer"\s*:\s*"([A-E])"/i,
    /\*\*correct_answer\*\*\s*:\s*"?([A-E])"?/i,
    /correct answer\s*(?:is|:)\s*"?([A-E])"?/i,
    /therefore,? the correct answer is\s*([A-E])\b/i,
    /option\s*([A-E])\s+is the correct answer/i,
  ];

  for (const pattern of patterns) {
    const m = rawText.match(pattern);
    if (m?.[1]) return m[1].toUpperCase();
  }

  return null;
}

function makeSummary(rows: ResultRow[]): string {
  const grouped = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const key = row.questionId;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const lines: string[] = [];
  for (const [qid, list] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`\n${qid}`);
    for (const model of MODELS) {
      const subset = list.filter(x => x.model === model);
      if (!subset.length) continue;
      const verdict = subset.map(x => (x.predictedAnswer ?? 'null') + (x.isCorrect ? '✓' : '✗')).join(', ');
      lines.push(`  - ${model}: ${verdict}`);
    }
  }
  return lines.join('\n');
}

async function main() {
  const [, , datasetPath, answerKeyPath, repeatsArg] = process.argv;
  if (!datasetPath || !answerKeyPath) {
    usage();
    process.exit(1);
  }

  const repeats = Number(repeatsArg ?? '1');
  if (!Number.isInteger(repeats) || repeats <= 0) {
    throw new Error('repeats must be a positive integer');
  }

  const dataset = await loadDataset(datasetPath);
  const answerKey = normalizeAnswerKey(await readJsonFile<unknown>(answerKeyPath));

  const targetQuestions = TARGET_QUESTION_IDS.map(id => {
    const q = dataset.find(item => item.id === id);
    if (!q) throw new Error(`Question not found in dataset: ${id}`);
    if (!answerKey[id]) throw new Error(`Answer key missing: ${id}`);
    return q;
  });

  console.log(`===== MODELS: ${MODELS.join(' | ')} =====`);
  console.log(`===== TARGET QUESTIONS: ${targetQuestions.length} =====`);
  console.log(`===== REPEATS PER MODEL: ${repeats} =====`);

  const results: ResultRow[] = [];

  for (const question of targetQuestions) {
    const prompt = buildPrompt(question);
    console.log(`\n### ${question.id}`);

    for (const model of MODELS) {
      for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
        try {
          const { rawText, latencyMs } = await callOpenRouter(model, prompt);
          const predictedAnswer = extractPredictedAnswer(rawText);
          const correctAnswer = answerKey[question.id];
          const isCorrect = predictedAnswer === correctAnswer;

          const row: ResultRow = {
            questionId: question.id,
            model,
            promptMode: 'minimal-r1-recheck',
            repeatIndex,
            correctAnswer,
            predictedAnswer,
            isCorrect,
            rawText,
            latencyMs,
          };
          results.push(row);
          console.log(`[${model}] repeat=${repeatIndex} pred=${predictedAnswer} gold=${correctAnswer} ok=${isCorrect} latency=${latencyMs}ms`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const row: ResultRow = {
            questionId: question.id,
            model,
            promptMode: 'minimal-r1-recheck',
            repeatIndex,
            correctAnswer: answerKey[question.id],
            predictedAnswer: null,
            isCorrect: false,
            rawText: '',
            latencyMs: 0,
            error: message,
          };
          results.push(row);
          console.error(`[ERR] [${model}] q=${question.id} repeat=${repeatIndex} ${message}`);
        }
      }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.resolve(process.cwd(), `final-r1-wrong-question-recheck-${timestamp}.json`);
  await fs.writeFile(outPath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\nSaved results to: ${outPath}`);
  console.log('\n===== SUMMARY =====');
  console.log(makeSummary(results));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
