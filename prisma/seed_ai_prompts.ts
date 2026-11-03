import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const prompts = [
    {
      name: 'roadmap_planner',
      agentType: 'planner',
      promptTemplate: 'You are a master learning planner. Create a learning roadmap for {{technology}} at {{difficulty}} level for {{duration}} weeks. Return a JSON object matching the schema.',
      modelConfig: { model: 'gemini-2.5-flash', temperature: 0.2, maxTokens: 4000 },
      outputSchema: { type: 'object', properties: { levels: { type: 'array' } } },
    },
    {
      name: 'content_generator',
      agentType: 'content',
      promptTemplate: 'You are a technical writer. Write node notes, learning objectives, code examples for {{topic}} using {{technology}}.',
      modelConfig: { model: 'gemini-2.5-flash', temperature: 0.3, maxTokens: 4000 },
      outputSchema: { type: 'object', properties: { notes: { type: 'string' } } },
    },
    {
      name: 'quiz_generator',
      agentType: 'quiz',
      promptTemplate: 'Generate 10 multiple-choice questions for {{topic}} in {{technology}}.',
      modelConfig: { model: 'gemini-2.5-flash', temperature: 0.3, maxTokens: 2000 },
      outputSchema: { type: 'object', properties: { questions: { type: 'array' } } },
    },
    {
      name: 'challenge_generator',
      agentType: 'challenge',
      promptTemplate: 'Create a coding challenge for {{topic}} in {{technology}}.',
      modelConfig: { model: 'gemini-2.5-flash', temperature: 0.3, maxTokens: 2000 },
      outputSchema: { type: 'object', properties: { challenge: { type: 'object' } } },
    },
    {
      // Phase 3 Hardening: this entry previously used {{topic}} only — code-reviewer.agent.ts
      // substitutes {{repoUrl}}/{{taskDescription}}/{{requirements}} too, and ai-review.validator.ts
      // specifically builds a rich taskDescription (title + description + the student's actual
      // matched code snippets) for exactly that placeholder — a template missing it silently drops
      // the real code content from what the AI reviews. Replaced with the fuller template already
      // written and used for the same job type in apps/worker/src/index.ts (a separate, legacy
      // code path against a different table), verified compatible via
      // code-reviewer.agent.spec.ts's placeholder-substitution test before being applied anywhere.
      name: 'code_reviewer',
      agentType: 'validation',
      promptTemplate: `
You are a senior backend engineer reviewing a student's code submission.
Repository Link: {{repoUrl}}
Task Description: {{taskDescription}}
Requirements: {{requirements}}

CRITICAL QUALITY CHECK:
- You must verify if the files and logic in the repository/PR actually implement the requested Task Description and Requirements.
- If the student has submitted a repository or pull request for a completely different project, task, or technology (e.g. submitting a Python project for a Node.js/Express challenge, or an AI agent repository for a simple Idea Board API challenge), you MUST immediately reject the submission!
- Under this rejection scenario, you MUST return:
  1. "score": 0
  2. "passed": false
  3. "feedback": "### Rejection: Unrelated Submission\\nThe submitted repository contains code for a completely different project ({{repoUrl}}) and does not implement the requested challenge ({{taskDescription}}). Please ensure you are submitting the correct codebase."

Please review the code and output a JSON object containing:
1. "score": a number from 0 to 100 representing how well the submission meets requirements.
2. "passed": a boolean representing whether the submission meets the minimum criteria.
3. "feedback": a detailed markdown report summarizing what they did well and areas of improvement.

Ensure you only return valid JSON. Do not include markdown code block backticks around the JSON.
`,
      modelConfig: { model: 'gemini-2.5-flash', temperature: 0.1, maxTokens: 2000 },
      outputSchema: { type: 'object', properties: { score: { type: 'integer' } } },
    },
    {
      name: 'github_readme_generator',
      agentType: 'github',
      promptTemplate: 'Generate a detailed README.md file for the git repository setup.',
      modelConfig: { model: 'gemini-2.5-flash', temperature: 0.4, maxTokens: 2000 },
      outputSchema: { type: 'object', properties: { readme: { type: 'string' } } },
    },
  ];

  console.log('Seeding default AI prompts...');
  for (const prompt of prompts) {
    await prisma.aIPrompt.upsert({
      where: { name: prompt.name },
      update: {},
      create: {
        name: prompt.name,
        agentType: prompt.agentType,
        promptTemplate: prompt.promptTemplate,
        modelConfig: prompt.modelConfig,
        outputSchema: prompt.outputSchema,
      },
    });
  }
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
