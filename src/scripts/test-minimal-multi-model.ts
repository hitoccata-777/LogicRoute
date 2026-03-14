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
  id?: string
  choices?: Array<{
    message?: {
      content?: string
    }
    finish_reason?: string
    native_finish_reason?: string
  }>
}

const MODELS = [
  'deepseek/deepseek-r1',
  'google/gemini-2.5-pro'
]

// minimal answer-only
const MAX_TOKENS = 256
const TEMPERATURE = 0

function usage() {
  console.log(`
Usage:
  pnpm tsx src/scripts/test-minimal-multi-model.ts <questions.json> <answer_key.json> <question_ids_csv> [repeat]

Examples:
  pnpm tsx src/scripts/test-minimal-multi-model.ts src/data/PT88_no_answers.json src/data/PT88_answer_key.json PT88-S2-Q22 3

  pnpm tsx src/scripts/test-minimal-multi-model.ts src/data/PT88_no_answers.json src/data/PT88_answer_key.json PT88-S2-Q22,PT88-S3-Q19 2
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

function validateQuestion(question: unknown, index: number): Question {
  if (!question || typeof question !== 'object') {
    throw new Error(`Invalid question at index ${index}: not an object`)
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
    throw new Error(`Invalid question at index ${index}`)
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
    throw new Error('Questions JSON must be an array or an object with a questions array')
  }

  const questions = questionsArray.map((q, index) => validateQuestion(q, index))

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
    throw new Error('Answer key JSON must be an object')
  }

  return { questions, answerKey }
}

async function callOpenRouter(model: string, prompt: string) {
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

function formatNowForFileName() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function majorityAnswer(answers: Array<OptionLetter | null>): OptionLetter | null {
  const counts = new Map<OptionLetter, number>()

  for (const answer of answers) {
    if (!answer) continue
    counts.set(answer, (counts.get(answer) ?? 0) + 1)
  }

  if (counts.size === 0) return null

  let bestAnswer: OptionLetter | null = null
  let bestCount = -1

  for (const [answer, count] of counts.entries()) {
    if (count > bestCount) {
      bestAnswer = answer
      bestCount = count
    }
  }

  return bestAnswer
}

function uniqueNonNullAnswers(answers: Array<OptionLetter | null>): OptionLetter[] {
  return Array.from(new Set(answers.filter((x): x is OptionLetter => x !== null)))
}

async function main() {
  const [questionsPath, answerKeyPath, questionIdsCsv, repeatArg] = process.argv.slice(2)

  if (!questionsPath || !answerKeyPath || !questionIdsCsv) {
    usage()
    process.exit(1)
  }

  const repeat = Number.parseInt(repeatArg ?? '1', 10)
  if (!Number.isFinite(repeat) || repeat < 1) {
    throw new Error('Repeat must be a positive integer')
  }

  const targetQuestionIds = questionIdsCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (targetQuestionIds.length === 0) {
    throw new Error('No valid question IDs provided')
  }

  const { questions, answerKey } = await loadDataset(questionsPath, answerKeyPath)

  const targetQuestions = questions.filter((q) => targetQuestionIds.includes(q.id))

  if (targetQuestions.length === 0) {
    throw new Error('No target questions found in dataset')
  }

  const missingIds = targetQuestionIds.filter((id) => !targetQuestions.some((q) => q.id === id))
  if (missingIds.length > 0) {
    console.warn(`Warning: missing question IDs: ${missingIds.join(', ')}`)
  }

  console.log(`\n===== MODELS: ${MODELS.join(' | ')} =====`)
  console.log(`===== QUESTIONS: ${targetQuestions.length} =====`)
  console.log(`===== REPEATS: ${repeat} =====\n`)

  const results: Array<Record<string, unknown>> = []

  for (const model of MODELS) {
    console.log(`\n----- MODEL: ${model} -----\n`)

    for (const question of targetQuestions) {
      const correctAnswer = answerKey[question.id]

      if (!correctAnswer || !isOptionLetter(correctAnswer)) {
        console.warn(`[WARN] Missing or invalid answer key for ${question.id}, skipping`)
        continue
      }

      for (let attempt = 1; attempt <= repeat; attempt++) {
        const prompt = buildPrompt(question)

        try {
          const raw = await callOpenRouter(model, prompt)
          const choice = raw.choices?.[0]
          const content = choice?.message?.content ?? ''
          const predictedAnswer = extractAnswerLetter(content)
          const finishReason = choice?.finish_reason ?? null
          const nativeFinishReason = choice?.native_finish_reason ?? null
          const isCorrect = predictedAnswer === correctAnswer

          const record = {
            model,
            questionId: question.id,
            section: question.section,
            qnum: question.qnum,
            repeat: attempt,
            correctAnswer,
            predictedAnswer,
            isCorrect,
            finishReason,
            nativeFinishReason,
            rawContent: content
          }

          results.push(record)

          console.log(
            `[${question.id}] repeat=${attempt} predicted=${predictedAnswer ?? 'null'} correct=${correctAnswer} result=${isCorrect ? 'OK' : 'WRONG'} finish=${finishReason ?? 'null'}`
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)

          results.push({
            model,
            questionId: question.id,
            section: question.section,
            qnum: question.qnum,
            repeat: attempt,
            correctAnswer,
            predictedAnswer: null,
            isCorrect: false,
            finishReason: null,
            nativeFinishReason: null,
            error: message
          })

          console.log(`[ERR] [${model}] ${question.id} repeat=${attempt} ${message}`)
        }
      }
    }
  }

  const summaryByModel = MODELS.map((model) => {
    const modelResults = results.filter((r) => r.model === model)

    const correctRuns = modelResults.filter((r) => r.isCorrect === true).length
    const answeredRuns = modelResults.filter((r) => r.predictedAnswer !== null).length
    const nullRuns = modelResults.filter((r) => r.predictedAnswer === null).length
    const stopRuns = modelResults.filter((r) => r.finishReason === 'stop').length
    const lengthRuns = modelResults.filter((r) => r.finishReason === 'length').length

    const byQuestion = new Map<string, Array<Record<string, unknown>>>()

    for (const record of modelResults) {
      const qid = String(record.questionId)
      if (!byQuestion.has(qid)) byQuestion.set(qid, [])
      byQuestion.get(qid)!.push(record)
    }

    let fullyCorrectQuestions = 0
    let atLeast2CorrectQuestions = 0
    let majorityCorrectQuestions = 0
    let unanimousStabilityQuestions = 0
    let validUnanimousStabilityQuestions = 0

    const questionSummaries = Array.from(byQuestion.entries()).map(([questionId, rows]) => {
      const correctAnswer = rows[0].correctAnswer as OptionLetter
      const predictedAnswers = rows.map(
        (r) => (r.predictedAnswer as OptionLetter | null) ?? null
      )
      const nonNullAnswers = predictedAnswers.filter((x): x is OptionLetter => x !== null)
      const numCorrect = rows.filter((r) => r.isCorrect === true).length
      const maj = majorityAnswer(predictedAnswers)

      const unanimous =
        predictedAnswers.length > 0 &&
        predictedAnswers.every((x) => x === predictedAnswers[0])

      const validUnique = uniqueNonNullAnswers(predictedAnswers)
      const validUnanimous = nonNullAnswers.length > 0 && validUnique.length === 1
      const majorityIsCorrect = maj === correctAnswer

      if (numCorrect === rows.length) fullyCorrectQuestions += 1
      if (numCorrect >= 2) atLeast2CorrectQuestions += 1
      if (majorityIsCorrect) majorityCorrectQuestions += 1
      if (unanimous) unanimousStabilityQuestions += 1
      if (validUnanimous) validUnanimousStabilityQuestions += 1

      return {
        questionId,
        correctAnswer,
        predictedAnswers,
        numCorrect,
        majorityAnswer: maj,
        majorityIsCorrect,
        unanimousStability: unanimous,
        validUnanimousStability: validUnanimous
      }
    })

    const totalQuestions = questionSummaries.length

    return {
      model,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      totalRuns: modelResults.length,
      correctRuns,
      answeredRuns,
      nullRuns,
      stopRuns,
      lengthRuns,
      rawAccuracy:
        modelResults.length > 0 ? Number((correctRuns / modelResults.length).toFixed(4)) : 0,
      answeredAccuracy:
        answeredRuns > 0 ? Number((correctRuns / answeredRuns).toFixed(4)) : 0,
      nullRate:
        modelResults.length > 0 ? Number((nullRuns / modelResults.length).toFixed(4)) : 0,
      stopRate:
        modelResults.length > 0 ? Number((stopRuns / modelResults.length).toFixed(4)) : 0,
      lengthRate:
        modelResults.length > 0 ? Number((lengthRuns / modelResults.length).toFixed(4)) : 0,
      totalQuestions,
      fullyCorrectQuestions,
      atLeast2CorrectQuestions,
      majorityCorrectQuestions,
      unanimousStabilityQuestions,
      validUnanimousStabilityQuestions,
      fullyCorrectQuestionRate:
        totalQuestions > 0 ? Number((fullyCorrectQuestions / totalQuestions).toFixed(4)) : 0,
      atLeast2CorrectQuestionRate:
        totalQuestions > 0 ? Number((atLeast2CorrectQuestions / totalQuestions).toFixed(4)) : 0,
      majorityCorrectQuestionRate:
        totalQuestions > 0 ? Number((majorityCorrectQuestions / totalQuestions).toFixed(4)) : 0,
      unanimousStabilityRate:
        totalQuestions > 0 ? Number((unanimousStabilityQuestions / totalQuestions).toFixed(4)) : 0,
      validUnanimousStabilityRate:
        totalQuestions > 0
          ? Number((validUnanimousStabilityQuestions / totalQuestions).toFixed(4))
          : 0,
      testedQuestionIds: targetQuestions.map((q) => q.id),
      questionSummaries
    }
  })

  const output = {
    config: {
      models: MODELS,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      repeat,
      targetQuestionIds
    },
    summaryByModel,
    results
  }

  const outputFileName = `multi-model-minimal-${formatNowForFileName()}.json`
  const outputPath = path.join(process.cwd(), outputFileName)

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8')

  console.log('\n===== SUMMARY BY MODEL =====')
  console.log(JSON.stringify(summaryByModel, null, 2))
  console.log(`\nSaved to: ${outputPath}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})