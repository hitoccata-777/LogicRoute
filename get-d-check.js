require("dotenv").config({ path: ".env.local" });

async function runOneTest(prompt, label) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENROUTER_API_KEY 环境变量");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-5.2-chat",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const data = await response.json();

  console.log(`\n===== ${label} =====\n`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const question = `
Essayist: It is much less difficult to live an enjoyable life if one is able to make lifestyle choices that accord with one's personal beliefs and then see those choices accepted by others. It is possible for people to find this kind of acceptance by choosing friends and associates who share many of their personal beliefs. Thus, no one should be denied the freedom to choose the people with whom he or she will associate.

Which one of the following principles, if valid, most helps to justify the essayist's argument?

(A) No one should be denied the freedom to make lifestyle choices that accord with his or her personal beliefs.
(B) One should associate with at least some people who share many of one's personal beliefs.
(C) If having a given freedom could make it less difficult for someone to live an enjoyable life, then no one should be denied that freedom.
(D) No one whose enjoyment of life depends, at least in part, on friends and associates who share many of the same personal beliefs should be deliberately prevented from having such friends and associates.
(E) One may choose for oneself the people with whom one will associate, if doing so could make it easier to live an enjoyable life.
`;

  const prompt1 = `
Read the LSAT question carefully.

Do NOT evaluate all answer choices equally.
Assume for this test that choice C is correct.
Your only task is to explain whether choice D is a valid rival, and if not, exactly why not.

Important:
- Do NOT say D is wrong merely because it is "circular" or "a restatement" unless it exactly matches the conclusion.
- If D does NOT exactly match the conclusion, identify the exact drift.
- You must explicitly check these phrases:
  1. "depends, at least in part"
  2. "deliberately prevented from having such friends and associates"
- For each phrase, state whether it matches the stimulus/conclusion exactly or introduces drift.

Return EXACTLY valid JSON:

{
  "correct_answer": "C",
  "is_D_valid_rival": true,
  "why_D_is_wrong": "...",
  "drift_points": [
    {
      "phrase": "...",
      "difference_type": "relation | scope | modality | actor | other",
      "explanation": "..."
    }
  ],
  "does_D_exactly_restate_conclusion": true,
  "final_verdict_on_D": "..."
}

Question:
${question}
`;

  const prompt2 = `
Read the LSAT question carefully.

Assume choice C is correct.
Your job is to test whether GPT incorrectly collapses D into the conclusion.

Before answering, do these checks:
1. Compare D against the conclusion exactly.
2. If D adds any new relation, narrowing, or modality, mark it as drift.
3. Do NOT use "restatement" or "circular" as the main reason unless D exactly reproduces the conclusion.

Return EXACTLY valid JSON:

{
  "correct_answer": "C",
  "does_D_exactly_match_conclusion": true,
  "main_reason_D_fails": "relation | scope | modality | actor | other",
  "two_key_differences": [
    "...",
    "..."
  ],
  "one_sentence_verdict": "..."
}

Question:
${question}
`;

  await runOneTest(prompt1, "TEST 1: precise D diagnosis");
  await runOneTest(prompt2, "TEST 2: anti-restatement check");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});