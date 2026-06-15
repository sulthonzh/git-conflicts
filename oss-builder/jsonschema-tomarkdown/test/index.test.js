'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateMarkdown, resolveRef, typeOf, fmt } = require('../src/index');

// ── resolveRef ───────────────────────────────────────────────────────────────

test('resolveRef: resolves local pointer', () => {
  const root = { definitions: { Foo: { type: 'string' } } };
  const result = resolveRef('#/definitions/Foo', root);
  assert.deepEqual(result, { type: 'string' });
});

test('resolveRef: resolves nested path', () => {
  const root = { a: { b: { c: 42 } } };
  assert.equal(resolveRef('#/a/b/c', root), 42);
});

test('resolveRef: returns null for unresolvable', () => {
  assert.equal(resolveRef('#/nope', { a: 1 }), null);
});

test('resolveRef: returns null for non-string', () => {
  assert.equal(resolveRef(123, {}), null);
});

test('resolveRef: returns null for external refs', () => {
  assert.equal(resolveRef('http://example.com/schema.json', {}), null);
});

test('resolveRef: handles ~0 and ~1 escapes', () => {
  const root = { 'a/b': { '~c': 'val' } };
  assert.equal(resolveRef('#/a~1b/~0c', root), 'val');
});

// ── typeOf ───────────────────────────────────────────────────────────────────

test('typeOf: returns type string', () => {
  assert.equal(typeOf({ type: 'string' }, {}), 'string');
});

test('typeOf: returns union types', () => {
  assert.equal(typeOf({ type: ['string', 'null'] }, {}), 'string \\| null');
});

test('typeOf: infers object from properties', () => {
  assert.equal(typeOf({ properties: {} }, {}), 'object');
});

test('typeOf: infers array from items', () => {
  assert.equal(typeOf({ items: {} }, {}), 'array');
});

test('typeOf: returns allOf', () => {
  assert.equal(typeOf({ allOf: [{ type: 'string' }] }, {}), 'allOf');
});

test('typeOf: returns enum', () => {
  assert.equal(typeOf({ enum: ['a', 'b'] }, {}), 'enum');
});

test('typeOf: returns const', () => {
  assert.equal(typeOf({ const: 42 }, {}), 'const');
});

test('typeOf: returns dash for empty', () => {
  assert.equal(typeOf({}, {}), '—');
});

test('typeOf: resolves $ref', () => {
  const root = { definitions: { X: { type: 'integer' } } };
  assert.equal(typeOf({ $ref: '#/definitions/X' }, root), 'integer');
});

// ── fmt ─────────────────────────────────────────────────────────────────────

test('fmt: formats string', () => {
  assert.equal(fmt('hello'), '`hello`');
});

test('fmt: formats number', () => {
  assert.equal(fmt(42), '`42`');
});

test('fmt: formats boolean', () => {
  assert.equal(fmt(true), '`true`');
});

test('fmt: formats null', () => {
  assert.equal(fmt(null), '`null`');
});

test('fmt: formats undefined as empty', () => {
  assert.equal(fmt(undefined), '');
});

test('fmt: formats array', () => {
  assert.equal(fmt(['a', 'b']), '`a`, `b`');
});

test('fmt: formats object as JSON', () => {
  assert.equal(fmt({ a: 1 }), '`{"a":1}`');
});

// ── generateMarkdown: basic ─────────────────────────────────────────────────

test('generateMarkdown: title from schema.title', () => {
  const md = generateMarkdown({ title: 'My Schema', type: 'object' });
  assert.ok(md.includes('# My Schema'));
});

test('generateMarkdown: title from opts', () => {
  const md = generateMarkdown({ type: 'object' }, { title: 'Custom' });
  assert.ok(md.includes('# Custom'));
});

test('generateMarkdown: default title', () => {
  const md = generateMarkdown({ type: 'object' });
  assert.ok(md.includes('# Schema Documentation'));
});

test('generateMarkdown: includes description', () => {
  const md = generateMarkdown({ description: 'A test schema', type: 'object' });
  assert.ok(md.includes('A test schema'));
});

test('generateMarkdown: includes $id', () => {
  const md = generateMarkdown({ $id: 'https://example.com/schema.json', type: 'object' });
  assert.ok(md.includes('https://example.com/schema.json'));
});

test('generateMarkdown: includes dialect', () => {
  const md = generateMarkdown({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' });
  assert.ok(md.includes('2020-12'));
});

test('generateMarkdown: includes top-level type', () => {
  const md = generateMarkdown({ type: 'string' });
  assert.ok(md.includes('**Type:** `string`'));
});

// ── generateMarkdown: properties ─────────────────────────────────────────────

test('generateMarkdown: renders property table', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'User name' },
      age: { type: 'integer', description: 'User age' },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('| `name` | string |'));
  assert.ok(md.includes('| `age` | integer |'));
  assert.ok(md.includes('User name'));
});

test('generateMarkdown: marks required fields', () => {
  const schema = {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.match(/\| `name` \| string \| ✅/));
  assert.ok(md.match(/\| `age` \| integer \|  \|/));
});

test('generateMarkdown: shows default values', () => {
  const schema = {
    type: 'object',
    properties: {
      timeout: { type: 'integer', default: 3000 },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('`3000`'));
});

test('generateMarkdown: shows enum values', () => {
  const schema = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['active', 'inactive'] },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('active'));
  assert.ok(md.includes('inactive'));
});

test('generateMarkdown: shows format', () => {
  const schema = {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('email'));
});

test('generateMarkdown: shows pattern', () => {
  const schema = {
    type: 'object',
    properties: {
      code: { type: 'string', pattern: '^[A-Z]{3}$' },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('^[A-Z]{3}$'));
});

test('generateMarkdown: marks deprecated', () => {
  const schema = {
    type: 'object',
    properties: {
      old: { type: 'string', deprecated: true },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('Deprecated'));
});

// ── generateMarkdown: additionalProperties ───────────────────────────────────

test('generateMarkdown: additionalProperties true (schema)', () => {
  const schema = {
    type: 'object',
    properties: { name: { type: 'string' } },
    additionalProperties: { type: 'string' },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('Additional properties'));
});

test('generateMarkdown: additionalProperties false', () => {
  const schema = {
    type: 'object',
    properties: { name: { type: 'string' } },
    additionalProperties: false,
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('NOT allowed'));
});

// ── generateMarkdown: constraints ────────────────────────────────────────────

test('generateMarkdown: numeric constraints', () => {
  const schema = {
    type: 'integer',
    minimum: 0,
    maximum: 100,
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('**Minimum:** 0'));
  assert.ok(md.includes('**Maximum:** 100'));
});

test('generateMarkdown: string constraints', () => {
  const schema = {
    type: 'string',
    minLength: 2,
    maxLength: 50,
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('**Min length:** 2'));
  assert.ok(md.includes('**Max length:** 50'));
});

test('generateMarkdown: array constraints', () => {
  const schema = {
    type: 'array',
    items: { type: 'string' },
    minItems: 1,
    maxItems: 10,
    uniqueItems: true,
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('**Min items:** 1'));
  assert.ok(md.includes('**Max items:** 10'));
  assert.ok(md.includes('Unique items'));
});

// ── generateMarkdown: composition ────────────────────────────────────────────

test('generateMarkdown: allOf', () => {
  const schema = {
    allOf: [
      { type: 'object', properties: { a: { type: 'string' } } },
    ],
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('### allOf'));
  assert.ok(md.includes('Option 1'));
});

test('generateMarkdown: anyOf', () => {
  const schema = {
    anyOf: [
      { type: 'string' },
      { type: 'integer' },
    ],
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('### anyOf'));
});

test('generateMarkdown: oneOf', () => {
  const schema = {
    oneOf: [
      { type: 'string' },
      { type: 'null' },
    ],
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('### oneOf'));
});

// ── generateMarkdown: items ──────────────────────────────────────────────────

test('generateMarkdown: array items (single schema)', () => {
  const schema = {
    type: 'array',
    items: { type: 'string', description: 'A tag' },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('Array Items'));
  assert.ok(md.includes('A tag'));
});

test('generateMarkdown: array items (tuple)', () => {
  const schema = {
    type: 'array',
    items: [
      { type: 'string' },
      { type: 'integer' },
    ],
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('Item 0'));
  assert.ok(md.includes('Item 1'));
});

// ── generateMarkdown: $defs / definitions ────────────────────────────────────

test('generateMarkdown: renders $defs section', () => {
  const schema = {
    type: 'object',
    $defs: {
      Address: {
        type: 'object',
        properties: { street: { type: 'string' } },
      },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('## $defs'));
  assert.ok(md.includes('### Address'));
  assert.ok(md.includes('street'));
});

test('generateMarkdown: renders definitions section', () => {
  const schema = {
    type: 'object',
    definitions: {
      Tag: { type: 'string' },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('## definitions'));
  assert.ok(md.includes('### Tag'));
});

// ── generateMarkdown: $ref resolution ────────────────────────────────────────

test('generateMarkdown: resolves $ref in property', () => {
  const schema = {
    type: 'object',
    properties: {
      address: { $ref: '#/$defs/Address' },
    },
    $defs: {
      Address: { type: 'object', properties: { city: { type: 'string' } } },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('object'));
  // Should also render nested properties
  assert.ok(md.includes('city'));
});

// ── generateMarkdown: nested properties ──────────────────────────────────────

test('generateMarkdown: renders nested properties', () => {
  const schema = {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          profile: {
            type: 'object',
            properties: {
              bio: { type: 'string' },
            },
          },
        },
      },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('bio'));
  assert.ok(md.includes('nested'));
});

// ── generateMarkdown: examples ───────────────────────────────────────────────

test('generateMarkdown: includes examples', () => {
  const schema = {
    type: 'object',
    examples: [{ name: 'Alice' }],
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('## Examples'));
  assert.ok(md.includes('"name": "Alice"'));
});

test('generateMarkdown: multiple examples', () => {
  const schema = {
    type: 'string',
    examples: ['hello', 'world'],
  };
  const md = generateMarkdown(schema);
  const codeBlocks = (md.match(/```json/g) || []).length;
  assert.equal(codeBlocks, 2);
});

// ── generateMarkdown: const ──────────────────────────────────────────────────

test('generateMarkdown: shows const value', () => {
  const schema = {
    type: 'object',
    properties: {
      version: { const: 2 },
    },
  };
  const md = generateMarkdown(schema);
  assert.ok(md.includes('const'));
});

// ── generateMarkdown: edge cases ─────────────────────────────────────────────

test('generateMarkdown: empty schema', () => {
  const md = generateMarkdown({});
  assert.ok(md.includes('# Schema Documentation'));
});

test('generateMarkdown: no properties', () => {
  const md = generateMarkdown({ type: 'string' });
  assert.ok(md.includes('**Type:** `string`'));
  assert.ok(!md.includes('| Name |'));
});

test('generateMarkdown: maxDepth limits nesting', () => {
  const schema = {
    type: 'object',
    properties: {
      a: {
        type: 'object',
        properties: {
          b: {
            type: 'object',
            properties: {
              c: { type: 'string' },
            },
          },
        },
      },
    },
  };
  const md = generateMarkdown(schema, { maxDepth: 0 });
  // At depth 0, properties table renders but no nested sections
  assert.ok(md.includes('| `a` |'));
  // Deep 'c' should not appear in nested section
  assert.ok(!md.includes('#### `a` (nested)'));
});

// ── generateMarkdown: title override in opts ────────────────────────────────

test('generateMarkdown: opts.title overrides schema.title', () => {
  const md = generateMarkdown({ title: 'Schema Title' }, { title: 'Override' });
  assert.ok(md.includes('# Override'));
  assert.ok(!md.includes('# Schema Title'));
});
