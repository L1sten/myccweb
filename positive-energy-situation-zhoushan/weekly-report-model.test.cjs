'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { buildReport } = require('./weekly-report-model.js');

const interval = { start: '2026-10-07', end: '2026-10-08' };
const coverage = { start: '2026-10-07T16:30', end: '2026-10-08T16:30' };
const at = '2026-10-07T16:30:00+08:00';
function dataset(overrides = {}) {
  return { region: '舟山', coverage, information: [], events: [], submissions: [], activities: [], ...overrides };
}

function allTablesAt(times) {
  return dataset({
    information: times.map((time, i) => ({ id: `i${i}`, at: time, sentiment: 'positive' })),
    events: times.map((time, i) => ({ id: `e${i}`, at: time, title: `事件${i}`, views: 1 })),
    submissions: times.map((time, i) => ({ id: `s${i}`, at: time, account: `账号${i}`, topicRelated: true })),
    activities: times.map((time, i) => ({ id: `a${i}`, at: time, accountId: `u${i}`, name: `账号${i}`, region: '舟山' }))
  });
}

test('uses Beijing [start, end) boundaries across calendar days and timezone offsets', () => {
  const report = buildReport(interval, dataset({ information: [
    { id: 'before', at: '2026-10-07T08:29:59.999Z', sentiment: 'positive' },
    { id: 'start', at: '2026-10-07T08:30:00Z', sentiment: 'positive' },
    { id: 'overnight', at: '2026-10-08T00:00:00+08:00', sentiment: 'neutral' },
    { id: 'minus-offset', at: '2026-10-07T04:30:00-04:00', sentiment: 'positive' },
    { id: 'last', at: '2026-10-08T16:29:59.999+0800', sentiment: 'negative' },
    { id: 'end', at: '2026-10-08T16:30:00+08:00', sentiment: 'positive' }
  ] }));
  assert.equal(report.ok, true);
  assert.equal(report.stats.informationCount, 4);
  assert.equal(report.stats.positivePercent, 50);
  assert.equal(report.start, '2026-10-07T16:00');
  assert.equal(report.end, '2026-10-08T16:00');
  assert.equal(report.calculationStart, '2026-10-07T16:30');
  assert.equal(report.calculationEnd, '2026-10-08T16:30');
  assert.equal(report.region, '舟山');
});

test('rejects empty, incomplete, impossible, equal, and reversed form dates without throwing', () => {
  for (const invalid of [null, undefined, {}, { start: '', end: '' },
    { ...interval, start: '2026-02-29' },
    { ...interval, start: '2026-04-31' },
    { ...interval, start: '2026-13-01' },
    { ...interval, start: '2026-00-07' },
    { ...interval, start: '2026-10-00' },
    { ...interval, start: '0000-10-07' },
    { ...interval, start: '2026-10-07T24:00' },
    { ...interval, start: '2026-10-07T16:60' },
    { ...interval, start: '2026-10-07T16:00' },
    { ...interval, start: '2026-10-07T16:30' },
    { ...interval, start: '2026-10-07 16:00' },
    { ...interval, start: '2026-10-07T16:00Z' },
    { ...interval, start: '2026-10-7' },
    { ...interval, start: '2026-10' },
    { ...interval, start: ' 2026-10-07' },
    { ...interval, start: '2026-10-07\n' },
    { ...interval, start: new Date() },
    { ...interval, end: '2026-10-08T16:30' },
    { start: interval.start, end: interval.start },
    { start: interval.end, end: interval.start }]) {
    const result = buildReport(invalid, dataset());
    assert.equal(result.ok, false, JSON.stringify(invalid));
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error.length > 0);
  }
  assert.equal(buildReport({ start: '2024-02-29', end: '2024-03-01' }, dataset()).ok, true);
  assert.equal(buildReport({ start: '2000-02-29', end: '2000-03-01' }, dataset()).ok, true);
  assert.equal(buildReport({ start: '1900-02-29', end: '1900-03-01' }, dataset()).ok, false);
  assert.equal(buildReport({}, dataset()).error, '请选择完整、有效的开始日期和结束日期。');
  assert.equal(buildReport({ start: interval.end, end: interval.start }, dataset()).error, '开始日期必须早于结束日期。');
});

test('requires valid explicit timezone timestamps on source records', () => {
  const badTimes = ['2026-10-07T16:00', '2026-10-07', '2026-02-30T16:00:00+08:00',
    '2026-10-07T24:00:00+08:00', '2026-10-07T16:00:60+08:00',
    '2026-10-07T16:00:00+24:00', '2026-10-07T16:00:00+08:60', null, undefined, 'garbage'];
  const rows = badTimes.map((value, i) => ({ id: String(i), at: value, sentiment: 'positive' }));
  rows.push({ id: 'valid', at, sentiment: 'positive' });
  const report = buildReport(interval, dataset({ information: rows }));
  assert.equal(report.stats.informationCount, 1);
  assert.equal(report.stats.positivePercent, 100);
});

test('all four tables, displayed times, and coverage are independent of the computer timezone', () => {
  const source = allTablesAt([
    '2026-10-07T08:29:59.999Z',
    '2026-10-07T08:30:00Z',
    '2026-10-08T04:29:59.999-04:00',
    '2026-10-08T16:30:00+08:00'
  ]);
  const script = `const {buildReport}=require(${JSON.stringify(require.resolve('./weekly-report-model.js'))});
    process.stdout.write(JSON.stringify(buildReport(${JSON.stringify(interval)}, ${JSON.stringify(source)})));`;
  const results = ['UTC', 'Asia/Shanghai', 'America/New_York', 'Pacific/Honolulu'].map(TZ =>
    execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' }));
  results.forEach(value => assert.equal(value, results[0]));
  const result = JSON.parse(results[0]);
  for (const field of ['informationCount', 'eventCount', 'submissionCount', 'activeAccounts']) assert.equal(result.stats[field], 2);
  assert.deepEqual(result.events.map(row => row.id), ['e2', 'e1']);
  assert.equal(result.coverageStatus, 'complete');
  assert.equal(result.start, '2026-10-07T16:00');
  assert.equal(result.calculationStart, '2026-10-07T16:30');
});

test('each table uses 16:30 boundaries, excluding the first date 16:00–16:29 and including the last date 16:00–16:29', () => {
  const cases = [
    ['2026-10-07T16:00:00+08:00', 0],
    ['2026-10-07T16:29:59.999+08:00', 0],
    ['2026-10-07T16:30:00+08:00', 1],
    ['2026-10-08T16:00:00+08:00', 1],
    ['2026-10-08T16:29:59.999+08:00', 1],
    ['2026-10-08T16:30:00+08:00', 0]
  ];
  for (const [time, expectedCount] of cases) {
    const report = buildReport(interval, allTablesAt([time]));
    for (const field of ['informationCount', 'eventCount', 'submissionCount', 'contributorCount', 'activeAccounts', 'totalViews']) {
      assert.equal(report.stats[field], expectedCount, `${field} at ${time}`);
    }
    assert.deepEqual(report.events.map(row => row.id), expectedCount ? ['e0'] : [], time);
    assert.deepEqual(report.submissions.map(row => row.account), expectedCount ? ['账号0'] : [], time);
    assert.deepEqual(report.accounts.flatMap(row => row.names), expectedCount ? ['账号0'] : [], time);
  }
});

test('adjacent periods partition all four tables without gaps or double counts at 16:30', () => {
  const source = allTablesAt([
    '2026-10-07T16:30:00+08:00',
    '2026-10-08T16:00:00+08:00',
    '2026-10-08T16:29:59.999+08:00',
    '2026-10-08T16:30:00+08:00',
    '2026-10-09T16:00:00+08:00',
    '2026-10-09T16:29:59.999+08:00',
    '2026-10-09T16:30:00+08:00'
  ]);
  source.coverage = { start: coverage.start, end: '2026-10-09T16:30' };
  const first = buildReport(interval, source);
  const second = buildReport({ start: '2026-10-08', end: '2026-10-09' }, source);
  const combined = buildReport({ start: '2026-10-07', end: '2026-10-09' }, source);
  for (const field of ['informationCount', 'eventCount', 'submissionCount', 'contributorCount', 'activeAccounts', 'totalViews']) {
    assert.equal(first.stats[field], 3, `first ${field}`);
    assert.equal(second.stats[field], 3, `second ${field}`);
    assert.equal(first.stats[field] + second.stats[field], combined.stats[field], `combined ${field}`);
  }
  assert.deepEqual(first.events.map(row => row.id).sort(), ['e0', 'e1', 'e2']);
  assert.deepEqual(second.events.map(row => row.id).sort(), ['e3', 'e4', 'e5']);
  for (const values of [
    report => report.events.map(row => row.id),
    report => report.submissions.map(row => row.account),
    report => report.accounts.flatMap(row => row.names)
  ]) {
    const firstValues = values(first);
    const secondValues = values(second);
    assert.deepEqual(firstValues.filter(value => secondValues.includes(value)), []);
    assert.deepEqual([...firstValues, ...secondValues].sort(), values(combined).sort());
  }
  assert.equal(first.calculationEnd, second.calculationStart);
  assert.equal(first.end, second.start);
  for (const report of [first, second, combined]) assert.equal(report.coverageStatus, 'complete');
});

test('deduplicates each table by id before interval filtering and preserves distinct equal titles', () => {
  const outside = '2026-10-06T16:00:00+08:00';
  const report = buildReport(interval, dataset({
    information: [{ id: 'same', at: outside, sentiment: 'positive' }, { id: 'same', at, sentiment: 'positive' },
      { id: 'kept', at, sentiment: 'negative' }, { id: 'kept', at, sentiment: 'positive' }],
    events: [{ id: 'e1', at, title: '同一标题', views: 0 }, { id: 'e1', at, title: '替换标题', views: 10 },
      { id: 'e2', at, title: '同一标题', views: 0 }],
    submissions: [{ id: 's1', at, account: '甲', topicRelated: true }, { id: 's1', at, account: '乙', topicRelated: false }],
    activities: [{ id: 'a1', at, accountId: 'u1', name: '甲', region: '舟山' },
      { id: 'a1', at, accountId: 'u2', name: '乙', region: '舟山' }]
  }));
  assert.equal(report.stats.informationCount, 1);
  assert.equal(report.stats.positivePercent, 0);
  assert.equal(report.stats.eventCount, 2);
  assert.equal(report.stats.totalViews, 0);
  assert.equal(report.stats.submissionCount, 1);
  assert.equal(report.stats.contributorCount, 1);
  assert.equal(report.stats.activeAccounts, 1);
  assert.equal(report.events[0].title, '同一标题');
});

test('calculates strict > 5 million, totals, and deterministic event order', () => {
  const report = buildReport(interval, dataset({ events: [
    { id: 'zero', at, views: 0 },
    { id: 'equal-threshold', at, views: 5000000 },
    { id: 'b', at, views: 5000001 },
    { id: 'a', at, views: 5000001 },
    { id: 'newer', at: '2026-10-08T00:00:00+08:00', views: 5000001 }
  ] }));
  assert.equal(report.stats.eventCount, 5);
  assert.equal(report.stats.overFiveMillionCount, 3);
  assert.equal(report.stats.knownOverFiveMillionCount, 3);
  assert.equal(report.stats.totalViews, 20000003);
  assert.equal(report.stats.knownTotalViews, 20000003);
  assert.equal(report.stats.missingViewsCount, 0);
  assert.deepEqual(report.events.map(row => row.id), ['newer', 'a', 'b', 'equal-threshold', 'zero']);
});

test('invalid or missing views remain unknown, while genuine zero remains valid', () => {
  const invalidViews = [null, undefined, -1, NaN, Infinity, '5000001', false];
  const rows = invalidViews.map((views, i) => ({ id: `missing-${i}`, at, views }));
  rows.push({ id: 'zero', at, views: 0 }, { id: 'known', at, views: 6000000 });
  const report = buildReport(interval, dataset({ events: rows }));
  assert.equal(report.stats.eventCount, 9);
  assert.equal(report.stats.overFiveMillionCount, null);
  assert.equal(report.stats.knownOverFiveMillionCount, 1);
  assert.equal(report.stats.totalViews, null);
  assert.equal(report.stats.knownTotalViews, 6000000);
  assert.equal(report.stats.missingViewsCount, 7);
  assert.deepEqual(report.events.slice(0, 2).map(row => row.id), ['known', 'zero']);
  assert.equal(report.events[1].views, 0);
  report.events.slice(2).forEach(row => assert.equal(row.views, null));
});

test('missing or invalid sentiment makes the proportion unknown; empty and all-negative differ', () => {
  assert.equal(buildReport(interval, dataset()).stats.positivePercent, null);
  for (const sentiment of [null, undefined, 'other']) {
    const report = buildReport(interval, dataset({ information: [
      { id: 'p', at, sentiment: 'positive' }, { id: 'm', at, sentiment }
    ] }));
    assert.equal(report.stats.informationCount, 2);
    assert.equal(report.stats.positivePercent, null);
  }
  assert.equal(buildReport(interval, dataset({ information: [{ id: 'n', at, sentiment: 'negative' }] })).stats.positivePercent, 0);
});

test('aggregates submission counts, topic counts, and distinct contributing accounts', () => {
  const report = buildReport(interval, dataset({ submissions: [
    { id: '1', at, account: '甲', topicRelated: true },
    { id: '2', at, account: '甲', topicRelated: false },
    { id: '3', at, account: '乙', topicRelated: true },
    { id: '4', at: '2026-10-08T16:30:00+08:00', account: '丙', topicRelated: true }
  ] }));
  assert.equal(report.stats.submissionCount, 3);
  assert.equal(report.stats.contributorCount, 2);
  assert.deepEqual(report.submissions, [{ account: '甲', count: 2, topicCount: 1 }, { account: '乙', count: 1, topicCount: 1 }]);
});

test('counts active account ids, retaining separate ids with equal names and latest region', () => {
  const report = buildReport(interval, dataset({ activities: [
    { id: '1', at, accountId: 'u1', name: '同名', region: '旧地区' },
    { id: '2', at: '2026-10-08T00:00:00+08:00', accountId: 'u1', name: '同名', region: '舟山' },
    { id: '3', at, accountId: 'u2', name: '同名', region: '舟山' },
    { id: '4', at, accountId: 'u3', name: '账号三', region: '岱山' },
    { id: '5', at: '2026-10-08T16:30:00+08:00', accountId: 'u4', name: '区间外', region: '舟山' }
  ] }));
  assert.equal(report.stats.activeAccounts, 3);
  assert.deepEqual(report.accounts, [
    { region: '岱山', count: 1, names: ['账号三'] },
    { region: '舟山', count: 2, names: ['同名', '同名'] }
  ]);
});

test('different intervals select different actual records in every table', () => {
  const nextAt = '2026-10-08T16:30:00+08:00';
  const source = dataset({
    coverage: { start: coverage.start, end: '2026-10-09T16:30' },
    information: [{ id: 'i1', at, sentiment: 'positive' }, { id: 'i2', at: nextAt, sentiment: 'negative' }],
    events: [{ id: 'e1', at, views: 1 }, { id: 'e2', at: nextAt, views: 2 }],
    submissions: [{ id: 's1', at, account: '甲', topicRelated: true }, { id: 's2', at: nextAt, account: '乙', topicRelated: false }],
    activities: [{ id: 'a1', at, accountId: 'u1', name: '甲', region: '舟山' },
      { id: 'a2', at: nextAt, accountId: 'u2', name: '乙', region: '岱山' }]
  });
  const first = buildReport(interval, source);
  const second = buildReport({ start: interval.end, end: '2026-10-09' }, source);
  assert.equal(first.stats.positivePercent, 100);
  assert.equal(second.stats.positivePercent, 0);
  assert.equal(first.stats.totalViews, 1);
  assert.equal(second.stats.totalViews, 2);
  assert.deepEqual(first.events.map(row => row.id), ['e1']);
  assert.deepEqual(second.events.map(row => row.id), ['e2']);
  assert.equal(first.submissions[0].account, '甲');
  assert.equal(second.submissions[0].account, '乙');
  assert.equal(first.accounts[0].region, '舟山');
  assert.equal(second.accounts[0].region, '岱山');
});

test('reports complete, partial, and no coverage using calculation boundaries', () => {
  const cases = [
    [interval, 'complete'],
    [{ start: '2026-10-06', end: interval.end }, 'partial'],
    [{ start: interval.start, end: '2026-10-09' }, 'partial'],
    [{ start: '2026-10-06', end: '2026-10-09' }, 'partial'],
    [{ start: '2026-10-06', end: interval.start }, 'none'],
    [{ start: interval.end, end: '2026-10-09' }, 'none']
  ];
  for (const [requested, expected] of cases) assert.equal(buildReport(requested, dataset()).coverageStatus, expected);
  for (const invalidCoverage of [null, {}, { start: 'bad', end: coverage.end }, { start: coverage.end, end: coverage.start }]) {
    assert.equal(buildReport(interval, dataset({ coverage: invalidCoverage })).coverageStatus, 'none');
  }
  assert.equal(buildReport(interval, dataset({ coverage: { start: '2026-10-07T08:30:00Z', end: '2026-10-08T08:30:00Z' } })).coverageStatus, 'complete');
  const partial = buildReport({ start: '2026-10-06', end: interval.end }, dataset({ events: [{ id: 'e', at, views: 2 }] }));
  assert.equal(partial.coverageStatus, 'partial');
  assert.equal(partial.stats.totalViews, 2);
});

test('coverage compares against actual 16:30 limits even when displayed dates appear covered', () => {
  const cases = [
    [{ start: '2026-10-07T16:00', end: '2026-10-08T16:00' }, 'partial'],
    [{ start: '2026-10-07T16:15', end: '2026-10-08T16:30' }, 'complete'],
    [{ start: '2026-10-07T16:30', end: '2026-10-08T16:30' }, 'complete'],
    [{ start: '2026-10-07T16:00', end: '2026-10-07T16:30' }, 'none'],
    [{ start: '2026-10-08T16:00', end: '2026-10-08T16:30' }, 'partial'],
    [{ start: '2026-10-08T16:30', end: '2026-10-09T16:00' }, 'none'],
    [{ start: '2026-10-07T16:30:00.001+08:00', end: '2026-10-08T16:30:00+08:00' }, 'partial'],
    [{ start: '2026-10-07T16:30:00+08:00', end: '2026-10-08T16:29:59.999+08:00' }, 'partial']
  ];
  for (const [available, expected] of cases) {
    assert.equal(buildReport(interval, dataset({ coverage: available })).coverageStatus, expected, JSON.stringify(available));
  }
});

test('empty data produces genuine zero counts and totals, without inventing a sentiment percentage', () => {
  const report = buildReport(interval, dataset());
  assert.deepEqual(report.stats, {
    informationCount: 0, positivePercent: null, eventCount: 0,
    overFiveMillionCount: 0, knownOverFiveMillionCount: 0,
    totalViews: 0, knownTotalViews: 0, missingViewsCount: 0,
    submissionCount: 0, contributorCount: 0, activeAccounts: 0
  });
  assert.deepEqual(report.events, []);
  assert.deepEqual(report.submissions, []);
  assert.deepEqual(report.accounts, []);
});

test('does not mutate input records or arrays, and exposes the browser UMD API', () => {
  const event = Object.freeze({ id: 'e', at, views: -1 });
  const source = Object.freeze(dataset({ events: Object.freeze([event]) }));
  const report = buildReport(Object.freeze(interval), source);
  assert.equal(event.views, -1);
  assert.equal(report.events[0].views, null);
  assert.notEqual(report.events[0], event);
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./weekly-report-model.js'), 'utf8'), context);
  assert.equal(typeof context.WeeklyReportModel.buildReport, 'function');
  assert.equal(context.WeeklyReportModel.buildReport(interval, source).stats.missingViewsCount, 1);
});
