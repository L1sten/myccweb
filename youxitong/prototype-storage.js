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
        if (!lock) { var busy=new Error('另一个原型页面正在操作，释放后将自动恢复。');busy.code='WRITER_BUSY';reject(busy);return; }
        var held=true,releaseLock;
        var lifetime=new Promise(function (release) { releaseLock=release; });
        resolve({
          assertHeld:function () { if(!held)throw new Error('当前页面已暂停写入，请返回此页面后继续。'); },
          release:function () { held=false;releaseLock(); }
        });
        return lifetime;
      }).catch(reject);
    });
  }
  // Only the active document holds the writer lease. A restored document must
  // reacquire it before checking its snapshot; never steal a legacy page's lock.
  function manageWriter(browser,onStatus) {
    var document=browser.document,lease=null,pending=false,left=false,blurred=false,closed=false,timer=null,handedOff=false,channel=null;
    var clientId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),handoffVersion=0,handoffOwner='',requestedTransfer=false;
    var resolveReady,rejectReady,settled=false;
    var ready=new Promise(function(resolve,reject){resolveReady=resolve;rejectReady=reject;});
    var status='waiting';
    function active(){return !closed&&!left&&!blurred&&!handedOff&&document.visibilityState!=='hidden';}
    function notify(next,error){status=next;if(onStatus)onStatus(next,error);}
    function clearRetry(){if(timer!==null){browser.clearTimeout(timer);timer=null;}}
    function release(){clearRetry();if(lease){lease.release();lease=null;}}
    function pause(){release();notify('paused');}
    function retry(){if(active()&&timer===null)timer=browser.setTimeout(function(){timer=null;resume();},1000);}
    function resume(takeOver){
      if(takeOver===true&&!closed&&!left&&document.visibilityState!=='hidden'){
        blurred=false;handedOff=false;requestedTransfer=true;
        if(channel){handoffVersion=Math.max(handoffVersion+1,Date.now());handoffOwner=clientId;channel.postMessage({type:'request-writer',version:handoffVersion,owner:clientId});}
      }
      if(!active()||pending||lease)return;
      clearRetry();pending=true;notify('waiting');
      acquireWriter(browser.navigator).then(function(next){
        pending=false;
        if(!active()){next.release();return;}
        lease=next;requestedTransfer=false;notify('active');
        if(!settled){settled=true;resolveReady(session);}
      },function(error){
        pending=false;
        if(closed)return;
        if(error.code==='WRITER_BUSY'){if(active()){notify('waiting');retry();}return;}
        notify('error',error);if(!settled){settled=true;rejectReady(error);}
      });
    }
    function hidden(){if(document.visibilityState==='hidden')pause();else{blurred=false;handedOff=false;resume();}}
    function hide(){left=true;pause();}
    function show(){left=false;blurred=false;handedOff=false;resume();}
    function blur(){blurred=true;pause();}
    function focus(){blurred=false;handedOff=false;resume();}
    var listeners=[['pagehide',hide],['pageshow',show],['blur',blur],['focus',focus]];
    var session={
      ready:ready,
      assertHeld:function(){if(!lease)throw new Error('当前页面已暂停写入，请返回此页面后继续。');lease.assertHeld();},
      status:function(){return status;},
      resume:resume,
      close:function(){closed=true;release();status='paused';if(channel)channel.close();listeners.forEach(function(pair){if(browser.removeEventListener)browser.removeEventListener(pair[0],pair[1]);});if(document.removeEventListener)document.removeEventListener('visibilitychange',hidden);}
    };
    // Install before requesting: navigation/hiding can happen while acquiring.
    listeners.forEach(function(pair){browser.addEventListener(pair[0],pair[1]);});
    document.addEventListener('visibilitychange',hidden);
    if(browser.BroadcastChannel){
      try{channel=new browser.BroadcastChannel('youxitong-prototype-writer-transfer-v1');
        channel.onmessage=function(event){
          var request=event.data;
          if(closed||!request||!Number.isSafeInteger(request.version)||request.version<=0)return;
          if(request.type==='writer-version'&&request.target===clientId&&requestedTransfer&&active()&&request.version>=handoffVersion){
            handoffVersion=request.version;resume(true);return;
          }
          if(request.type==='request-writer'&&typeof request.owner==='string'){
            if(request.version>handoffVersion||(request.version===handoffVersion&&request.owner>handoffOwner)){
              handoffVersion=request.version;handoffOwner=request.owner;requestedTransfer=false;handedOff=true;pause();
            }else if(request.owner!==clientId){
              channel.postMessage({type:'writer-version',target:request.owner,version:handoffVersion});
            }
          }
        };
      }catch(ignore){channel=null;}
    }
    resume();
    return session;
  }
  function create(storage, engine, writer) {
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
      if(writer)writer.assertHeld();
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
  var api = {create:create, acquireWriter:acquireWriter, manageWriter:manageWriter, STATE_KEY:STATE_KEY, BACKUP_KEY:BACKUP_KEY, CATALOG_KEY:CATALOG_KEY, BUSINESS_KEY:BUSINESS_KEY};
  global.YouxitongPrototypeStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
