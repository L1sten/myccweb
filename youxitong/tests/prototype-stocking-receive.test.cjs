const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {STATE_KEY}=require('../prototype-storage.js');
const hotel='org-hotel-yunqi',floor=hotel+'-floor-0',factory='org-factory-1',site='site-factory-east';
const skus=['linen-duvet','linen-sheet','linen-towel'];
function storage(){const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};}
async function fixture(store=storage()){
  const elements=new Map();let fields=[];
  const element=()=>({innerHTML:'',value:'',addEventListener(){},querySelectorAll:selector=>selector==='[data-stock-result]'?fields:[],querySelector:selector=>selector==='[data-stock-result]'?fields[0]||null:null,classList:{contains:()=>false,add(){},remove(){}}});
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){},querySelector:()=>null};
  const context={document,localStorage:store,sessionStorage:storage(),setTimeout,clearTimeout,URL,location:{href:'http://localhost/'},history:{replaceState(){}},navigator:{locks:{request:(name,options,callback)=>Promise.resolve(callback({name}))}},addEventListener(){}};context.window=context;
  for(const file of ['prototype-reset-data.js','prototype-storage.js','v19.js','v193.js','driver-orders.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../'+file),'utf8'),context);
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/\}\)\(\);\s*$/,`
    var testModal='',testError='',testToasts=[];
    render=function(){};closeModal=function(){testModal='';};modalShell=function(t,s,h,f){testModal=t+' '+s+' '+h+(f||'');};showToast=function(m,tone){testToasts.push({message:m,tone:tone});};identityError=function(m){testError=m;};
    linenSetup();flowSetup();
    globalThis.api={state:state,catalog:catalog,data:syncData,identity:identity,roles:roles,v19:v19.api,assets:v193.api,
      plan:prototypeStockingPlan,receive:prototypeStockingReceive,fulfil:prototypeDriverFulfil,detail:catOrderDetail,account:flowAccount,stats:flowStatistics,
      action:linenAction,click:function(action){handleClick({target:{closest:function(selector){return selector==='[data-action]'?{dataset:{action:action}}:null;}}});},
      save:syncSave,advance:syncTerminalAdvance,terminal:terminalWorkspace,
      html:function(){return testModal;},error:function(){return testError;},toasts:function(){return testToasts;},storageError:function(){return prototypeStorageError;},draft:function(){return prototypeStockingDraft;}};
  })();`);
  await vm.runInNewContext(source,context);const f=context.api;f.store=store;f.state.role='factory_operator';
  f.fields=values=>{fields=Object.entries(values).map(([key,value])=>({dataset:{stockResult:key},value:String(value)}));};return f;
}
function addOrder(f,id='NEW-ORDER',extra={}){
  const order={id,hotel,hotelName:'云栖酒店',floorId:floor,floorName:'1F',factory,factoryName:'桐乡洗涤一厂',site,siteName:'东区站',inventoryVersion:2,progress:1,stocked:{},qty:{'被套':5,'床单':5,'浴巾':5},total:81.5,factoryTotal:56.5,createdAt:'2026-10-21T03:00:00Z',lines:[{sku:skus[0],name:'被套',quantity:5,hotelPrice:800,factoryPrice:550},{sku:skus[1],name:'床单',quantity:5,hotelPrice:550,factoryPrice:380},{sku:skus[2],name:'浴巾',quantity:5,hotelPrice:280,factoryPrice:200}],...extra};
  f.catalog.orders.push(order);for(const sku of skus){f.data.v19.floorInitials[floor+'|'+sku]=50;f.data.v19.floorCaps[floor+'|'+sku]=100;}
  return order;
}
function payload(order,quantities,token='BATCH-A'){return {token,order:order.id,hotel:order.hotel,floorId:order.floorId,factory:order.factory,site:order.site,quantities};}
function snapshot(f){return JSON.stringify({catalog:f.catalog,data:f.data});}

test('final order detail and actual click handler expose reception only for own preparing factory operators',async()=>{
  const f=await fixture(),o=addOrder(f);f.save();
  for(const role of ['factory_admin','factory_operator']){f.state.role=role;f.click('catOrder:'+o.id);assert.doesNotMatch(f.html(),/备货进度|模拟接收批次/);assert.match(f.html(),/data-action="stockResultOpen:NEW-ORDER"/);assert.match(f.html(),/data-action="advance:NEW-ORDER"/);f.click('stockResultOpen:'+o.id);assert.match(f.html(),/备货进度.*计划数量.*已备数量.*剩余数量/);assert.match(f.html(),/模拟接收批次（0）/);assert.match(f.html(),/第三方备货结果回传/);assert.match(f.html(),/实际项目不提供人工录入备货数量/);assert.match(f.html(),/原工厂 \/ 站点/);assert.match(f.html(),/云栖酒店 \/ 1F/);assert.match(f.html(),/东区站/);assert.equal((f.html().match(/value="5"/g)||[]).length,3);assert.doesNotMatch(f.html(),/<select|rfid|EPC|扫描/);}
  for(const role of ['platform_admin','platform_ops','platform_finance','factory_finance','hotel_admin','hotel_operator','driver','terminal']){f.state.role=role;assert.match(f.receive(payload(o,{[skus[0]]:1})).error,/无权/);if(['platform_admin','platform_ops','platform_finance','factory_finance'].includes(role)){f.detail(o);assert.doesNotMatch(f.html(),/stockResultOpen/);}}
  f.state.role='factory_operator';o.progress=0;f.detail(o);assert.doesNotMatch(f.html(),/stockResultOpen/);assert.match(f.receive(payload(o,{[skus[0]]:1})).error,/备货中/);o.progress=2;assert.match(f.receive(payload(o,{[skus[0]]:1})).error,/备货中/);o.progress=3;assert.match(f.receive(payload(o,{[skus[0]]:1})).error,/备货中/);
});

test('reception checks original factory/site/floor without requiring an operator station binding or current hotel mapping',async()=>{
  const f=await fixture(),o=addOrder(f);const operator=f.identity.users.find(u=>u.id==='user-factory_operator');delete operator.site;delete operator.station;f.catalog.mappings[hotel]='site-factory-north';
  assert.equal(f.receive(payload(o,{[skus[0]]:1})).error,undefined);
  const before=snapshot(f);for(const extra of [{hotel:'other'},{floorId:hotel+'-floor-1'},{factory:'org-factory-legacy'},{site:'site-factory-north'}])assert.match(f.receive({...payload(o,{[skus[0]]:1},'BAD'),...extra}).error,/归属/);
  assert.equal(snapshot(f),before);const foreign=addOrder(f,'FOREIGN',{factory:'org-factory-legacy',site:'site-factory-north'});assert.match(f.receive(payload(foreign,{[skus[0]]:1})).error,/无权/);
  o.site='site-factory-north';assert.match(f.receive(payload(o,{[skus[0]]:1})).error,/归属/);o.site=site;operator.active=false;assert.match(f.receive(payload(o,{[skus[0]]:1})).error,/无权/);
});

test('partial then full reception changes stocking and statistics once while amounts and available quantity stay fixed',async()=>{
  const f=await fixture(),o=addOrder(f);f.save();const business=JSON.stringify(f.data),money=JSON.stringify({total:o.total,factoryTotal:o.factoryTotal,lines:o.lines,entries:f.data.entries,balances:f.data.balances}),assets=JSON.stringify({db:f.assets.db,chips:f.data.v19.chips,terminal:f.catalog.terminalBatches});
  const account=()=>{const a=f.account(hotel,skus[0]);return [a.pending,a.out,a.amount];};assert.deepEqual(account(),[5,0,45]);
  f.advance(o.id);assert.equal(o.progress,1);assert.match(f.toasts().at(-1).message,/尚未备齐/);
  const first=f.receive(payload(o,{[skus[0]]:2,[skus[1]]:1}));assert.equal(first.error,undefined);assert.deepEqual(account(),[3,2,45]);assert.equal(f.stats().rows.find(r=>r.sku===skus[0]).out,2);assert.equal(o.progress,1);assert.equal(first.receipt.floorId,floor);assert.equal(first.receipt.source,'prototype-third-party-stocking');assert.equal(first.receipt.receivedBy,'user-factory_operator');assert.equal(first.receipt.lines[0].before,0);assert.equal(first.receipt.lines[0].after,2);
  f.advance(o.id);assert.equal(o.progress,1);
  assert.equal(f.receive(payload(o,{[skus[0]]:3,[skus[1]]:4,[skus[2]]:5},'BATCH-B')).error,undefined);assert.deepEqual(account(),[0,5,45]);assert.equal(f.stats().rows.find(r=>r.sku===skus[0]).out,5);assert.equal(f.catalog.prototypeStockingReceipts.length,2);
  assert.equal(JSON.stringify(f.data),business);assert.equal(JSON.stringify({total:o.total,factoryTotal:o.factoryTotal,lines:o.lines,entries:f.data.entries,balances:f.data.balances}),money);assert.equal(JSON.stringify({db:f.assets.db,chips:f.data.v19.chips,terminal:f.catalog.terminalBatches}),assets);
  f.detail(o);assert.doesNotMatch(f.html(),/备货进度|模拟接收批次/);assert.match(f.html(),/data-action="stockResultOpen:NEW-ORDER"/);assert.doesNotMatch(f.html(),/stockResultOpen:NEW-ORDER" disabled/);f.click('stockResultOpen:'+o.id);assert.match(f.html(),/模拟接收批次（2）/);assert.match(f.html(),/BATCH-A/);assert.match(f.html(),/BATCH-B/);assert.doesNotMatch(f.html(),/data-stock-result|data-action="stockResultReceive"/);f.click('stockResultCancel');f.click('advance:'+o.id);assert.equal(o.progress,2);assert.deepEqual(account(),[0,5,45]);
  for(const progress of [2,3]){o.progress=progress;const before=snapshot(f);f.detail(o);assert.match(f.html(),/stockResultOpen/);assert.doesNotMatch(f.html(),/备货进度|模拟接收批次/);f.click('stockResultOpen:'+o.id);assert.match(f.html(),/备货进度/);assert.match(f.html(),/BATCH-A/);assert.doesNotMatch(f.html(),/data-stock-result|data-action="stockResultReceive"/);f.click('stockResultReceive');assert.equal(snapshot(f),before);f.click('stockResultCancel');assert.match(f.html(),/补充订单详情/);}
});

test('batch retry is idempotent, mismatched content fails, and permissions/state are rechecked before replay',async()=>{
  const f=await fixture(),o=addOrder(f),p=payload(o,{[skus[0]]:5});assert.equal(f.receive(p).duplicate,false);const before=snapshot(f);assert.equal(f.receive(p).duplicate,true);assert.equal(snapshot(f),before);assert.match(f.receive({...p,quantities:{[skus[0]]:4}}).error,/不能更换/);assert.equal(snapshot(f),before);
  f.state.role='factory_finance';assert.match(f.receive(p).error,/无权/);f.state.role='factory_operator';o.progress=2;assert.match(f.receive(p).error,/备货中/);o.progress=1;o.factory='org-factory-legacy';assert.match(f.receive(p).error,/无权/);
});

test('invalid and excessive quantities, empty batches and malformed historical totals never mutate data',async()=>{
  const f=await fixture(),o=addOrder(f);f.save();const before=snapshot(f);
  for(const quantities of [{},{[skus[0]]:''},{[skus[0]]:0},{[skus[0]]:-1},{[skus[0]]:0.5},{[skus[0]]:6},{[skus[0]]:NaN},{[skus[0]]:true},{unknown:1},{[skus[0]]:2,[skus[1]]:6}]){assert.ok(f.receive(payload(o,quantities)).error);assert.equal(snapshot(f),before);}
  o.stocked['被套']=-1;const invalid=snapshot(f);assert.match(f.receive(payload(o,{[skus[1]]:1})).error,/异常/);assert.equal(snapshot(f),invalid);
});

test('opening and cancelling changes no orders, batches, money or persisted state',async()=>{
  const f=await fixture(),o=addOrder(f);f.save();f.detail(o);const before=snapshot(f),persisted=f.store.getItem(STATE_KEY);f.click('stockResultOpen:'+o.id);f.fields({[skus[0]]:2,[skus[1]]:0,[skus[2]]:0});f.click('stockResultCancel');assert.equal(snapshot(f),before);assert.equal(f.store.getItem(STATE_KEY),persisted);assert.equal(f.draft(),null);assert.match(f.html(),/补充订单详情/);
});

test('atomic storage failure rolls back order and new receipt, keeps input and token, and retry succeeds once',async()=>{
  const f=await fixture(),o=addOrder(f);f.save();f.click('stockResultOpen:'+o.id);f.fields({[skus[0]]:2,[skus[1]]:1,[skus[2]]:0});const token=f.draft().token,html=f.html(),before=snapshot(f),persisted=f.store.getItem(STATE_KEY),write=f.store.setItem;
  f.store.setItem=(key,value)=>{if(key===STATE_KEY)throw new Error('存储空间不足');write(key,value);};
  f.click('stockResultReceive');assert.match(f.error(),/未保存.*已恢复.*输入已保留/);assert.match(f.error(),/存储空间不足/);assert.equal(f.html(),html);assert.equal(snapshot(f),before);assert.equal(f.store.getItem(STATE_KEY),persisted);assert.equal(f.storageError(),'');assert.equal(f.draft().token,token);assert.equal(f.draft().quantities[skus[0]],'2');assert.equal(f.toasts().filter(t=>t.tone==='success').length,0);
  f.store.setItem=write;f.click('stockResultReceive');assert.equal(o.stocked['被套'],2);assert.equal(o.stocked['床单'],1);assert.equal(f.catalog.prototypeStockingReceipts.length,1);assert.equal(f.catalog.prototypeStockingReceipts[0].id,token);assert.equal(f.draft(),null);assert.equal(f.toasts().filter(t=>t.tone==='success').length,1);
  const again=await fixture(f.store);assert.equal(again.catalog.orders.find(x=>x.id===o.id).stocked['被套'],2);assert.equal(again.catalog.prototypeStockingReceipts.length,1);assert.equal(again.account(hotel,skus[0]).amount,45);
});

test('failed later batch restores existing batch history by reference and preserves all unrelated user data',async()=>{
  const f=await fixture(),o=addOrder(f),other=addOrder(f,'USER-OTHER',{floorId:hotel+'-floor-1',floorName:'2F'});other.userNote='保留用户备注';f.data.storeOrders=[{no:'USER-STORE',hotel,cents:9900}];f.data.recharges=[{id:'USER-RECHARGE',hotel,status:'PENDING',cents:10000}];f.save();const unrelated=JSON.stringify({other:other,data:f.data});
  assert.equal(f.receive(payload(o,{[skus[0]]:1})).error,undefined);assert.equal(JSON.stringify({other:other,data:f.data}),unrelated);const stocked=o.stocked,receipts=f.catalog.prototypeStockingReceipts,before=snapshot(f),write=f.store.setItem;f.store.setItem=()=>{throw new Error('写入失败');};
  assert.match(f.receive(payload(o,{[skus[0]]:1},'BATCH-B')).error,/未保存/);assert.equal(o.stocked,stocked);assert.equal(f.catalog.prototypeStockingReceipts,receipts);assert.equal(snapshot(f),before);f.store.setItem=write;
});

test('stale snapshot cannot overwrite another saved update and retired terminal actions stay retired',async()=>{
  const f=await fixture(),o=addOrder(f);f.save();const before=snapshot(f),envelope=JSON.parse(f.store.getItem(STATE_KEY));envelope.catalogSnapshot.catalog.external='another-tab';f.store.setItem(STATE_KEY,JSON.stringify(envelope));assert.match(f.receive(payload(o,{[skus[0]]:1})).error,/其他标签页/);assert.equal(snapshot(f),before);assert.equal(JSON.parse(f.store.getItem(STATE_KEY)).catalogSnapshot.catalog.external,'another-tab');
  f.state.role='terminal';f.action('terminalSubmit');assert.match(f.toasts().at(-1).message,/第三方/);assert.doesNotMatch(f.terminal(),/data-action|扫描|备货数量/);assert.equal(snapshot(f),before);
});

test('driver loading and delivery persist atomically, rollback failed writes and preserve the first delivery time',async()=>{
  const f=await fixture(),o=addOrder(f);o.stocked={'被套':5,'床单':5,'浴巾':5};f.state.role='driver';f.save();const write=f.store.setItem,before=snapshot(f),persisted=f.store.getItem(STATE_KEY);f.store.setItem=()=>{throw new Error('quota');};
  assert.match(f.fulfil(o.id,2).error,/未保存/);assert.equal(snapshot(f),before);assert.equal(f.store.getItem(STATE_KEY),persisted);f.store.setItem=write;assert.equal(f.fulfil(o.id,2).duplicate,false);const loaded=snapshot(f),events=o.prototypeFulfilmentEvents;
  f.store.setItem=()=>{throw new Error('quota');};assert.match(f.fulfil(o.id,3).error,/未保存/);assert.equal(snapshot(f),loaded);assert.equal(o.prototypeFulfilmentEvents,events);assert.equal(Object.hasOwn(o,'deliveredAt'),false);f.store.setItem=write;
  assert.equal(f.fulfil(o.id,3).duplicate,false);const delivered=o.deliveredAt;assert.equal(f.fulfil(o.id,3).duplicate,true);assert.equal(o.deliveredAt,delivered);const reload=await fixture(f.store),saved=reload.catalog.orders.find(x=>x.id===o.id);assert.equal(saved.progress,3);assert.equal(saved.deliveredAt,delivered);assert.equal(saved.prototypeFulfilmentEvents.length,2);
});

test('driver fulfilment rejects a stale browser snapshot without overwriting another update',async()=>{
  const f=await fixture(),o=addOrder(f);o.stocked={'被套':5,'床单':5,'浴巾':5};f.state.role='driver';f.save();const before=snapshot(f),envelope=JSON.parse(f.store.getItem(STATE_KEY));envelope.catalogSnapshot.catalog.external='another-tab';f.store.setItem(STATE_KEY,JSON.stringify(envelope));assert.match(f.fulfil(o.id,2).error,/其他标签页/);assert.equal(snapshot(f),before);assert.equal(JSON.parse(f.store.getItem(STATE_KEY)).catalogSnapshot.catalog.external,'another-tab');
});
