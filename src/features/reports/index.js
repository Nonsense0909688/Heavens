import fs from 'node:fs';
const esc = value => String(value ?? '').replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));
export function toJUnit(report, name = 'Heaven') {
  const steps = report.steps ?? [];
  const failures = steps.filter(s => !s.ok);
  const cases = steps.map(s => `<testcase name="${esc(s.name ?? `step ${s.index ?? ''}`)}" time="${Math.max(0, Number(s.timeMs ?? 0))/1000}">${s.ok ? '' : `<failure message="${esc(s.error ?? 'Assertion failed')}">${esc(s.error ?? 'Assertion failed')}</failure>`}</testcase>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${esc(name)}" tests="${steps.length}" failures="${failures.length}">${cases}</testsuite>\n`;
}
export function writeJsonReport(file, report) { fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`); }
export function writeJUnitReport(file, report, name) { fs.writeFileSync(file, toJUnit(report, name)); }
export function toHtmlReport(report) {
  const rows = (report.steps ?? []).map(s => `<tr><td>${esc(s.name)}</td><td>${s.ok ? 'PASS' : 'FAIL'}</td><td>${esc(s.timeMs ?? '')}</td><td>${esc(s.error ?? '')}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Heaven report</title><style>body{font:16px system-ui;margin:2rem}table{border-collapse:collapse;width:100%}td,th{padding:.6rem;border:1px solid #ccc;text-align:left}</style></head><body><h1>Heaven report</h1><pre>${esc(JSON.stringify({ok:report.ok,requests:report.requests,failures:report.failures},null,2))}</pre><table><thead><tr><th>Step</th><th>Result</th><th>Time (ms)</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
