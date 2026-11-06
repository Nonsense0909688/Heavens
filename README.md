<div align="center">

# Heaven ☁️

**Your terminal API workshop.**

Heaven is a small command-line tool for talking to APIs. Send a request, save it
so you never retype it, point it at dev or prod with one flag, compare the two,
chain requests into a workflow, and load-test the result. All from your terminal,
with no app to open and no account to create.

[![CI Pipeline](https://github.com/Nonsense0909688/Heavens/actions/workflows/ci.yml/badge.svg?style=flat-square)](https://github.com/Nonsense0909688/Heavens/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/release/Nonsense0909688/Heavens?style=flat-square&label=Release)](https://github.com/Nonsense0909688/Heavens/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)

[![GitHub Stars](https://img.shields.io/github/stars/Nonsense0909688/Heavens?style=flat-square&label=Stars)](https://github.com/Nonsense0909688/Heavens/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Nonsense0909688/Heavens?style=flat-square&label=Forks)](https://github.com/Nonsense0909688/Heavens/forks)
[![GitHub Issues](https://img.shields.io/github/issues/Nonsense0909688/Heavens?style=flat-square&label=Issues)](https://github.com/Nonsense0909688/Heavens/issues)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

</div>

```bash
heaven get https://api.github.com/users/Nonsense0909688
```

That's it. That's a request. The rest of this page shows you what else you can do.

---

## Table of Contents

- [Install](#install)
- [Your first five minutes](#your-first-five-minutes)
- [What's in the box](#whats-in-the-box)
- [Features](#features)
- [A few promises Heaven makes](#a-few-promises-heaven-makes)
- [Getting help](#getting-help)
- [Star History](#star-history)
- [Contributing](#contributing)
- [License](#license)

---

## Install

You need [Node.js](https://nodejs.org) version 20 or newer.

```bash
cd heaven
npm link
```

Now `heaven` (and the short alias `hv`) work anywhere on your machine.

> **On Windows and it says "command not found"?** That's a very common PATH quirk,
> and it's easy to fix. See [docs/windows-setup.md](docs/windows-setup.md).

Not ready to link it? You can always run it directly:

```bash
node bin/heaven.js get https://api.github.com/users/Nonsense0909688
```

---

## Your first five minutes

**1. Send something.**

```bash
heaven get https://api.github.com/users/Nonsense0909688
heaven post https://httpbin.org/post --json @body.json
```

**2. Tell Heaven where your API lives**, so you can stop typing the host:

```bash
heaven env set dev --base-url http://localhost:3000
heaven get /users            # → http://localhost:3000/users
```

**3. Save a request you'll use again:**

```bash
heaven save list-users get /users -q page=1
heaven run list-users
heaven run list-users -q page=2      # tweak it on the fly
```

**4. Make it check itself:**

```bash
heaven get /health --expect-status 200 --expect-time 300
```

If the check fails, Heaven exits with code `4`, which makes it perfect for CI.

**5. See what changed between environments:**

```bash
heaven env set prod --base-url https://api.example.com
heaven compare list-users --env dev --env prod --ignore updatedAt
```

---

## What's in the box

| You want to...                      | Use                                | Learn more                                                                                   |
| ----------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Send a request                      | `heaven get/post/put/patch/delete` | [Commands](docs/commands.md#sending-requests)                                                |
| Save and re-run requests            | `save`, `run`, `list`, `rm`        | [Commands](docs/commands.md#saved-requests)                                                  |
| Switch between dev / staging / prod | `env`                              | [Environments](docs/environments-and-variables.md)                                           |
| Keep secrets out of files           | `{{$env.NAME}}`                    | [Variables](docs/environments-and-variables.md#variables)                                    |
| Look back at what you sent          | `history`, `replay`                | [Commands](docs/commands.md#history-and-replay)                                              |
| Diff two environments               | `compare`                          | [Commands](docs/commands.md#compare)                                                         |
| Check responses automatically       | `--expect-*`                       | [Testing](docs/testing-and-workflows.md#expectations)                                        |
| Chain requests together             | `flow`                             | [Testing](docs/testing-and-workflows.md#workflows)                                           |
| Load-test an endpoint               | `bench`                            | [Testing](docs/testing-and-workflows.md#benchmarking)                                        |
| Share requests with your team       | `init`                             | [Environments](docs/environments-and-variables.md#project-local-data-sharing-with-your-team) |

The full guide lives in [DOCS.md](DOCS.md).

---

## Features

- **One-command HTTP** — `get`, `post`, `put`, `patch`, `delete` with headers,
  query params, JSON bodies, multipart, and file uploads.
- **Environments** — switch dev / staging / prod with `--env` and per-env variables.
- **Saved requests** — save, re-run, and tweak any call on the fly.
- **Secret-safe** — tokens are scrubbed before history is written and Heaven warns
  before saving them to disk.
- **Script-friendly** — stdout is pure response data; timing and warnings go to
  stderr, so `heaven get /users | jq .` just works.
- **Expectations** — assert on status, JSON paths, body, headers, and response time.
- **Workflows** — chain requests with `flow`, branching, and result passing.
- **Benchmarking** — load-test an endpoint with `bench` and compare runs.
- **Compare** — diff the same request across environments.
- **History & replay** — look back at what you sent and replay it verbatim.

---

## A few promises Heaven makes

- **Your secrets stay yours.** Tokens and passwords are scrubbed before anything is
  written to history, and Heaven warns you before saving one to a file.
  Details in [Security](DOCS.md#keeping-secrets-safe).
- **Output is script-friendly.** Response data goes to stdout; chatter (timings,
  warnings) goes to stderr. So `heaven get /users | jq .` just works.
- **Exit codes mean something.** `2` is "the server said no", `3` is "couldn't
  reach it", `4` is "your check failed". See [Exit codes](DOCS.md#exit-codes).
- **Big responses won't eat your memory.** Heaven keeps at most 10 MB in memory;
  use `-o file` to stream anything larger straight to disk.

---

## Getting help

```bash
heaven help             # the overview
heaven help flow        # help for one command
heaven get --help
```

Something broken or confusing? Set `HEAVEN_DEBUG=1` to see full error details, and
check [Troubleshooting](DOCS.md#troubleshooting).

Curious how the code is organised? See [docs/architecture.md](docs/architecture.md).

---

## Star History

If Heaven saves you time, please give it a star ⭐ — it helps others find the project.

[![Star History Chart](https://api.star-history.com/svg?repos=Nonsense0909688/Heavens&type=Date)](https://star-history.com/#Nonsense0909688/Heavens&Date)

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

- Browse [open issues](https://github.com/Nonsense0909688/Heavens/issues) and
  [pull requests](https://github.com/Nonsense0909688/Heavens/pulls).
- Open an issue or PR from GitHub — please include steps to reproduce for bugs
  and a clear use case for features.

---

## License

[MIT](LICENSE) © 2026 Anish Nandi.

---

<div align="center">

**[Full documentation](DOCS.md)** ·
**[Issues](https://github.com/Nonsense0909688/Heavens/issues)** ·
**[Releases](https://github.com/Nonsense0909688/Heavens/releases)**

Made with ☁️ for terminal-first API work.

</div>
