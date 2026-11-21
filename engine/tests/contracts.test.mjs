// Every agent has a JSON Schema contract, a passing fixture and a failing fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAgents } from '../agents/registry.mjs';
import { repoRoot } from '../state/niche.mjs';
import { validateRepo } from '../state/validate-repo.mjs';

const artifactsOf = (agent, output) =>
  agent.mode === 'generate' ? output.items : agent.mode === 'batch' ? output.decisions.map((d) => d.artifact) : [output.artifact];

for (const agent of loadAgents()) {
  test(`${agent.name}: valid fixture passes, invalid fixture fails`, () => {
    const read = (kind) => JSON.parse(readFileSync(join(agent.dir, 'fixtures', `${kind}.json`), 'utf8'));
    const valid = read('valid');
    assert.ok(agent.validateEnvelope(valid), JSON.stringify(agent.validateEnvelope.errors));
    for (const artifact of artifactsOf(agent, valid)) {
      assert.ok(agent.validateArtifact(artifact), JSON.stringify(agent.validateArtifact.errors));
    }
    const invalid = read('invalid');
    const rejected = !agent.validateEnvelope(invalid) || !artifactsOf(agent, invalid).every((a) => agent.validateArtifact(a));
    assert.ok(rejected, 'invalid fixture must fail validation');
  });
}

test('engine/ contains no niche-specific strings', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['fixtures', 'tests'].includes(entry.name)) walk(path);
      } else if (/coffee|espresso|grinder|bambino/i.test(readFileSync(path, 'utf8'))) {
        offenders.push(path.slice(repoRoot.length));
      }
    }
  };
  walk(join(repoRoot, 'engine'));
  assert.deepEqual(offenders, []);
});

test('the repository itself validates', () => {
  assert.deepEqual(validateRepo().errors, []);
});
