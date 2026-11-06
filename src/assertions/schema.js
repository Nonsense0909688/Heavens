// Minimal JSON Schema validator (subset, zero-dependency).
// Supports: $ref (local), type, enum, const, required, properties,
// additionalProperties, items, min/maxProperties, minimum/maximum,
// exclusiveMinimum/exclusiveMaximum, multipleOf, min/maxLength, pattern,
// min/maxItems, uniqueItems, allOf, anyOf, oneOf, not.
import { isDeepStrictEqual } from 'node:util';

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) return null;
  let cur = root;
  for (const part of ref.slice(2).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (cur == null) return null;
    cur = cur[part];
  }
  return cur ?? null;
}

function checkType(instance, type) {
  if (Array.isArray(type)) return type.some(t => checkType(instance, t));
  switch (type) {
    case 'string': return typeof instance === 'string';
    case 'number': return typeof instance === 'number' && Number.isFinite(instance);
    case 'integer': return Number.isInteger(instance);
    case 'boolean': return typeof instance === 'boolean';
    case 'object': return instance !== null && typeof instance === 'object' && !Array.isArray(instance);
    case 'array': return Array.isArray(instance);
    case 'null': return instance === null;
    default: return true; // unknown type names ignored
  }
}

export function validateJsonSchema(instance, schema, root = schema, path = '$', errors = []) {
  if (!schema || typeof schema !== 'object') return errors;
  if (schema.$ref) {
    const target = resolveRef(root, schema.$ref);
    if (target) validateJsonSchema(instance, target, root, path, errors);
    return errors;
  }

  if (schema.const !== undefined && !isDeepStrictEqual(instance, schema.const)) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(instance)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some(v => isDeepStrictEqual(v, instance))) {
    errors.push(`${path}: ${JSON.stringify(instance)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type && !checkType(instance, schema.type)) {
    errors.push(`${path}: expected type ${schema.type}, got ${typeOf(instance)}`);
  }

  if (typeof instance === 'number') {
    if (schema.minimum !== undefined && instance < schema.minimum) errors.push(`${path}: ${instance} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && instance > schema.maximum) errors.push(`${path}: ${instance} > maximum ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && instance <= schema.exclusiveMinimum) errors.push(`${path}: ${instance} <= exclusiveMinimum ${schema.exclusiveMinimum}`);
    if (schema.exclusiveMaximum !== undefined && instance >= schema.exclusiveMaximum) errors.push(`${path}: ${instance} >= exclusiveMaximum ${schema.exclusiveMaximum}`);
    if (schema.multipleOf && instance % schema.multipleOf !== 0) errors.push(`${path}: ${instance} not multiple of ${schema.multipleOf}`);
  }

  if (typeof instance === 'string') {
    if (schema.minLength !== undefined && instance.length < schema.minLength) errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    if (schema.maxLength !== undefined && instance.length > schema.maxLength) errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    if (schema.pattern) {
      try { if (!new RegExp(schema.pattern).test(instance)) errors.push(`${path}: "${instance}" does not match pattern ${schema.pattern}`); } catch { /* invalid pattern ignored */ }
    }
  }

  if (Array.isArray(instance)) {
    if (schema.minItems !== undefined && instance.length < schema.minItems) errors.push(`${path}: fewer than minItems ${schema.minItems}`);
    if (schema.maxItems !== undefined && instance.length > schema.maxItems) errors.push(`${path}: more than maxItems ${schema.maxItems}`);
    if (schema.uniqueItems) {
      const seen = new Set(instance.map(v => JSON.stringify(v)));
      if (seen.size !== instance.length) errors.push(`${path}: items are not unique`);
    }
    if (schema.items && typeof schema.items === 'object') {
      instance.forEach((item, i) => validateJsonSchema(item, schema.items, root, `${path}[${i}]`, errors));
    }
    if (Array.isArray(schema.prefixItems)) {
      schema.prefixItems.forEach((s, i) => { if (i < instance.length) validateJsonSchema(instance[i], s, root, `${path}[${i}]`, errors); });
    }
  }

  if (instance !== null && typeof instance === 'object' && !Array.isArray(instance)) {
    if (schema.minProperties !== undefined && Object.keys(instance).length < schema.minProperties) errors.push(`${path}: fewer than minProperties`);
    if (schema.maxProperties !== undefined && Object.keys(instance).length > schema.maxProperties) errors.push(`${path}: more than maxProperties`);
    for (const req of schema.required ?? []) {
      if (!(req in instance)) errors.push(`${path}: missing required property "${req}"`);
    }
    const props = schema.properties ?? {};
    for (const [k, sub] of Object.entries(props)) {
      if (k in instance) validateJsonSchema(instance[k], sub, root, `${path}.${k}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(instance)) if (!(k in props)) errors.push(`${path}: additional property "${k}" not allowed`);
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const k of Object.keys(instance)) if (!(k in props)) validateJsonSchema(instance[k], schema.additionalProperties, root, `${path}.${k}`, errors);
    }
  }

  if (Array.isArray(schema.allOf)) for (const sub of schema.allOf) validateJsonSchema(instance, sub, root, path, errors);
  if (Array.isArray(schema.anyOf)) {
    const ok = schema.anyOf.some(sub => validateJsonSchema(instance, sub, root, path, []).length === 0);
    if (!ok) errors.push(`${path}: matches none of anyOf`);
  }
  if (Array.isArray(schema.oneOf)) {
    const ok = schema.oneOf.filter(sub => validateJsonSchema(instance, sub, root, path, []).length === 0).length;
    if (ok !== 1) errors.push(`${path}: matches ${ok} oneOf schemas (expected 1)`);
  }
  if (schema.not && validateJsonSchema(instance, schema.not, root, path, []).length === 0) {
    errors.push(`${path}: matches forbidden "not" schema`);
  }

  return errors;
}
