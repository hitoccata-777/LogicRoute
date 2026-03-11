// File: src/scripts/test-judge-reverse.ts
// Run: pnpm tsx src/scripts/test-judge-reverse.ts

import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MODELS = [
        'meituan/longcat-flash-chat',
    ];
const N = 5; // 每个实验跑几次
const FULL_TEXT_PATH = 'testcase.json'; // 你把完整题粘在这里

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

function parseQuestionText(text: string) {
  const optionPattern = /\(([A-E])\)|^([A-E])\./gm;
  const matches = [...text.matchAll(optionPattern)];

  if (matches.length === 0) {
    return { stimulus: text.trim(), questionStem: '', optionsText: '' };
  }

  const firstOptionIndex = matches[0].index ?? 0;
  const beforeOptions = text.substring(0, firstOptionIndex).trim();

  const questionMatch = beforeOptions.match(/[^.!?]*\?[^.!?]*/g);
  const lastQuestion = questionMatch ? questionMatch[questionMatch.length - 1].trim() : '';

  let stimulus = beforeOptions;
  let questionStem = '';

  if (lastQuestion) {
    const qi = beforeOptions.lastIndexOf(lastQuestion);
    stimulus = beforeOptions.substring(0, qi).trim();
    questionStem = lastQuestion.trim();
  }

  const optionsText = text.substring(firstOptionIndex).trim();
  return { stimulus, questionStem, optionsText };
}

function parseOptionsFromText(text: string): Record<string, string> {
  const options: Record<string, string> = {};
  const lines = text.split('\n');
  let currentLetter = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^\(([A-E])\)\s*(.+)|^([A-E])[.)\s]+(.+)/);
    if (match) {
      currentLetter = match[1] || match[3] || '';
      const lineText = match[2] || match[4] || '';
      if (currentLetter && lineText) options[currentLetter] = lineText.trim();
    } else if (currentLetter) {
      options[currentLetter] = (options[currentLetter] + ' ' + trimmed).trim();
    }
  }

  return options;
}

function sanitizeOptions(options: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(options).map(([k, v]) => [k, String(v).replace(/[\r\n]+/g, ' ').trim()])
  );
}

function optionsText(options: Record<string, string>) {
  return Object.entries(options).map(([k, v]) => `(${k}) ${v}`).join('\n');
}

// 3) callOpenRouter：加 model 参数
async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string) {
    const key = mustEnv('OPENROUTER_API_KEY');
  
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'LogiClue-Reverse-Test',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 350,
      }),
    });
  
    if (!res.ok) throw new Error(await res.text());
  
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    return content.trim();
  }

function extractLetter(s: string): string {
  const m = s.toUpperCase().match(/[A-E]/);
  return m ? m[0] : `?(${s.slice(0, 40)})`;
}

function buildUser(stimulus: string, questionStem: string, options: Record<string, string>, tail: string) {
  return `Stimulus:
${stimulus}

Question:
${questionStem}

Options:
${optionsText(options)}

${tail}`;
}

// 实验从 0 条约束开始：system 基本空，逐条加 1 条
const EXPERIMENTS: Array<{ name: string; system: string; tail: string }> = [
    { name: 'C0', system: `You are a helpful assistant.`, tail: `Output ONE JSON only:
  {"answer":"A-E","a_chain":"<=40 words","b_target":"<=25 words","quote":"ONE exact sentence copied verbatim from the stimulus"}
  Rules:
  - answer must be a single letter A-E
  - quote must be copied exactly from the stimulus (verbatim)
  - keep a_chain and b_target short
  No markdown. No extra keys.` },
    //{ name: 'C4', system: `You are a helpful assistant.\n\n[EXP4]\nBefore choosing, run a strict faithfulness check: do not introduce any claim about the author’s views that is not explicitly stated. Prefer answers that can be justified with minimal assumptions.`, tail: `Choose A-E. Output ONLY one uppercase letter.` },
    //{ name: 'C34', system: `You are a helpful assistant.\n\n[EXP3]\nIf you choose an option that says misinterpret/misunderstand/mistaken view, you must be able to cite the exact sentence in the stimulus that states the misunderstood view; otherwise you must NOT choose it.\n\n[EXP4]\nBefore choosing, run a strict faithfulness check: do not introduce any claim about the author’s views that is not explicitly stated. Prefer answers that can be justified with minimal assumptions.`, tail: `Choose A-E. Output ONLY one uppercase letter.` },
  ];

// 4) runSuite：加 model 参数
async function runSuite(
    model: string,
    label: string,
    stimulus: string,
    questionStem: string,
    options: Record<string, string>
  ) {
    console.log(`\n==================== ${label} | ${model} ====================\n`);
  
    for (const exp of EXPERIMENTS) {
      // C0：输出可检验JSON（不走 extractLetter）
      if (exp.name === 'C0') {
        for (let i = 0; i < N; i++) {
          const user = buildUser(stimulus, questionStem, options, exp.tail);
          const out = await callOpenRouter(model, exp.system, user);
          console.log(`${exp.name}[${i + 1}]: ${out}`);
        }
        continue;
      }
  
      // 其他实验：照旧输出字母
      const letters: string[] = [];
      for (let i = 0; i < N; i++) {
        const user = buildUser(stimulus, questionStem, options, exp.tail);
        const out = await callOpenRouter(model, exp.system, user);
        letters.push(extractLetter(out));
      }
      console.log(`${exp.name}: ${letters.join(' ')}`);
    }
  }

// 5) main：循环模型
async function main() {
    const full = fs.readFileSync(FULL_TEXT_PATH, 'utf-8');
    const { stimulus, questionStem, optionsText: optText } = parseQuestionText(full);
    const optsRaw = parseOptionsFromText(optText);
    const optsSan = sanitizeOptions(optsRaw);
  
    for (const model of MODELS) {
      await runSuite(model, 'RAW options', stimulus, questionStem, optsRaw);
      await runSuite(model, 'SANITIZED options (product-like)', stimulus, questionStem, optsSan);
    }
  }

main().catch((e) => {
  console.error(e);
  process.exit(1);
});