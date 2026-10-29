/* Local, versioned snapshots of generated custom weekly reports. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeeklyReportStore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'positive-energy-situation.custom-weekly-reports.v1';
  var REPORT_ID = /^custom-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var LOCAL_STAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
  var DISPLAY_TIME = /^(\d{4})-(\d{2})-(\d{2})T16:00$/;
  var ZONED_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;
  var ERRORS = {
    invalid: '报告数据不完整或格式无效，无法保存。',
    corrupt: '已保存的周报数据损坏或格式不受支持，原数据未修改。',
    read: '无法读取本地已保存周报，请检查浏览器存储设置。',
    write: '周报保存失败，请检查浏览器存储空间或设置后重试。',
    invalidRemove: '只能删除有效的自定义周报。',
    removeWrite: '周报删除失败，请检查浏览器存储设置后重试。'
  };

  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function nonnegative(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
  function count(value) { return Number.isSafeInteger(value) && value >= 0; }
  function nullable(value, valid) { return value === null || valid(value); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function matches(pattern, value) {
    if (typeof value !== 'string') return null;
    var parts = pattern.exec(value);
    return parts && parts[0].length === value.length ? parts : null;
  }

  function calendarDate(parts) {
    var year = Number(parts[1]);
    var month = Number(parts[2]);
    var day = Number(parts[3]);
    var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  }

  function validStamp(value) {
    var parts = matches(LOCAL_STAMP, value);
    return Boolean(parts && calendarDate(parts) && Number(parts[4]) < 24 && Number(parts[5]) < 60 && Number(parts[6]) < 60);
  }

  function validDisplayTime(value) {
    var parts = matches(DISPLAY_TIME, value);
    return Boolean(parts && calendarDate(parts));
  }

  function validEventTime(value) {
    var parts = matches(ZONED_TIME, value);
    if (!parts || !calendarDate(parts) || Number(parts[4]) > 23 || Number(parts[5]) > 59 || Number(parts[6] || 0) > 59) return false;
    var zone = parts[7];
    if (zone !== 'Z') {
      var digits = zone.slice(1).replace(':', '');
      if (Number(digits.slice(0, 2)) > 23 || Number(digits.slice(2)) > 59) return false;
    }
    // The report renderer passes event timestamps to Date and Intl.DateTimeFormat.
    return Number.isFinite(Date.parse(value));
  }

  function validStats(stats) {
    return object(stats) &&
      ['informationCount', 'eventCount', 'knownOverFiveMillionCount', 'missingViewsCount', 'submissionCount', 'contributorCount', 'activeAccounts'].every(function (key) { return count(stats[key]); }) &&
      nullable(stats.overFiveMillionCount, count) && nullable(stats.totalViews, nonnegative) && nonnegative(stats.knownTotalViews) &&
      nullable(stats.positivePercent, function (value) { return nonnegative(value) && value <= 100; });
  }

  function validEvent(row) {
    return object(row) && ((typeof row.id === 'string' && row.id.trim().length > 0) || (typeof row.id === 'number' && Number.isFinite(row.id))) &&
      validEventTime(row.at) && typeof row.title === 'string' && typeof row.region === 'string' && typeof row.host === 'string' &&
      nullable(row.views, nonnegative);
  }

  function validSubmission(row) {
    return object(row) && typeof row.account === 'string' && count(row.count) && count(row.topicCount);
  }

  function validAccounts(row) {
    return object(row) && typeof row.region === 'string' && count(row.count) && Array.isArray(row.names) &&
      row.names.every(function (name) { return typeof name === 'string'; });
  }

  function validReport(report) {
    return object(report) && report.ok === true && Boolean(matches(REPORT_ID, report.id)) &&
      validStamp(report.generatedAt) && validStamp(report.savedAt) &&
      validDisplayTime(report.start) && validDisplayTime(report.end) && report.start < report.end &&
      report.calculationStart === report.start.slice(0, 10) + 'T16:30' &&
      report.calculationEnd === report.end.slice(0, 10) + 'T16:30' &&
      typeof report.region === 'string' && validStats(report.stats) &&
      Array.isArray(report.events) && report.events.every(validEvent) &&
      Array.isArray(report.submissions) && report.submissions.every(validSubmission) &&
      Array.isArray(report.accounts) && report.accounts.every(validAccounts) &&
      ['complete', 'partial', 'none'].indexOf(report.coverageStatus) !== -1;
  }

  function sorted(reports) {
    return reports.map(function (report, index) { return { report: report, index: index }; })
      .sort(function (a, b) {
        return a.report.savedAt === b.report.savedAt ? a.index - b.index : a.report.savedAt > b.report.savedAt ? -1 : 1;
      }).map(function (item) { return item.report; });
  }

  function create(storage) {
    function read() {
      var raw;
      try { raw = storage.getItem(STORAGE_KEY); }
      catch (_) { return { ok: false, error: ERRORS.read }; }
      if (raw === null) return { ok: true, reports: [] };
      try {
        var saved = JSON.parse(raw);
        if (!object(saved) || saved.version !== 1 || !Array.isArray(saved.reports)) throw new Error('Unsupported format');
        var ids = new Set();
        saved.reports.forEach(function (report) {
          if (!validReport(report) || ids.has(report.id)) throw new Error('Invalid report');
          ids.add(report.id);
        });
        return { ok: true, reports: saved.reports };
      } catch (_) { return { ok: false, error: ERRORS.corrupt }; }
    }

    function list() {
      var current = read();
      return current.ok ? { ok: true, reports: sorted(current.reports) } : current;
    }

    function save(report) {
      var snapshot;
      try {
        if (!validReport(report)) return { ok: false, error: ERRORS.invalid };
        snapshot = clone(report);
        if (!validReport(snapshot)) return { ok: false, error: ERRORS.invalid };
      } catch (_) { return { ok: false, error: ERRORS.invalid }; }

      var current = list();
      if (!current.ok) return current;
      var existing = current.reports.find(function (item) { return item.id === snapshot.id; });
      if (existing) return { ok: true, report: clone(existing), duplicate: true };
      var reports = sorted(current.reports.concat([snapshot]));
      try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, reports: reports })); }
      catch (_) { return { ok: false, error: ERRORS.write }; }
      return { ok: true, report: clone(snapshot), duplicate: false };
    }

    function remove(id) {
      if (!matches(REPORT_ID, id)) return { ok: false, error: ERRORS.invalidRemove };
      var current = read();
      if (!current.ok) return current;
      var index = current.reports.findIndex(function (report) { return report.id === id; });
      if (index === -1) return { ok: true, deleted: false, reports: sorted(current.reports) };
      // Keep the stored order and contents of every remaining snapshot unchanged.
      var reports = current.reports.slice();
      reports.splice(index, 1);
      try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, reports: reports })); }
      catch (_) { return { ok: false, error: ERRORS.removeWrite }; }
      return { ok: true, deleted: true, reports: sorted(reports) };
    }

    return { list: list, save: save, remove: remove };
  }

  return { STORAGE_KEY: STORAGE_KEY, create: create };
});
