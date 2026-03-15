import fs from 'node:fs/promises'
import path from 'node:path'

// 按你的实际路径改这里
import { classifyQuestion } from '../lib/questionClassifier'

type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E'

type Question = {
  section: number
  qnum: number
  id: string
  stimulus: string
  questionStem: string
  options: Record<OptionLetter, string>
}

type ClassifiedRow = {
  id: string
  section: number
  qnum: number
  questionStem: string
  type: string
  family: string
  primaryMethods: string[]
  sourceFile: string
}

function usage() {
  console.log(`
Usage:
  pnpm tsx src/scripts/classify-pt-by-questionclassifier.ts <questions1.json> [questions2.json] [questions3.json] ...

Example:
  pnpm tsx src/scripts/classify-pt-by-questionclassifier.ts src/data/PT88_no_answers_fixed.json
  pnpm tsx src/scripts/classify-pt-by-questionclassifier.ts src/data/PT88_no_answers_fixed.json src/data/PT89_no_answers.json src/data/PT90_no_answers.json
`)
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

async function loadQuestionsFile(filePath: string): Promise<Question[]> {
  const rawQuestions = await readJsonFile<unknown>(filePath)

  const questionsArray = Array.isArray(rawQuestions)
    ? rawQuestions
    : (rawQuestions as { questions?: unknown[] })?.questions

  if (!Array.isArray(questionsArray)) {
    throw new Error(`Questions JSON must be an array or an object with a questions array: ${filePath}`)
  }

  return questionsArray.map((q, index) => validateQuestion(q, index, filePath))
}

function escapeCsv(value: string | number) {
  const s = String(value)
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsv(rows: ClassifiedRow[]) {
  const header = [
    'id',
    'section',
    'qnum',
    'type',
    'family',
    'primaryMethods',
    'sourceFile',
    'questionStem'
  ]

  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.id,
        row.section,
        row.qnum,
        row.type,
        row.family,
        row.primaryMethods.join('|'),
        row.sourceFile,
        row.questionStem
      ]
        .map(escapeCsv)
        .join(',')
    )
  ]

  return lines.join('\n')
}

function formatNowForFileName() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function buildOutputBaseName(inputFiles: string[]) {
  return `pt-question-types-${inputFiles.length}files-${formatNowForFileName()}`
}

async function main() {
  const inputFiles = process.argv.slice(2)

  if (inputFiles.length === 0) {
    usage()
    process.exit(1)
  }

  const rows: ClassifiedRow[] = []

  for (const filePath of inputFiles) {
    const questions = await loadQuestionsFile(filePath)

    for (const q of questions) {
      const classification = classifyQuestion(q.questionStem)

      rows.push({
        id: q.id,
        section: q.section,
        qnum: q.qnum,
        questionStem: q.questionStem,
        type: classification.type,
        family: classification.family,
        primaryMethods: classification.primaryMethods ?? [],
        sourceFile: path.basename(filePath)
      })
    }
  }

  rows.sort((a, b) => a.id.localeCompare(b.id))

  const summaryByType = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = (acc[row.type] ?? 0) + 1
    return acc
  }, {})

  const summaryByFamily = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.family] = (acc[row.family] ?? 0) + 1
    return acc
  }, {})

  const output = {
    summary: {
      totalFiles: inputFiles.length,
      totalQuestions: rows.length,
      byType: summaryByType,
      byFamily: summaryByFamily
    },
    rows
  }

  const baseName = buildOutputBaseName(inputFiles)
  const jsonPath = path.join(process.cwd(), `${baseName}.json`)
  const csvPath = path.join(process.cwd(), `${baseName}.csv`)

  await fs.writeFile(jsonPath, JSON.stringify(output, null, 2), 'utf-8')
  await fs.writeFile(csvPath, toCsv(rows), 'utf-8')

  console.log('\n===== SUMMARY BY TYPE =====')
  console.log(JSON.stringify(summaryByType, null, 2))

  console.log('\n===== SUMMARY BY FAMILY =====')
  console.log(JSON.stringify(summaryByFamily, null, 2))

  console.log(`\nSaved JSON: ${jsonPath}`)
  console.log(`Saved CSV: ${csvPath}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})