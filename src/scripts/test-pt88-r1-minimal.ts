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

type AnswerKey = Record<string, string>;

type RunResult = {
  questionId: string;
  model: string;
  promptMode: 'minimal';
  repeatIndex: number;
  correctAnswer: string | null;
  predictedAnswer: string | null;
  isCorrect: boolean;
  rawText: string;
  latencyMs: number;
  error?: string;
};

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error('Missing OPENROUTER_API_KEY in .env.local');
}

const DATASET_PATH =
  process.argv[2] || 'src/data/PT88_no_answers.json';

const ANSWER_KEY_PATH =
  process.argv[3] || 'src/data/PT88_answer_key.json';

const REPEATS = Number(process.argv[4] || 1);
const LIMIT = Number(process.argv[5] || 0);

const MODEL = 'deepseek/deepseek-r1';

function buildMinimalPrompt(q: Question): string {
  return `
You are an LSAT Logical Reasoning judge.

Task:
Read the question carefully and choose the single best answer.

Rules:
- Return only valid JSON
- Use English only
- Do not output markdown
- Keep the reason short

Required JSON format:
{
  "correct_answer": "A/B/C/D/E",
  "reason": "one or two short sentences"
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
`.trim();
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

async function callOpenRouter(prompt: string): Promise<{ text: string; latencyMs: number }> {
  const started = Date.now();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'PT88 R1 Minimal Test'
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
      max_tokens: 1800
    })
  });

  const latencyMs = Date.now() - started;

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = extractTextFromResponse(data);

  return { text, latencyMs };
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
    /\blabel\b\s*[:=]\s*"?([A-E])"?/i
  ];

  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m?.[1]) return m[1].toUpperCase();
  }

  return null;
}

async function loadDataset(filePath: string): Promise<Question[]> {
  const abs = path.resolve(filePath);
  const raw = await fs.readFile(abs, 'utf-8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error('Dataset must be an array');
  }

  return data.map((item, index) => {
    if (!item.id || !item.stimulus || !item.questionStem || !item.options) {
      throw new Error(`Invalid question at index ${index}`);
    }

    for (const key of ['A', 'B', 'C', 'D', 'E']) {
      if (!item.options[key]) {
        throw new Error(`Question ${item.id || index} is missing option ${key}`);
      }
    }

    return item as Question;
  });
}

async function loadAnswerKey(filePath: string): Promise<AnswerKey> {
  const abs = path.resolve(filePath);
  const raw = await fs.readFile(abs, 'utf-8');
  const data = JSON.parse(raw);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Answer key must be a JSON object');
  }

  for (const [qid, ans] of Object.entries(data)) {
    if (typeof ans !== 'string' || !/^[A-E]$/.test(ans)) {
      throw new Error(`Invalid answer key entry: ${qid} -> ${String(ans)}`);
    }
  }

  return data as AnswerKey;
}

function summarize(results: RunResult[]) {
  const totalRuns = results.length;
  const correctRuns = results.filter(r => r.isCorrect).length;
  const parseFail = results.filter(r => !r.predictedAnswer).length;
  const avgLatencyMs = Math.round(
    results.reduce((sum, r) => sum + r.latencyMs, 0) / Math.max(totalRuns, 1)
  );

  const perQuestion = new Map<string, RunResult[]>();
  for (const row of results) {
    if (!perQuestion.has(row.questionId)) perQuestion.set(row.questionId, []);
    perQuestion.get(row.questionId)!.push(row);
  }

  let stableQuestionCount = 0;
  let unstableQuestionCount = 0;

  for (const [, qRows] of perQuestion.entries()) {
    const answers = qRows.map(x => x.predictedAnswer || 'NULL');
    if (new Set(answers).size === 1) stableQuestionCount += 1;
    else unstableQuestionCount += 1;
  }

  const totalQuestions = perQuestion.size;
  const stabilityRate =
    totalQuestions > 0 ? stableQuestionCount / totalQuestions : 0;

  return {
    model: MODEL,
    promptMode: 'minimal',
    totalRuns,
    correctRuns,
    accuracyRate: `${((correctRuns / Math.max(totalRuns, 1)) * 100).toFixed(1)}%`,
    parseFail,
    avgLatencyMs,
    totalQuestions,
    stableQuestions: stableQuestionCount,
    unstableQuestions: unstableQuestionCount,
    stabilityRate: `${(stabilityRate * 100).toFixed(1)}%`
  };
}

async function saveResults(results: RunResult[], tag: string = 'checkpoint') {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve('tmp/pt88-r1-minimal');

  await fs.mkdir(outDir, { recursive: true });

  const rawPath = path.join(outDir, `${tag}-raw-results-${stamp}.json`);
  const summaryPath = path.join(outDir, `${tag}-summary-${stamp}.json`);
  const csvPath = path.join(outDir, `${tag}-raw-results-${stamp}.csv`);

  await fs.writeFile(rawPath, JSON.stringify(results, null, 2), 'utf-8');
  await fs.writeFile(summaryPath, JSON.stringify(summarize(results), null, 2), 'utf-8');

  const csvHeader = [
    'questionId',
    'model',
    'promptMode',
    'repeatIndex',
    'correctAnswer',
    'predictedAnswer',
    'isCorrect',
    'latencyMs',
    'error'
  ].join(',');

  const csvRows = results.map(r =>
    [
      r.questionId,
      r.model,
      r.promptMode,
      r.repeatIndex,
      r.correctAnswer ?? '',
      r.predictedAnswer ?? '',
      r.isCorrect,
      r.latencyMs,
      (r.error ?? '').replace(/,/g, ';').replace(/\n/g, ' ')
    ].join(',')
  );

  await fs.writeFile(csvPath, [csvHeader, ...csvRows].join('\n'), 'utf-8');

  console.log(`\n[Saved ${tag}]`);
  console.log(rawPath);
  console.log(summaryPath);
  console.log(csvPath);
}

async function run() {
  let dataset = await loadDataset(DATASET_PATH);
  if (LIMIT > 0) {
    dataset = dataset.slice(0, LIMIT);
  }

  const answerKey = await loadAnswerKey(ANSWER_KEY_PATH);
  const results: RunResult[] = [];

  console.log(`\n===== MODEL: ${MODEL} =====`);
  console.log(`===== QUESTIONS: ${dataset.length} =====`);

  for (const q of dataset) {
    for (let i = 1; i <= REPEATS; i++) {
      const prompt = buildMinimalPrompt(q);

      try {
        const { text, latencyMs } = await callOpenRouter(prompt);
        const predictedAnswer = extractAnswer(text);
        const gold = answerKey[q.id] ?? null;

        const row: RunResult = {
          questionId: q.id,
          model: MODEL,
          promptMode: 'minimal',
          repeatIndex: i,
          correctAnswer: gold,
          predictedAnswer,
          isCorrect: gold ? predictedAnswer === gold : false,
          rawText: text,
          latencyMs
        };

        results.push(row);

        console.log(
          `[OK] q=${q.id} repeat=${i} predicted=${predictedAnswer} correct=${gold} latency=${latencyMs}ms`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const gold = answerKey[q.id] ?? null;

        const row: RunResult = {
          questionId: q.id,
          model: MODEL,
          promptMode: 'minimal',
          repeatIndex: i,
          correctAnswer: gold,
          predictedAnswer: null,
          isCorrect: false,
          rawText: '',
          latencyMs: 0,
          error: message
        };

        results.push(row);

        console.error(`[ERR] q=${q.id} repeat=${i} ${message}`);
      }
    }

    await saveResults(results, 'checkpoint');
  }

  await saveResults(results, 'final');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});