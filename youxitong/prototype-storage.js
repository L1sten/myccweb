(function (global) {
  'use strict';
  var STATE_KEY = 'youxitong-prototype-state-v1';
  var BACKUP_KEY = 'youxitong-prototype-before-linen-restart-20261020';
  var CATALOG_KEY = 'youxitong-catalog-prototype-v3';
  var BUSINESS_KEY = 'youxitong-review-sync-v1';
  function parse(raw, label) {
    if (raw === null) return null;
    try { return JSON.parse(raw); }
    catch (error) { throw new Error(label + '无法读取，原数据已保留。请核对后刷新重试。'); }
  }
  function acquireWriter(navigator) {
    if (!navigator || !navigator.locks) return Promise.reject(new Error('当前浏览器不支持原型数据保护，请使用新版 Chrome 或 Firefox。'));
    return new Promise(function (resolve, reject) {
      navigator.locks.request('youxitong-prototype-writer-v1', {mode:'exclusive', ifAvailable:true}, function (lock) {
        if (!lock) { reject(new Error('另一个标签页正在使用本地原型，请关闭该标签页后刷新继续。')); return; }
        resolve();
        // The browser releases this lock when the document is destroyed. Keeping
        // it across synchronous UI actions prevents check/set races in storage.
        return new Promise(function () {});
      }).catch(reject);
    });
  }
  function create(storage, engine) {
    if (!engine) throw new Error('重置模块未加载，请刷新重试。');
    var loadedRaw = storage.getItem(STATE_KEY);
    var envelope = parse(loadedRaw, '原型数据');
    var legacyCatalog = storage.getItem(CATALOG_KEY);
    var legacyBusiness = storage.getItem(BUSINESS_KEY);
    var initialized = false;
    function validate(value) {
      if (!value || value.resetVersion !== engine.VERSION || !value.catalogSnapshot ||
          !value.catalogSnapshot.catalog || !Array.isArray(value.catalogSnapshot.orgs) ||
          !value.businessSnapshot || !Array.isArray(value.businessSnapshot.entries)) {
        throw new Error('原型存储版本或结构不匹配，原数据已保留。');
      }
      return value;
    }
    if (envelope) validate(envelope);
    function assertCurrent() {
      if (storage.getItem(STATE_KEY) !== loadedRaw) {
        throw new Error('原型数据已在其他标签页更新，请刷新后继续。');
      }
    }
    function write(catalogSnapshot, businessSnapshot, summary) {
      assertCurrent();
      if (loadedRaw) {
        var persisted=JSON.parse(loadedRaw);
        if(JSON.stringify(persisted.catalogSnapshot)===JSON.stringify(catalogSnapshot) && JSON.stringify(persisted.businessSnapshot)===JSON.stringify(businessSnapshot)) return envelope;
      }
      var next = {resetVersion:engine.VERSION, revision:(envelope ? envelope.revision : 0) + 1,
        catalogSnapshot:catalogSnapshot, businessSnapshot:businessSnapshot};
      if (summary || (envelope && envelope.resetSummary)) next.resetSummary = summary || envelope.resetSummary;
      var raw = JSON.stringify(next);
      // One atomic localStorage write commits both business and catalog state.
      storage.setItem(STATE_KEY, raw);
      loadedRaw = raw;
      envelope = next;
      return next;
    }
    return {
      readCatalog:function () {
        var value=envelope ? envelope.catalogSnapshot : parse(legacyCatalog, '旧档案数据');
        if(value && (!value.catalog || !Array.isArray(value.orgs))) throw new Error('旧档案结构不完整，原数据已保留。');
        return value;
      },
      readBusiness:function () {
        var value=envelope ? envelope.businessSnapshot : parse(legacyBusiness, '旧业务数据');
        if(value && (!Array.isArray(value.categories)||!Array.isArray(value.products)||!Array.isArray(value.entries))) throw new Error('旧业务结构不完整，原数据已保留。');
        return value;
      },
      initialize:function (catalogSnapshot, businessSnapshot) {
        assertCurrent();
        if (!envelope) {
          // Fail before any write for invalid/unknown funds. Never replace the backup.
          var prepared = engine.prepare(catalogSnapshot, businessSnapshot);
          if (storage.getItem(CATALOG_KEY) !== legacyCatalog || storage.getItem(BUSINESS_KEY) !== legacyBusiness) {
            throw new Error('旧原型数据在初始化期间发生变化，请关闭旧标签页后刷新。');
          }
          if (storage.getItem(BACKUP_KEY) === null) {
            storage.setItem(BACKUP_KEY, JSON.stringify({version:engine.VERSION, time:new Date().toISOString(),
              catalog:legacyCatalog, business:legacyBusiness}));
          }
          write(prepared.catalogSnapshot, prepared.businessSnapshot, prepared.summary);
        }
        initialized = true;
        return envelope;
      },
      save:function (catalogSnapshot, businessSnapshot) {
        if (!initialized) throw new Error('原型数据初始化未完成，未保存修改。');
        return write(catalogSnapshot, businessSnapshot || envelope.businessSnapshot);
      },
      assertCurrent:assertCurrent,
      isReady:function () { return initialized; }
    };
  }
  var api = {create:create, acquireWriter:acquireWriter, STATE_KEY:STATE_KEY, BACKUP_KEY:BACKUP_KEY, CATALOG_KEY:CATALOG_KEY, BUSINESS_KEY:BUSINESS_KEY};
  global.YouxitongPrototypeStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
