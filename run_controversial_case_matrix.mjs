#!/usr/bin/env node
/**
 * Controversial-case matrix runner (LogiClue) — FULL SCRIPT (v2)
 * - Runs T1/T2/F1/F2 cases against your existing API route (no prompt change)
 * - Sweeps model/temperature/stream
 * - Writes results to JSONL + CSV
 * - Parses your backend response shape: { success: true, data: {...} }
 * - Adds CSV columns:
 *    - model_correct_label (what model judged as correct)
 *    - correct_mismatch (whether model_correct_label != provided correct_label)
 *
 * Usage:
 *   1) Set ANALYZE_URL to your existing route:
 *        Windows PowerShell:
 *          $env:ANALYZE_URL="http://localhost:3000/api/analyze"
 *        macOS/Linux:
 *          export ANALYZE_URL="http://localhost:3000/api/analyze"
 *   2) (Optional) Set MATRIX_MODELS / MATRIX_TEMPS / MATRIX_STREAMS
 *   3) node run_controversial_case_matrix.mjs
 */

import fs from "node:fs";
import path from "node:path";

// ----------------------------
// Config
// ----------------------------
const ANALYZE_URL = process.env.ANALYZE_URL || "http://localhost:3000/api/analyze";

const MODELS = (process.env.MATRIX_MODELS || "openai/gpt-5.4,openai/gpt-5.2-chat,anthropic/claude-sonnet-4.5")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const TEMPS = (process.env.MATRIX_TEMPS || "0,0.3")
  .split(",")
  .map(s => Number(s.trim()))
  .filter(n => !Number.isNaN(n));

const STREAMS = (process.env.MATRIX_STREAMS || "false")
  .split(",")
  .map(s => s.trim().toLowerCase() === "true");

const OUT_DIR = process.env.OUT_DIR || "./_matrix_runs";

// ----------------------------
// Paste the controversial item here (keep option texts EXACT)
// ----------------------------
const BASE = {
  question_id: "controversial_editor_director_001",
  question_stem:
    "Which one of the following is the most accurate assessment of the advertising-sales director’s argument as a response to the magazine editor’s argument?",
  stimulus: `Magazine editor: I know that some of our regular advertisers have been pressuring us to give favorable mention to their products in our articles, but they should realize that for us to yield to their wishes would actually be against their interests. To remain an effective advertising vehicle we must have loyal readership, and we would soon lose that readership if our readers suspect that our editorial integrity has been compromised by pandering to advertisers.
Advertising-sales director: You underestimate the sophistication of our readers. They recognize that the advertisements we carry are not articles, so their response to the advertisements has never depended on their opinion of the editorial integrity of the magazine as a whole.`,
  options: {
    A: "It succeeds because it shows that the editor’s argument depends on an unwarranted assumption about factors affecting an advertisement’s effectiveness.",
    B: "It succeeds because it exposes as mistaken the editor’s estimation of the sophistication of the magazine’s readers.",
    C: "It succeeds because it undermines the editor’s claim about how the magazine’s editorial integrity would be affected by allowing advertisers to influence articles.",
    D: "It fails because the editor’s argument does not depend on any assumption about readers’ response to the advertisements they see in the magazine.",
    E: "It fails because it is based on a misunderstanding of the editor’s view about how readers respond to advertisements they see in the magazine."
  }
};

// ----------------------------
// Test cases (T=truthy correct, F=fake correct)
// ----------------------------
const CASES = [
  { case_id: "T1", correct_label: "D", chosen_label: "E" },
  { case_id: "T2", correct_label: "D", chosen_label: "B" },
  { case_id: "F1", correct_label: "E", chosen_label: "D" },
  { case_id: "F2", correct_label: "E", chosen_label: "B" }
];

// ----------------------------
// “精神”/评测金标准（结构约束）— evaluation only (NO prompt edits)
// ----------------------------
const GOLD = {
  mustMentionAny: ["readership", "loyal", "stop reading", "lose that readership", "读者", "忠实", "流失", "停止阅读"],
  mustNotOverfocusAny: ["response to the advertisements", "distinguish ads", "ads are not articles", "对广告的反应", "区分广告"],
  preferredMethods: ["dispute_locate", "argument_chain"]
};

// ----------------------------
// Helpers
// ----------------------------
function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function textContainsAny(hay, needles) {
  const h = (hay || "").toLowerCase();
  return needles.some(n => h.includes(String(n).toLowerCase()));
}

function buildPayload(base, c, sweep) {
  const correct_text = base.options?.[c.correct_label] || "";
  const chosen_text = base.options?.[c.chosen_label] || "";

  // Required by your route: stimulus, questionStem, options, userChoice
  // Keep extra fields for your own debugging / future B-mode switch.
  return {
    stimulus: base.stimulus,
    questionStem: base.question_stem,
    options: base.options,
    userChoice: c.chosen_label,

    question_id: base.question_id,
    correct_label: c.correct_label,
    chosen_label: c.chosen_label,
    correct_option_text: correct_text,
    chosen_option_text: chosen_text,

    model: sweep.model,
    temperature: sweep.temperature,
    stream: sweep.stream,

    _matrix: { case_id: c.case_id, sweep }
  };
}

async function callApi(payload) {
  const res = await fetch(ANALYZE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const ct = res.headers.get("content-type") || "";
  const isSse = ct.includes("text/event-stream");
  const raw = await res.text();

  // Most likely: standard JSON (application/json)
  let json = safeJsonParse(raw);

  // If SSE: try extract last JSON object or unwrap "reply":"{...}"
  if (!json && isSse) {
    const match = raw.match(/\{[\s\S]*\}\s*$/);
    if (match) json = safeJsonParse(match[0]);

    if (!json) {
      const m2 = raw.match(/"reply"\s*:\s*"(\{[\s\S]*\})"/);
      if (m2) {
        const unescaped = m2[1]
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n")
          .replace(/\\\\/g, "\\");
        json = safeJsonParse(unescaped);
      }
    }
  }

  return { ok: res.ok, status: res.status, contentType: ct, raw, json };
}

function evaluate(json, c) {
  // Your backend returns: { success: true, data: {...} }
  const root = json?.data ?? json ?? {};

  const method = root?.method ?? null;
  const faith = root?.faithfulness_check ?? null;
  const core = root?.core_judgment ?? null;

  const modelCorrect = root?.correct_option?.label ?? null;
  const correctMismatch =
    (modelCorrect && c?.correct_label) ? (String(modelCorrect) !== String(c.correct_label)) : false;

  const coreOk = textContainsAny(core, GOLD.mustMentionAny);
  const coreOverfocusAds = textContainsAny(core, GOLD.mustNotOverfocusAny);
  const methodPreferred = method ? GOLD.preferredMethods.includes(String(method)) : false;

  const redFlags = [];

  // If request failed or parsing failed, mark hard flags
  if (!json) redFlags.push("no_json_parsed");
  if (faith && String(faith).toLowerCase().startsWith("fail")) redFlags.push("faithfulness_fail");
  if (!coreOk) redFlags.push("core_missing_readership_anchor");
  if (coreOverfocusAds) redFlags.push("core_overfocus_ads_response");
  if (method && !methodPreferred) redFlags.push("method_unexpected_for_two_speakers");
  if (correctMismatch) redFlags.push("provided_correct_disagrees_with_model");

  // Broad-net tendency: multiple independent faults instead of one fork
  const narrative = root?.narrative ?? null;
  const whyWrongChosen = (root?.wrong_options || []).find(o => o?.label === c.chosen_label)?.why_wrong ?? "";
  const broadNet = textContainsAny(String(whyWrongChosen) + " " + JSON.stringify(narrative || {}), [
    "also", "in addition", "multiple", "还有", "此外", "同时", "另外"
  ]);
  if (broadNet) redFlags.push("broad_net_multi_fault_tendency");

  return {
    method,
    faithfulness_check: faith,
    core_judgment: core,
    core_ok: coreOk,
    method_preferred: methodPreferred,
    model_correct_label: modelCorrect,
    correct_mismatch: correctMismatch,
    red_flags: redFlags
  };
}

function toCsvRow(obj, headers) {
  const esc = v => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return headers.map(h => esc(obj[h])).join(",");
}

// ----------------------------
// Main
// ----------------------------
async function main() {
  ensureDir(OUT_DIR);
  const runId = nowStamp();
  const outJsonl = path.join(OUT_DIR, `run_${runId}.jsonl`);
  const outCsv = path.join(OUT_DIR, `run_${runId}.csv`);

  const headers = [
    "run_id", "case_id", "correct_label", "chosen_label", "model", "temperature", "stream",
    "ok", "status", "content_type",
    "model_correct_label", "correct_mismatch",
    "method", "faithfulness_check", "core_ok", "method_preferred",
    "red_flags"
  ];
  fs.writeFileSync(outCsv, headers.join(",") + "\n", "utf8");

  const sweeps = [];
  for (const model of MODELS) for (const temperature of TEMPS) for (const stream of STREAMS) {
    sweeps.push({ model, temperature, stream });
  }

  for (const c of CASES) {
    for (const sweep of sweeps) {
      const payload = buildPayload(BASE, c, sweep);

      const started = Date.now();
      const resp = await callApi(payload);
      const ms = Date.now() - started;

      const evald = evaluate(resp.json, c);

      const row = {
        run_id: runId,
        case_id: c.case_id,
        correct_label: c.correct_label,
        chosen_label: c.chosen_label,
        model: sweep.model,
        temperature: sweep.temperature,
        stream: sweep.stream,

        ok: resp.ok,
        status: resp.status,
        content_type: resp.contentType,

        model_correct_label: evald.model_correct_label,
        correct_mismatch: evald.correct_mismatch,

        method: evald.method,
        faithfulness_check: evald.faithfulness_check,
        core_ok: evald.core_ok,
        method_preferred: evald.method_preferred,
        red_flags: evald.red_flags.join("|"),
        latency_ms: ms
      };

      const record = {
        meta: row,
        payload,
        evaluation: evald,
        latency_ms: ms,
        raw_snippet: (resp.raw || "").slice(0, 4000),
        json: resp.json
      };

      fs.appendFileSync(outJsonl, JSON.stringify(record) + "\n", "utf8");
      fs.appendFileSync(outCsv, toCsvRow(row, headers) + "\n", "utf8");

      console.log(
        `[${c.case_id}] model=${sweep.model} temp=${sweep.temperature} stream=${sweep.stream} ` +
        `status=${resp.status} ms=${ms} model_correct=${evald.model_correct_label ?? "-"} ` +
        `mismatch=${evald.correct_mismatch ? "Y" : "N"} flags=${row.red_flags || "-"}`
      );
    }
  }

  console.log("\nDONE");
  console.log("JSONL:", outJsonl);
  console.log("CSV :", outCsv);
  console.log("\nTip: open CSV and sort by red_flags / correct_mismatch.");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});