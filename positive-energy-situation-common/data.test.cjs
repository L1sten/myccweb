const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('./data.js');
const localClues = require('./local-clues.js');
const opts = { region: '杭州市', start: '2026-09-16', end: '2026-09-22' };
const sample = model.records[0];
test('three sources included; region, status, broadcast, source and category enforce exclusions', () => {
  const result = model.filter([...model.records, { ...sample, id: 'wrong-category', category: '央媒报道' }], opts);
  assert.equal(result.topics.length, 18);
  assert.deepEqual(new Set(result.topics.map(t => t.source)), new Set(['hotspot', 'clue', 'central']));
  assert.equal(model.filter(model.records, { ...opts, region: '' }).topics.length, 0);
  for (const platform of ['微博', '抖音', '头条']) {
    const platformTopics = model.filter(model.records, { ...opts, platform }).topics;
    assert.equal(platformTopics.length, 6);
    assert.deepEqual(new Set(platformTopics.map(t => t.source)), new Set(['hotspot', 'clue', 'central']));
  }
});
test('deduplicate by source plus ID; equal titles and same IDs across sources remain independent', () => {
  const input = [sample, { ...sample }, { ...sample, id: 'different-id' }, { ...sample, source: 'clue', category: '正能量线索' }];
  assert.equal(model.filter(input, opts).topics.length, 3);
  assert.equal(model.aggregate(input, opts.start, opts.end).count, 3);
});
test('Shanghai midnight, UTC timestamps, and inclusive range boundaries', () => {
  const input = [
    { ...sample, id: 'before', onlineAt: '2026-09-15T15:59:59Z' },
    { ...sample, id: 'first', onlineAt: '2026-09-15T16:00:00Z' },
    { ...sample, id: 'last', onlineAt: '2026-09-22T15:59:59Z' },
    { ...sample, id: 'after', onlineAt: '2026-09-22T16:00:00Z' }
  ];
  const selected = model.filter(input, opts).topics;
  assert.deepEqual(selected.map(t => t.id), ['first', 'last']);
  const result = model.aggregate(selected, opts.start, opts.end);
  assert.equal(result.series[0].count, 1);
  assert.equal(result.series[6].count, 1);
});
test('invalid or missing online date is separately reported without substituting publication time', () => {
  const input = [null, ...['', null, 'invalid', '2026-09-16T10:30:00'].map((onlineAt, i) => ({ ...sample, id: String(i), onlineAt, publishedAt: sample.onlineAt }))];
  const result = model.filter(input, opts);
  assert.equal(result.topics.length, 0);
  assert.equal(result.missingOnlineCount, 4);
});
test('daily sum, all highest ties, and zero-filled dates are consistent', () => {
  const result = model.aggregate(model.filter(model.records, opts).topics, opts.start, opts.end);
  assert.equal(result.count, 18);
  assert.equal(result.total, 51580000);
  assert.equal(result.series.reduce((sum, day) => sum + day.total, 0), result.total);
  assert.equal(result.series[1].total, 15220000);
  assert.equal(result.series[1].top.length, 2);
  assert.ok(result.series[1].top.every(t => t.volume === 6800000));
  assert.equal(model.aggregate([], opts.start, opts.end).series[0].total, 0);
  assert.deepEqual(model.aggregate([], opts.start, opts.end).top, []);
});
test('missing volumes do not masquerade as zero or claim a highest topic', () => {
  const result = model.aggregate([sample, { ...sample, id: 'missing', volume: null }], opts.start, opts.end);
  assert.equal(result.total, null);
  assert.equal(result.knownTotal, sample.volume);
  assert.equal(result.missingCount, 1);
  assert.deepEqual(result.top, []);
  assert.equal(result.series[0].total, null);
  assert.equal(result.series[1].total, 0);
});
test('invalid dates, reversed ranges and leap-year boundaries', () => {
  assert.deepEqual(model.days('2026-02-30', opts.end), []);
  assert.deepEqual(model.days(opts.end, opts.start), []);
  assert.deepEqual(model.days('', ''), []);
  assert.deepEqual(model.days('2024-02-28', '2024-03-01'), ['2024-02-28', '2024-02-29', '2024-03-01']);
  assert.deepEqual(model.days(opts.start, opts.start), [opts.start]);
});
test('display units preserve missing and actual zero', () => {
  assert.equal(model.format(null), '数据缺失');
  assert.equal(model.format(0), '0');
  assert.equal(model.format(123456), '12.35万');
  assert.equal(model.format(325000000), '3.25亿');
});
test('heat fixture is independent of volume and no observations beyond fixture interval', () => {
  const topics = model.filter(model.records, opts).topics;
  assert.deepEqual(model.heatSeries(opts.start, opts.end, topics), model.heatSeries(opts.start, opts.end, topics.map(t => ({ ...t, volume: 0 }))));
  assert.equal(model.heatSeries('2026-09-23', '2026-09-23', topics)[0].value, null);
  assert.equal(model.heatSeries(opts.start, opts.start, [sample, sample])[0].value, model.heatSeries(opts.start, opts.start, [sample])[0].value);
});

test('single-topic observations are independent daily series with explicit boundaries', () => {
  const topic = model.records[2];
  const series = model.topicSeries(topic, '2026-09-15', '2026-09-23');
  assert.deepEqual(series.slice(0, 2).map(point => point.value), [null, null]);
  assert.equal(series[2].value, 780000);
  assert.equal(series[7].value, topic.volume);
  assert.equal(series[8].value, null);
  assert.notDeepEqual(model.topicSeries(topic, opts.start, opts.end), model.topicSeries(model.records[3], opts.start, opts.end));
  assert.deepEqual(model.topicSeries({ ...topic, volume: 1 }, opts.start, opts.end), model.topicSeries(topic, opts.start, opts.end));
  for (const record of model.filter(model.records, opts).topics) {
    const observations = model.topicSeries(record, opts.start, opts.end);
    assert.equal(observations.at(-1).value, record.volume);
    assert.ok(observations.some(point => point.value !== null));
  }
});
test('single-topic missing values and unknown fixtures are never synthesized', () => {
  for (const topic of [null, { ...sample, volume: null }, { ...sample, id: 'unknown' }, { ...sample, onlineAt: null }]) {
    assert.ok(model.topicSeries(topic, opts.start, opts.end).every(point => point.value === null));
  }
});
test('original URLs accept only absolute HTTP(S) without embedded credentials', () => {
  assert.equal(model.originalUrl({ originUrl: 'https://example.com/article?a=1' }), 'https://example.com/article?a=1');
  assert.equal(model.originalUrl({ originUrl: 'http://example.com' }), 'http://example.com/');
  for (const originUrl of [null, '', '/article', '//example.com', 'javascript:alert(1)', 'data:text/plain,hello', 'file:///tmp/a', 'https://', 'https://user:password@example.com']) {
    assert.equal(model.originalUrl({ originUrl }), null);
  }
  assert.equal(model.originalUrl(null), null);
});

test('original hotlist snapshots retain source order, displayed timestamps and raw amounts', () => {
  const topics = localClues.filter(localClues.records, { ...opts, start: '2026-10-21', end: '2026-10-21', platform: '微博' });
  assert.equal(topics.length, 5);
  assert.equal(topics[0].title, '杭州卡栏冬瓜被全校师生追更');
  assert.equal(topics[0].displayTime, '2026/10/21 15:57:27');
  assert.deepEqual(topics.map(t => t.volume), [320000, 130000, 1320000, 490000, 120000]);
  assert.equal(localClues.filter(localClues.records, { ...opts, platform: '微博' }).length, 5);
  for (const overrides of [{platform:'抖音'}, {platform:'头条'}, {region:''}, {region:'宁波市'}, {start:'2026-10-22',end:'2026-10-22'}]) {
    assert.deepEqual(localClues.filter(localClues.records, { ...opts, platform:'微博', ...overrides }), []);
  }
});

test('local clues cannot enter broadcast filters, counts or propagation totals', () => {
  const before = model.aggregate(model.filter(model.records, opts).topics, opts.start, opts.end);
  const after = model.aggregate(model.filter([...model.records, ...localClues.records], opts).topics, opts.start, opts.end);
  assert.deepEqual(after, before);
  const localOptions = { ...opts, platform: '微博' };
  assert.deepEqual(localClues.filter([...localClues.records, ...model.records], localOptions), localClues.filter(localClues.records, localOptions));
});

test('local clue history uses only its own observations, never snapshot totals or broadcast history', () => {
  const topic = localClues.records[0];
  assert.ok(localClues.topicSeries(topic, '2026-10-15', '2026-10-21').every(p => p.value === null));
  const observed = { ...topic, observations: [{date:'2026-10-20',value:0},{date:'2026-10-21',value:12345}] };
  const result = localClues.topicSeries(observed, '2026-10-19', '2026-10-21');
  assert.deepEqual(result.map(p => p.value), [null, 0, 12345]);
  assert.deepEqual(localClues.topicSeries({...observed, volume:9999999}, '2026-10-19', '2026-10-21'), result);
});
