'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildReport } = require('./weekly-report-model.js');
const { create, STORAGE_KEY } = require('./weekly-report-store.js');

function memoryStorage(initial = null) {
  let value = initial;
  return {
    writes: 0,
    getItem(key) { assert.equal(key, STORAGE_KEY); return value; },
    setItem(key, next) { assert.equal(key, STORAGE_KEY); value = String(next); this.writes++; },
    raw() { return value; }
  };
}

function report(overrides = {}) {
  const at = '2026-10-07T16:30:00+08:00';
  const result = buildReport({ start: '2026-10-07', end: '2026-10-08' }, {
    region: '舟山', coverage: { start: '2026-10-07T16:30', end: '2026-10-08T16:30' },
    information: [{ id: 'i1', at, sentiment: 'positive' }],
    events: [{ id: 'e1', at, title: '测试事件', region: '舟山', host: '测试账号', views: 0 }],
    submissions: [{ id: 's1', at, account: '测试账号', topicRelated: true }],
    activities: [{ id: 'a1', at, accountId: 'u1', name: '测试账号', region: '舟山' }]
  });
  return { ...result, id: 'custom-' + randomUUID(), generatedAt: '2026-10-29 10:00:00', savedAt: '2026-10-29 10:01:00', ...overrides };
}

test('uses the fixed key and retains a saved report when a fresh store instance reads it', () => {
  assert.equal(STORAGE_KEY, 'positive-energy-situation.custom-weekly-reports.v1');
  const storage = memoryStorage();
  assert.deepEqual(create(storage).list(), { ok: true, reports: [] });
  assert.equal(storage.writes, 0);
  const input = report();
  assert.deepEqual(create(storage).save(input), { ok: true, report: input, duplicate: false });
  assert.deepEqual(create(storage).list(), { ok: true, reports: [input] });
  assert.equal(storage.writes, 1);
});

test('duplicate generated id keeps its original snapshot and savedAt without another write', () => {
  const storage = memoryStorage();
  const store = create(storage);
  const first = report();
  store.save(first);
  const changed = { ...first, region: '其他地区', savedAt: '2026-10-29 11:00:00' };
  assert.deepEqual(store.save(changed), { ok: true, report: first, duplicate: true });
  assert.equal(storage.writes, 1);
  assert.deepEqual(store.list().reports, [first]);
});

test('different generated ids with the same dates remain independent and sort by savedAt', () => {
  const storage = memoryStorage();
  const store = create(storage);
  const older = report();
  const newer = report({ savedAt: '2026-10-29 11:00:00' });
  store.save(older);
  store.save(newer);
  assert.equal(older.start, newer.start);
  assert.equal(older.end, newer.end);
  assert.deepEqual(store.list().reports.map(row => row.id), [newer.id, older.id]);
  assert.equal(storage.writes, 2);
});

test('same-second saves retain insertion order and saves reread shared storage', () => {
  const storage = memoryStorage();
  const firstStore = create(storage);
  const secondStore = create(storage);
  const first = report();
  const second = report();
  const third = report({ savedAt: '2026-10-30 09:00:00' });
  firstStore.save(first);
  secondStore.save(second);
  firstStore.save(third);
  assert.deepEqual(secondStore.list().reports.map(row => row.id), [third.id, first.id, second.id]);
});

test('input, save return, list return, and duplicate return are independent snapshots', () => {
  const storage = memoryStorage();
  const store = create(storage);
  const input = report();
  const expected = structuredClone(input);
  const saved = store.save(input);
  input.stats.totalViews = 999;
  input.events[0].title = '输入已修改';
  input.accounts[0].names.push('新增');
  saved.report.submissions[0].count = 999;
  const listed = store.list();
  listed.reports[0].accounts[0].names[0] = '读取结果已修改';
  listed.reports.push(report());
  const duplicate = store.save(expected);
  duplicate.report.events[0].title = '重复返回已修改';
  assert.deepEqual(create(storage).list().reports, [expected]);
});

test('empty reports, zero values, and missing sentiment or views remain valid', () => {
  const empty = buildReport({ start: '2026-10-07', end: '2026-10-08' }, { region: '舟山' });
  const store = create(memoryStorage());
  const emptySnapshot = report(empty);
  assert.equal(store.save(emptySnapshot).ok, true);
  assert.equal(emptySnapshot.stats.positivePercent, null);
  assert.equal(emptySnapshot.stats.totalViews, 0);
  assert.deepEqual(emptySnapshot.events, []);
  const missing = report();
  missing.stats.positivePercent = null;
  missing.stats.totalViews = null;
  missing.stats.overFiveMillionCount = null;
  missing.stats.missingViewsCount = 1;
  missing.events[0].views = null;
  const saved = store.save(missing);
  assert.equal(saved.ok, true);
  assert.equal(saved.report.events[0].views, null);
  assert.equal(saved.report.stats.totalViews, null);
  assert.equal(saved.report.stats.knownTotalViews, 0);
  assert.equal(store.list().reports.length, 2);
});

test('invalid input cannot write or replace a valid saved snapshot', () => {
  const storage = memoryStorage();
  const store = create(storage);
  store.save(report());
  const original = storage.raw();
  const invalidReports = [
    null, {}, report({ ok: false }), report({ id: 'custom-not-a-uuid' }), report({ id: 'custom-' + randomUUID() + '\n' }),
    report({ generatedAt: '2026-02-30 10:00:00' }), report({ generatedAt: '2026-10-29 24:00:00' }),
    report({ generatedAt: '2026-10-29 10:00' }), report({ savedAt: '2026-10-29T10:01:00+08:00' }),
    report({ start: '2026-02-30T16:00', calculationStart: '2026-02-30T16:30' }),
    report({ start: '2026-10-07T16:30' }), report({ start: '2026-10-08T16:00', calculationStart: '2026-10-08T16:30' }),
    report({ calculationStart: '2026-10-07T16:00' }), report({ calculationEnd: '2026-10-09T16:30' }),
    report({ region: null }), report({ stats: null }), report({ events: null }), report({ submissions: {} }),
    report({ accounts: 'bad' }), report({ coverageStatus: 'unknown' })
  ];
  const invalidStats = ['informationCount', 'eventCount', 'knownOverFiveMillionCount', 'missingViewsCount', 'submissionCount', 'contributorCount', 'activeAccounts'];
  for (const field of invalidStats) {
    const invalid = report();
    invalid.stats[field] = null;
    invalidReports.push(invalid);
  }
  for (const value of [NaN, Infinity, -1, '0']) {
    const invalid = report();
    invalid.stats.totalViews = value;
    invalidReports.push(invalid);
  }
  for (const invalid of invalidReports) {
    const result = store.save(invalid);
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, 'string');
    assert.equal(storage.raw(), original);
    assert.equal(storage.writes, 1);
  }
});

test('nested table validation prevents invalid timestamps or non-array names reaching the renderer', () => {
  const mutations = [
    r => { r.events = [null]; },
    r => { r.events[0].at = '2026-10-07T16:30'; },
    r => { r.events[0].at = '2026-02-30T16:30:00+08:00'; },
    r => { r.events[0].at = '2026-10-07T16:30:00+24:00'; },
    r => { r.events[0].views = undefined; },
    r => { r.events[0].views = NaN; },
    r => { r.events[0].title = {}; },
    r => { r.submissions = [null]; },
    r => { r.submissions[0].account = {}; },
    r => { r.submissions[0].topicCount = -1; },
    r => { r.accounts = [null]; },
    r => { r.accounts[0].names = '账号'; },
    r => { r.accounts[0].names = [null]; }
  ];
  for (const mutate of mutations) {
    const storage = memoryStorage();
    const invalid = report();
    mutate(invalid);
    assert.equal(create(storage).save(invalid).ok, false);
    assert.equal(storage.writes, 0);
    const corrupt = JSON.stringify({ version: 1, reports: [invalid] });
    // JSON turns NaN into an allowed null; that case is rejected before serialization above.
    if (Number.isNaN(invalid.events?.[0]?.views)) continue;
    const stored = memoryStorage(corrupt);
    assert.equal(create(stored).list().ok, false);
    assert.equal(create(stored).save(report()).ok, false);
    assert.equal(stored.raw(), corrupt);
    assert.equal(stored.writes, 0);
  }
});

test('malformed, unknown-version, and duplicate-id stored data are preserved without writes', () => {
  const valid = report();
  const corruptValues = ['', '{broken', 'null', '[]', '{}', JSON.stringify({ version: 2, reports: [valid] }),
    JSON.stringify({ version: 1, reports: {} }), JSON.stringify({ version: 1, reports: [valid, null] }),
    JSON.stringify({ version: 1, reports: [valid, valid] })];
  for (const corrupt of corruptValues) {
    const storage = memoryStorage(corrupt);
    const store = create(storage);
    assert.equal(store.list().ok, false, corrupt);
    assert.equal(store.save(report()).ok, false, corrupt);
    assert.equal(storage.raw(), corrupt);
    assert.equal(storage.writes, 0);
  }
});

test('read failures do not attempt a write, and write failures never report success', () => {
  let writes = 0;
  const unreadable = create({ getItem() { throw new Error('SecurityError'); }, setItem() { writes++; } });
  assert.equal(unreadable.list().ok, false);
  assert.equal(unreadable.save(report()).ok, false);
  assert.equal(writes, 0);
  assert.equal(create(null).list().ok, false);
  assert.equal(create(undefined).save(report()).ok, false);
  const existing = report();
  const original = JSON.stringify({ version: 1, reports: [existing] });
  const full = create({ getItem() { return original; }, setItem() { throw new Error('QuotaExceededError'); } });
  const result = full.save(report());
  assert.equal(result.ok, false);
  assert.match(result.error, /保存失败/);
  assert.deepEqual(full.list().reports, [existing]);
  assert.equal(full.save(existing).duplicate, true);
});

test('circular or throwing inputs fail safely before writing', () => {
  const storage = memoryStorage();
  const circular = report();
  circular.extra = circular;
  assert.equal(create(storage).save(circular).ok, false);
  const throwing = report();
  Object.defineProperty(throwing, 'stats', { get() { throw new Error('bad getter'); } });
  assert.equal(create(storage).save(throwing).ok, false);
  assert.equal(storage.writes, 0);
});

test('removes exactly one id among reports for the same dates and persists the remaining snapshots', () => {
  const storage = memoryStorage();
  const store = create(storage);
  const older = report();
  const target = report();
  const newer = report({ savedAt: '2026-10-30 10:01:00' });
  for (const snapshot of [older, target, newer]) store.save(snapshot);
  assert.equal(older.start, target.start);
  assert.equal(target.start, newer.start);
  const result = store.remove(target.id);
  assert.deepEqual(result, { ok: true, deleted: true, reports: [newer, older] });
  assert.equal(storage.writes, 4);
  assert.deepEqual(create(storage).list().reports, [newer, older]);
  assert.deepEqual(JSON.parse(storage.raw()).reports, [newer, older]);
  result.reports[0].events[0].title = '删除返回值修改';
  result.reports[1].accounts[0].names.push('外部修改');
  assert.deepEqual(create(storage).list().reports, [newer, older]);
});

test('removal preserves stored order even for a valid snapshot envelope with unsorted reports', () => {
  const older = report();
  const target = report();
  const newer = report({ savedAt: '2026-10-30 10:01:00' });
  const storage = memoryStorage(JSON.stringify({ version: 1, reports: [older, target, newer] }));
  const result = create(storage).remove(target.id);
  assert.deepEqual(JSON.parse(storage.raw()).reports, [older, newer]);
  assert.deepEqual(result.reports, [newer, older]);
  assert.deepEqual(create(storage).list().reports, result.reports);
});

test('removing the final report persists an empty collection and repeated removal does not write', () => {
  const storage = memoryStorage();
  const store = create(storage);
  const only = report();
  store.save(only);
  assert.deepEqual(store.remove(only.id), { ok: true, deleted: true, reports: [] });
  assert.deepEqual(create(storage).list(), { ok: true, reports: [] });
  assert.deepEqual(JSON.parse(storage.raw()), { version: 1, reports: [] });
  const original = storage.raw();
  assert.deepEqual(create(storage).remove(only.id), { ok: true, deleted: false, reports: [] });
  assert.equal(storage.writes, 2);
  assert.equal(storage.raw(), original);
  const emptyStorage = memoryStorage();
  assert.deepEqual(create(emptyStorage).remove(only.id), { ok: true, deleted: false, reports: [] });
  assert.equal(emptyStorage.raw(), null);
  assert.equal(emptyStorage.writes, 0);
});

test('a missing id does not rewrite storage, and removal rereads reports saved through another instance', () => {
  const storage = memoryStorage();
  const firstStore = create(storage);
  const secondStore = create(storage);
  const first = report();
  const second = report();
  firstStore.save(first);
  secondStore.save(second);
  const original = storage.raw();
  assert.deepEqual(firstStore.remove(report().id), { ok: true, deleted: false, reports: [first, second] });
  assert.equal(storage.raw(), original);
  assert.equal(storage.writes, 2);
  assert.deepEqual(firstStore.remove(first.id), { ok: true, deleted: true, reports: [second] });
  assert.deepEqual(secondStore.list().reports, [second]);
});

test('refuses automatic report ids and malformed custom ids before reading or writing', () => {
  let reads = 0;
  let writes = 0;
  const store = create({ getItem() { reads++; return null; }, setItem() { writes++; } });
  for (const id of [undefined, null, '', 1, {}, 'w0', 'd0', 'm123', randomUUID(), 'custom-not-a-uuid', 'custom-' + randomUUID() + '\n']) {
    const result = store.remove(id);
    assert.equal(result.ok, false);
    assert.match(result.error, /自定义周报/);
  }
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test('failed deletion preserves storage for read errors, corrupt data, and write failures', () => {
  const target = report();
  const remaining = report();
  let attemptedWrites = 0;
  const unreadable = create({ getItem() { throw new Error('SecurityError'); }, setItem() { attemptedWrites++; } });
  assert.equal(unreadable.remove(target.id).ok, false);
  assert.equal(attemptedWrites, 0);
  assert.equal(create(null).remove(target.id).ok, false);
  const corruptValues = ['{broken', JSON.stringify({ version: 2, reports: [target] }),
    JSON.stringify({ version: 1, reports: [target, null] }), JSON.stringify({ version: 1, reports: [target, target] })];
  for (const corrupt of corruptValues) {
    const storage = memoryStorage(corrupt);
    assert.equal(create(storage).remove(target.id).ok, false);
    assert.equal(storage.raw(), corrupt);
    assert.equal(storage.writes, 0);
  }
  const storage = memoryStorage(JSON.stringify({ version: 1, reports: [target, remaining] }));
  const original = storage.raw();
  storage.setItem = function () { attemptedWrites++; throw new Error('QuotaExceededError'); };
  const result = create(storage).remove(target.id);
  assert.equal(result.ok, false);
  assert.match(result.error, /删除失败/);
  assert.equal(attemptedWrites, 1);
  assert.equal(storage.raw(), original);
  assert.deepEqual(create(storage).list().reports, [target, remaining]);
});

test('exposes the browser UMD API and uses injected storage without a global localStorage', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./weekly-report-store.js'), 'utf8'), context);
  assert.equal(context.WeeklyReportStore.STORAGE_KEY, STORAGE_KEY);
  assert.equal(typeof context.WeeklyReportStore.create, 'function');
  const storage = memoryStorage();
  const snapshot = report();
  assert.equal(context.WeeklyReportStore.create(storage).save(snapshot).ok, true);
  assert.equal(context.WeeklyReportStore.create(storage).list().reports.length, 1);
  assert.equal(context.WeeklyReportStore.create(storage).remove(snapshot.id).deleted, true);
  assert.equal(context.WeeklyReportStore.create(storage).list().reports.length, 0);
});
