const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create,STATE_KEY,BACKUP_KEY,CATALOG_KEY,BUSINESS_KEY}=require('../prototype-storage.js');
const engine=require('../prototype-reset-data.js');
function storage(seed={}){
  const data=new Map(Object.entries(seed));
  return {data,fail:'',getItem:k=>data.has(k)?data.get(k):null,setItem(k,v){if(k===this.fail)throw new Error('disk full');data.set(k,v);}};
}
function inputs(){return [{catalog:{floors:[],sites:[],orders:[{id:'old'}],mappings:{},drafts:{}},orgs:[{id:'org-hotel-yunqi',type:'hotel'}],users:[{id:'u'}],qty:{}},{categories:[],products:[],entries:[],receipts:[{token:'missing-floor'}]}];}
function seed(){const [c,b]=inputs();return {[CATALOG_KEY]:JSON.stringify(c),[BUSINESS_KEY]:JSON.stringify(b),'another-project':'untouched'};}
function init(store){const c=create(store,engine);return {c,result:c.initialize(c.readCatalog(),c.readBusiness())};}
test('backs up original strings, commits both snapshots and leaves unrelated storage intact',()=>{
 const s=storage(seed()),old=seed();const {result}=init(s);
 assert.equal(result.catalogSnapshot.catalog.orders.length,0);assert.equal(result.businessSnapshot.receipts.length,0);
 assert.equal(result.businessSnapshot.balances['org-hotel-yunqi'],2000000);
 const backup=JSON.parse(s.getItem(BACKUP_KEY));assert.equal(backup.catalog,old[CATALOG_KEY]);assert.equal(backup.business,old[BUSINESS_KEY]);assert.equal(s.getItem('another-project'),'untouched');
});
test('backup or commit failure cannot partially reset either snapshot; retry succeeds once',()=>{
 for(const key of [BACKUP_KEY,STATE_KEY]){const s=storage(seed());s.fail=key;assert.throws(()=>init(s),/disk full/);assert.equal(s.getItem(STATE_KEY),null);assert.equal(s.getItem(CATALOG_KEY),seed()[CATALOG_KEY]);s.fail='';init(s);assert.equal(JSON.parse(s.getItem(STATE_KEY)).revision,1);}
});
test('new data survives reload and old-version tabs writing legacy keys cannot restore history',()=>{
 const s=storage(seed()),{c,result}=init(s),backup=s.getItem(BACKUP_KEY);
 result.catalogSnapshot.catalog.orders.push({id:'new'});result.businessSnapshot.v19.floorInitials={f:50};
 c.save(result.catalogSnapshot,result.businessSnapshot);
 s.setItem(CATALOG_KEY,seed()[CATALOG_KEY]);s.setItem(BUSINESS_KEY,seed()[BUSINESS_KEY]);
 const next=init(s).result;assert.deepEqual(next.catalogSnapshot.catalog.orders,[{id:'new'}]);assert.equal(next.businessSnapshot.v19.floorInitials.f,50);assert.equal(s.getItem(BACKUP_KEY),backup);assert.equal(next.businessSnapshot.entries.length,1);
});
test('stale current-version tab and concurrent initialization cannot overwrite committed changes',()=>{
 const s=storage(seed());const first=create(s,engine),second=create(s,engine),[cat,biz]=inputs();first.initialize(cat,biz);assert.throws(()=>second.initialize(cat,biz),/其他标签页/);
 const a=init(s),b=init(s);a.result.catalogSnapshot.catalog.orders.push({id:'fresh'});a.c.save(a.result.catalogSnapshot,a.result.businessSnapshot);assert.throws(()=>b.c.save(b.result.catalogSnapshot,b.result.businessSnapshot),/其他标签页/);assert.equal(init(s).result.catalogSnapshot.catalog.orders[0].id,'fresh');
});
test('invalid legacy JSON, invalid shape and unknown money fail without committing or backing up',()=>{
 const s=storage(seed());s.setItem(BUSINESS_KEY,'{');assert.throws(()=>init(s),/无法读取/);assert.equal(s.getItem(STATE_KEY),null);
 s.setItem(BUSINESS_KEY,'{}');assert.throws(()=>init(s),/结构不完整/);
 const b=inputs()[1];b.entries=[{hotel:'org-hotel-yunqi',type:'unknown',cents:100}];s.setItem(BUSINESS_KEY,JSON.stringify(b));assert.throws(()=>init(s),/未知资金/);assert.equal(s.getItem(STATE_KEY),null);assert.equal(s.getItem(BACKUP_KEY),null);
});
test('exclusive browser writer lease blocks simultaneous tabs and never falls back without Web Locks',async()=>{
 const {acquireWriter}=require('../prototype-storage.js');let held=false;
 const navigator={locks:{request:async(name,options,callback)=>{assert.equal(name,'youxitong-prototype-writer-v1');assert.equal(options.ifAvailable,true);if(held)return callback(null);held=true;return callback({name});}}};
 const lease=await acquireWriter(navigator);await assert.rejects(()=>acquireWriter(navigator),{code:'WRITER_BUSY'});lease.release();await assert.rejects(()=>acquireWriter({}),/不支持/);
});
test('no-op save does not invalidate other observers',()=>{const s=storage(seed()),{c,result}=init(s);const raw=s.getItem(STATE_KEY);c.save(result.catalogSnapshot,result.businessSnapshot);assert.equal(s.getItem(STATE_KEY),raw);});

test('legacy recharge retry preserves exact backup and never reruns a completed reset',()=>{
 const [cat,biz]=inputs();biz.entries=[{hotel:'org-hotel-yunqi',cents:12345,after:1280345,bank:'0001-OLD',note:'',time:'2026/9/12 10:00:00'}];
 const raw=JSON.stringify(biz),s=storage({[CATALOG_KEY]:JSON.stringify(cat),[BUSINESS_KEY]:raw});
 const {c,result}=init(s);assert.equal(JSON.parse(s.getItem(BACKUP_KEY)).business,raw);assert.equal(s.getItem(BUSINESS_KEY),raw);
 assert.equal(result.businessSnapshot.entries[0].type,'线下充值');assert.equal(result.businessSnapshot.balances['org-hotel-yunqi'],2012345);
 result.catalogSnapshot.catalog.orders.push({id:'AFTER-RESET'});c.save(result.catalogSnapshot,result.businessSnapshot);
 const before=s.getItem(STATE_KEY),backup=s.getItem(BACKUP_KEY);init(s);
 assert.equal(s.getItem(STATE_KEY),before);assert.equal(s.getItem(BACKUP_KEY),backup);
});
