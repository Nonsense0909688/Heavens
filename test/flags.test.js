import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VALUE_FLAGS,
  BOOL_FLAGS,
  SHORT_VALUE,
  SHORT_BOOL,
} from '../src/cli/flag-definitions.js';
import { parseArgs } from '../src/cli/parse-args.js';

const valueNames = Object.keys(VALUE_FLAGS);
const boolNames = Object.keys(BOOL_FLAGS);
const repeatedValueNames = valueNames.filter((name) => VALUE_FLAGS[name].list);
const singleValueNames = valueNames.filter((name) => !VALUE_FLAGS[name].list);
const valueAliases = Object.entries(VALUE_FLAGS).filter(([, def]) => def.short);
const boolAliases = Object.entries(BOOL_FLAGS).filter(([, alias]) => alias);

// The definitions are the contract used by parsing, help, and commands.
test('flag registry has unique, valid names and aliases', () => {
  assert.equal(new Set(valueNames).size, valueNames.length);
  assert.equal(new Set(boolNames).size, boolNames.length);
  assert.ok(valueNames.every((name) => /^[a-z][a-z0-9-]*$/.test(name)));
  assert.ok(boolNames.every((name) => /^[a-z][a-z0-9-]*$/.test(name)));
  assert.ok(valueNames.every((name) => !Object.hasOwn(BOOL_FLAGS, name)), 'value and boolean flags must not overlap');
  const aliases = [...Object.keys(SHORT_VALUE), ...Object.keys(SHORT_BOOL)];
  assert.equal(new Set(aliases).size, aliases.length, 'short aliases must be unique across flag types');
  assert.deepEqual(SHORT_VALUE, Object.fromEntries(valueAliases.map(([name, def]) => [def.short, name])));
  assert.deepEqual(SHORT_BOOL, Object.fromEntries(boolAliases.map(([name, alias]) => [alias, name])));
});

// Each value flag must support both documented long-option forms.
for (const name of valueNames) {
  test(`--${name} consumes a following value`, () => {
    const parsed = parseArgs(['--' + name, 'sentinel-value']);
    assert.deepEqual(parsed._, []);
    assert.equal(parsed.flags[name] instanceof Array ? parsed.flags[name][0] : parsed.flags[name], 'sentinel-value');
  });

  test(`--${name}=value parses inline assignment`, () => {
    const parsed = parseArgs(['--' + name + '=inline-value']);
    assert.equal(parsed.flags[name] instanceof Array ? parsed.flags[name][0] : parsed.flags[name], 'inline-value');
  });

  test(`--${name} preserves values containing equals signs`, () => {
    const parsed = parseArgs(['--' + name + '=left=middle=right']);
    assert.equal(parsed.flags[name] instanceof Array ? parsed.flags[name][0] : parsed.flags[name], 'left=middle=right');
  });

  test(`--${name} accepts an empty inline value`, () => {
    const parsed = parseArgs(['--' + name + '=']);
    assert.equal(parsed.flags[name] instanceof Array ? parsed.flags[name][0] : parsed.flags[name], '');
  });

  test(`--${name} does not swallow following positional arguments`, () => {
    const parsed = parseArgs(['--' + name, 'value', 'GET', 'https://example.test']);
    assert.deepEqual(parsed._, ['GET', 'https://example.test']);
  });
}

for (const name of repeatedValueNames) {
  test(`--${name} accumulates repeated values in order`, () => {
    const parsed = parseArgs(['--' + name, 'first', '--' + name, 'second', '--' + name + '=third']);
    assert.deepEqual(parsed.flags[name], ['first', 'second', 'third']);
  });

  test(`--${name} initializes a fresh array per parse`, () => {
    const first = parseArgs(['--' + name, 'one']);
    const second = parseArgs(['--' + name, 'two']);
    assert.deepEqual(first.flags[name], ['one']);
    assert.deepEqual(second.flags[name], ['two']);
    assert.notEqual(first.flags[name], second.flags[name]);
  });
}

for (const name of singleValueNames) {
  test(`--${name} uses the last value when repeated`, () => {
    const parsed = parseArgs(['--' + name, 'first', '--' + name, 'second']);
    assert.equal(parsed.flags[name], 'second');
  });
}

for (const [name, definition] of valueAliases) {
  const alias = definition.short;
  test(`-${alias} resolves to --${name}`, () => {
    const parsed = parseArgs(['-' + alias, 'alias-value']);
    const expected = definition.list ? ['alias-value'] : 'alias-value';
    assert.deepEqual(parsed.flags[name], expected);
    assert.equal(Object.hasOwn(parsed.flags, alias), false);
  });

  test(`-${alias} supports an attached value`, () => {
    const parsed = parseArgs(['-' + alias + 'attached']);
    assert.equal(definition.list ? parsed.flags[name][0] : parsed.flags[name], 'attached');
  });

  if (definition.list) {
    test(`-${alias} accumulates multiple occurrences`, () => {
      assert.deepEqual(parseArgs(['-' + alias, 'one', '-' + alias + 'two']).flags[name], ['one', 'two']);
    });
  }
}

for (const name of boolNames) {
  test(`--${name} sets a true boolean flag`, () => {
    const parsed = parseArgs(['--' + name]);
    assert.equal(parsed.flags[name], true);
    assert.equal(Object.hasOwn(parsed.flags, 'undefined'), false);
  });

  test(`--${name} can be repeated without changing its meaning`, () => {
    assert.equal(parseArgs(['--' + name, '--' + name]).flags[name], true);
  });

  test(`--${name} leaves later positional arguments intact`, () => {
    assert.deepEqual(parseArgs(['--' + name, 'GET', '/health'])._, ['GET', '/health']);
  });
}

for (const [name, alias] of boolAliases) {
  test(`-${alias} resolves to --${name}`, () => {
    const parsed = parseArgs(['-' + alias]);
    assert.equal(parsed.flags[name], true);
    assert.equal(Object.hasOwn(parsed.flags, alias), false);
  });
}

// Short boolean combinations and mixed positional/flag parsing.
for (const [nameA, aliasA] of boolAliases) {
  for (const [nameB, aliasB] of boolAliases) {
    if (aliasA === aliasB) continue;
    test(`short boolean bundle -${aliasA}${aliasB} sets ${nameA} and ${nameB}`, () => {
      const parsed = parseArgs(['-' + aliasA + aliasB]);
      assert.equal(parsed.flags[nameA], true);
      assert.equal(parsed.flags[nameB], true);
    });
  }
}

for (const [name, definition] of valueAliases) {
  for (const [boolName, boolAlias] of boolAliases) {
    test(`-${boolAlias}${definition.short}value bundles ${boolName} with ${name}`, () => {
      const parsed = parseArgs(['-' + boolAlias + definition.short, 'bundle-value']);
      assert.equal(parsed.flags[boolName], true);
      assert.equal(definition.list ? parsed.flags[name][0] : parsed.flags[name], 'bundle-value');
    });
  }
}

// Parser edge cases shared by all commands.
test('positional arguments before and after flags retain their order', () => {
  assert.deepEqual(parseArgs(['GET', '--silent', '/health', '--count=4'])._, ['GET', '/health']);
});

test('double dash ends option parsing', () => {
  assert.deepEqual(parseArgs(['GET', '--', '--not-a-flag', '-x'])._, ['GET', '--not-a-flag', '-x']);
});

test('negative numeric-looking positional values are not parsed as short flags', () => {
  assert.deepEqual(parseArgs(['-5', '-0.25'])._, ['-5', '-0.25']);
});

test('unknown long flags fail with a useful message', () => {
  assert.throws(() => parseArgs(['--not-a-real-flag']), /Unknown option --not-a-real-flag/);
});

test('unknown short flags fail with a useful message', () => {
  assert.throws(() => parseArgs(['-Z']), /Unknown option -Z/);
});

for (const name of valueNames) {
  test(`--${name} rejects a missing value`, () => {
    assert.throws(() => parseArgs(['--' + name]), new RegExp('--' + name + ' requires a value'));
  });
}

for (const [, definition] of valueAliases) {
  test(`-${definition.short} rejects a missing value`, () => {
    assert.throws(() => parseArgs(['-' + definition.short]), new RegExp('-' + definition.short + ' requires a value'));
  });
}

test('empty argv returns empty positional and flag collections', () => {
  assert.deepEqual(parseArgs([]), { _: [], flags: {} });
});

test('repeated flags do not leak between parse calls', () => {
  parseArgs(['--header', 'first']);
  assert.deepEqual(parseArgs(['GET', '--silent']), { _: ['GET'], flags: { silent: true } });
});
