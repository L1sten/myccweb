/* Pure local report calculations. Selected dates display 16:00 and use 16:30 Beijing time (UTC+08:00). */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WeeklyReportModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BEIJING_OFFSET = 8 * 60;
  var FIVE_MILLION = 5000000;
  var REPORT_DATE = /^\d{4}-\d{2}-\d{2}$/;
  var DISPLAY_TIME = 'T16:00';
  var CALCULATION_TIME = 'T16:30';
  var FORM_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
  var ZONED_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})$/;

  function calendarTime(parts) {
    var year = Number(parts[1]);
    var month = Number(parts[2]);
    var day = Number(parts[3]);
    var hour = Number(parts[4]);
    var minute = Number(parts[5]);
    var second = Number(parts[6] || 0);
    var millisecond = Number(((parts[7] || '') + '000').slice(0, 3));
    var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    var monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
        hour > 23 || minute > 59 || second > 59) return null;
    // setUTCFullYear avoids Date.UTC's special handling of years 00–99.
    var date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, millisecond);
    return date.getTime();
  }

  function parseFormTime(value) {
    if (typeof value !== 'string') return null;
    var parts = FORM_TIME.exec(value);
    if (!parts) return null;
    var time = calendarTime(parts);
    return time === null ? null : time - BEIJING_OFFSET * 60000;
  }

  function parseReportDate(value) {
    if (typeof value !== 'string' || !REPORT_DATE.test(value)) return null;
    return parseFormTime(value + CALCULATION_TIME);
  }

  function parseZonedTime(value) {
    if (typeof value !== 'string') return null;
    var parts = ZONED_TIME.exec(value);
    if (!parts) return null;
    var time = calendarTime(parts);
    if (time === null) return null;
    var zone = parts[8];
    if (zone === 'Z') return time;
    var digits = zone.slice(1).replace(':', '');
    var hours = Number(digits.slice(0, 2));
    var minutes = Number(digits.slice(2));
    if (hours > 23 || minutes > 59) return null;
    return time - (zone[0] === '+' ? 1 : -1) * (hours * 60 + minutes) * 60000;
  }

  function parseCoverageTime(value) {
    var local = parseFormTime(value);
    return local === null ? parseZonedTime(value) : local;
  }

  function identity(value) {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return null;
  }

  function textCompare(a, b) {
    a = String(a);
    b = String(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function withinInterval(rows, start, end) {
    var seen = new Set();
    return (Array.isArray(rows) ? rows : []).reduce(function (selected, row) {
      if (!row || typeof row !== 'object') return selected;
      var id = identity(row.id);
      if (id === null || seen.has(id)) return selected;
      // The first source record for an id wins, even if it falls outside the interval.
      seen.add(id);
      var time = parseZonedTime(row.at);
      if (time !== null && time >= start && time < end) selected.push({ row: row, time: time, id: id });
      return selected;
    }, []);
  }

  function validViews(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  function newestFirst(a, b) {
    return b.time - a.time || textCompare(a.id, b.id);
  }

  function coverageStatus(coverage, start, end) {
    var coveredStart = parseCoverageTime(coverage && coverage.start);
    var coveredEnd = parseCoverageTime(coverage && coverage.end);
    if (coveredStart === null || coveredEnd === null || coveredStart >= coveredEnd ||
        end <= coveredStart || start >= coveredEnd) return 'none';
    return start >= coveredStart && end <= coveredEnd ? 'complete' : 'partial';
  }

  function buildReport(interval, dataset) {
    var start = parseReportDate(interval && interval.start);
    var end = parseReportDate(interval && interval.end);
    if (start === null || end === null) {
      return { ok: false, error: '请选择完整、有效的开始日期和结束日期。' };
    }
    if (start >= end) return { ok: false, error: '开始日期必须早于结束日期。' };
    dataset = dataset && typeof dataset === 'object' ? dataset : {};

    var information = withinInterval(dataset.information, start, end);
    var eventRecords = withinInterval(dataset.events, start, end);
    var submissionRecords = withinInterval(dataset.submissions, start, end);
    var activities = withinInterval(dataset.activities, start, end);
    var positiveCount = 0;
    var missingSentiment = false;
    information.forEach(function (item) {
      var sentiment = item.row.sentiment;
      if (sentiment === 'positive') positiveCount += 1;
      else if (sentiment !== 'neutral' && sentiment !== 'negative') missingSentiment = true;
    });

    var knownTotalViews = 0;
    var knownOverFiveMillionCount = 0;
    var missingViewsCount = 0;
    eventRecords.forEach(function (item) {
      if (validViews(item.row.views)) {
        knownTotalViews += item.row.views;
        if (item.row.views > FIVE_MILLION) knownOverFiveMillionCount += 1;
      } else missingViewsCount += 1;
    });
    eventRecords.sort(function (a, b) {
      var aValid = validViews(a.row.views);
      var bValid = validViews(b.row.views);
      if (aValid !== bValid) return aValid ? -1 : 1;
      return (aValid ? b.row.views - a.row.views : 0) || newestFirst(a, b);
    });
    var events = eventRecords.map(function (item) {
      return Object.assign({}, item.row, { views: validViews(item.row.views) ? item.row.views : null });
    });

    var submissionGroups = new Map();
    submissionRecords.forEach(function (item) {
      var account = identity(item.row.account);
      if (account === null) return;
      if (!submissionGroups.has(account)) submissionGroups.set(account, { account: account, count: 0, topicCount: 0 });
      var group = submissionGroups.get(account);
      group.count += 1;
      if (item.row.topicRelated === true) group.topicCount += 1;
    });
    var submissions = Array.from(submissionGroups.values()).sort(function (a, b) {
      return b.count - a.count || textCompare(a.account, b.account);
    });

    // An account belongs to the region/name on its latest activity in this interval.
    var activeAccountRecords = new Map();
    activities.sort(newestFirst).forEach(function (item) {
      var accountId = identity(item.row.accountId);
      if (accountId !== null && !activeAccountRecords.has(accountId)) activeAccountRecords.set(accountId, item.row);
    });
    var accountGroups = new Map();
    activeAccountRecords.forEach(function (row, accountId) {
      var region = identity(row.region) || identity(dataset.region) || '未标明地区';
      if (!accountGroups.has(region)) accountGroups.set(region, []);
      accountGroups.get(region).push({ id: accountId, name: identity(row.name) || accountId });
    });
    var accounts = Array.from(accountGroups, function (entry) {
      var members = entry[1].sort(function (a, b) { return textCompare(a.name, b.name) || textCompare(a.id, b.id); });
      return { region: entry[0], count: members.length, names: members.map(function (member) { return member.name; }) };
    }).sort(function (a, b) { return textCompare(a.region, b.region); });

    return {
      ok: true,
      start: interval.start + DISPLAY_TIME,
      end: interval.end + DISPLAY_TIME,
      calculationStart: interval.start + CALCULATION_TIME,
      calculationEnd: interval.end + CALCULATION_TIME,
      region: dataset.region || '',
      stats: {
        informationCount: information.length,
        positivePercent: information.length && !missingSentiment ? positiveCount / information.length * 100 : null,
        eventCount: events.length,
        overFiveMillionCount: missingViewsCount ? null : knownOverFiveMillionCount,
        knownOverFiveMillionCount: knownOverFiveMillionCount,
        totalViews: missingViewsCount ? null : knownTotalViews,
        knownTotalViews: knownTotalViews,
        missingViewsCount: missingViewsCount,
        submissionCount: submissionRecords.length,
        contributorCount: submissionGroups.size,
        activeAccounts: activeAccountRecords.size
      },
      events: events,
      submissions: submissions,
      accounts: accounts,
      coverageStatus: coverageStatus(dataset.coverage, start, end)
    };
  }

  return { buildReport: buildReport };
});
