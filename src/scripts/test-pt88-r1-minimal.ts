import fs from 'node:fs/promises'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E'

type Question = {
  section: number
  qnum: number
  id: string
  stimulus: string
  questionStem: string
  options: Record<OptionLetter, string>
}

type AnswerKey = Record<string, OptionLetter>

type DatasetPair = {
  questionsPath: string
  answerKeyPath: string
}

type OpenRouterResponse = {
  id?: string
  choices?: Array<{
    message?: {
      content?: string
    }
    finish_reason?: string
    native_finish_reason?: string
  }>
}

type ParsedModelOutput = {
  correct_option?: string
  reasoning?: string
  core_issue?: string
  why_not_others?: Record<string, string>
  confidence?: string
}

const DEFAULT_MODEL = 'deepseek/deepseek-r1'
const MAX_TOKENS = 4000
const TEMPERATURE = 0

const TARGET_IDS = [
  'PT88-S2-Q08',
  'PT88-S2-Q15',
  'PT88-S2-Q19',
  'PT88-S3-Q18',
  'PT88-S3-Q19',
  'PT88-S3-Q21',
  'PT89-S1-Q01',
  'PT89-S1-Q20',
  'PT89-S1-Q23',
  'PT89-S1-Q25',
  'PT89-S2-Q18',
  'PT89-S2-Q25',
  'PT89-S3-Q20',
  'PT89-S3-Q23',
  'PT89-S3-Q25',
  'PT90-S1-Q07',
  'PT90-S2-Q20',
  'PT90-S2-Q21',
  'PT90-S2-Q23',
  'PT91-S1-Q17',
  'PT91-S1-Q18',
  'PT91-S1-Q21',
  'PT91-S1-Q24',
  'PT92-S2-Q19',
  'PT92-S2-Q24',
  'PT92-S2-Q25',
  'PT92-S3-Q06',
  'PT92-S3-Q14',
  'PT92-S4-Q16',
  'PT92-S4-Q26',
  'PT93-S1-Q03',
  'PT93-S1-Q22',
  'PT93-S2-Q12',
  'PT93-S2-Q17',
  'PT93-S2-Q18',
  'PT93-S2-Q22',
  'PT93-S2-Q24',
  'PT93-S2-Q25',
  'PT93-S3-Q10',
  'PT93-S3-Q22',
  'PT93-S3-Q23'
] as const

function usage() {
  console.log(`
Usage:
  pnpm tsx src/scripts/test-pt88-r1-minimal.ts --datasets="questions.json:answer_key.json,questions.json:answer_key.json" [--repeat=1] [--model=deepseek/deepseek-r1]

Required:
  --datasets=...

Optional:
  --repeat=1
  --model=deepseek/deepseek-r1

Example:
  pnpm tsx src/scripts/test-pt88-r1-minimal.ts --datasets="src/data/PT88_no_answers_repaired_all.json:src/data/PT88_answer_key_fixed.json,src/data/PT89_no_answers_repaired_all.json:src/data/PT89_answer_key.json,src/data/PT90_no_answers_repaired_all.json:src/data/PT90_answer_key.json,src/data/PT91_no_answers_repaired_all.json:src/data/PT91_answer_key.json,src/data/PT92_no_answers_repaired_all.json:src/data/PT92_answer_key.json,src/data/PT93_no_answers_repaired_all.json:src/data/PT93_answer_key.json" --repeat=1 --model=deepseek/deepseek-r1
`)
}

function isOptionLetter(value: string): value is OptionLetter {
  return ['A', 'B', 'C', 'D', 'E'].includes(value)
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

function validateQuestion(question: unknown, index: number, filePath: string): Question {
  if (!question || typeof question !== 'object') {
    throw new Error(`Invalid question at index ${index} in ${filePath}: not an object`)
  }

  const q = question as Partial<Question>

  const validOptions =
    q.options &&
    typeof q.options === 'object' &&
    ['A', 'B', 'C', 'D', 'E'].every(
      (key) => typeof q.options?.[key as OptionLetter] === 'string'
    )

  if (
    typeof q.section !== 'number' ||
    typeof q.qnum !== 'number' ||
    typeof q.id !== 'string' ||
    typeof q.stimulus !== 'string' ||
    typeof q.questionStem !== 'string' ||
    !validOptions
  ) {
    throw new Error(`Invalid question at index ${index} in ${filePath}`)
  }

  return q as Question
}

async function loadDataset(questionsPath: string, answerKeyPath: string) {
  const rawQuestions = await readJsonFile<unknown>(questionsPath)
  const rawAnswerKey = await readJsonFile<unknown>(answerKeyPath)

  const questionsArray = Array.isArray(rawQuestions)
    ? rawQuestions
    : (rawQuestions as { questions?: unknown[] })?.questions

  if (!Array.isArray(questionsArray)) {
    throw new Error(`Questions JSON must be an array or object with questions array: ${questionsPath}`)
  }

  const questions = questionsArray.map((q, index) =>
    validateQuestion(q, index, questionsPath)
  )

  let answerKey: AnswerKey
  if (rawAnswerKey && typeof rawAnswerKey === 'object' && !Array.isArray(rawAnswerKey)) {
    if (
      'answerKey' in rawAnswerKey &&
      typeof (rawAnswerKey as { answerKey?: unknown }).answerKey === 'object'
    ) {
      answerKey = (rawAnswerKey as { answerKey: AnswerKey }).answerKey
    } else {
      answerKey = rawAnswerKey as AnswerKey
    }
  } else {
    throw new Error(`Answer key JSON must be an object: ${answerKeyPath}`)
  }

  return { questions, answerKey }
}

function parseCliArgs(argv: string[]) {
  let datasetsRaw: string | null = null
  let repeat = 1
  let model = DEFAULT_MODEL

  for (const arg of argv) {
    if (arg.startsWith('--datasets=')) {
      datasetsRaw = arg.slice('--datasets='.length).trim()
    } else if (arg.startsWith('--repeat=')) {
      repeat = Number.parseInt(arg.slice('--repeat='.length).trim(), 10)
    } else if (arg.startsWith('--model=')) {
      model = arg.slice('--model='.length).trim() || DEFAULT_MODEL
    }
  }

  if (!datasetsRaw) {
    throw new Error('Missing --datasets')
  }

  if (!Number.isFinite(repeat) || repeat < 1) {
    throw new Error('Repeat must be a positive integer')
  }

  const datasets: DatasetPair[] = datasetsRaw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const sepIndex = pair.indexOf(':')
      if (sepIndex === -1) {
        throw new Error(`Invalid dataset pair: ${pair}`)
      }

      const questionsPath = pair.slice(0, sepIndex).trim()
      const answerKeyPath = pair.slice(sepIndex + 1).trim()

      if (!questionsPath || !answerKeyPath) {
        throw new Error(`Invalid dataset pair: ${pair}`)
      }

      return { questionsPath, answerKeyPath }
    })

  return { datasets, repeat, model }
}

function buildPrompt(question: Question): string {
  const optionLines = ['A', 'B', 'C', 'D', 'E']
    .map((letter) => {
      const key = letter as OptionLetter
      return `${letter}. ${question.options[key]}`
    })
    .join('\n')

  return [
    'You are solving one LSAT Logical Reasoning question.',
    'Think carefully and explain your reasoning in a useful, explicit way.',
    'Then return strict JSON only.',
    '',
    'Required JSON schema:',
    '{',
    '  "correct_option": "A|B|C|D|E",',
    '  "reasoning": "detailed explanation of why the chosen option is best",',
    '  "core_issue": "brief label for the key logical issue",',
    '  "why_not_others": {',
    '    "A": "short reason",',
    '    "B": "short reason",',
    '    "C": "short reason",',
    '    "D": "short reason",',
    '    "E": "short reason"',
    '  },',
    '  "confidence": "high|medium|low"',
    '}',
    '',
    'Do not include markdown fences.',
    'Do not include any text before or after the JSON.',
    '',
    'Question:',
    question.stimulus,
    '',
    'Question stem:',
    question.questionStem,
    '',
    'Options:',
    optionLines
  ].join('\n')
}

async function callOpenRouter(prompt: string, model: string) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY in environment')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'LogiClue'
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    })
  })

  const text = await response.text()

  if (!response.ok) {
    throw new Error(`OpenRouter error ${response.status}: ${text}`)
  }

  return JSON.parse(text) as OpenRouterResponse
}

function extractAnswerLetter(text: string | undefined): OptionLetter | null {
  if (!text) return null

  const trimmed = text.trim().toUpperCase()

  if (isOptionLetter(trimmed)) return trimmed

  const exactMatch = trimmed.match(/\b([A-E])\b/)
  if (exactMatch && isOptionLetter(exactMatch[1])) return exactMatch[1]

  const fallback = trimmed.match(/[A-E]/)
  if (fallback && isOptionLetter(fallback[0])) return fallback[0]

  return null
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')

  if (first === -1 || last === -1 || last <= first) {
    return null
  }

  return trimmed.slice(first, last + 1)
}

function parseModelOutput(rawContent: string): ParsedModelOutput | null {
  const jsonBlock = extractJsonObject(rawContent)
  if (!jsonBlock) return null

  try {
    return JSON.parse(jsonBlock) as ParsedModelOutput
  } catch {
    return null
  }
}

function formatNowForFileName() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function buildOutputFileName(model: string, repeat: number) {
  const safeModel = model.replace(/[\/:]/g, '_')
  return `final-raw-results-${safeModel}-target41-r${repeat}-${formatNowForFileName()}.json`
}

async function main() {
  const { datasets, repeat, model } = parseCliArgs(process.argv.slice(2))

  const allQuestions = new Map<string, Question>()
  const allAnswerKeys = new Map<string, OptionLetter>()

  for (const pair of datasets) {
    const { questions, answerKey } = await loadDataset(pair.questionsPath, pair.answerKeyPath)

    for (const question of questions) {
      if (allQuestions.has(question.id)) {
        throw new Error(`Duplicate question id found across datasets: ${question.id}`)
      }
      allQuestions.set(question.id, question)
    }

    for (const [qid, ans] of Object.entries(answerKey)) {
      if (!isOptionLetter(ans)) continue

      if (allAnswerKeys.has(qid)) {
        throw new Error(`Duplicate answer key id found across datasets: ${qid}`)
      }

      allAnswerKeys.set(qid, ans)
    }
  }

  const targetQuestions = TARGET_IDS
    .map((id) => allQuestions.get(id))
    .filter((q): q is Question => q !== undefined)

  const foundIds = new Set(targetQuestions.map((q) => q.id))
  const missingIds = TARGET_IDS.filter((id) => !foundIds.has(id))

  if (targetQuestions.length === 0) {
    throw new Error('No target questions found across provided datasets')
  }

  console.log(`\n===== MODEL: ${model} =====`)
  console.log(`===== TARGET QUESTIONS: ${targetQuestions.length} =====`)
  console.log(`===== REPEATS: ${repeat} =====`)
  console.log(`===== MAX_TOKENS: ${MAX_TOKENS} =====`)
  console.log(`===== DATASETS: ${datasets.length} =====`)
  if (missingIds.length > 0) {
    console.log(`===== MISSING_IDS: ${missingIds.join(', ')} =====`)
  }
  console.log('')

  const results: Array<Record<string, unknown>> = []

  for (const question of targetQuestions) {
    const correctAnswer = allAnswerKeys.get(question.id)

    if (!correctAnswer || !isOptionLetter(correctAnswer)) {
      console.warn(`[WARN] Missing or invalid answer key for ${question.id}, skipping`)
      continue
    }

    for (let attempt = 1; attempt <= repeat; attempt++) {
      const prompt = buildPrompt(question)

      try {
        const raw = await callOpenRouter(prompt, model)
        const choice = raw.choices?.[0]
        const content = choice?.message?.content ?? ''
        const finishReason = choice?.finish_reason ?? null
        const nativeFinishReason = choice?.native_finish_reason ?? null

        const parsed = parseModelOutput(content)

        const predictedAnswer =
          parsed?.correct_option && isOptionLetter(parsed.correct_option)
            ? parsed.correct_option
            : extractAnswerLetter(content)

        const isCorrect = predictedAnswer === correctAnswer

        results.push({
          questionId: question.id,
          section: question.section,
          qnum: question.qnum,
          repeat: attempt,
          model,
          correctAnswer,
          predictedAnswer,
          isCorrect,
          finishReason,
          nativeFinishReason,
          confidence: parsed?.confidence ?? null,
          coreIssue: parsed?.core_issue ?? null,
          reasoning: parsed?.reasoning ?? null,
          whyNotOthers: parsed?.why_not_others ?? null,
          rawContent: content
        })

        console.log(
          `[${question.id}] repeat=${attempt} predicted=${predictedAnswer ?? 'null'} correct=${correctAnswer} result=${isCorrect ? 'OK' : 'WRONG'}`
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        results.push({
          questionId: question.id,
          section: question.section,
          qnum: question.qnum,
          repeat: attempt,
          model,
          correctAnswer,
          predictedAnswer: null,
          isCorrect: false,
          finishReason: null,
          nativeFinishReason: null,
          confidence: null,
          coreIssue: null,
          reasoning: null,
          whyNotOthers: null,
          rawContent: null,
          error: message
        })

        console.log(`[ERR] ${question.id} repeat=${attempt} ${message}`)
      }
    }
  }

  const correctRuns = results.filter((r) => r.isCorrect === true).length
  const answeredRuns = results.filter((r) => r.predictedAnswer !== null).length
  const nullRuns = results.filter((r) => r.predictedAnswer === null).length

  const byQuestion = new Map<string, Array<Record<string, unknown>>>()
  for (const record of results) {
    const qid = String(record.questionId)
    if (!byQuestion.has(qid)) byQuestion.set(qid, [])
    byQuestion.get(qid)!.push(record)
  }

  const questionSummaries = Array.from(byQuestion.entries()).map(([questionId, rows]) => {
    const correctAnswer = rows[0].correctAnswer as OptionLetter
    const predictedAnswers = rows.map((r) => (r.predictedAnswer as OptionLetter | null) ?? null)
    const numCorrect = rows.filter((r) => r.isCorrect === true).length

    return {
      questionId,
      correctAnswer,
      predictedAnswers,
      numCorrect,
      allCorrect: numCorrect === rows.length
    }
  })

  const output = {
    summary: {
      model,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      repeat,
      totalTargetIds: TARGET_IDS.length,
      totalFoundQuestions: targetQuestions.length,
      missingIds,
      totalRuns: results.length,
      correctRuns,
      answeredRuns,
      nullRuns,
      rawAccuracy: results.length > 0 ? Number((correctRuns / results.length).toFixed(4)) : 0,
      answeredAccuracy: answeredRuns > 0 ? Number((correctRuns / answeredRuns).toFixed(4)) : 0
    },
    targetIds: TARGET_IDS,
    questionSummaries,
    results
  }

  const outputFileName = buildOutputFileName(model, repeat)
  const outputPath = path.join(process.cwd(), outputFileName)

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8')

  console.log('\n===== SUMMARY =====')
  console.log(JSON.stringify(output.summary, null, 2))
  console.log(`\nSaved to: ${outputPath}\n`)
}

main().catch((error) => {
  console.error(error)
  usage()
  process.exit(1)
})