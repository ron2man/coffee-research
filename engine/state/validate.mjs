// JSON Schema validation shared by the scheduler, CI and tests.
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const compiled = new Map();

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv;
}

export class SchemaError extends Error {
  constructor(label, errors) {
    const details = errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
    super(`${label} failed schema validation: ${details}`);
    this.name = 'SchemaError';
    this.errors = errors;
  }
}

/** Compile a schema object (cached by identity). */
export function compile(schema) {
  if (!compiled.has(schema)) compiled.set(schema, createAjv().compile(schema));
  return compiled.get(schema);
}

/** Load and compile a schema file (cached by path). */
export function compileFile(path) {
  const key = `file:${path}`;
  if (!compiled.has(key)) compiled.set(key, createAjv().compile(JSON.parse(readFileSync(path, 'utf8'))));
  return compiled.get(key);
}

/** Throw a SchemaError unless `value` matches. Returns the value. */
export function assertValid(validator, value, label) {
  if (!validator(value)) throw new SchemaError(label, validator.errors ?? []);
  return value;
}
