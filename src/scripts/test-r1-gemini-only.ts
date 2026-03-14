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

// 可选：旧 raw-results 文件；没有就传空字符串
const PREVIOUS_RAW_RESULTS_PATH = process.argv[5] || '';

// 可选：只跑前 N 题；0 表示全跑
const LIMIT = Number(process.argv[6] || 0);

const MODELS_MINIMAL_ONLY = [
  'deepseek/deepseek-r1'
];

const MODELS_BOTH = [
  'google/gemini-2.5-pro'
];

function sanitizeFileName(name: string): string {
  return name.replace(/[\/\\:*?"<>|]/g, '_');
}

function getPromptModesForModel(model: string): PromptMode[] {
  if (MODELS_MINIMAL_ONLY.includes(model)) {
    return ['minimal'];
  }

  if (MODELS_BOTH.includes(model)) {
    return ['minimal', 'current'];
  }

  return ['minimal', 'current'];
}

function getModelConfig(model: string) {
  if (model === 'google/gemini-2.5-pro') {
    return {
      temperature: 0,
      max_tokens: 4000
    };
  }

  if (model === 'deepseek/deepseek-r1') {
    return {
      temperature: 0,
      max_tokens: 1800
    };
  }

  return {
    temperature: 0,
    max_tokens: 1200
  };
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

async function callOpenRouter(
  model: string,
  prompt: string
): Promise<{ text: string; latencyMs: number }> {
  const started = Date.now();
  const cfg = getModelConfig(model);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'LogicRoute R1 + Gemini Test'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: cfg.temperature,
      max_tokens: cfg.max_tokens
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
    /\blabel\b\s*[:=]\s*"?([A-E])"?/i,
    /\bcorrect answer\b\s*[:=]\s*"?([A-E])"?/i
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

async function saveResults(results: RunResult[], tag: string = 'checkpoint') {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve('tmp/r1-gemini-only');

  await fs.mkdir(outDir, { recursive: true });

  const rawPath = path.join(outDir, `${tag}-raw-results-${stamp}.json`);
  const summaryPath = path.join(outDir, `${tag}-summary-${stamp}.json`);
  const csvPath = path.join(outDir, `${tag}-raw-results-${stamp}.csv`);

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
  const previousResults = await loadPreviousResults(PREVIOUS_RAW_RESULTS_PATH);

  const allModels = [
    ...MODELS_MINIMAL_ONLY,
    ...MODELS_BOTH
  ];

  const results: RunResult[] = [...previousResults];
  const existingKeys = new Set(previousResults.map(resultKey));

  for (const model of allModels) {
    const promptModes = getPromptModesForModel(model);

    console.log(`\n===== MODEL: ${model} =====`);

    for (const promptMode of promptModes) {
      console.log(`\n----- promptMode=${promptMode} -----`);

      for (const q of dataset) {
        for (let i = 1; i <= REPEATS; i++) {
          const key = `${model}__${promptMode}__${q.id}__${i}`;

          if (existingKeys.has(key)) {
            console.log(`[SKIP] already exists: ${key}`);
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

        // 每跑完一题就 checkpoint
        await saveResults(results, 'checkpoint');
      }
    }

    // 每跑完一个模型再存一次
    await saveResults(results, `after-${sanitizeFileName(model)}`);
  }

  await saveResults(results, 'final');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});