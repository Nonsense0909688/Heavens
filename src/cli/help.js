// All help text.
//   GENERAL          -> `heaven help`
//   COMMANDS[name]   -> `heaven help <name>`
//
// Conventions used throughout:
//   UPPERCASE   placeholder you replace      [brackets]  optional
//   a | b       choose one                   ...         may be repeated

export const GENERAL = `
heaven - a terminal workshop for HTTP APIs                      (alias: hv)

USAGE
  heaven <command> [arguments] [options]
  heaven help <command>                 detailed help for one command

SEND A REQUEST
  heaven get /users                     relative URLs use the active environment
  heaven post /users --json '{"name":"Anish"}'
  heaven get https://api.github.com/users/octocat
  heaven get /users -q page=2 -H "X-Debug: 1" --bearer {{token}} -i

SAVE AND REUSE
  save      Store a request as a reusable template
  run       Send a saved request, with optional overrides
  list      List saved requests
  rm        Delete a saved request

ENVIRONMENTS AND SAFETY
  env       Manage environments (base URL, variables, headers)

  heaven env set staging --base-url https://staging.example.com --protected
  heaven env use staging
  heaven save create-user post /users --requires-env staging

  Protected environments ask for confirmation before any non-GET request.
  GET requests never prompt. In a non-interactive session, a write to a
  protected environment fails safely without being sent.
  A request saved with --requires-env runs only against that environment.

IMPORT, EXPORT, AND EXTEND
  import FILE --format curl|postman|openapi   Import requests as JSON templates
  export FILE.json --format openapi           Export templates as OpenAPI
  heaven get URL --curl                        Print a cURL command without sending
  mock fixtures.json --port 8080               Run a local JSON mock server

COMPARE, REPLAY, TEST
  compare   Send one request to two environments and diff the results
  history   Browse past requests (secrets redacted, no response bodies)
  replay    Re-send a history entry
  flow      Run a multi-step workflow with extraction and assertions
  bench     Measure latency and throughput under load
  (inline checks) heaven get /health --expect-status 200 --expect-time 300

PROJECT SETUP
  init      Create a project-local .heaven/ directory (git-friendly)

REQUEST OPTIONS
  -H, --header "K: v"       Add a header                 (repeatable)
  -q, --query k=v           Add a query parameter        (repeatable)
  -e, --env NAME            Use environment NAME for this request
  -v, --var k=v             Set a variable               (repeatable)
      --json BODY|@file     Send a JSON body
  -d, --data BODY|@file     Send a raw body
  -F, --form k=v|k=@file    Send multipart form data     (repeatable)
      --upload FILE         Upload a file as the request body
      --bearer TOKEN        Bearer token authentication
      --basic user:pass     Basic authentication
  -t, --timeout MS          Abort after MS milliseconds
      --no-follow           Do not follow redirects
  -k, --insecure            Skip TLS certificate verification

OUTPUT OPTIONS
  -i, --include             Include response status and headers
  -V, --verbose             Show request details as well as the response
  -s, --silent              Suppress all output except errors
  -o, --output-file FILE    Write the response body to FILE
      --output json         Emit machine-readable JSON
      --raw | --pretty      Disable or force body formatting
      --stream              Print the response as it arrives
      --no-color            Disable colored output

ASSERTION OPTIONS
  --expect-status 200|2xx           Require a status code or class
  --expect-json path=value          Require a JSON field value
  --expect-contains TEXT            Require text in the body
  --expect-time MS                  Require a response within MS milliseconds

SAFETY AND HISTORY OPTIONS
  --protected               Mark an environment as protected (env set)
  --requires-env NAME       Restrict a saved request to one environment (save)
  --no-history              Do not record this request in history
  --no-fail                 Exit 0 on HTTP 4xx/5xx responses

EXIT CODES
  0  Success
  1  Usage or configuration error
  2  HTTP 4xx/5xx response
  3  Network, timeout, or TLS failure
  4  Assertion failed
  5  Compare found differences

Run "heaven help <command>" for examples and details.
`;

export const COMMANDS = {
  import: `heaven import FILE --format curl|postman|openapi\nPrint imported request templates as JSON.`,
  export: `heaven export FILE.json --format openapi\nExport request templates as an OpenAPI document.`,
  mock: `heaven mock fixtures.json [--port 8080]\nServe fixtures keyed by \"METHOD /path\".`,
  request: `
heaven METHOD URL [options]

METHOD   get | post | put | patch | delete | head | options
URL      Absolute (https://...) or relative to the active environment's base URL.

Sends a single HTTP request and prints the response. {{variables}} in the URL,
headers, query, and body are resolved from the environment, --var, and your
shell ({{$env.NAME}}).

EXAMPLES
  heaven get /users -q page=2
  heaven post /users --json '{"name":"Anish"}'
  heaven post /upload -F title=Report -F file=@report.pdf
  heaven get /health --expect-status 200 --expect-time 300

NOTES
  Requests to a protected environment prompt for confirmation unless the
  method is GET. See "heaven help env".

SEE ALSO
  heaven help save     heaven help history     heaven help flow
`,

  save: `
USAGE
  heaven save NAME [METHOD] URL [request options]
  heaven save NAME --last [overrides]

DESCRIPTION
  Stores a request template under NAME in requests.json. {{placeholders}} stay
  unresolved, so one saved request works in every environment.

OPTIONS
  --last               Save the most recent history entry. Only possible when
                       that entry contained no secrets.
  --requires-env NAME  Restrict this request to environment NAME. Running it
                       against any other environment is rejected before the
                       request is sent.

EXAMPLES
  heaven save login post /login --json '{"user":"anish","password":"{{$env.PASS}}"}'
  heaven save create-user post /users --requires-env staging
  heaven save --last create-user

SECURITY
  Literal secrets in a saved request trigger a warning. Use {{$env.NAME}} or
  {{variables}} so credentials never touch disk.

SEE ALSO
  heaven help run     heaven help env
`,

  run: `
USAGE
  heaven run NAME [overrides]

DESCRIPTION
  Sends a saved request. Any request option overrides the saved value.

EXAMPLES
  heaven run get-user --env prod --var id=42
  heaven run get-user -H "X-Debug: 1" -i

NOTES
  A request saved with --requires-env must run against its required
  environment. A mismatch is rejected before anything is sent.

SEE ALSO
  heaven help save     heaven help compare
`,

  list: `
USAGE
  heaven list

DESCRIPTION
  Lists all saved requests with their method and URL template.

SEE ALSO
  heaven help save     heaven help run
`,

  rm: `
USAGE
  heaven rm NAME

DESCRIPTION
  Deletes the saved request NAME. This does not affect history.

SEE ALSO
  heaven help list
`,

  env: `
USAGE
  heaven env set NAME [--base-url URL] [-v key=value]... [-H "Header: value"]...
                      [--protected]
  heaven env use NAME
  heaven env list
  heaven env show [NAME]
  heaven env rm NAME

DESCRIPTION
  An environment bundles a base URL, variables, and default headers so the
  same requests can target dev, staging, or production.

COMMANDS
  set    Create or update an environment
  use    Make NAME the active environment
  list   List all environments
  show   Print an environment (defaults to the active one)
  rm     Delete an environment

OPTIONS
  --base-url URL     Prefix applied to relative request URLs
  -v, --var k=v      Set a variable. An empty value (-v key=) removes it.
  -H, --header       Default header sent with every request
  --protected        Require interactive confirmation for every non-GET
                     request to this environment. If confirmation cannot be
                     obtained (non-interactive session), the request fails
                     safely without being sent.

EXAMPLES
  heaven env set staging --base-url https://staging.example.com --protected
  heaven env set dev --base-url http://localhost:3000 -v token='{{$env.MY_TOKEN}}'
  heaven env use staging

SECURITY
  Variable values may reference your shell environment, as in the token example
  above, so secrets are never written to disk.

SEE ALSO
  heaven help save     heaven help compare
`,

  compare: `
USAGE
  heaven compare NAME --env A --env B [--ignore PATHS] [--headers]
  heaven compare METHOD URL --env A --env B [--ignore PATHS] [--headers]

DESCRIPTION
  Sends the same request to two environments and reports differences in status
  code and JSON body (field by field). Headers are compared only with --headers.
  Response time is displayed but never counts as a difference.

OPTIONS
  --env NAME      Environment to compare (specify exactly twice)
  --ignore PATHS  Comma-separated fields to skip. Accepts key names (matched at
                  any depth), exact paths, or wildcards such as items[*].id
  --headers       Include response headers in the comparison

EXAMPLES
  heaven compare get-user --env dev --env prod --ignore updatedAt,id
  heaven compare get /users --env dev --env prod

EXIT CODES
  0  Responses are identical
  5  Differences found

SEE ALSO
  heaven help env     heaven help run
`,

  history: `
USAGE
  heaven history [--limit N] [--search TEXT]
  heaven history show ID
  heaven history clear
  heaven replay ID [overrides]

DESCRIPTION
  Every request is recorded as a template with secrets redacted, plus response
  metadata (status, time, size). Response bodies are never stored.
  Use --no-history on any request to skip recording.

COMMANDS
  (none)   List recent entries
  show     Display one entry in full
  clear    Delete all history
  replay   Re-send an entry, optionally with overrides

OPTIONS
  --limit N        Number of entries to list (default: 20)
  --search TEXT    Show only entries matching TEXT

REPLAYING REDACTED ENTRIES
  If an entry contained a secret, supply it again with -H or --bearer, or
  express it as a {{variable}}.

EXAMPLES
  heaven history --search /users --limit 5
  heaven history show 12
  heaven replay 12 --env staging
`,

  replay: `
USAGE
  heaven replay ID [overrides]

DESCRIPTION
  Re-sends the history entry ID. Any request option overrides the recorded value.
  Entries that contained redacted secrets need them supplied again with -H or
  --bearer, or expressed as {{variables}}.

EXAMPLES
  heaven replay 12
  heaven replay 12 --env staging --bearer {{token}}

SEE ALSO
  heaven help history
`,

  flow: `
USAGE
  heaven flow FILE.json [--env NAME] [--var k=v] [--output json]

DESCRIPTION
  Runs a sequence of requests defined in a JSON file. Values extracted from one
  step can be used in later steps as {{variables}}. Execution stops at the first
  failing step unless "continueOnError": true is set on it.

FILE FORMAT
  {
    "name": "login then fetch profile",
    "vars": { "user": "anish" },
    "steps": [
      { "name": "login", "method": "POST", "url": "/login",
        "json": { "user": "{{user}}", "password": "{{$env.PASS}}" },
        "expect": { "status": 200 },
        "extract": { "token": "body.access_token" } },
      { "name": "me", "method": "GET", "url": "/me", "bearer": "{{token}}",
        "expect": { "status": 200, "json": { "user": "anish" }, "maxTime": 500 } }
    ]
  }

STEPS
  A step is either inline (method, url, and request fields) or a reference to a
  saved request: { "use": "saved-request-name" }.

EXTRACT
  body.a.b[0]        a value from the JSON response body
  headers.location   a response header
  status             the HTTP status code

EXPECT
  status     200 | "2xx" | [200, 201]
  maxTime    maximum response time in milliseconds
  contains   text that must appear in the body
  headers    required response headers
  json       a map of path -> value, or a list of rules:
             { "path": "...", "equals" | "exists" | "gt" | "lt" | "matches" | "type" }

EXIT CODES
  0  All steps passed
  4  An assertion failed
`,

  bench: `
USAGE
  heaven bench NAME|URL [-n COUNT] [-c CONCURRENCY] [--max-p95 MS] [--output json]
  heaven bench METHOD URL [-n COUNT] [-c CONCURRENCY]

DESCRIPTION
  Sends COUNT requests with CONCURRENCY in flight at once. Response bodies are
  read and discarded. Reports latency percentiles, throughput, a status-code
  histogram, and the error rate.

OPTIONS
  -n COUNT         Total requests to send (default: 100)
  -c CONCURRENCY   Requests in flight at once (default: 10)
  --max-p95 MS     Fail if the 95th-percentile latency exceeds MS
  --output json    Emit results as JSON

EXAMPLES
  heaven bench get-users -n 200 -c 20
  heaven bench get /health -n 500 -c 25 --max-p95 250

EXIT CODES
  0  All requests succeeded
  2  One or more requests failed
  4  --max-p95 threshold exceeded
`,

  init: `
USAGE
  heaven init

DESCRIPTION
  Creates a project-local .heaven/ directory so saved requests, environments,
  and flows can live in your repository and be shared through git.

NOTES
  Keep secrets out of committed files: reference them as {{$env.NAME}} rather
  than writing literal values.

SEE ALSO
  heaven help save     heaven help env
`,
};
