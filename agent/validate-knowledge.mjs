import { scanKnowledge } from './knowledge.mjs';

try {
  const { cards, errors } = await scanKnowledge(process.argv[2] ?? 'knowledge');
  for (const error of errors) console.error(error);
  console.log(`Validated ${cards.size} product cards. Invalid cards: ${errors.length}.`);
  process.exitCode = errors.length > 0 ? 1 : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
