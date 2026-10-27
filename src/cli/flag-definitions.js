// The single list of every flag Heaven understands.
// To add a new flag: add one line here, then read it from `flags` in a command.

// Flags that take a value.  name -> { short?, list? }
// `list: true` means the flag may repeat (-H a -H b) and is collected into an array.
export const VALUE_FLAGS = {
  header: { short: 'H', list: true },
  query: { short: 'q', list: true },
  form: { short: 'F', list: true },
  var: { short: 'v', list: true },
  env: { short: 'e', list: true },
  'expect-json': { list: true },
  'expect-contains': { list: true },
  ignore: { list: true },
  json: {},
  data: { short: 'd' },
  upload: {},
  timeout: { short: 't' },
  output: {},
  'output-file': { short: 'o' },
  'expect-status': {},
  'expect-time': {},
  bearer: {},
  basic: {},
  'base-url': {},
  limit: {},
  search: {},
  count: { short: 'n' },
  concurrency: { short: 'c' },
  'max-buffer': {},
  'max-p95': {},
  'requires-env': {},
  format: {},
  port: {},
  'plugin-dir': {},
  'watch-interval': {},
  'ramp-up': {},
  'junit-output': {},
  'html-report': {},
  'json-report': {},
  'assert-header': { list: true },
  'assert-body': { list: true },
  'json-schema': {},
};

// On/off flags.  name -> short alias (or null)
export const BOOL_FLAGS = {
  include: 'i',
  verbose: 'V',
  insecure: 'k',
  silent: 's',
  help: 'h',
  version: null,
  'no-color': null,
  'no-follow': null,
  'no-fail': null,
  'no-history': null,
  last: null,
  headers: null,
  raw: null,
  pretty: null,
  stream: null,
  protected: null,
  'dry-run': null,
  curl: null,
  watch: null,
  mock: null,
  color: null,
};

// Reverse lookups for short flags:  'H' -> 'header',  'i' -> 'include'
export const SHORT_VALUE = Object.fromEntries(
  Object.entries(VALUE_FLAGS)
    .filter(([, v]) => v.short)
    .map(([name, v]) => [v.short, name])
);
export const SHORT_BOOL = Object.fromEntries(
  Object.entries(BOOL_FLAGS)
    .filter(([, short]) => short)
    .map(([name, short]) => [short, name])
);
