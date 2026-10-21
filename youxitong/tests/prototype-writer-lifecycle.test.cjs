const {test}=require('node:test');
const assert=require('node:assert/strict');
const {acquireWriter,manageWriter,create,STATE_KEY,BACKUP_KEY}=require('../prototype-storage.js');
const engine=require('../prototype-reset-data.js');

const WRITER_NAME='youxitong-prototype-writer-v1';
const flush=()=>new Promise(resolve=>setImmediate(resolve));

// All simulated documents share this manager. A callback owns its lock until
// the Promise it returns settles, matching the Web Locks lifetime contract.
function lockManager({deferred=false}={}){
  const held=new Map(),deliveries=[],calls=[];
  let defer=deferred;
  const manager={
    calls,
    heldCount:()=>held.size,
    defer(value){defer=value;},
    deliver(){for(const deliver of deliveries.splice(0))deliver();},
    request(name,options,callback){
      calls.push({name,options:{...options}});
      assert.equal(name,WRITER_NAME);
      assert.equal(options.mode,'exclusive');
      assert.equal(options.ifAvailable,true);
      assert.notEqual(options.steal,true,'a managed page must never steal a legacy lock');
      return new Promise((resolve,reject)=>{
        const deliver=()=>{
          if(held.has(name)){
            try{Promise.resolve(callback(null)).then(resolve,reject);}catch(error){reject(error);}
            return;
          }
          const lock={name,mode:'exclusive'};
          held.set(name,lock);
          const release=()=>{if(held.get(name)===lock)held.delete(name);};
          try{
            Promise.resolve(callback(lock)).then(value=>{release();resolve(value);},error=>{release();reject(error);});
          }catch(error){release();reject(error);}
        };
        if(defer)deliveries.push(deliver);else queueMicrotask(deliver);
      });
    }
  };
  return manager;
}

function eventTarget(){
  const listeners=new Map();
  return {
    addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(callback);},
    removeEventListener(type,callback){listeners.get(type)?.delete(callback);},
    emit(type,event={}){for(const callback of [...(listeners.get(type)||[])])callback(event);}
  };
}

function broadcastHub(){
  const channels=new Set(),deliveries=[],messages=[];
  class BroadcastChannel{
    constructor(name){this.name=name;this.onmessage=null;this.closed=false;channels.add(this);}
    postMessage(data){
      assert.equal(this.closed,false,'a closed channel cannot request a handoff');
      messages.push({name:this.name,data});
      for(const peer of channels){
        if(peer!==this&&peer.name===this.name){
          const message=JSON.parse(JSON.stringify(data));
          deliveries.push(()=>{if(!peer.closed&&peer.onmessage)peer.onmessage({data:message});});
        }
      }
    }
    close(){this.closed=true;channels.delete(this);}
  }
  return {BroadcastChannel,messages,openCount:()=>channels.size,async deliver({reverse=false}={}){
    let rounds=0;
    while(deliveries.length){
      assert.ok(++rounds<=32,'broadcast negotiation must settle without an endless request/version loop');
      const batch=deliveries.splice(0);if(reverse)batch.reverse();for(const deliver of batch)deliver();
      await flush();
    }
  }};
}

function browserFor(locks,{visibility='visible',BroadcastChannel}={}){
  const timers=new Map();let timerId=0;
  const document={...eventTarget(),visibilityState:visibility};
  return {
    ...eventTarget(),document,navigator:{locks},BroadcastChannel,
    setTimeout(callback,delay){assert.equal(delay,1000);timers.set(++timerId,callback);return timerId;},
    clearTimeout(id){timers.delete(id);},
    timerCount:()=>timers.size,
    retry(){const callbacks=[...timers.values()];timers.clear();for(const callback of callbacks)callback();},
    visibility(value){document.visibilityState=value;document.emit('visibilitychange');}
  };
}

function storage(){
  const data=new Map();
  return {data,getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,value)};
}

function inputs(){
  return [{catalog:{floors:[],sites:[],orders:[],mappings:{},drafts:{}},orgs:[{id:'org-hotel-yunqi',type:'hotel'}],users:[{id:'u'}],qty:{}},
    {categories:[],products:[],entries:[],receipts:[]}];
}

function initialize(store,writer){
  const controller=create(store,engine,writer),[catalog,business]=inputs();
  const snapshot=controller.initialize(controller.readCatalog()||catalog,controller.readBusiness()||business);
  return {controller,snapshot};
}

test('a released lease loses write authority synchronously and frees the shared lock',async()=>{
  const locks=lockManager(),navigator={locks};
  const first=await acquireWriter(navigator);
  assert.doesNotThrow(()=>first.assertHeld());
  await assert.rejects(acquireWriter(navigator),error=>error.code==='WRITER_BUSY');
  first.release();first.release();
  assert.throws(()=>first.assertHeld(),/暂停写入/);
  await flush();assert.equal(locks.heldCount(),0);
  const second=await acquireWriter(navigator);
  assert.doesNotThrow(()=>second.assertHeld());
  second.release();await flush();assert.equal(locks.heldCount(),0);
});

test('visible pages remain mutually exclusive and automatically recover after focus moves',async t=>{
  const locks=lockManager(),a=browserFor(locks),b=browserFor(locks);
  const first=manageWriter(a),second=manageWriter(b);
  t.after(()=>{first.close();second.close();});
  await first.ready;await flush();
  assert.equal(second.status(),'waiting');assert.equal(b.timerCount(),1);
  assert.throws(()=>second.assertHeld(),/暂停写入/);
  a.emit('blur');assert.throws(()=>first.assertHeld(),/暂停写入/);
  await flush();b.retry();await second.ready;
  assert.equal(second.status(),'active');assert.equal(locks.heldCount(),1);
  a.emit('focus');await flush();
  assert.equal(first.status(),'waiting');assert.equal(a.timerCount(),1);
  b.emit('blur');await flush();a.retry();await flush();
  assert.equal(first.status(),'active');assert.equal(second.status(),'paused');
  assert.equal(locks.heldCount(),1);assert.doesNotThrow(()=>first.assertHeld());
});

test('BFCache pagehide releases the lease and pageshow reacquires without changing stored data',async t=>{
  const locks=lockManager(),browser=browserFor(locks),writer=manageWriter(browser);
  t.after(()=>writer.close());await writer.ready;
  const store=storage(),{controller,snapshot}=initialize(store,writer),before=store.getItem(STATE_KEY);
  browser.emit('pagehide',{persisted:true});
  assert.equal(writer.status(),'paused');assert.throws(()=>controller.assertCurrent(),/暂停写入/);
  await flush();assert.equal(locks.heldCount(),0);
  browser.emit('focus');await flush();assert.equal(locks.calls.length,1,'focus cannot reactivate a page that has left');
  browser.emit('pageshow',{persisted:true});await flush();
  assert.equal(writer.status(),'active');assert.equal(locks.heldCount(),1);
  assert.doesNotThrow(()=>controller.save(snapshot.catalogSnapshot,snapshot.businessSnapshot));
  assert.equal(store.getItem(STATE_KEY),before,'a restored no-op snapshot must not create a revision');
});

for(const transition of ['hidden','pagehide','close']){
  test(`a delayed grant after ${transition} is released without activating the old page`,async t=>{
    const locks=lockManager({deferred:true}),browser=browserFor(locks),statuses=[];
    const writer=manageWriter(browser,status=>statuses.push(status));
    t.after(()=>writer.close());
    if(transition==='hidden')browser.visibility('hidden');
    else if(transition==='pagehide')browser.emit('pagehide',{persisted:true});
    else writer.close();
    locks.deliver();await flush();
    assert.equal(locks.heldCount(),0);assert.ok(!statuses.includes('active'));
    assert.throws(()=>writer.assertHeld(),/暂停写入/);
    locks.defer(false);
    const replacement=manageWriter(browserFor(locks));t.after(()=>replacement.close());
    await replacement.ready;assert.doesNotThrow(()=>replacement.assertHeld());
  });
}

test('repeated focus and pageshow events neither duplicate a held lease nor pending requests',async t=>{
  const locks=lockManager({deferred:true}),browser=browserFor(locks),writer=manageWriter(browser);
  t.after(()=>writer.close());
  for(let i=0;i<5;i++){browser.emit('focus');browser.emit('pageshow');writer.resume();}
  assert.equal(locks.calls.length,1);
  locks.deliver();await writer.ready;
  for(let i=0;i<5;i++){browser.emit('focus');browser.emit('pageshow');writer.resume();}
  assert.equal(locks.calls.length,1);assert.equal(locks.heldCount(),1);
  browser.visibility('hidden');await flush();
  browser.emit('focus');writer.resume();assert.equal(locks.calls.length,1);
  browser.visibility('visible');
  for(let i=0;i<5;i++){browser.emit('focus');writer.resume();}
  assert.equal(locks.calls.length,2);
  locks.deliver();await flush();assert.equal(writer.status(),'active');assert.equal(locks.heldCount(),1);
});

test('storage rejects initialization after release before creating either backup or state',async t=>{
  const locks=lockManager(),browser=browserFor(locks),writer=manageWriter(browser);
  t.after(()=>writer.close());await writer.ready;
  const store=storage(),controller=create(store,engine,writer);
  browser.visibility('hidden');
  assert.throws(()=>controller.initialize(...inputs()),/暂停写入/);
  assert.equal(store.getItem(BACKUP_KEY),null);assert.equal(store.getItem(STATE_KEY),null);
});

test('released and subsequently stale writers cannot overwrite a newer snapshot without storage events',async t=>{
  const locks=lockManager(),a=browserFor(locks),b=browserFor(locks),first=manageWriter(a);
  t.after(()=>first.close());await first.ready;
  const store=storage(),old=initialize(store,first),before=store.getItem(STATE_KEY);
  a.visibility('hidden');
  old.snapshot.catalogSnapshot.catalog.orders.push({id:'stale'});
  assert.throws(()=>old.controller.save(old.snapshot.catalogSnapshot,old.snapshot.businessSnapshot),/暂停写入/);
  assert.equal(store.getItem(STATE_KEY),before);
  await flush();const second=manageWriter(b);t.after(()=>second.close());await second.ready;
  const current=initialize(store,second);
  current.snapshot.catalogSnapshot.catalog.orders.push({id:'fresh'});
  current.controller.save(current.snapshot.catalogSnapshot,current.snapshot.businessSnapshot);
  const committed=store.getItem(STATE_KEY);
  b.visibility('hidden');await flush();a.visibility('visible');await flush();
  assert.equal(first.status(),'active');assert.doesNotThrow(()=>first.assertHeld());
  assert.throws(()=>old.controller.assertCurrent(),/其他标签页/);
  assert.throws(()=>old.controller.save(old.snapshot.catalogSnapshot,old.snapshot.businessSnapshot),/其他标签页/);
  assert.equal(store.getItem(STATE_KEY),committed);
  assert.deepEqual(JSON.parse(committed).catalogSnapshot.catalog.orders,[{id:'fresh'}]);
});

test('an old lifetime lock is never stolen and retry stops while the new page is hidden',async t=>{
  const locks=lockManager();
  // This deliberately never settles: it represents a still-open old release.
  locks.request(WRITER_NAME,{mode:'exclusive',ifAvailable:true},()=>new Promise(()=>{}));
  await flush();const browser=browserFor(locks),writer=manageWriter(browser);
  t.after(()=>writer.close());await flush();
  for(let i=0;i<3;i++){assert.equal(browser.timerCount(),1);browser.retry();await flush();}
  assert.equal(writer.status(),'waiting');assert.equal(locks.heldCount(),1);
  assert.throws(()=>writer.assertHeld(),/暂停写入/);
  assert.ok(locks.calls.every(call=>call.name===WRITER_NAME&&call.options.steal!==true));
  const attempts=locks.calls.length;
  browser.visibility('hidden');assert.equal(browser.timerCount(),0);browser.retry();await flush();
  assert.equal(locks.calls.length,attempts);
});

test('unsupported Web Locks reject readiness and preserve the write guard',async t=>{
  const browser=browserFor(undefined),writer=manageWriter(browser);
  t.after(()=>writer.close());await assert.rejects(writer.ready,/不支持/);
  assert.equal(writer.status(),'error');assert.throws(()=>writer.assertHeld(),/暂停写入/);
  assert.equal(browser.timerCount(),0);
});

test('manual handoff works without hidden or blur and immediately disables the previous writer',async t=>{
  const locks=lockManager(),hub=broadcastHub(),a=browserFor(locks,hub),b=browserFor(locks,hub);
  const first=manageWriter(a);t.after(()=>first.close());await first.ready;
  const store=storage(),old=initialize(store,first);
  const second=manageWriter(b);t.after(()=>second.close());await flush();
  assert.equal(first.status(),'active');assert.equal(second.status(),'waiting');
  second.resume(true);
  assert.equal(hub.messages.length,1);assert.equal(hub.messages[0].name,'youxitong-prototype-writer-transfer-v1');
  assert.equal(hub.messages[0].data.type,'request-writer');assert.ok(Number.isSafeInteger(hub.messages[0].data.version));
  assert.equal(typeof hub.messages[0].data.owner,'string');assert.ok(hub.messages[0].data.owner);
  await hub.deliver();
  assert.equal(first.status(),'paused');assert.equal(a.timerCount(),0);
  assert.throws(()=>first.assertHeld(),/暂停写入/);
  assert.throws(()=>old.controller.save(old.snapshot.catalogSnapshot,old.snapshot.businessSnapshot),/暂停写入/);
  await flush();b.retry();await second.ready;
  assert.equal(second.status(),'active');assert.equal(locks.heldCount(),1);
  assert.equal(a.document.visibilityState,'visible');assert.equal(b.document.visibilityState,'visible');
  const current=initialize(store,second);
  current.snapshot.catalogSnapshot.catalog.orders.push({id:'after-handoff'});
  current.controller.save(current.snapshot.catalogSnapshot,current.snapshot.businessSnapshot);
  const committed=store.getItem(STATE_KEY),requests=locks.calls.length;
  for(let i=0;i<3;i++){first.resume();a.retry();await flush();}
  assert.equal(first.status(),'paused');assert.equal(locks.calls.length,requests,'the old page cannot automatically request the lock again');
  second.close();await flush();first.resume();a.retry();await flush();
  assert.equal(locks.heldCount(),0,'handoff remains in effect even after the new owner closes');
  assert.equal(locks.calls.length,requests);
  first.resume(true);await hub.deliver();await flush();
  assert.equal(first.status(),'active');
  assert.throws(()=>old.controller.save(old.snapshot.catalogSnapshot,old.snapshot.businessSnapshot),/其他标签页/);
  assert.equal(store.getItem(STATE_KEY),committed,'manual reacquisition cannot revive an old snapshot');
  first.close();assert.equal(hub.openCount(),0);
});

test('a pending old page releases a late grant after receiving a manual handoff request',async t=>{
  const locks=lockManager({deferred:true}),hub=broadcastHub(),a=browserFor(locks,hub),b=browserFor(locks,hub);
  const first=manageWriter(a),second=manageWriter(b);
  t.after(()=>{first.close();second.close();});
  second.resume(true);await hub.deliver();
  assert.equal(first.status(),'paused');
  locks.deliver();await flush();
  assert.throws(()=>first.assertHeld(),/暂停写入/);assert.equal(locks.heldCount(),0);
  const requests=locks.calls.length;first.resume();a.retry();assert.equal(locks.calls.length,requests);
  locks.defer(false);b.retry();await second.ready;
  assert.equal(second.status(),'active');assert.equal(locks.heldCount(),1);
});

test('manual handoff cannot bypass a legacy lifetime lock with no channel listener',async t=>{
  const locks=lockManager(),hub=broadcastHub();
  locks.request(WRITER_NAME,{mode:'exclusive',ifAvailable:true},()=>new Promise(()=>{}));
  await flush();
  const browser=browserFor(locks,hub),writer=manageWriter(browser);
  t.after(()=>writer.close());await flush();
  for(let i=0;i<3;i++){writer.resume(true);await hub.deliver();await flush();browser.retry();await flush();}
  assert.equal(hub.messages.length,3);assert.equal(writer.status(),'waiting');
  assert.throws(()=>writer.assertHeld(),/暂停写入/);assert.equal(locks.heldCount(),1);
  assert.ok(locks.calls.every(call=>call.name===WRITER_NAME&&call.options.steal!==true));
  const store=storage(),controller=create(store,engine,writer);
  assert.throws(()=>controller.initialize(...inputs()),/暂停写入/);
  assert.equal(store.getItem(BACKUP_KEY),null);assert.equal(store.getItem(STATE_KEY),null);
});

for(const reverse of [false,true]){
  test(`simultaneous handoff requests elect exactly one writer with ${reverse?'reversed':'normal'} delivery order`,async t=>{
    t.mock.method(Date,'now',()=>1800000000000);
    const locks=lockManager(),hub=broadcastHub(),browsers=[browserFor(locks,hub),browserFor(locks,hub),browserFor(locks,hub)];
    const first=manageWriter(browsers[0]);await first.ready;
    const contenders=[manageWriter(browsers[1]),manageWriter(browsers[2])];
    t.after(()=>[first,...contenders].forEach(writer=>writer.close()));await flush();
    contenders[0].resume(true);contenders[1].resume(true);await hub.deliver({reverse});await flush();
    for(const browser of browsers)browser.retry();await flush();
    assert.equal(first.status(),'paused');
    assert.deepEqual(contenders.map(writer=>writer.status()).sort(),['active','paused']);
    assert.equal(locks.heldCount(),1);
    assert.ok(hub.messages.length<=8,'concurrent requesters must converge without continuously raising the version');
    const active=contenders.findIndex(writer=>writer.status()==='active');
    const requests=hub.messages.map(message=>message.data);
    const winner=requests[0].version>requests[1].version||requests[0].version===requests[1].version&&requests[0].owner>requests[1].owner?0:1;
    assert.equal(active,winner,'all documents must agree on the newest request');
    assert.doesNotThrow(()=>contenders[active].assertHeld());
    assert.throws(()=>contenders[1-active].assertHeld(),/暂停写入/);
  });
}

test('a newly opened page can take over after earlier handoffs have advanced the version',async t=>{
  t.mock.method(Date,'now',()=>1800000000000);
  const locks=lockManager(),hub=broadcastHub(),a=browserFor(locks,hub),first=manageWriter(a);
  t.after(()=>first.close());await first.ready;
  first.resume(true);first.resume(true);await hub.deliver();await flush();
  const browser=browserFor(locks,hub),newcomer=manageWriter(browser);
  t.after(()=>newcomer.close());await flush();
  newcomer.resume(true);await hub.deliver();await flush();browser.retry();await flush();
  assert.equal(newcomer.status(),'active','first manual takeover from a new document must not require repeated clicks');
  assert.equal(first.status(),'paused');assert.equal(locks.heldCount(),1);
});
