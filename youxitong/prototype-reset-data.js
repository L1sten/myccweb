(function (global) {
  'use strict';

  var VERSION = 'linen-restart-20261020-v1';
  var OPENING_HOTEL = 'org-hotel-yunqi';
  var OPENING_BANK = 'BANK-20260901-01';
  var OPENING_KEY = 'prototype-opening-recharge:yunqi';
  var RECHARGES = ['线下充值', '微信充值', '平台直接充值'];
  var LINEN_TYPES = ['布草订单扣款', '退污退款'];
  var ARRAY_FIELDS = ['receipts', 'returnRequests', 'linenRefunds', 'quotaEvents'];
  var MAP_FIELDS = ['hotelLinen', 'quotas'];

  function fail(message) { throw new Error('原型重置：' + message); }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function own(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }
  function requiredObject(value, path) { if (!object(value)) fail(path + ' 必须是对象'); }
  function requiredArray(value, path) { if (!Array.isArray(value)) fail(path + ' 必须是数组'); }
  function text(value) { return typeof value === 'string' ? value.trim() : ''; }
  function bank(value) { return text(value).toLowerCase(); }
  function set(map, key, value) { Object.defineProperty(map, key, {value: value, enumerable: true, writable: true, configurable: true}); }
  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { fail('快照必须是可序列化的 JSON 数据：' + error.message); }
  }
  function optionalArray(value, key, path) {
    if (own(value, key)) requiredArray(value[key], path + '.' + key);
    return value[key] || [];
  }
  function optionalObject(value, key, path) {
    if (own(value, key)) requiredObject(value[key], path + '.' + key);
    return value[key] || {};
  }
  function isOpening(entry) {
    return bank(entry.bank) === OPENING_BANK.toLowerCase() || entry.businessKey === OPENING_KEY;
  }
  function openingEntry() {
    return {id: 'WL-DEMO-0901-001', hotel: OPENING_HOTEL, type: '线下充值', cents: 2000000,
      after: 2000000, bank: OPENING_BANK, businessKey: OPENING_KEY,
      time: '2026-09-01 10:06', note: '历史到账记录'};
  }
  // Before recharge approval was introduced (b047f79), syncRechargeSave wrote
  // exactly these six fields and the wallet displayed them as 线下充值.
  // Recognize that complete format only; a missing type alone proves nothing.
  function normalizeLegacyRecharge(entry) {
    var fields = ['hotel', 'cents', 'after', 'bank', 'note', 'time'];
    if (!object(entry) || Object.keys(entry).length !== fields.length ||
        !fields.every(function (key) { return own(entry, key); }) ||
        !Number.isSafeInteger(entry.cents) || entry.cents <= 0 ||
        !Number.isSafeInteger(entry.after) || !text(entry.bank) || entry.bank.length > 80 ||
        !text(entry.time) || typeof entry.note !== 'string') return false;
    entry.type = '线下充值';
    return true;
  }
  function classify(entry, index, hotels) {
    var path = 'entries[' + index + ']';
    requiredObject(entry, path);
    if (!text(entry.hotel) || !own(hotels, entry.hotel)) fail(path + ' 引用了未知酒店 ' + String(entry.hotel));
    if (!Number.isSafeInteger(entry.cents)) fail(path + ' 金额 cents 必须是安全整数分');
    ['id', 'businessKey', 'businessId', 'bank'].forEach(function (key) {
      if (own(entry, key) && typeof entry[key] !== 'string') fail(path + '.' + key + ' 必须是字符串');
    });
    var refundKey = /^(linen-refund:|return-complete:)/.test(entry.businessKey || '');
    var linenType = LINEN_TYPES.includes(entry.type);
    if (refundKey || linenType) {
      if (refundKey && entry.type && entry.type !== '退污退款') fail(path + ' 退污业务标识与资金类型冲突');
      if ((refundKey || entry.type === '退污退款') ? entry.cents < 0 : entry.cents > 0) fail(path + ' 布草资金方向与类型冲突');
      return 'linen';
    }
    if (RECHARGES.includes(entry.type)) {
      if (entry.cents <= 0) fail(path + ' 充值金额必须大于零');
      if (entry.approvalStatus && !['APPROVED', 'DIRECT'].includes(entry.approvalStatus)) fail(path + ' 充值流水不是已入账状态');
      return 'recharge';
    }
    if (entry.type === '商城订单扣款') {
      if (entry.cents >= 0) fail(path + ' 商城扣款金额必须小于零');
      if (!text(entry.bank) && !text(entry.businessKey) && !text(entry.businessId)) fail(path + ' 商城扣款缺少业务标识');
      return 'store';
    }
    fail(path + ' 存在未知资金类型 ' + String(entry.type || '（空）'));
  }
  function identifiers(entry, kind) {
    var keys = [];
    if (text(entry.id)) keys.push('id:' + entry.id);
    if (text(entry.businessKey)) keys.push('businessKey:' + entry.businessKey);
    if (text(entry.businessId)) keys.push('businessId:' + kind + ':' + entry.businessId);
    if (bank(entry.bank) && kind === 'recharge') keys.push('rechargeBank:' + bank(entry.bank));
    if (bank(entry.bank) && kind === 'store') keys.push('storeOrder:' + bank(entry.bank));
    return keys;
  }
  // after is a derived, previously unreliable balance; other content must agree.
  function signature(entry) {
    return JSON.stringify(Object.keys(entry).filter(function (key) { return key !== 'after'; }).sort().map(function (key) {
      return [key, key === 'bank' ? bank(entry[key]) : entry[key]];
    }));
  }
  function wallet(entries, hotels) {
    var seen = Object.create(null), retained = [], removed = 0, duplicates = 0, foundOpening = false, legacyRecharges = 0;
    entries.forEach(function (entry, index) {
      if (normalizeLegacyRecharge(entry)) legacyRecharges++;
      var kind = classify(entry, index, hotels);
      if (isOpening(entry)) {
        if (kind !== 'recharge' || entry.type !== '线下充值' || entry.hotel !== OPENING_HOTEL || entry.cents !== 2000000 || bank(entry.bank) !== OPENING_BANK.toLowerCase()) {
          fail('样例充值 ' + OPENING_BANK + ' 的酒店、类型、银行流水号或金额冲突');
        }
        entry.businessKey = OPENING_KEY;
        entry.bank = OPENING_BANK;
        foundOpening = true;
      }
      var keys = identifiers(entry, kind), fingerprint = signature(entry), previous = null;
      keys.forEach(function (key) {
        if (own(seen, key)) {
          if (seen[key].fingerprint !== fingerprint) fail('重复业务标识内容冲突：' + key);
          previous = seen[key];
        }
      });
      var row = previous || {fingerprint: fingerprint};
      keys.forEach(function (key) { seen[key] = row; });
      if (previous) { duplicates++; return; }
      if (kind === 'linen') { removed++; return; }
      retained.push(entry);
    });
    var added = !foundOpening && own(hotels, OPENING_HOTEL);
    if (added) retained.push(openingEntry());
    var balances = {};
    Object.keys(hotels).forEach(function (hotel) { set(balances, hotel, 0); });
    // entries is stored newest first by unshift(). Reverse traversal preserves the
    // actual posting sequence, including equal/locale-formatted timestamps.
    for (var i = retained.length - 1; i >= 0; i--) {
      var entry = retained[i], after = balances[entry.hotel] + entry.cents;
      if (!Number.isSafeInteger(after)) fail('酒店 ' + entry.hotel + ' 重算余额超出安全整数范围');
      entry.after = after;
      set(balances, entry.hotel, after);
    }
    return {entries: retained, balances: balances, linenEntries: removed, duplicateEntries: duplicates,
      openingRechargeAdded: added, legacyRecharges: legacyRecharges};
  }
  function prepare(catalogSnapshot, businessSnapshot) {
    requiredObject(catalogSnapshot, 'catalogSnapshot');
    requiredObject(catalogSnapshot.catalog, 'catalogSnapshot.catalog');
    requiredArray(catalogSnapshot.orgs, 'catalogSnapshot.orgs');
    requiredArray(catalogSnapshot.users, 'catalogSnapshot.users');
    if (!catalogSnapshot.orgs.length || !catalogSnapshot.users.length) fail('目录快照必须包含完整非空组织和账号');
    requiredObject(catalogSnapshot.qty, 'catalogSnapshot.qty');
    ['floors', 'sites', 'orders'].forEach(function (key) { requiredArray(catalogSnapshot.catalog[key], 'catalogSnapshot.catalog.' + key); });
    requiredObject(catalogSnapshot.catalog.mappings, 'catalogSnapshot.catalog.mappings');
    requiredObject(businessSnapshot, 'businessSnapshot');
    ['categories', 'products', 'entries'].forEach(function (key) { requiredArray(businessSnapshot[key], 'businessSnapshot.' + key); });
    var outer = clone(catalogSnapshot), data = clone(businessSnapshot), catalog = outer.catalog, hotels = {};
    outer.orgs.forEach(function (org, index) {
      requiredObject(org, 'orgs[' + index + ']');
      if (org.type === 'hotel') {
        if (!text(org.id)) fail('酒店缺少组织编号');
        if (own(hotels, org.id)) fail('重复酒店组织编号：' + org.id);
        set(hotels, org.id, true);
      }
    });
    if (!Object.keys(hotels).length) fail('目录快照必须包含酒店');
    var removed = {orders: catalog.orders.length, terminalBatches: optionalArray(catalog, 'terminalBatches', 'catalog').length};
    var clearedDocuments = Object.create(null);
    function remember(rows) {
      rows.forEach(function (row) {
        if (!object(row)) fail('布草业务记录必须是对象');
        ['id', 'token', 'reference'].forEach(function (key) { if (text(row[key])) clearedDocuments[row[key]] = true; });
      });
    }
    remember(catalog.orders);
    remember(catalog.terminalBatches || []);
    ARRAY_FIELDS.forEach(function (key) {
      var rows = optionalArray(data, key, 'businessSnapshot');
      removed[key] = rows.length;
      remember(rows);
      data[key] = [];
    });
    MAP_FIELDS.forEach(function (key) {
      var old = optionalObject(data, key, 'businessSnapshot');
      removed[key] = Object.keys(old).length;
      data[key] = {};
    });
    catalog.orders = [];
    catalog.terminalBatches = [];
    catalog.selection = {};
    catalog.drafts = {};
    catalog.draft = null;
    outer.qty = {};
    if (own(catalog, 'qty')) catalog.qty = {};
    var v19 = optionalObject(data, 'v19', 'businessSnapshot');
    removed.floorCaps = Object.keys(optionalObject(v19, 'floorCaps', 'v19')).length;
    removed.floorInitials = Object.keys(optionalObject(v19, 'floorInitials', 'v19')).length;
    v19.floorCaps = {};
    v19.floorInitials = {};
    removed.v19Audit = 0;
    if (own(v19, 'audit')) {
      v19.audit = optionalArray(v19, 'audit', 'v19').filter(function (entry) {
        requiredObject(entry, 'v19.audit[]');
        var business = ['楼层初始化额度', '原型入库楼层归属核定'].includes(entry.kind) ||
          text(entry.subject) && own(clearedDocuments, entry.subject);
        if (business) removed.v19Audit++;
        return !business;
      });
    }
    data.v19 = v19;
    removed.v191Batches = 0;
    if (own(data, 'v191')) {
      var v191 = optionalObject(data, 'v191', 'businessSnapshot');
      if (own(v191, 'batches')) {
        v191.batches = optionalArray(v191, 'batches', 'v191').filter(function (batch) {
          requiredObject(batch, 'v191.batches[]');
          var business = ['STOCKING', 'DAILY', 'REFUND'].includes(batch.mode) || ['order', 'request', 'document', 'reference'].some(function (key) {
            return text(batch[key]) && own(clearedDocuments, batch[key]);
          });
          if (business) removed.v191Batches++;
          return !business;
        });
      }
    }
    var result = wallet(data.entries, hotels);
    data.entries = result.entries;
    data.balances = result.balances;
    removed.linenEntries = result.linenEntries;
    removed.duplicateEntries = result.duplicateEntries;
    // Everything not explicitly cleared above survives unchanged: identities,
    // mappings, floor bindings, prices, categories, store inventory/orders,
    // recharge requests, payment objects, configuration audit and v193 assets.
    return {catalogSnapshot: outer, businessSnapshot: data, summary: {
      version: VERSION, hotels: Object.keys(hotels).length, removed: removed,
      retained: {entries: data.entries.length, recharges: optionalArray(data, 'recharges', 'businessSnapshot').length,
        storeOrders: optionalArray(data, 'storeOrders', 'businessSnapshot').length,
        payments: optionalArray(v19, 'payments', 'v19').length},
      balances: clone(data.balances), openingRechargeAdded: result.openingRechargeAdded,
      normalizedLegacyRecharges: result.legacyRecharges
    }};
  }

  var api = {VERSION: VERSION, prepare: prepare};
  global.YouxitongResetData = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
