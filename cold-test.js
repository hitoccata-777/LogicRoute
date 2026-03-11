require("dotenv").config({ path: ".env.local" });
const fs = require("fs");

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENROUTER_API_KEY 环境变量");
  }

  const question = `
Magazine editor: I know that some of our regular advertisers have been pressuring us to give favorable mention to their products in our articles, but they should realize that for us to yield to their wishes would actually be against their interests. To remain an effective advertising vehicle we must have loyal readership, and we would soon lose that readership if our readers suspect that our editorial integrity has been compromised by pandering to advertisers. 
Advertising-sales director: You underestimate the sophistication of our readers. They recognize that the advertisements we carry are not articles, so their response to the advertisements has never depended on their opinion of the editorial integrity of the magazine as a whole. 
Which one of the following is the most accurate assessment of the advertising-sales director’s argument as a response to the magazine editor’s argument? 
(A) It succeeds because it shows that the editor’s argument depends on an unwarranted 
assumption about factors affecting an advertisement’s effectiveness. 
(B) It succeeds because it exposes as mistaken the editor’s estimation of the sophistication of the magazine’s readers. 
(C) It succeeds because it undermines the editor’s claim about how the magazine’s editorial integrity would be affected by allowing advertisers to influence articles. 
(D) It fails because the editor’s argument does not depend on any assumption about readers’ response to the advertisements they see in the magazine. 
(E) It fails because it is based on a misunderstanding of the editor’s view about 
how readers respond to advertisements they see in the magazine.
`;

const prompt = `
Read the LSAT question carefully.

Return EXACTLY valid JSON:

{
  "answer": "A-E",
  "one_sentence_reason": "...",
  "runner_up": "A-E",
  "why_runner_up_loses": "..."
}

Question:
${question}
`;

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
  console.log(JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});