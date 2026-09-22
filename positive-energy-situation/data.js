/* Independent local demonstration data. No production requests or credentials. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.TopicModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const mapping = { hotspot: '正能量热点', clue: '正能量线索', central: '央媒报道' };
  const titles = [
    '杭州志愿者接力守护放学路', '千年运河焕新生，沿岸百姓共享美好生活',
    '杭州科技创新成果走进百姓生活', '一座城的温暖：爱心食堂里的幸福滋味', '西湖畔的文明风景线',
    '青年工匠以匠心点亮中国制造', '社区书房让阅读触手可及',
    '杭州亚运场馆惠民开放迎来新热潮', '乡村艺术节让美丽乡村更有活力', '西湖大学采取长周期考核',
    '山村孩子的科学梦想有了新伙伴', '城市绿道串起家门口的幸福',
    '杭州无障碍出行服务持续升级', '青年创业者在乡村追逐梦想', '一座城的温暖：爱心食堂里的幸福滋味',
    '中国创新力量闪耀全球数字贸易博览会', '平凡英雄合力托起生命的希望', '杭州文明实践让幸福生活可感可及'
  ];
  const dateNumbers = [16,16,17,17,17,18,18,19,19,19,20,20,21,21,21,22,22,22];
  const volumes = [1280000,2360000,6800000,6800000,1620000,980000,1530000,4250000,2120000,1680000,1850000,2430000,3160000,1870000,1260000,5480000,3820000,2290000];
  const sources = ['hotspot', 'clue', 'central'];
  const platforms = ['微博', '抖音', '头条'];
  const records = titles.map(function (title, i) {
    const source = sources[i % 3];
    return { id: 'topic-' + String(i + 1).padStart(2, '0'), source: source, category: mapping[source], title: title,
      originUrl: null, region: '杭州市', platform: platforms[Math.floor(i / 3) % 3], status: '已上线', broadcast: '已播报',
      onlineAt: '2026-09-' + dateNumbers[i] + 'T' + String(8 + (i % 10)).padStart(2, '0') + ':30:00+08:00', volume: volumes[i] };
  });
  // User-supplied original destination; statistical values remain illustrative.
  records[9].originUrl = 'https://s.weibo.com/weibo?q=%23%E8%A5%BF%E6%B9%96%E5%A4%A7%E5%AD%A6%E9%87%87%E5%8F%96%E9%95%BF%E5%91%A8%E6%9C%9F%E8%80%83%E6%A0%B8%23&t=31&band_rank=42&Refer=top';
  // Exclusion examples remain in the raw fixture, so filtering is observable and testable.
  const sample = records[0];
  records.push(
    Object.assign({}, sample, { id: 'other-region', region: '宁波市', title: '宁波青年志愿服务在行动' }),
    Object.assign({}, sample, { id: 'child-region', region: '上城区', title: '街巷里的邻里守望' }),
    Object.assign({}, sample, { id: 'offline', status: '待上线' }),
    Object.assign({}, sample, { id: 'unbroadcast', broadcast: '未播报' }),
    Object.assign({}, sample, { id: 'local-only', source: 'local', category: '正能量热点' }),
    Object.assign({}, sample, { id: 'central-library', source: 'central-library', category: '央媒报道' }),
    Object.assign({}, sample)
  );
  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
  function calendarDate(input) {
    if (typeof input !== 'string' || !input.trim()) return null;
    // Timestamp must carry its timezone; never silently use the viewer's local timezone.
    if (!/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(input)) return null;
    const parsed = new Date(input);
    if (!Number.isFinite(parsed.getTime())) return null;
    const parts = dateFormatter.formatToParts(parsed);
    const value = type => parts.find(part => part.type === type).value;
    return value('year') + '-' + value('month') + '-' + value('day');
  }
  function dateMillis(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const millis = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 10) === value ? millis : NaN;
  }
  function days(start, end) {
    const first = dateMillis(start), last = dateMillis(end);
    if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) return [];
    const count = Math.round((last - first) / 86400000) + 1;
    if (count > 36600) return []; // Bound allocation for malformed or impractical ranges.
    return Array.from({ length: count }, (_, index) => new Date(first + index * 86400000).toISOString().slice(0, 10));
  }
  function filter(input, options) {
    const opts = options || {};
    const result = { topics: [], missingOnlineCount: 0 };
    if (!opts.region || !days(opts.start, opts.end).length) return result;
    const seen = new Set();
    (input || []).forEach(function (topic) {
      if (!topic || !Object.prototype.hasOwnProperty.call(mapping, topic.source) || mapping[topic.source] !== topic.category ||
          topic.region !== opts.region || topic.status !== '已上线' || topic.broadcast !== '已播报' ||
          (opts.platform && opts.platform !== '全部' && topic.platform !== opts.platform)) return;
      const identity = topic.source + ':' + topic.id;
      if (seen.has(identity)) return;
      seen.add(identity);
      const date = calendarDate(topic.onlineAt);
      if (!date) { result.missingOnlineCount += 1; return; }
      if (date >= opts.start && date <= opts.end) result.topics.push(topic);
    });
    return result;
  }
  function validVolume(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
  function summarize(topics) {
    const known = topics.filter(topic => validVolume(topic.volume));
    const missingCount = topics.length - known.length;
    const knownTotal = known.reduce((total, topic) => total + topic.volume, 0);
    const highest = known.length ? Math.max.apply(null, known.map(topic => topic.volume)) : null;
    return { total: missingCount ? null : knownTotal, knownTotal: knownTotal, missingCount: missingCount, count: topics.length,
      top: missingCount ? [] : known.filter(topic => topic.volume === highest) };
  }
  function aggregate(topics, start, end) {
    const dates = days(start, end);
    const grouped = new Map(dates.map(date => [date, []]));
    const included = [];
    const seen = new Set();
    (topics || []).forEach(function (topic) {
      const day = calendarDate(topic.onlineAt);
      const identity = topic.source + ':' + topic.id;
      if (!grouped.has(day) || seen.has(identity)) return;
      seen.add(identity);
      grouped.get(day).push(topic);
      included.push(topic);
    });
    return Object.assign(summarize(included), { series: dates.map(date => Object.assign({ date: date }, summarize(grouped.get(date)))) });
  }
  function format(value) {
    if (!validVolume(value)) return '数据缺失';
    const unit = value >= 100000000 ? 100000000 : value >= 10000 ? 10000 : 1;
    return Number((value / unit).toFixed(2)).toLocaleString('zh-CN', { useGrouping: false, maximumFractionDigits: 2 }) + (unit === 100000000 ? '亿' : unit === 10000 ? '万' : '');
  }
  // Pre-set per-topic heat observations ONLY for visual demonstration. This is not
  // a production heat formula. No volume field is used to create or read these values.
  const heatFixture = new Map(titles.map((_, index) => [sources[index % 3] + ':topic-' + String(index + 1).padStart(2, '0'),
    [420, 710, 680, 940, 880, 1320, 1890].map((value, day) => value + ((index * 137 + day * 79) % 610))]));
  function heatSeries(start, end, topics) {
    const identities = new Set((topics || []).map(topic => topic.source + ':' + topic.id));
    return days(start, end).map(function (date) {
      const index = Math.round((dateMillis(date) - dateMillis('2026-09-16')) / 86400000);
      if (index < 0 || index > 6) return { date: date, value: null };
      let value = 0;
      for (const identity of identities) {
        if (!heatFixture.has(identity)) return { date: date, value: null };
        value += heatFixture.get(identity)[index];
      }
      return { date: date, value: value };
    });
  }
  // Independent cumulative propagation observations, ordered 09/16–09/22.
  // Values before the topic went online are intentionally absent. These explicit
  // fixtures demonstrate a single topic's history; they do not redistribute a total.
  const propagationFixture = [
    [180000, 360000, 590000, 820000, 970000, 1120000, 1280000],
    [310000, 690000, 1030000, 1350000, 1720000, 2040000, 2360000],
    [null, 780000, 1560000, 2790000, 4080000, 5530000, 6800000],
    [null, 920000, 2120000, 3490000, 4810000, 5910000, 6800000],
    [null, 190000, 430000, 710000, 1030000, 1370000, 1620000],
    [null, null, 130000, 280000, 510000, 790000, 980000],
    [null, null, 220000, 490000, 820000, 1190000, 1530000],
    [null, null, null, 640000, 1720000, 3070000, 4250000],
    [null, null, null, 390000, 880000, 1490000, 2120000],
    [null, null, null, 280000, 730000, 1210000, 1680000],
    [null, null, null, null, 350000, 1040000, 1850000],
    [null, null, null, null, 420000, 1280000, 2430000],
    [null, null, null, null, null, 920000, 3160000],
    [null, null, null, null, null, 630000, 1870000],
    [null, null, null, null, null, 340000, 1260000],
    [null, null, null, null, null, null, 5480000],
    [null, null, null, null, null, null, 3820000],
    [null, null, null, null, null, null, 2290000]
  ];
  const topicObservationFixture = new Map(propagationFixture.map((values, index) =>
    [sources[index % 3] + ':topic-' + String(index + 1).padStart(2, '0'), values]));
  function topicSeries(topic, start, end) {
    const fixture = topic && validVolume(topic.volume) ? topicObservationFixture.get(topic.source + ':' + topic.id) : null;
    const onlineDay = topic && calendarDate(topic.onlineAt);
    return days(start, end).map(function (date) {
      const index = Math.round((dateMillis(date) - dateMillis('2026-09-16')) / 86400000);
      const value = fixture && onlineDay && date >= onlineDay && index >= 0 && index <= 6 ? fixture[index] : null;
      return { date: date, value: value };
    });
  }
  function originalUrl(topic) {
    if (!topic || typeof topic.originUrl !== 'string' || !/^https?:\/\//i.test(topic.originUrl)) return null;
    try {
      const url = new URL(topic.originUrl);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }
  return { records: records, filter: filter, aggregate: aggregate, days: days, format: format, heatSeries: heatSeries, topicSeries: topicSeries, originalUrl: originalUrl };
});
