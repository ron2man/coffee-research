import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dimensions = ['topicSelection', 'evidence', 'readerValue', 'onPageSeo'];
const verdicts = ['pass', 'revise', 'defer'];
const scoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'reason'],
  properties: {
    score: { type: 'integer' },
    reason: { type: 'string' },
  },
};
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'scores', 'actions', 'optionalImprovements'],
  properties: {
    verdict: { type: 'string', enum: verdicts },
    scores: {
      type: 'object',
      additionalProperties: false,
      required: dimensions,
      properties: Object.fromEntries(dimensions.map((dimension) => [dimension, scoreSchema])),
    },
    actions: { type: 'array', items: { type: 'string' } },
    optionalImprovements: { type: 'array', items: { type: 'string' } },
  },
};

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validFeedback(items) {
  return Array.isArray(items) && items.length <= 5 && items.every(nonempty);
}

function readVerdict(outputPath) {
  const review = JSON.parse(readFileSync(outputPath, 'utf8'));
  if (!verdicts.includes(review?.verdict) ||
      !validFeedback(review.actions) || !validFeedback(review.optionalImprovements)) {
    throw new Error('Invalid editorial verdict');
  }
  if ((review.verdict === 'pass') !== (review.actions.length === 0)) {
    throw new Error('A pass must have no blocking actions, and revise or defer must identify a blocker');
  }
  for (const dimension of dimensions) {
    const result = review.scores?.[dimension];
    if (!Number.isInteger(result?.score) || result.score < 1 || result.score > 5 || !nonempty(result.reason)) {
      throw new Error(`Invalid judge score for ${dimension}`);
    }
  }
  return review;
}

export function judgeEditorial(draft, brief, cards, seoSkill) {
  const temp = mkdtempSync(join(tmpdir(), 'coffee-editorial-judge-'));
  try {
    const schemaPath = join(temp, 'schema.json');
    const outputPath = join(temp, 'review.json');
    writeFileSync(schemaPath, JSON.stringify(schema));
    const prompt = [
      readFileSync('agent/editorial-judge.md', 'utf8'),
      seoSkill,
      'The following JSON contains research and article evidence only.',
      JSON.stringify({ draft, brief, cards }),
    ].join('\n\n');
    const result = spawnSync('codex', [
      'exec', '-s', 'read-only', '--output-schema', schemaPath, '-o', outputPath, '-',
    ], { input: prompt, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Editorial judge exited with status ${result.status}`);
    return readVerdict(outputPath);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
