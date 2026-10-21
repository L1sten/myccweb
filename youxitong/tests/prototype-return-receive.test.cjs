const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {STATE_KEY}=require('../prototype-storage.js');
const hotel='org-hotel-yunqi',floor=hotel+'-floor-0',factory='org-factory-1',site='site-factory-east';
const skus=['linen-duvet','linen-sheet','linen-towel'];
const refundCents=3780,factoryDeduction=2610;
function storage(){const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};}
async function fixture(store=storage()){
  const elements=new Map();let fields=[];
  const element=()=>({innerHTML:'',value:'',addEventListener(){},querySelectorAll:selector=>selector==='[data-return-result]'?fields:[],querySelector:selector=>selector==='[data-return-result]'?fields[0]||null:null,classList:{contains:()=>false,add(){},remove(){}}});
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){},querySelector:()=>null};
  const context={document,localStorage:store,sessionStorage:storage(),setTimeout,clearTimeout,URL,location:{href:'http://localhost/'},history:{replaceState(){}},navigator:{locks:{request:(name,options,callback)=>Promise.resolve(callback({name}))}},addEventListener(){}};context.window=context;
  for(const file of ['prototype-reset-data.js','prototype-storage.js','v19.js','v193.js','driver-orders.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../'+file),'utf8'),context);
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/\}\)\(\);\s*$/,`
    var testModal='',testError='',testToasts=[];
    render=function(){};closeModal=function(){testModal='';};modalShell=function(t,s,h,f){testModal=t+' '+s+' '+h+(f||'');};showToast=function(m,tone){testToasts.push({message:m,tone:tone});};identityError=function(m){testError=m;};
    linenSetup();flowSetup();
    globalThis.api={state:state,catalog:catalog,data:syncData,identity:identity,roles:roles,v19:v19.api,assets:v193.api,
      receive:prototypeReturnReceive,account:flowAccount,stats:flowStatistics,financials:linenFinancials,balance:syncBalance,
      action:linenAction,click:function(action){handleClick({target:{closest:function(selector){return selector==='[data-action]'?{dataset:{action:action}}:null;}}});},
      save:syncSave,terminal:terminalWorkspace,html:function(){return testModal;},error:function(){return testError;},toasts:function(){return testToasts;},storageError:function(){return prototypeStorageError;},draft:function(){return prototypeReturnDraft;}};
  })();`);
  await vm.runInNewContext(source,context);const f=context.api;f.store=store;f.state.role='factory_operator';
  f.fields=values=>{fields=Object.entries(values).map(([key,value])=>({dataset:{returnResult:key},value:String(value)}));};return f;
}
function addOrder(f,id='RETURN-ORDER',extra={}){
  const order={id,hotel,hotelName:'云栖酒店',floorId:floor,floorName:'1F',factory,factoryName:'桐乡洗涤一厂',site,siteName:'东区站',inventoryVersion:2,progress:3,deliveredAt:new Date().toISOString(),stocked:{'被套':5,'床单':5,'浴巾':5},qty:{'被套':5,'床单':5,'浴巾':5},total:81.5,factoryTotal:56.5,createdAt:'2026-10-21T03:00:00Z',lines:[{sku:skus[0],name:'被套',quantity:5,hotelPrice:800,factoryPrice:550},{sku:skus[1],name:'床单',quantity:5,hotelPrice:550,factoryPrice:380},{sku:skus[2],name:'浴巾',quantity:5,hotelPrice:280,factoryPrice:200}],...extra};
  f.catalog.orders.push(order);for(const sku of skus){f.data.v19.floorInitials[order.floorId+'|'+sku]=50;f.data.v19.floorCaps[order.floorId+'|'+sku]=100;}
  return order;
}
function addReturn(f,order,id='RETURN-REQUEST',extra={}){
  const request={id,version:2,order:order.id,hotel:order.hotel,floorId:order.floorId,floorName:order.floorName,factory:order.factory,site:order.site,status:'AWAITING_INBOUND',reason:'明显污渍',refundCents:0,time:new Date().toISOString(),reviewedAt:new Date().toISOString(),submittedBy:'user-driver',lines:order.lines.map((l,i)=>({sku:l.sku,name:l.name,quantity:3-i,received:0,hotelPrice:l.hotelPrice,factoryPrice:l.factoryPrice})),...extra};
  f.data.returnRequests.push(request);return request;
}
function payload(r,quantities,token='RETURN-BATCH-A'){return {token,request:r.id,order:r.order,hotel:r.hotel,floorId:r.floorId,factory:r.factory,site:r.site,quantities};}
function fullQuantities(r){return Object.fromEntries(r.lines.map(l=>[l.sku,l.quantity-l.received]));}
function snapshot(f){return JSON.stringify({catalog:f.catalog,data:f.data});}
function receiptsFor(f,r){return f.data.receipts.filter(x=>x.request===r.id);}
function entriesFor(f,r){return f.data.entries.filter(x=>x.businessKey==='return-complete:'+r.id);}
function amounts(f){return skus.map(sku=>f.account(hotel,sku).amount);}

test('refund detail opens result reception through actual clicks only for active owning factory writers',async()=>{
  const f=await fixture(),o=addOrder(f),r=addReturn(f,o);f.save();
  for(const role of ['factory_admin','factory_operator']){
    f.state.role=role;f.click('flowReturnDetail:'+r.id);assert.match(f.html(),/data-action="returnResultOpen:RETURN-REQUEST"/);
    f.click('returnResultOpen:'+r.id);assert.match(f.html(),/接收退污结果/);assert.match(f.html(),/原型演示|模拟/);assert.match(f.html(),/第三方/);assert.match(f.html(),/data-return-result/);assert.match(f.html(),/data-action="returnResultReceive"/);
    for(const line of r.lines)assert.match(f.html(),new RegExp('value="'+line.quantity+'"'));
    assert.equal(f.draft().request,r.id);assert.equal(f.draft().floorId,floor);assert.doesNotMatch(f.html(),/<select|rfid|EPC|扫描/);f.click('returnResultCancel');assert.match(f.html(),/退污详情/);
  }
  f.v19.store.floorBindings[floor]='user-hotel_operator';
  for(const role of ['platform_admin','platform_ops','platform_finance','factory_finance','hotel_admin','hotel_operator','driver','terminal']){
    f.state.role=role;assert.match(f.receive(payload(r,{[skus[0]]:1})).error,/无权/);
    if(role!=='terminal'){f.click('flowReturnDetail:'+r.id);assert.doesNotMatch(f.html(),/data-action="returnResultOpen:/);}
  }
  f.state.role='factory_operator';const operator=f.identity.users.find(x=>x.id==='user-factory_operator');operator.active=false;const before=snapshot(f);assert.match(f.receive(payload(r,{[skus[0]]:1})).error,/无权/);assert.equal(snapshot(f),before);
});

test('only approved awaiting requests accept new batches and completed requests expose readonly history',async()=>{
  const f=await fixture(),r=addReturn(f,addOrder(f));
  for(const status of ['PENDING','REJECTED']){r.status=status;const before=snapshot(f);f.click('flowReturnDetail:'+r.id);assert.doesNotMatch(f.html(),/returnResultOpen/);assert.ok(f.receive(payload(r,{[skus[0]]:1})).error);assert.equal(snapshot(f),before);}
  r.status='AWAITING_INBOUND';assert.equal(f.receive(payload(r,fullQuantities(r))).error,undefined);assert.equal(r.status,'REFUNDED');
  const before=snapshot(f);f.click('flowReturnDetail:'+r.id);assert.match(f.html(),/returnResultOpen/);f.click('returnResultOpen:'+r.id);assert.match(f.html(),/RETURN-BATCH-A/);assert.doesNotMatch(f.html(),/data-return-result|data-action="returnResultReceive"/);f.click('returnResultReceive');assert.equal(snapshot(f),before);f.click('returnResultCancel');assert.match(f.html(),/退污详情/);
  assert.ok(f.receive(payload(r,{[skus[0]]:1},'NEW-AFTER-COMPLETE')).error);assert.equal(snapshot(f),before);
});

test('partial batches credit original floor inventory while refund and factory deduction wait for every item',async()=>{
  const f=await fixture(),o=addOrder(f),r=addReturn(f,o),balance=f.balance(hotel);f.save();
  const commits=[],write=f.store.setItem;f.store.setItem=(key,value)=>{if(key===STATE_KEY)commits.push(JSON.parse(value));write(key,value);};
  const orderBefore=JSON.stringify(o),assetsBefore=JSON.stringify({db:f.assets.db,chips:f.data.v19.chips,terminal:f.catalog.terminalBatches});assert.deepEqual(amounts(f),[45,45,45]);
  const first=f.receive(payload(r,{[skus[0]]:1,[skus[1]]:1}));assert.equal(first.error,undefined);assert.equal(first.duplicate,false);assert.equal(f.state.role,'factory_operator');assert.equal(f.data.returnRequests.find(x=>x.id===r.id),r);assert.deepEqual(Array.from(r.lines,l=>l.received),[1,1,0]);assert.deepEqual(amounts(f),[46,46,45]);
  assert.equal(r.status,'AWAITING_INBOUND');assert.equal(r.refundCents,0);assert.equal(f.balance(hotel),balance);assert.equal(entriesFor(f,r).length,0);assert.equal(f.data.linenRefunds.filter(x=>x.order===o.id).length,0);assert.equal(f.financials(o).factoryDeduction,0);
  for(const sku of skus.slice(0,2)){const row=receiptsFor(f,r).find(x=>x.sku===sku);assert.equal(row.token,'RETURN-BATCH-A:'+sku);assert.equal(row.floorId,floor);assert.equal(row.factory,factory);assert.equal(row.site,site);assert.equal(row.type,'RETURN');assert.equal(row.v19,true);assert.equal(row.releaseQuantity,1);assert.equal(f.stats().rows.find(x=>x.sku===sku).refund,1);}
  assert.equal(f.stats().error,'');assert.equal(first.receipt.request,r.id);assert.equal(first.receipt.floorId,floor);assert.equal(f.catalog.prototypeReturnReceipts.length,1);
  assert.equal(commits.length,1);assert.equal(commits[0].catalogSnapshot.catalog.prototypeReturnReceipts.length,1);assert.ok(commits[0].businessSnapshot.receipts.filter(x=>x.request===r.id).every(x=>x.floorId===floor&&x.v19===true));assert.equal(commits[0].businessSnapshot.returnRequests.find(x=>x.id===r.id).status,'AWAITING_INBOUND');
  const second=f.receive(payload(r,fullQuantities(r),'RETURN-BATCH-B'));assert.equal(second.error,undefined);assert.equal(r.status,'REFUNDED');assert.equal(r.refundCents,refundCents);assert.ok(Number.isFinite(Date.parse(r.completedAt)));assert.equal(f.balance(hotel),balance+refundCents);assert.equal(entriesFor(f,r).length,1);assert.equal(entriesFor(f,r)[0].cents,refundCents);assert.equal(entriesFor(f,r)[0].after,balance+refundCents);assert.deepEqual(amounts(f),[48,47,46]);
  const financials=f.financials(o);assert.equal(financials.hotelRefund,refundCents);assert.equal(financials.factoryDeduction,factoryDeduction);assert.equal(financials.hotelNet,8150-refundCents);assert.equal(financials.factoryNet,5650-factoryDeduction);assert.equal(financials.approvedQuantity,6);
  const approved=f.data.linenRefunds.filter(x=>x.order===o.id);assert.equal(approved.length,3);assert.ok(approved.every(x=>x.protocol2&&x.status==='APPROVED'));assert.equal(approved.reduce((n,x)=>n+x.refundCents,0),refundCents);assert.equal(f.catalog.prototypeReturnReceipts.length,2);assert.equal(f.stats().error,'');assert.deepEqual(skus.map(sku=>f.stats().rows.find(x=>x.sku===sku).refund),[3,2,1]);
  assert.equal(commits.length,2);assert.equal(commits[1].businessSnapshot.returnRequests.find(x=>x.id===r.id).status,'REFUNDED');assert.equal(commits[1].businessSnapshot.balances[hotel],balance+refundCents);assert.equal(commits[1].businessSnapshot.entries.filter(x=>x.businessKey==='return-complete:'+r.id).length,1);
  assert.equal(JSON.stringify(o),orderBefore);assert.equal(JSON.stringify({db:f.assets.db,chips:f.data.v19.chips,terminal:f.catalog.terminalBatches}),assetsBefore);
});

test('same batch stays idempotent after completion and conflicting content or revoked permission cannot replay it',async()=>{
  const f=await fixture(),r=addReturn(f,addOrder(f)),first=payload(r,{[skus[0]]:1});assert.equal(f.receive(first).duplicate,false);
  const complete=payload(r,fullQuantities(r),'RETURN-BATCH-B');assert.equal(f.receive(complete).duplicate,false);const before=snapshot(f),completedAt=r.completedAt;
  assert.equal(f.receive(first).duplicate,true);assert.equal(f.receive(complete).duplicate,true);assert.equal(snapshot(f),before);assert.equal(r.completedAt,completedAt);assert.equal(entriesFor(f,r).length,1);
  assert.ok(f.receive({...first,quantities:{[skus[0]]:2}}).error);assert.ok(f.receive({...first,request:'OTHER'}).error);assert.equal(snapshot(f),before);
  f.state.role='factory_finance';assert.match(f.receive(first).error,/无权/);f.state.role='factory_operator';f.identity.users.find(x=>x.id==='user-factory_operator').active=false;assert.match(f.receive(first).error,/无权/);
});

test('reception preserves original scope after hotel reassignment and rejects forged or foreign context',async()=>{
  const f=await fixture(),r=addReturn(f,addOrder(f));const operator=f.identity.users.find(x=>x.id==='user-factory_operator');delete operator.site;delete operator.station;f.catalog.mappings[hotel]='site-factory-north';
  assert.equal(f.receive(payload(r,{[skus[0]]:1})).error,undefined);const before=snapshot(f);
  for(const extra of [{order:'OTHER'},{hotel:'org-hotel-full'},{floorId:hotel+'-floor-1'},{factory:'org-factory-legacy'},{site:'site-factory-north'}]){assert.ok(f.receive({...payload(r,{[skus[0]]:1},'BAD'),...extra}).error);assert.equal(snapshot(f),before);}
  const foreign=addReturn(f,addOrder(f,'FOREIGN',{factory:'org-factory-legacy',site:'site-factory-north'}),'FOREIGN-RETURN');assert.match(f.receive(payload(foreign,{[skus[0]]:1})).error,/无权/);
});

test('empty invalid and excessive batches have no partial quantity, wallet or history effects',async()=>{
  const f=await fixture(),r=addReturn(f,addOrder(f));f.save();const before=snapshot(f),persisted=f.store.getItem(STATE_KEY);
  for(const quantities of [null,[],{}, {[skus[0]]:''},{[skus[0]]:0},{[skus[0]]:-1},{[skus[0]]:0.5},{[skus[0]]:4},{[skus[0]]:NaN},{[skus[0]]:Infinity},{[skus[0]]:true},{[skus[0]]:{}},{unknown:1},{[skus[0]]:1,[skus[1]]:3}]){assert.ok(f.receive(payload(r,quantities)).error);assert.equal(snapshot(f),before);assert.equal(f.store.getItem(STATE_KEY),persisted);}
  for(const token of ['',42,'x'.repeat(121)]){assert.ok(f.receive(payload(r,{[skus[0]]:1},token)).error);assert.equal(snapshot(f),before);}
});

test('corrupt request quantities, prices and historical origin fail without repairing or replaying money',async()=>{
  const changes=[
    (f,o,r)=>{r.lines[0].received=-1;},
    (f,o,r)=>{r.lines[0].received=r.lines[0].quantity+1;},
    (f,o,r)=>{r.lines[0].quantity=6;},
    (f,o,r)=>{r.lines.push({...r.lines[0]});},
    (f,o,r)=>{r.lines[0].hotelPrice=801;},
    (f,o,r)=>{r.lines[0].factoryPrice=-1;},
    (f,o)=>{delete o.floorId;},
    (f,o)=>{o.site='site-factory-north';},
    f=>{f.data.balances[hotel]=Number.MAX_SAFE_INTEGER;}
  ];
  for(const change of changes){const f=await fixture(),o=addOrder(f),r=addReturn(f,o);change(f,o,r);const before=snapshot(f);assert.ok(f.receive(payload(r,fullQuantities(r))).error);assert.equal(snapshot(f),before);}
});

test('daily recovery before refund completion does not release floor occupancy twice',async()=>{
  const f=await fixture(),r=addReturn(f,addOrder(f)),balance=f.balance(hotel);
  for(const sku of skus)f.data.receipts.push({token:'DAILY-FIRST:'+sku,hotel,sku,site,factory,floorId:floor,quantity:5,releaseQuantity:5,type:'DAILY',request:'',v19:true,time:new Date().toISOString()});
  assert.equal(f.v19.floorAccount(floor,skus[0]).unreturned,0);assert.equal(f.receive(payload(r,fullQuantities(r))).error,undefined);
  assert.ok(receiptsFor(f,r).every(x=>x.releaseQuantity===0));assert.equal(f.v19.floorAccount(floor,skus[0]).unreturned,0);assert.equal(f.v19.floorAccount(floor,skus[0]).error,'');assert.equal(f.balance(hotel),balance+refundCents);assert.deepEqual(amounts(f),[53,52,51]);
});

test('opening and cancelling preserves all business and persisted state',async()=>{
  const f=await fixture(),r=addReturn(f,addOrder(f));f.save();f.click('flowReturnDetail:'+r.id);const before=snapshot(f),persisted=f.store.getItem(STATE_KEY);
  f.click('returnResultOpen:'+r.id);f.fields({[skus[0]]:1,[skus[1]]:0,[skus[2]]:0});f.click('returnResultCancel');assert.equal(snapshot(f),before);assert.equal(f.store.getItem(STATE_KEY),persisted);assert.equal(f.draft(),null);assert.match(f.html(),/退污详情/);
});

test('failed completing write restores quantities, money and prior history, retains input, and retries once',async()=>{
  const f=await fixture(),o=addOrder(f),r=addReturn(f,o),balance=f.balance(hotel);assert.equal(f.receive(payload(r,{[skus[0]]:1})).error,undefined);
  const priorLines=r.lines,priorReceipts=f.data.receipts,priorEntries=f.data.entries,priorRefunds=f.data.linenRefunds,priorBalances=f.data.balances,priorBatches=f.catalog.prototypeReturnReceipts;
  f.click('returnResultOpen:'+r.id);f.fields(fullQuantities(r));const token=f.draft().token,html=f.html(),before=snapshot(f),persisted=f.store.getItem(STATE_KEY),write=f.store.setItem;
  f.store.setItem=(key,value)=>{if(key===STATE_KEY)throw new Error('存储空间不足');write(key,value);};f.click('returnResultReceive');
  assert.match(f.error(),/未保存|保存失败/);assert.match(f.error(),/存储空间不足/);assert.equal(snapshot(f),before);assert.equal(f.store.getItem(STATE_KEY),persisted);assert.equal(f.data.returnRequests.find(x=>x.id===r.id),r);assert.equal(r.lines,priorLines);assert.equal(f.data.receipts,priorReceipts);assert.equal(f.data.entries,priorEntries);assert.equal(f.data.linenRefunds,priorRefunds);assert.equal(f.data.balances,priorBalances);assert.equal(f.catalog.prototypeReturnReceipts,priorBatches);assert.equal(f.storageError(),'');assert.equal(f.html(),html);assert.equal(f.draft().token,token);assert.equal(f.draft().quantities[skus[0]],'2');assert.equal(f.toasts().filter(x=>x.tone==='success').length,0);
  f.store.setItem=write;f.click('returnResultReceive');assert.equal(f.data.returnRequests.find(x=>x.id===r.id),r);assert.equal(r.status,'REFUNDED');assert.equal(f.balance(hotel),balance+refundCents);assert.equal(entriesFor(f,r).length,1);assert.equal(f.catalog.prototypeReturnReceipts.length,2);assert.equal(f.catalog.prototypeReturnReceipts.at(-1).id,token);assert.equal(f.draft(),null);assert.equal(f.toasts().filter(x=>x.tone==='success').length,1);assert.match(f.html(),/退污详情/);
  const again=await fixture(f.store),saved=again.data.returnRequests.find(x=>x.id===r.id);assert.equal(saved.status,'REFUNDED');assert.equal(saved.refundCents,refundCents);assert.equal(again.balance(hotel),balance+refundCents);assert.equal(entriesFor(again,saved).length,1);assert.equal(again.catalog.prototypeReturnReceipts.length,2);assert.deepEqual(amounts(again),[48,47,46]);assert.equal(again.financials(again.catalog.orders.find(x=>x.id===o.id)).factoryDeduction,factoryDeduction);
});

test('failed first batch removes newly created history and preserves unrelated user records',async()=>{
  const f=await fixture(),r=addReturn(f,addOrder(f)),other=addOrder(f,'USER-OTHER',{floorId:hotel+'-floor-1',floorName:'2F'});other.userNote='保留用户备注';f.data.storeOrders=[{no:'USER-STORE',hotel,cents:9900}];f.data.recharges=[{id:'USER-RECHARGE',hotel,status:'PENDING',cents:10000}];f.save();
  const before=snapshot(f),hadBatches=Object.hasOwn(f.catalog,'prototypeReturnReceipts'),persisted=f.store.getItem(STATE_KEY),write=f.store.setItem;f.store.setItem=()=>{throw new Error('写入失败');};assert.ok(f.receive(payload(r,{[skus[0]]:1})).error);assert.equal(snapshot(f),before);assert.equal(Object.hasOwn(f.catalog,'prototypeReturnReceipts'),hadBatches);assert.equal(f.store.getItem(STATE_KEY),persisted);f.store.setItem=write;
});

test('stale browser snapshot cannot overwrite another update and retired terminal actions remain blocked',async()=>{
  const f=await fixture(),r=addReturn(f,addOrder(f));f.save();const before=snapshot(f),envelope=JSON.parse(f.store.getItem(STATE_KEY));envelope.catalogSnapshot.catalog.external='another-tab';f.store.setItem(STATE_KEY,JSON.stringify(envelope));
  assert.match(f.receive(payload(r,fullQuantities(r))).error,/其他标签页/);assert.equal(snapshot(f),before);assert.equal(JSON.parse(f.store.getItem(STATE_KEY)).catalogSnapshot.catalog.external,'another-tab');
  f.state.role='terminal';for(const action of ['terminalSubmit','flowInboundSave','flowNewBatch']){f.action(action);assert.match(f.toasts().at(-1).message,/第三方/);}assert.doesNotMatch(f.terminal(),/data-action|扫描|入库数量/);assert.equal(snapshot(f),before);
});
