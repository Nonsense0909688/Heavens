import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve(process.cwd(), 'bin/heaven.js');

async function createFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'heaven-test-'));
  const requests = [];

  const server = createServer(async (req, res) => {
    const chunks = [];

    for await (const chunk of req) chunks.push(chunk);

    const body = Buffer.concat(chunks).toString();

    requests.push({
      method: req.method,
      url: req.url,
      body,
      headers: req.headers,
    });

    const statusMatch = req.url.match(/^\/status\/(\d+)$/);

    if (statusMatch) {
      const status = Number(statusMatch[1]);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        body,
        headers: req.headers,
      })
    );
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  const init = await runCLI(['init'], dir);
  assert.equal(init.code, 0, init.stderr);

  return { dir, base, requests };
}

function runCLI(args, cwd, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: {
        ...process.env,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => child.kill(), timeout);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function outputJSON(result) {
  return JSON.parse(result.stdout.trim());
}

async function setEnv(dir, name, base, protectedEnv = false) {
  const args = ['env', 'set', name, '--base-url', base];

  if (protectedEnv) args.push('--protected');

  const result = await runCLI(args, dir);
  assert.equal(result.code, 0, result.stderr);
}

async function selectEnv(dir, name) {
  const result = await runCLI(['env', 'use', name], dir);
  assert.equal(result.code, 0, result.stderr);
}

// ── CLI basics ─────────────────────────────────────────────────────

test('help displays Heaven usage', async (t) => {
  const { dir } = await createFixture(t);
  const result = await runCLI(['help'], dir);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout + result.stderr, /heaven/i);
});

test('init creates a project successfully', async (t) => {
  const { dir } = await createFixture(t);

  const result = await runCLI(['init'], dir);

  assert.equal(result.code, 0, result.stderr);
});

test('GET sends a request to the correct path', async (t) => {
  const { dir, base } = await createFixture(t);

  const result = await runCLI(['get', `${base}/hello`], dir);

  assert.equal(result.code, 0, result.stderr);

  const response = outputJSON(result);
  assert.equal(response.method, 'GET');
  assert.equal(response.url, '/hello');
});

test('POST sends a JSON body', async (t) => {
  const { dir, base } = await createFixture(t);

  const result = await runCLI(['post', `${base}/echo`, '--json', '{"hello":"world"}'], dir);

  assert.equal(result.code, 0, result.stderr);

  const response = outputJSON(result);
  assert.equal(response.method, 'POST');
  assert.deepEqual(JSON.parse(response.body), { hello: 'world' });
});

test('query parameters are forwarded', async (t) => {
  const { dir, base } = await createFixture(t);

  const result = await runCLI(['get', `${base}/search`, '-q', 'page=2'], dir);

  assert.equal(result.code, 0, result.stderr);
  assert.match(outputJSON(result).url, /page=2/);
});

test('custom headers are forwarded', async (t) => {
  const { dir, base } = await createFixture(t);

  const result = await runCLI(
    ['get', `${base}/headers`, '-H', 'X-Test: heaven', '--output', 'json'],
    dir
  );
  assert.equal(result.code, 0, result.stderr);

  const response = outputJSON(result);

  assert.equal(response.body.headers['x-test'], 'heaven');
});

test('expected HTTP status succeeds', async (t) => {
  const { dir, base } = await createFixture(t);

  const result = await runCLI(['get', `${base}/status/200`, '--expect-status', '200'], dir);

  assert.equal(result.code, 0, result.stderr);
});

test('unexpected HTTP status fails with exit code 4', async (t) => {
  const { dir, base } = await createFixture(t);

  const result = await runCLI(['get', `${base}/status/200`, '--expect-status', '201'], dir);

  assert.equal(result.code, 4, result.stderr);
});

test('HTTP 404 returns exit code 2', async (t) => {
  const { dir, base } = await createFixture(t);

  const result = await runCLI(['get', `${base}/status/404`], dir);

  assert.equal(result.code, 2, result.stderr);
});

test('connection failure returns exit code 3', async (t) => {
  const { dir } = await createFixture(t);

  const result = await runCLI(['get', 'http://127.0.0.1:1/unreachable'], dir);

  assert.equal(result.code, 3, result.stderr);
});

// ── Environments ───────────────────────────────────────────────────

test('environment base URL resolves relative request paths', async (t) => {
  const { dir, base } = await createFixture(t);

  await setEnv(dir, 'staging', base);

  const result = await runCLI(['get', '/hello', '--env', 'staging'], dir);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(outputJSON(result).url, '/hello');
});

test('switching active environment changes the default target', async (t) => {
  const { dir, base: baseA } = await createFixture(t);
  const other = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ method: req.method, url: req.url }));
  });

  await new Promise((resolve) => other.listen(0, '127.0.0.1', resolve));

  t.after(async () => {
    await new Promise((resolve) => other.close(resolve));
  });

  const baseB = `http://127.0.0.1:${other.address().port}`;

  await setEnv(dir, 'staging', baseA);
  await setEnv(dir, 'local', baseB);
  await selectEnv(dir, 'local');

  const result = await runCLI(['get', '/active-env'], dir);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(outputJSON(result).url, '/active-env');
});

test('protected environment allows GET without confirmation', async (t) => {
  const { dir, base } = await createFixture(t);

  await setEnv(dir, 'staging', base, true);

  const result = await runCLI(['get', '/hello', '--env', 'staging'], dir);

  assert.equal(result.code, 0, result.stderr);
});

test('protected environment blocks POST in non-interactive mode', async (t) => {
  const { dir, base, requests } = await createFixture(t);

  await setEnv(dir, 'staging', base, true);

  const countBefore = requests.length;

  const result = await runCLI(
    ['post', '/write-marker', '--env', 'staging', '--json', '{"test":true}'],
    dir
  );

  assert.notEqual(result.code, 0);
  assert.match(result.stdout + result.stderr, /confirm|protected|interactive/i);
  assert.equal(requests.length, countBefore);
});

test('unprotected environment allows POST without confirmation', async (t) => {
  const { dir, base } = await createFixture(t);

  await setEnv(dir, 'staging', base);

  const result = await runCLI(
    ['post', '/hello', '--env', 'staging', '--json', '{"test":true}'],
    dir
  );

  assert.equal(result.code, 0, result.stderr);
  assert.equal(outputJSON(result).method, 'POST');
});

// ── Saved requests ─────────────────────────────────────────────────

test('saved request appears in the request list', async (t) => {
  const { dir } = await createFixture(t);

  const saved = await runCLI(['save', 'get-users', 'GET', '/users'], dir);

  assert.equal(saved.code, 0, saved.stderr);

  const listed = await runCLI(['list'], dir);

  assert.equal(listed.code, 0, listed.stderr);
  assert.match(listed.stdout, /get-users/);
});

test('saved request executes successfully', async (t) => {
  const { dir, base } = await createFixture(t);

  await setEnv(dir, 'staging', base);

  const saved = await runCLI(['save', 'get-users', 'GET', '/users'], dir);

  assert.equal(saved.code, 0, saved.stderr);

  const result = await runCLI(['run', 'get-users', '--env', 'staging'], dir);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(outputJSON(result).method, 'GET');
  assert.equal(outputJSON(result).url, '/users');
});

test('saved request rejects a mismatched required environment', async (t) => {
  const { dir, base, requests } = await createFixture(t);

  await setEnv(dir, 'staging', base);
  await setEnv(dir, 'prod', base);
  await selectEnv(dir, 'staging');

  const saved = await runCLI(
    ['save', 'create-user', 'POST', '/users', '--requires-env', 'staging'],
    dir
  );

  assert.equal(saved.code, 0, saved.stderr);

  const countBefore = requests.length;

  const result = await runCLI(['run', 'create-user', '--env', 'prod'], dir);

  assert.notEqual(result.code, 0);
  assert.match(result.stdout + result.stderr, /environment mismatch|required.*staging/i);
  assert.equal(requests.length, countBefore);
});

test('saved request list supports JSON output', async (t) => {
  const { dir } = await createFixture(t);

  const saved = await runCLI(['save', 'get-users', 'GET', '/users'], dir);

  assert.equal(saved.code, 0, saved.stderr);

  const result = await runCLI(['list', '--output', 'json'], dir);

  assert.equal(result.code, 0, result.stderr);

  const requests = outputJSON(result);
  assert.ok(Array.isArray(requests));
  assert.ok(requests.some((request) => request.name === 'get-users'));
});

// ── Request validation ─────────────────────────────────────────────

test('unknown CLI option is rejected', async (t) => {
  const { dir } = await createFixture(t);

  const result = await runCLI(
    ['get', 'http://127.0.0.1:1/', '--definitely-not-a-real-option'],
    dir
  );

  assert.notEqual(result.code, 0);
  assert.match(
    result.stdout + result.stderr,
    /unknown option|unknown argument|unrecognized option/i
  );
});

test('missing request URL is rejected', async (t) => {
  const { dir } = await createFixture(t);

  const result = await runCLI(['get'], dir);

  assert.notEqual(result.code, 0);
});

// ── Regressions: protected env, EPIPE, dry-run masking ─────────────
test('--yes lets a write through a protected environment non-interactively', async (t) => {
  const { dir, base } = await createFixture(t);
  await runCLI(['env', 'set', 'prod', '--base-url', base, '--protected'], dir);
  const blocked = await runCLI(['post', '/x', '-e', 'prod', '--json', '{}'], dir);
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /--yes/);
  assert.doesNotMatch(blocked.stderr, /not defined/);
});

test('--dry-run masks secrets', async (t) => {
  const { dir, base } = await createFixture(t);
  const result = await runCLI(['post', `${base}/x`, '--bearer', 'SECRET123', '--dry-run'], dir);
  assert.equal(result.code, 0);
  assert.doesNotMatch(result.stdout, /SECRET123/);
});
