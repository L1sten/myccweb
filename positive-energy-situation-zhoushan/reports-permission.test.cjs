'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { create } = require('./weekly-report-store.js');

// A small view harness exercises permission changes without touching browser storage.
function harness() {
  let calls = 0, writes = 0, throws = false;
  const tasks = [];
  const form = {};
  const input = { value: '2026-10-21', focus() {} };
  const root = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '#weeklyQueryForm') return this.innerHTML.includes('id="weeklyQueryForm"') ? form : null;
      if (selector === '#weeklyStart') return input;
      if (selector === '#weeklyEnd') return { value: '2026-10-28', focus() {} };
      if (selector === '#weeklyQueryToggle') return { focus() {} };
      return null;
    },
    querySelectorAll() { return []; }
  };
  const window = {
    WeeklyReportDemo: { defaultRange: { start: '2026-10-21', end: '2026-10-28' } },
    WeeklyReportStore: { create },
    localStorage: { getItem() { return null; }, setItem() { writes++; } },
    WeeklyReportModel: { buildReport() { calls++; if (throws) throw new Error('fixture failure'); return { ok: false, error: 'fixture validation' }; } }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./reports.js'), 'utf8'), {
    window, document: {}, setTimeout: callback => tasks.push(callback), Intl
  });
  window.ReportView.render(root);
  return {
    root, form, view: window.ReportView,
    get calls() { return calls; }, get writes() { return writes; },
    failGeneration() { throws = true; },
    click(action) { root.onclick({ target: { closest: () => ({ dataset: { reportAction: action }, disabled: false }) } }); },
    submit() { form.onsubmit({ preventDefault() {} }); },
    async flush() { tasks.splice(0).forEach(callback => callback()); await Promise.resolve(); }
  };
}

test('opens weekly reports with a collapsed query and hides all query controls without weekly permission', () => {
  const h = harness();
  assert.match(h.root.innerHTML, /data-value="weekly" class="active"/);
  assert.match(h.root.innerHTML, /id="weeklyQueryToggle"/);
  assert.match(h.root.innerHTML, /aria-label="自定义时间生成周报" hidden/);
  h.view.setWeeklyPermission(false);
  assert.doesNotMatch(h.root.innerHTML, /id="weeklyQuery(?:Toggle|Form)"/);
  assert.match(h.root.innerHTML, /正能量热点周报/);
  h.click('toggle-custom');
  assert.doesNotMatch(h.root.innerHTML, /id="weeklyQueryForm"/);
  assert.equal(h.writes, 0);
});

test('a stale query form cannot generate after permission is removed', async () => {
  const h = harness();
  h.click('toggle-custom');
  const staleSubmit = h.form.onsubmit;
  h.view.setWeeklyPermission(false);
  staleSubmit({ preventDefault() {} });
  await h.flush();
  assert.equal(h.calls, 0);
  assert.equal(h.writes, 0);
});

test('revoking permission cancels pending generation even if permission is restored immediately', async () => {
  const h = harness();
  h.click('toggle-custom');
  h.submit();
  assert.match(h.root.innerHTML, /正在生成/);
  h.view.setWeeklyPermission(false);
  h.view.setWeeklyPermission(true);
  await h.flush();
  assert.equal(h.calls, 0);
  assert.match(h.root.innerHTML, /aria-label="自定义时间生成周报" hidden/);
  h.click('toggle-custom');
  h.submit();
  await h.flush();
  assert.equal(h.calls, 1);
});

test('generation failures restore editable controls and show retryable feedback', async () => {
  const h = harness();
  h.failGeneration();
  h.click('toggle-custom');
  h.submit();
  await h.flush();
  assert.match(h.root.innerHTML, /报告生成失败，请重试。/);
  assert.doesNotMatch(h.root.innerHTML, /正在生成/);
  assert.equal(h.writes, 0);
});
