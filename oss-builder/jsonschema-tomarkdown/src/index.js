'use strict';

/**
 * jsonschema-tomarkdown
 * Generate human-readable markdown from JSON Schema definitions.
 */

// ── Canonical key ordering for object schemas ────────────────────────────────
const FIELD_ORDER = [
  'type', 'format', 'title', 'description', 'default',
  'enum', 'const', 'examples',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'pattern',
  'minItems', 'maxItems', 'uniqueItems',
  'minProperties', 'maxProperties',
  'required', 'properties', 'additionalProperties', 'patternProperties',
  'items', 'prefixItems', 'contains',
  'allOf', 'anyOf', 'oneOf', 'not',
  '$ref', '$id', '$schema', '$comment',
  'deprecated', 'readOnly', 'writeOnly',
];

/**
 * Resolve a local $ref pointer within the root schema.
 * Only supports internal `#/path/to/thing` refs.
 * @returns {*} resolved target, or null if unresolvable
 */
function resolveRef(ref, root) {
  if (typeof ref !== 'string' || !ref.startsWith('#')) return null;
  const parts = ref.slice(1).split('/').filter(Boolean);
  let node = root;
  for (const part of parts) {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node == null || typeof node !== 'object') return null;
    node = node[key];
  }
  return node === undefined ? null : node;
}

/**
 * Pretty-print a JSON value for table cells.
 */
function fmt(value) {
  if (value === undefined) return '';
  if (value === null) return '`null`';
  if (typeof value === 'string') return `\`${value}\``;
  if (typeof value === 'number' || typeof value === 'boolean') return `\`${value}\``;
  if (Array.isArray(value)) {
    return value.map((v) => fmt(v)).join(', ');
  }
  return '`' + JSON.stringify(value) + '`';
}

/**
 * Determine display type string for a schema node.
 */
function typeOf(schema, root) {
  if (!schema) return '—';
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, root);
    if (resolved) return typeOf(resolved, root);
    return schema.$ref;
  }
  if (schema.allOf) return 'allOf';
  if (schema.anyOf) return 'anyOf';
  if (schema.oneOf) return 'oneOf';
  if (schema.enum) return 'enum';
  if (schema.const !== undefined) return 'const';
  if (Array.isArray(schema.type)) return schema.type.join(' \\| ');
  if (schema.type) return schema.type;
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  return '—';
}

/**
 * Extract a short description, trimming long text.
 */
function shortDesc(schema) {
  const d = schema.description || schema.title || '';
  return d;
}

/**
 * Build a markdown table row for a property.
 */
function propRow(name, schema, root, required) {
  const type = typeOf(schema, root);
  const req = required ? '✅' : '';
  const def = fmt(schema.default);
  const desc = shortDesc(schema);
  const enumStr = schema.enum ? '`' + JSON.stringify(schema.enum) + '`' : '';
  const pattern = schema.pattern ? `\`${schema.pattern}\`` : '';

  let extra = '';
  if (enumStr) extra += `<br>Enum: ${enumStr}`;
  if (pattern) extra += `<br>Pattern: ${pattern}`;
  if (schema.format) extra += `<br>Format: \`${schema.format}\``;
  if (schema.deprecated) extra += ' ⚠️ **Deprecated**';

  return `| \`${name}\` | ${type} | ${req} | ${def} | ${desc}${extra} |`;
}

/**
 * Render schema constraints (min/max etc.) as bullet points.
 */
function renderConstraints(schema) {
  const lines = [];
  if (schema.minimum !== undefined) lines.push(`- **Minimum:** ${schema.minimum}`);
  if (schema.maximum !== undefined) lines.push(`- **Maximum:** ${schema.maximum}`);
  if (schema.exclusiveMinimum !== undefined) lines.push(`- **Exclusive minimum:** ${schema.exclusiveMinimum}`);
  if (schema.exclusiveMaximum !== undefined) lines.push(`- **Exclusive maximum:** ${schema.exclusiveMaximum}`);
  if (schema.minLength !== undefined) lines.push(`- **Min length:** ${schema.minLength}`);
  if (schema.maxLength !== undefined) lines.push(`- **Max length:** ${schema.maxLength}`);
  if (schema.minItems !== undefined) lines.push(`- **Min items:** ${schema.minItems}`);
  if (schema.maxItems !== undefined) lines.push(`- **Max items:** ${schema.maxItems}`);
  if (schema.uniqueItems) lines.push('- **Unique items required**');
  if (schema.minProperties !== undefined) lines.push(`- **Min properties:** ${schema.minProperties}`);
  if (schema.maxProperties !== undefined) lines.push(`- **Max properties:** ${schema.maxProperties}`);
  return lines.join('\n');
}

/**
 * Main: convert a schema object to markdown string.
 *
 * @param {object} schema - JSON Schema object
 * @param {object} [opts] - Options
 * @param {string} [opts.title] - Override document title
 * @param {number} [opts.maxDepth=10] - Max nesting depth
 * @returns {string} markdown
 */
function generateMarkdown(schema, opts = {}) {
  const root = schema;
  const maxDepth = opts.maxDepth ?? 10;
  const lines = [];
  const seen = new Set();

  const title = opts.title || schema.title || 'Schema Documentation';
  lines.push(`# ${title}`, '');
  if (schema.description) {
    lines.push(schema.description, '');
  }
  if (schema.$id) {
    lines.push(`> **Schema ID:** \`${schema.$id}\``, '');
  }
  if (schema.$schema) {
    lines.push(`> **Dialect:** \`${schema.$schema}\``, '');
  }

  // Top-level type
  const t = typeOf(schema, root);
  if (t !== '—') {
    lines.push(`**Type:** \`${t}\``, '');
  }

  // Constraints
  const constraints = renderConstraints(schema);
  if (constraints) {
    lines.push('### Constraints', '', constraints, '');
  }

  // Render composition keywords
  for (const kw of ['allOf', 'anyOf', 'oneOf']) {
    if (schema[kw]) {
      lines.push(`### ${kw}`, '');
      schema[kw].forEach((sub, i) => {
        lines.push(`**Option ${i + 1}:**`, '');
        const subMd = renderSchemaNode(sub, root, 0, maxDepth, seen);
        lines.push(subMd, '');
      });
    }
  }

  // Properties
  if (schema.properties) {
    lines.push(renderProperties(schema, root, 0, maxDepth, seen), '');
  }

  // Items (array)
  if (schema.items) {
    lines.push('### Array Items', '');
    if (Array.isArray(schema.items)) {
      schema.items.forEach((item, i) => {
        lines.push(`**Item ${i}:**`, '');
        lines.push(renderSchemaNode(item, root, 0, maxDepth, seen), '');
      });
    } else {
      lines.push(renderSchemaNode(schema.items, root, 0, maxDepth, seen), '');
    }
    lines.push('');
  }

  // Definitions / $defs
  const defs = schema.$defs || schema.definitions;
  const defKey = schema.$defs ? '$defs' : 'definitions';
  if (defs) {
    lines.push(`## ${defKey}`, '');
    for (const [name, def] of Object.entries(defs)) {
      lines.push(`### ${name}`, '');
      lines.push(renderSchemaNode(def, root, 0, maxDepth, seen), '');
    }
    lines.push('');
  }

  // Examples
  if (schema.examples && schema.examples.length) {
    lines.push('## Examples', '');
    for (const ex of schema.examples) {
      lines.push('```json');
      lines.push(JSON.stringify(ex, null, 2));
      lines.push('```', '');
    }
  }

  return lines.join('\n');
}

/**
 * Render a properties table + nested details.
 */
function renderProperties(schema, root, depth, maxDepth, seen) {
  const lines = [];
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const header = depth === 0 ? '## Properties' : `### ${'  '.repeat(depth)}Properties`;

  lines.push(header, '');
  lines.push('| Name | Type | Required | Default | Description |');
  lines.push('|------|------|----------|---------|-------------|');

  for (const [name, prop] of Object.entries(props)) {
    lines.push(propRow(name, prop, root, required.has(name)));
  }
  lines.push('');

  // Additional properties
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    lines.push(`> **Additional properties** are allowed with type: \`${typeOf(schema.additionalProperties, root)}\``, '');
  } else if (schema.additionalProperties === false) {
    lines.push('> **Additional properties are NOT allowed.**', '');
  }

  // Nested properties
  if (depth < maxDepth) {
    for (const [name, prop] of Object.entries(props)) {
      const resolved = prop.$ref ? resolveRef(prop.$ref, root) : prop;
      if (resolved && resolved.properties && Object.keys(resolved.properties).length) {
        const ref = prop.$ref || `properties/${name}`;
        if (!seen.has(ref)) {
          seen.add(ref);
          lines.push(`#### \`${name}\` (nested)`, '');
          lines.push(renderProperties(resolved, root, depth + 1, maxDepth, seen), '');
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Render a single schema node (for composition items etc.)
 */
function renderSchemaNode(schema, root, depth, maxDepth, seen) {
  const lines = [];
  const t = typeOf(schema, root);
  if (t !== '—') lines.push(`**Type:** \`${t}\``, '');
  if (schema.description) lines.push(schema.description, '');

  const constraints = renderConstraints(schema);
  if (constraints) lines.push('### Constraints', '', constraints, '');

  if (schema.enum) {
    lines.push(`**Enum:** ${schema.enum.map((v) => fmt(v)).join(' \\| ')}`, '');
  }
  if (schema.const !== undefined) {
    lines.push(`**Const:** ${fmt(schema.const)}`, '');
  }

  for (const kw of ['allOf', 'anyOf', 'oneOf']) {
    if (schema[kw]) {
      lines.push(`**${kw}:**`, '');
      schema[kw].forEach((sub, i) => {
        lines.push(`_${kw} ${i + 1}:_`);
        const subMd = renderSchemaNode(sub, root, depth + 1, maxDepth, seen);
        lines.push(subMd, '');
      });
    }
  }

  if (schema.properties) {
    lines.push(renderProperties(schema, root, depth, maxDepth, seen), '');
  }

  if (schema.items && depth < maxDepth) {
    lines.push('**Array items:**', '');
    if (Array.isArray(schema.items)) {
      schema.items.forEach((item, i) => {
        lines.push(`_Item ${i}:_`);
        lines.push(renderSchemaNode(item, root, depth + 1, maxDepth, seen), '');
      });
    } else {
      lines.push(renderSchemaNode(schema.items, root, depth + 1, maxDepth, seen), '');
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = { generateMarkdown, resolveRef, typeOf, fmt, renderConstraints, renderProperties };
