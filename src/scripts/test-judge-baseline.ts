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

type PromptMode = 'minimal' | 'current';

type RunResult = {
  questionId: string;
  model: string;
  promptMode: PromptMode;
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
  process.argv[2] || 'src/data/judge_test_17_no_answers.json';

const ANSWER_KEY_PATH =
  process.argv[3] || 'src/data/judge_test_17_answer_key.json';

const REPEATS = Number(process.argv[4] || 3);

// 可选：上一轮 raw-results.json 路径
const PREVIOUS_RAW_RESULTS_PATH = process.argv[5] || '';

// 老三家：只补 current
const EXISTING_MODELS_CURRENT_ONLY = [
  'openai/gpt-5.2-chat',
  'anthropic/claude-sonnet-4.5',
  'meituan/longcat-flash-chat'
];

// 新模型：minimal + current 都跑
const NEW_MODELS_BOTH = [
  'openai/o1',
  'deepseek/deepseek-r1',
  'google/gemini-3.1-pro-preview'
];

function getPromptModesForModel(model: string): PromptMode[] {
  if (EXISTING_MODELS_CURRENT_ONLY.includes(model)) {
    return ['current'];
  }
  if (NEW_MODELS_BOTH.includes(model)) {
    return ['minimal', 'current'];
  }
  return ['minimal', 'current'];
}

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

function buildPrompt(q: Question, promptMode: PromptMode): string {
  if (promptMode === 'minimal') return buildMinimalPrompt(q);
  return buildCurrentPrompt(q);
}

async function callOpenRouter(
  model: string,
  prompt: string
): Promise<{ text: string; latencyMs: number }> {
  const started = Date.now();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'LogicRoute Judge Baseline Test V2'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 1200
    })
  });

  const latencyMs = Date.now() - started;

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';

  return { text, latencyMs };
}

function extractAnswer(rawText: string): string | null {
  const cleaned = rawText.trim();

  try {
    const parsed = JSON.parse(cleaned);

    const ans1 = parsed?.correct_answer;
    if (typeof ans1 === 'string' && /^[A-E]$/.test(ans1.trim())) {
      return ans1.trim();
    }

    const ans2 = parsed?.answer;
    if (typeof ans2 === 'string' && /^[A-E]$/.test(ans2.trim())) {
      return ans2.trim();
    }

    const ans3 = parsed?.correct_option?.label;
    if (typeof ans3 === 'string' && /^[A-E]$/.test(ans3.trim())) {
      return ans3.trim();
    }
  } catch {
    // ignore
  }

  const patterns = [
    /"correct_answer"\s*:\s*"([A-E])"/i,
    /"answer"\s*:\s*"([A-E])"/i,
    /"correct_option"\s*:\s*\{[\s\S]*?"label"\s*:\s*"([A-E])"/i,
    /\bcorrect_answer\b\s*[:=]\s*"?([A-E])"?/i,
    /\banswer\b\s*[:=]\s*"?([A-E])"?/i,
    /\blabel\b\s*[:=]\s*"?([A-E])"?/i
  ];

  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m?.[1] && /^[A-E]$/.test(m[1])) {
      return m[1];
    }
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

    const requiredOptions = ['A', 'B', 'C', 'D', 'E'];
    for (const key of requiredOptions) {
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

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [qid, ans] of Object.entries(data)) {
      if (typeof ans !== 'string' || !/^[A-E]$/.test(ans)) {
        throw new Error(`Invalid answer key entry: ${qid} -> ${String(ans)}`);
      }
    }
    return data as AnswerKey;
  }

  if (Array.isArray(data)) {
    const key: AnswerKey = {};
    for (const item of data) {
      if (!item.id || !item.correctAnswer || !/^[A-E]$/.test(item.correctAnswer)) {
        throw new Error('Array answer source must contain id + correctAnswer');
      }
      key[item.id] = item.correctAnswer;
    }
    return key;
  }

  throw new Error(
    'Answer key must be either a JSON object or an array with id + correctAnswer'
  );
}

async function loadPreviousResults(filePath: string): Promise<RunResult[]> {
  if (!filePath) return [];
  const abs = path.resolve(filePath);
  const raw = await fs.readFile(abs, 'utf-8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error('Previous raw results must be an array');
  }

  return data as RunResult[];
}

function resultKey(r: RunResult): string {
  return `${r.model}__${r.promptMode}__${r.questionId}__${r.repeatIndex}`;
}

function summarize(results: RunResult[]) {
  const byGroup = new Map<string, RunResult[]>();

  for (const r of results) {
    const key = `${r.model}__${r.promptMode}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(r);
  }

  const summary = Array.from(byGroup.entries()).map(([key, rows]) => {
    const [model, promptMode] = key.split('__');

    const totalRuns = rows.length;
    const correctRuns = rows.filter(r => r.isCorrect).length;
    const parseFail = rows.filter(r => !r.predictedAnswer).length;
    const avgLatencyMs = Math.round(
      rows.reduce((sum, r) => sum + r.latencyMs, 0) / Math.max(totalRuns, 1)
    );

    const perQuestion = new Map<string, RunResult[]>();
    for (const row of rows) {
      if (!perQuestion.has(row.questionId)) perQuestion.set(row.questionId, []);
      perQuestion.get(row.questionId)!.push(row);
    }

    let stableQuestionCount = 0;
    let unstableQuestionCount = 0;

    for (const [, qRows] of perQuestion.entries()) {
      const answers = qRows.map(x => x.predictedAnswer || 'NULL');
      const uniqueCount = new Set(answers).size;

      if (uniqueCount === 1) stableQuestionCount += 1;
      else unstableQuestionCount += 1;
    }

    const totalQuestions = perQuestion.size;
    const stabilityRate =
      totalQuestions > 0 ? stableQuestionCount / totalQuestions : 0;

    return {
      model,
      promptMode,
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
  });

  summary.sort((a, b) => {
    if (a.model === b.model) return a.promptMode.localeCompare(b.promptMode);
    return a.model.localeCompare(b.model);
  });

  return summary;
}

async function saveResults(results: RunResult[]) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve('tmp/judge-baseline');

  await fs.mkdir(outDir, { recursive: true });

  const rawPath = path.join(outDir, `combined-raw-results-${stamp}.json`);
  const summaryPath = path.join(outDir, `combined-summary-${stamp}.json`);
  const csvPath = path.join(outDir, `combined-raw-results-${stamp}.csv`);

  await fs.writeFile(rawPath, JSON.stringify(results, null, 2), 'utf-8');

  const summary = summarize(results);
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

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

  console.log('\n==================== COMBINED SUMMARY ====================');
  console.table(summary);
  console.log('\nSaved files:');
  console.log(rawPath);
  console.log(summaryPath);
  console.log(csvPath);
}

async function run() {
  const dataset = await loadDataset(DATASET_PATH);
  const answerKey = await loadAnswerKey(ANSWER_KEY_PATH);
  const previousResults = await loadPreviousResults(PREVIOUS_RAW_RESULTS_PATH);

  const allModels = [
    ...EXISTING_MODELS_CURRENT_ONLY,
    ...NEW_MODELS_BOTH
  ];

  const results: RunResult[] = [...previousResults];
  const existingKeys = new Set(previousResults.map(resultKey));

  for (const model of allModels) {
    const promptModes = getPromptModesForModel(model);

    for (const promptMode of promptModes) {
      console.log(`\n===== Testing model=${model}, promptMode=${promptMode} =====`);

      for (const q of dataset) {
        for (let i = 1; i <= REPEATS; i++) {
          const fakeKey = `${model}__${promptMode}__${q.id}__${i}`;

          if (existingKeys.has(fakeKey)) {
            console.log(`[SKIP] already exists: ${fakeKey}`);
            continue;
          }

          const prompt = buildPrompt(q, promptMode);

          try {
            const { text, latencyMs } = await callOpenRouter(model, prompt);
            const predictedAnswer = extractAnswer(text);
            const gold = answerKey[q.id] ?? null;

            const row: RunResult = {
              questionId: q.id,
              model,
              promptMode,
              repeatIndex: i,
              correctAnswer: gold,
              predictedAnswer,
              isCorrect: gold ? predictedAnswer === gold : false,
              rawText: text,
              latencyMs
            };

            results.push(row);
            existingKeys.add(resultKey(row));

            console.log(
              `[OK] q=${q.id} repeat=${i} predicted=${predictedAnswer} correct=${gold} latency=${latencyMs}ms`
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const gold = answerKey[q.id] ?? null;

            const row: RunResult = {
              questionId: q.id,
              model,
              promptMode,
              repeatIndex: i,
              correctAnswer: gold,
              predictedAnswer: null,
              isCorrect: false,
              rawText: '',
              latencyMs: 0,
              error: message
            };

            results.push(row);
            existingKeys.add(resultKey(row));

            console.error(`[ERR] q=${q.id} repeat=${i} ${message}`);
          }
        }
      }
    }
  }

  await saveResults(results);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});