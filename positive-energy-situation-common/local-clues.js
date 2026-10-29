/* Original platform hotlist snapshots, kept separate from broadcast topics.
 * Only fields visible in the user's screenshots are transcribed. There are no
 * captured Douyin/Toutiao records, original URLs or historical observations.
 */
(function (root, factory) {
  const model = factory(typeof module === 'object' && module.exports ? require('./data.js') : root.TopicModel);
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.LocalClueModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  const platforms = ['微博', '抖音', '头条'];
  const snapshots = [
    ['2026-10-21', [
      ['杭州卡栏冬瓜被全校师生追更', '15:57:27', 320000],
      ['杭州人有自己的八达岭', '15:57:20', 130000],
      ['杭州AI正在把科幻变成日常', '15:57:05', 1320000],
      ['杭州万象城ZARA即将闭店', '15:56:43', 490000],
      ['金店员工警觉拦截22万元诈骗案', '15:56:38', 120000]
    ]],
    ['2026-09-22', [
      ['中公考研回应1.5万奖学金迟迟不到', '15:23:12', 180000],
      ['杭州通报中学门口车祸致2伤', '15:19:18', 30000],
      ['张博恒赛前左臂拉伤', '15:16:27', 190000],
      ['以钛材之力挺起中国钛谷脊梁', '15:16:20', 20000],
      ['独居老人被困20小时丢纸条求助', '15:16:10', 70000]
    ]]
  ];
  const records = snapshots.flatMap(([date, rows]) => rows.map(([title, time, volume], index) => ({
    source: 'local-hotlist', id: 'weibo-' + date + '-' + (index + 1),
    platform: '微博', region: '杭州市', title, volume, originUrl: null,
    snapshotDate: date, originalRank: index + 1,
    displayTime: date.replaceAll('-', '/') + ' ' + time,
    observations: []
  })));
  function filter(input, options) {
    const opts = options || {};
    if (!opts.region || !platforms.includes(opts.platform) || !M.days(opts.start, opts.end).length) return [];
    // Retain the captured source order. Snapshot dates are only a local sample
    // selector; they are not broadcast online dates or a new production rule.
    return (input || []).filter(row => row.source === 'local-hotlist' && row.region === opts.region &&
      row.platform === opts.platform && row.snapshotDate >= opts.start && row.snapshotDate <= opts.end);
  }
  function topicSeries(topic, start, end) {
    const observations = new Map((topic?.observations || []).map(point => [point.date, point.value]));
    return M.days(start, end).map(date => {
      const value = observations.get(date);
      return { date, value: typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null };
    });
  }
  return { platforms, records, filter, topicSeries };
});
