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

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

type DatasetPair = {
  questionsPath: string
  answerKeyPath: string
}

const MODEL = 'google/gemini-2.5-pro'
const MAX_TOKENS = 1024
const TEMPERATURE = 0

function usage() {
  console.log(`
Usage:
  pnpm tsx src/scripts/test-gemini-minimal-answer-only-multi.ts [repeat] --ids-file=src/data/gemini-empty-ids.txt --datasets=src/data/PT88_no_answers_fixed.json:src/data/PT88_answer_key_fixed.json,src/data/PT89_no_answers.json:src/data/PT89_answer_key.json,src/data/PT90_no_answers.json:src/data/PT90_answer_key.json,src/data/PT91_no_answers.json:src/data/PT91_answer_key.json,src/data/PT92_no_answers.json:src/data/PT92_answer_key.json,src/data/PT93_no_answers.json:src/data/PT93_answer_key.json

Arguments:
  [repeat]                 Optional. Defaults to 1.

Required flags:
  --ids-file=...           Text file with one question id per line
  --datasets=...           Comma-separated dataset pairs
                           Format:
                           questions.json:answer_key.json,questions.json:answer_key.json
`)
}

function isOptionLetter(value: string): value is OptionLetter {
  return ['A', 'B', 'C', 'D', 'E'].includes(value)
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

function buildPrompt(question: Question): string {
  const optionLines = ['A', 'B', 'C', 'D', 'E']
    .map((letter) => {
      const key = letter as OptionLetter
      return `${letter}. ${question.options[key]}`
    })
    .join('\n')

  return [
    'Choose the single best answer to this LSAT Logical Reasoning question.',
    'Return only one uppercase letter: A, B, C, D, or E.',
    '',
    question.stimulus,
    '',
    question.questionStem,
    '',
    optionLines
  ].join('\n')
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

async function readIdsFile(filePath: string): Promise<string[]> {
  const raw = await fs.readFile(filePath, 'utf-8')
  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  )
}

function validateQuestion(question: unknown, index: number, sourcePath: string): Question {
  if (!question || typeof question !== 'object') {
    throw new Error(`Invalid question at index ${index} in ${sourcePath}: not an object`)
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
    throw new Error(`Invalid question at index ${index} in ${sourcePath}`)
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
    throw new Error(`Questions JSON must be an array or an object with a questions array: ${questionsPath}`)
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
  const positional: string[] = []
  let idsFile: string | null = null
  let datasets: DatasetPair[] = []

  for (const arg of argv) {
    if (arg.startsWith('--ids-file=')) {
      idsFile = arg.slice('--ids-file='.length).trim()
    } else if (arg.startsWith('--datasets=')) {
      const raw = arg.slice('--datasets='.length).trim()

      datasets = raw
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
    } else {
      positional.push(arg)
    }
  }

  return { positional, idsFile, datasets }
}

async function callOpenRouter(prompt: string) {
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
      model: MODEL,
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

function formatNowForFileName() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function buildOutputFileName(totalIds: number) {
  const timestamp = formatNowForFileName()
  return `gemini-minimal-answer-only-rerun-${totalIds}q-${timestamp}.json`
}

async function main() {
  const { positional, idsFile, datasets } = parseCliArgs(process.argv.slice(2))
  const repeatArg = positional[0]

  const repeat = Number.parseInt(repeatArg ?? '1', 10)
  if (!Number.isFinite(repeat) || repeat < 1) {
    throw new Error('Repeat must be a positive integer')
  }

  if (!idsFile) {
    throw new Error('Missing --ids-file')
  }

  if (datasets.length === 0) {
    throw new Error('Missing --datasets')
  }

  const requestedIds = await readIdsFile(idsFile)
  if (requestedIds.length === 0) {
    throw new Error(`No question ids found in file: ${idsFile}`)
  }

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

  const targetQuestions = requestedIds
    .map((id) => allQuestions.get(id))
    .filter((q): q is Question => q !== undefined)

  if (targetQuestions.length === 0) {
    throw new Error('No target questions found across provided datasets')
  }

  const foundQuestionIds = new Set(targetQuestions.map((q) => q.id))
  const missingRequestedIds = requestedIds.filter((id) => !foundQuestionIds.has(id))

  console.log(`\n===== MODEL: ${MODEL} =====`)
  console.log(`===== QUESTIONS: ${targetQuestions.length} =====`)
  console.log(`===== REPEATS: ${repeat} =====`)
  console.log(`===== MAX_TOKENS: ${MAX_TOKENS} =====`)
  console.log(`===== IDS_FILE: ${idsFile} =====`)
  console.log(`===== DATASETS: ${datasets.length} =====`)

  if (missingRequestedIds.length > 0) {
    console.log(`===== MISSING_REQUESTED_IDS: ${missingRequestedIds.join(', ')} =====`)
  }

  console.log('')

  const results: Array<{
    questionId: string
    correctAnswer: OptionLetter
    predictedAnswer: OptionLetter | null
    isCorrect: boolean
    repeat: number
    error?: string
  }> = []

  for (const question of targetQuestions) {
    const correctAnswer = allAnswerKeys.get(question.id)

    if (!correctAnswer || !isOptionLetter(correctAnswer)) {
      console.warn(`[WARN] Missing or invalid answer key for ${question.id}, skipping`)
      continue
    }

    for (let attempt = 1; attempt <= repeat; attempt++) {
      const prompt = buildPrompt(question)

      try {
        const raw = await callOpenRouter(prompt)
        const content = raw.choices?.[0]?.message?.content ?? ''
        const predictedAnswer = extractAnswerLetter(content)
        const isCorrect = predictedAnswer === correctAnswer

        results.push({
          questionId: question.id,
          correctAnswer,
          predictedAnswer,
          isCorrect,
          repeat: attempt
        })

        console.log(
          `[${question.id}] repeat=${attempt} predicted=${predictedAnswer ?? 'null'} correct=${correctAnswer} result=${isCorrect ? 'OK' : 'WRONG'}`
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        results.push({
          questionId: question.id,
          correctAnswer,
          predictedAnswer: null,
          isCorrect: false,
          repeat: attempt,
          error: message
        })

        console.log(`[ERR] ${question.id} repeat=${attempt} ${message}`)
      }
    }
  }

  const output = {
    summary: {
      model: MODEL,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      repeat,
      idsFile,
      totalRequestedIds: requestedIds.length,
      totalFoundQuestions: targetQuestions.length,
      missingRequestedIds
    },
    results
  }

  const outputFileName = buildOutputFileName(requestedIds.length)
  const outputPath = path.join(process.cwd(), outputFileName)

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8')

  console.log('\n===== DONE =====')
  console.log(`Saved to: ${outputPath}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})