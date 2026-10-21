const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const reset = require('../prototype-reset-data.js');

function fixture() {
  const hotel = 'org-hotel-yunqi';
  return {
    catalogSnapshot: {
      catalog: {floors: [{id:'f1', hotel, name:'1F'}], sites:[{id:'s1',factory:'factory'}], mappings:{[hotel]:'s1'},
        orders:[{id:'RP1',hotel,total:706},{id:'RP2',hotel:'hotel-2',total:369.60}],
        terminalBatches:[{reference:'T1',order:'RP1'}], selection:{[hotel]:'f1'}, drafts:{[hotel]:{duvet:2}},
        draft:{kind:'dispatch',id:'RP1'}, hotel, next:42},
      orgs:[{id:hotel,type:'hotel',name:'云栖'},{id:'hotel-2',type:'hotel',name:'另一酒店'},{id:'factory',type:'factory'}],
      users:[{id:'admin',org:hotel,role:'hotel_admin'}],identityNext:10,qty:{duvet:2},extra:{keep:true}
    },
    businessSnapshot: {
      categories:['清洁'],products:[{id:'p1',stock:12,price:3900}], next:10,
      entries:[],balances:{[hotel]:1268000,'hotel-2':123},
      linenPrices:{hotel:{[hotel+'|duvet']:800},factory:{'factory|duvet':550}},prices:[{hotel,sku:'duvet',hotelPrice:800}],
      receipts:[{token:'IN1',hotel,quantity:10}],returnRequests:[{id:'RT1',order:'RP1'}],linenRefunds:[{id:'LR1',order:'RP1'}],
      quotaEvents:[{token:'Q1',hotel}],hotelLinen:{[hotel+'|duvet']:{cap:100}},quotas:{[hotel+'|duvet']:{amount:100}},
      recharges:[{id:'PENDING',hotel,cents:99999,status:'PENDING'},{id:'DONE',hotel,cents:5000,status:'APPROVED'}],
      storeOrders:[{no:'SO1',hotel,cents:3900}],
      v19:{floorCaps:{'f1|duvet':100},floorInitials:{'f1|duvet':80},floorBindings:{f1:'admin'},
        categories:[{id:'duvet',name:'被套'}],chips:[{chip:'E1',sku:'duvet'}],payments:[{id:'WX1',status:'SUCCESS',cents:50000}],
        audit:[{kind:'楼层初始化额度',after:80},{kind:'原型入库楼层归属核定',subject:'IN1'},
          {kind:'历史业务核对',subject:'RP1'},{kind:'楼层限额与人员绑定',subject:'f1'},
          {kind:'布草品类',subject:'duvet'}],custom:{unchanged:true}},
      v191:{batches:[{id:'REG',mode:'REGISTER'},{id:'STOCK',mode:'STOCKING',order:'RP1'},
        {id:'DAILY',mode:'DAILY'},{id:'RETURN',mode:'REFUND',request:'RT1'},
        {id:'LINK',mode:'LEGACY',document:'IN1'}],chips:[{epc:'E2'}],archives:[{epc:'E3'}]},
      v193:{assets:[{epc:'SAMPLE',sample:true}],events:[{id:'SAMPLE-1',document:'RP-SAMPLE-1-1'}]},
      custom:{preserve:'configuration'}
    }
  };
}
function run(f) { return reset.prepare(f.catalogSnapshot, f.businessSnapshot); }
function recharge(hotel, cents, extra={}) { return {hotel,cents,type:'线下充值',...extra}; }
function legacyRecharge(extra={}) { return {hotel:'org-hotel-yunqi',cents:12345,after:1280345,bank:'0001-OLD',note:'历史直接充值',time:'2026/9/12 10:00:00',...extra}; }
function deepFreeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }

test('browser and Node export the same contract without browser/storage dependencies', () => {
  assert.equal(reset.VERSION,'linen-restart-20261020-v1');
  assert.equal(global.YouxitongResetData,reset);
  const context={module:{exports:{}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../prototype-reset-data.js'),'utf8'),context);
  assert.equal(context.YouxitongResetData,context.module.exports);
  assert.equal(typeof context.YouxitongResetData.prepare,'function');
});

test('clears the linen chain for every hotel without mutating either input', () => {
  const f=deepFreeze(fixture()), before=JSON.stringify(f), result=run(f), c=result.catalogSnapshot, b=result.businessSnapshot;
  assert.equal(JSON.stringify(f),before);
  for (const key of ['orders','terminalBatches']) assert.deepEqual(c.catalog[key],[]);
  for (const key of ['selection','drafts']) assert.deepEqual(c.catalog[key],{});
  assert.equal(c.catalog.draft,null);assert.deepEqual(c.qty,{});
  for (const key of ['receipts','returnRequests','linenRefunds','quotaEvents']) assert.deepEqual(b[key],[]);
  for (const key of ['hotelLinen','quotas']) assert.deepEqual(b[key],{});
  assert.deepEqual(b.v19.floorCaps,{});assert.deepEqual(b.v19.floorInitials,{});
  assert.deepEqual(b.v19.audit,[{kind:'楼层限额与人员绑定',subject:'f1'},{kind:'布草品类',subject:'duvet'}]);
  assert.deepEqual(b.v191.batches,[{id:'REG',mode:'REGISTER'}]);
  assert.equal(result.summary.removed.orders,2);assert.equal(result.summary.removed.v191Batches,4);
  assert.equal(result.summary.removed.v19Audit,3);
});

test('preserves identities, operating configuration, recharge/payment records, store data and independent assets', () => {
  const f=fixture(), r=run(f), c=r.catalogSnapshot, b=r.businessSnapshot;
  for (const key of ['orgs','users','identityNext','extra']) assert.deepEqual(c[key],f.catalogSnapshot[key]);
  for (const key of ['floors','sites','mappings','hotel','next']) assert.deepEqual(c.catalog[key],f.catalogSnapshot.catalog[key]);
  for (const key of ['categories','products','prices','linenPrices','recharges','storeOrders','v193','custom']) assert.deepEqual(b[key],f.businessSnapshot[key]);
  for (const key of ['floorBindings','categories','chips','payments','custom']) assert.deepEqual(b.v19[key],f.businessSnapshot.v19[key]);
  assert.deepEqual(b.v191.chips,f.businessSnapshot.v191.chips);assert.deepEqual(b.v191.archives,f.businessSnapshot.v191.archives);
});

test('rebuilds balances from posted recharge/store entries in stored chronology, without request/payment replay', () => {
  const f=fixture(), h='org-hotel-yunqi';
  f.businessSnapshot.entries=[
    {hotel:h,type:'退污退款',cents:800,businessKey:'linen-refund:LR1'},
    recharge('hotel-2',7000,{id:'E4',type:'平台直接充值',businessKey:'direct-recharge:2',time:'same'}),
    {hotel:h,type:'商城订单扣款',cents:-3900,bank:'SO1',time:'locale timestamp'},
    recharge(h,5000,{id:'E2',type:'微信充值',businessKey:'wechat-prototype:WX2',time:'same'}),
    {hotel:h,type:'布草订单扣款',cents:-70600,bank:'RP1'},
    recharge(h,10000,{id:'E1',bank:'BANK-NEW',after:99999999,time:'unparsed'})
  ];
  const r=run(f), b=r.businessSnapshot;
  assert.deepEqual(b.balances,{[h]:2011100,'hotel-2':7000});
  assert.deepEqual(b.entries.map(e=>e.after),[7000,2011100,2015000,2010000,2000000]);
  assert.equal(b.entries.at(-1).businessKey,'prototype-opening-recharge:yunqi');
  assert.equal(r.summary.removed.linenEntries,2);
  assert.equal(r.summary.openingRechargeAdded,true);
});

test('sample orders never add refunds and the old 12680 balance is never carried forward', () => {
  const r=run(fixture());
  assert.deepEqual(r.businessSnapshot.balances,{'org-hotel-yunqi':2000000,'hotel-2':0});
  assert.equal(r.businessSnapshot.entries.length,1);
});

test('a previously persisted opening bank entry is normalized without adding another recharge', () => {
  const f=fixture();
  f.businessSnapshot.entries=[recharge('org-hotel-yunqi',2000000,{id:'existing',bank:' bank-20260901-01 ',after:1338600})];
  const r=run(f);
  assert.equal(r.businessSnapshot.entries.length,1);assert.equal(r.summary.openingRechargeAdded,false);
  assert.equal(r.businessSnapshot.entries[0].businessKey,'prototype-opening-recharge:yunqi');
  assert.equal(r.businessSnapshot.entries[0].bank,'BANK-20260901-01');
  assert.equal(r.businessSnapshot.entries[0].id,'existing');
  assert.equal(r.businessSnapshot.entries[0].after,2000000);
});

test('deduplicates identical posted entries while rejecting conflicting business identity or opening amounts', () => {
  const f=fixture(), e=recharge('org-hotel-yunqi',100,{id:'E1',businessKey:'recharge-request:RC1',bank:'BANK-X'});
  f.businessSnapshot.entries=[{...e,after:300},{...e,after:100}];
  const r=run(f);assert.equal(r.businessSnapshot.balances['org-hotel-yunqi'],2000100);assert.equal(r.summary.removed.duplicateEntries,1);
  f.businessSnapshot.entries[1].cents=200;assert.throws(()=>run(f),/重复业务标识内容冲突/);
  f.businessSnapshot.entries=[recharge('org-hotel-yunqi',2000001,{bank:'BANK-20260901-01'})];
  assert.throws(()=>run(f),/样例充值.*金额冲突/);
});

test('rejects unknown funding, invalid amounts, sign conflicts and nonposted entries with concrete errors', () => {
  const cases=[
    [{hotel:'org-hotel-yunqi',type:'手动调整',cents:1},/未知资金类型.*手动调整/],
    [recharge('org-hotel-yunqi',1.2),/安全整数分/],
    [recharge('org-hotel-yunqi',NaN),/安全整数分/],
    [recharge('org-hotel-yunqi',Number.MAX_SAFE_INTEGER+1),/安全整数分/],
    [recharge('org-hotel-yunqi',0),/充值金额必须大于零/],
    [recharge('org-hotel-yunqi',-1),/充值金额必须大于零/],
    [recharge('org-hotel-yunqi',1,{approvalStatus:'PENDING'}),/不是已入账状态/],
    [{hotel:'org-hotel-yunqi',type:'商城订单扣款',cents:1,bank:'SO1'},/商城扣款金额必须小于零/],
    [{hotel:'org-hotel-yunqi',type:'商城订单扣款',cents:0,bank:'SO1'},/商城扣款金额必须小于零/],
    [{hotel:'org-hotel-yunqi',type:'退污退款',cents:-1},/资金方向与类型冲突/],
    [recharge('org-hotel-yunqi',1,{businessKey:'linen-refund:RT1'}),/标识与资金类型冲突/],
    [recharge('missing-hotel',1),/未知酒店/]
  ];
  for (const [entry,error] of cases) { const f=fixture();f.businessSnapshot.entries=[entry];assert.throws(()=>run(f),error); }
  const f=fixture();f.businessSnapshot.entries=[recharge('org-hotel-yunqi',Number.MAX_SAFE_INTEGER)];
  assert.throws(()=>run(f),/余额超出安全整数范围/);
});

test('known return keys are removed, even for the older ledger shape without a type', () => {
  const f=fixture();f.businessSnapshot.entries=[
    {hotel:'org-hotel-yunqi',cents:300,businessKey:'return-complete:RT1'},
    {hotel:'org-hotel-yunqi',cents:0,type:'退污退款',businessKey:'linen-refund:FREE'},
    {hotel:'org-hotel-yunqi',cents:0,type:'布草订单扣款',bank:'RP-FREE'}
  ];
  assert.equal(run(f).summary.removed.linenEntries,3);
});

test('recognizes the original six-field offline recharge without changing the source snapshot', () => {
  const f=fixture(), old=legacyRecharge();
  f.businessSnapshot.entries=[old];deepFreeze(f);
  const r=run(f), saved=r.businessSnapshot.entries[0];
  assert.deepEqual(old,legacyRecharge());assert.equal(saved.type,'线下充值');
  for(const key of ['hotel','cents','bank','note','time'])assert.equal(saved[key],old[key]);
  assert.equal(saved.after,2012345);assert.equal(r.businessSnapshot.balances[old.hotel],2012345);
  assert.equal(r.summary.normalizedLegacyRecharges,1);
  assert.equal(run({catalogSnapshot:r.catalogSnapshot,businessSnapshot:r.businessSnapshot}).summary.normalizedLegacyRecharges,0);
});

test('legacy recharge normalization retains bank deduplication and conflict detection', () => {
  const f=fixture(), old=legacyRecharge();
  f.businessSnapshot.entries=[old,{...old,type:'线下充值',after:999}];
  const r=run(f);assert.equal(r.summary.removed.duplicateEntries,1);assert.equal(r.businessSnapshot.balances[old.hotel],2012345);
  for(const conflict of [{cents:54321},{hotel:'hotel-2'}]){
    f.businessSnapshot.entries=[old,{...old,...conflict}];assert.throws(()=>run(f),/重复业务标识内容冲突/);
  }
});

test('does not guess other missing, empty or conflicting funding types as legacy recharge', () => {
  const cases=[{cents:-1},{cents:0},{bank:''},{bank:'x'.repeat(81)},{time:''},{after:1.5},{note:null},
    {type:''},{type:null},{type:'未知类型'},{businessId:'RC1'},{businessKey:'wechat-prototype:WX1'},
    {approvalStatus:'PENDING'},{kind:'线下充值'}];
  for(const change of cases){const f=fixture();f.businessSnapshot.entries=[legacyRecharge(change)];assert.throws(()=>run(f),/未知资金类型/);}
  const f=fixture(), missing=legacyRecharge();delete missing.after;f.businessSnapshot.entries=[missing];assert.throws(()=>run(f),/未知资金类型/);
  f.businessSnapshot.entries=[legacyRecharge({hotel:'unknown'})];assert.throws(()=>run(f),/未知酒店/);
});

test('requires complete nonempty snapshots and reports malformed collections instead of guessing', () => {
  assert.throws(()=>reset.prepare(null,{}),/catalogSnapshot 必须是对象/);
  const f=fixture();f.catalogSnapshot.users=[];assert.throws(()=>run(f),/完整非空组织和账号/);
  const g=fixture();g.businessSnapshot.receipts={};assert.throws(()=>run(g),/receipts 必须是数组/);
});

test('rerunning an already transformed snapshot is idempotent', () => {
  const f=fixture();f.businessSnapshot.entries=[recharge('hotel-2',4567,{businessKey:'recharge-request:RC2'})];
  const first=run(f), second=reset.prepare(first.catalogSnapshot,first.businessSnapshot);
  assert.deepEqual(second.catalogSnapshot,first.catalogSnapshot);
  assert.deepEqual(second.businessSnapshot,first.businessSnapshot);
  assert.equal(second.summary.openingRechargeAdded,false);
  assert.equal(second.summary.removed.orders,0);
});
