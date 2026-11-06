// Run a workflow: ordered steps that extract values from responses and feed them
// into later steps as {{variables}}. Stops at the first failing step unless
// continueOnError is set (on the step or on the whole flow).
import { HeavenError, NetworkError, EXIT } from '../../core/errors.js';
import { sendTemplate } from '../../request/send.js';
import { evaluate } from '../../assertions/evaluate.js';
import { stepTemplate } from './step-template.js';
import { extractValue } from './extract.js';

/**
 * Check one response: the step's `expect` block, plus a default "status is not an error"
 * check when the step didn't say what status it expects.
 */
function runChecks(template, res) {
  const checks = [...evaluate(template.expect, res).checks];
  let httpFailure = false;
  if (!template.expect || template.expect.status === undefined) {
    const ok = res.status < 400;
    checks.unshift({ ok, label: 'status is not an error', detail: ok ? undefined : `got ${res.status}` });
    httpFailure = !ok;
  }
  return { checks, httpFailure };
}

/** Run `extract` rules; successful values go into `vars`, missing ones become failed checks. */
function runExtracts(step, res, vars, result) {
  for (const [varName, spec] of Object.entries(step.extract || {})) {
    const v = extractValue(res, spec);
    if (v === undefined) {
      result.checks.push({ ok: false, label: `extract ${varName} from ${spec}`, detail: 'not found in response' });
      continue;
    }
    vars[varName] = typeof v === 'object' ? JSON.stringify(v) : v;
    result.extracted.push(varName);
  }
}

/** Execute one step and fill in its `result` record. */
async function runStep(step, index, ctx) {
  const { store, vars, envName, cliVars, record, assumeYes } = ctx;
  const name = step.name || step.use || `step ${index + 1}`;
  const template = stepTemplate(step, store, index);
  const result = { index: index + 1, name, method: template.method, url: template.url, ok: false, checks: [], extracted: [] };

  try {
    const { res } = await sendTemplate(store, template, {
      envName, extraVars: vars, cliVars, record, historyName: name, assumeYes,
    });
    Object.assign(result, { status: res.status, timeMs: Math.round(res.timeMs), size: res.size });

    const { checks, httpFailure } = runChecks(template, res);
    result.checks = checks;
    runExtracts(step, res, vars, result);

    result.ok = result.checks.every((c) => c.ok);
    if (!result.ok) {
      // Exit 2 only if the *sole* problem was an HTTP error status; otherwise it's an assertion failure (4).
      const onlyHttp = httpFailure && result.checks.filter((c) => !c.ok).length === 1;
      result.code = onlyHttp ? EXIT.HTTP : EXIT.ASSERT;
    }
  } catch (e) {
    // Network problems fail this step; config/usage problems abort the whole flow.
    if (!(e instanceof NetworkError)) throw e;
    result.error = e.message;
    result.code = e.exitCode;
  }
  return result;
}

export async function runFlow(def, { store, envName, cliVars, record = true, assumeYes = false, onStep }) {
  if (!def || !Array.isArray(def.steps) || def.steps.length === 0) {
    throw new HeavenError('Workflow file needs a non-empty "steps" array');
  }
  const ctx = { store, envName, cliVars, record, assumeYes, vars: { ...(def.vars || {}) } };
  const results = [];
  let exitCode = EXIT.OK;

  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i];
    const result = await runStep(step, i, ctx);
    results.push(result);
    if (onStep) onStep(result);

    if (!result.ok) {
      if (exitCode === EXIT.OK) exitCode = result.code;           // remember the first failure's code
      if (!step.continueOnError && !def.continueOnError) break;
    }
  }

  return {
    name: def.name,
    ok: exitCode === EXIT.OK,
    exitCode,
    steps: results,
    skipped: def.steps.length - results.length,
    variables: Object.keys(ctx.vars),
  };
}
