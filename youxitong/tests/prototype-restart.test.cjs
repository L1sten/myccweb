const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {STATE_KEY,CATALOG_KEY,BUSINESS_KEY}=require('../prototype-storage.js');
function storage(){const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};}
async function fixture(store=storage()){
 const elements=new Map();const handlers={};
 const element=()=>({innerHTML:'',value:'',addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,classList:{contains:()=>false,add(){},remove(){}}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){},querySelector:()=>null};
 const context={document,localStorage:store,sessionStorage:storage(),setTimeout,clearTimeout,URL,location:{href:'http://localhost/'},history:{replaceState(){}},navigator:{locks:{request:(name,options,callback)=>Promise.resolve(callback({name}))}},addEventListener:(name,fn)=>handlers[name]=fn};context.window=context;
 for(const file of ['prototype-reset-data.js','prototype-storage.js','v19.js','v193.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../'+file),'utf8'),context);
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/\}\)\(\);\s*$/,`
   var actualModal=modalShell,actualToast=showToast,actualRender=render;
   var testModal='';render=function(){};closeModal=function(){};modalShell=function(t,s,h,f){testModal=h+(f||'');};showToast=function(){};
   globalThis.api={state:state,data:syncData,catalog:catalog,roles:roles,identity:identity,categories:linenCategories,
     v19:v19.api,assets:v193.api,account:flowAccount,receipt:flowReceipt,request:flowSubmit,review:flowReview,
     stock:syncTerminalSubmit,terminalDraft:terminalDraft,setup:linenSetup,ledger:rechargeLedger,balance:syncBalance,
     save:syncSave,stats:flowStatistics,showSubmit:showSubmitOrder,submit:function(){return catHandle('catSubmitOrder');},
     page:actualOrders,refundPage:actualRefunds,report:actualResource,quota:syncQuotaDialog,dashboard:actualDashboard,
     html:function(){return testModal;},error:function(){return prototypeStorageError;},snapshot:catalogSnapshot,
     originalModal:actualModal,originalToast:actualToast,originalRender:actualRender,root:root,modal:modal};
 })();`);
 await vm.runInNewContext(source,context);return {...context.api,store,handlers};
}
const hotel='org-hotel-yunqi',floor=hotel+'-floor-0',sku='linen-duvet';
test('fresh browser has no auto-created linen history, zero quantities and a single opening recharge',async()=>{
 const f=await fixture();assert.equal(f.error(),'');f.setup();f.setup();assert.equal(f.catalog.orders.length,0);
 for(const h of f.identity.orgs.filter(x=>x.type==='hotel'))for(const s of f.categories){const q=f.account(h.id,s.id);assert.equal(q.error,'');assert.deepEqual([q.initial,q.cap,q.daily,q.refund,q.incoming,q.pending,q.out,q.amount],[0,0,0,0,0,0,0,0]);}
 assert.equal(f.ledger(hotel).length,1);assert.equal(f.balance(hotel),2000000);assert.doesNotMatch(f.ledger(hotel).map(x=>x.type).join(),/布草订单扣款/);
 assert.doesNotThrow(()=>f.page(f.roles.platform_admin));assert.doesNotThrow(()=>f.refundPage(f.roles.platform_admin));
 f.quota(hotel);assert.doesNotMatch(f.html(),/待核查|数据异常/);
});
test('old unassigned refunds reset once while organization, floor owner, store and recharge survive',async()=>{
 const initial=await fixture();const cat=JSON.parse(JSON.stringify(initial.snapshot())),biz=JSON.parse(JSON.stringify(initial.data));
 cat.catalog.orders=[{id:'OLD',hotel}];biz.receipts=[{token:'IN-OLD',hotel,sku,type:'RETURN',quantity:10}];biz.returnRequests=[{id:'RT-OLD'}];biz.v19.floorCaps={[floor+'|'+sku]:2000};biz.v19.floorInitials={[floor+'|'+sku]:200};biz.v19.floorBindings={[floor]:'user-hotel_operator'};
 biz.recharges=[{id:'RC',hotel,status:'PENDING',cents:10000}];biz.storeOrders=[{no:'SC1',hotel,cents:3900}];biz.entries.unshift({hotel,type:'商城订单扣款',cents:-3900,bank:'SC1',time:'2026-10-19'});
 const s=storage();s.setItem(CATALOG_KEY,JSON.stringify(cat));s.setItem(BUSINESS_KEY,JSON.stringify(biz));
 const f=await fixture(s);assert.equal(f.error(),'');assert.equal(f.data.receipts.length,0);assert.equal(f.data.returnRequests.length,0);assert.equal(f.catalog.orders.length,0);assert.equal(f.account(hotel,sku).amount,0);assert.equal(f.v19.store.floorBindings[floor],'user-hotel_operator');assert.equal(f.data.storeOrders[0].no,'SC1');assert.equal(f.data.recharges[0].status,'PENDING');assert.equal(f.balance(hotel),1996100);
 assert.equal(f.v19.saveFloorCaps(floor,[{sku,cap:100,initial:50}]),'');const again=await fixture(s);assert.equal(again.account(hotel,sku).amount,50);assert.equal(again.balance(hotel),1996100);
});
test('new order, partial stocking and refund use 50/10/10/10/15 and write one debit across reload',async()=>{
 const f=await fixture();assert.equal(f.v19.saveFloorCaps(floor,[{sku,cap:100,initial:50}]),'');assert.equal(f.account(hotel,sku).amount,50);
 f.state.role='hotel_admin';f.catalog.selection[hotel]=floor;f.state.qty={'被套':40};f.showSubmit();f.submit();f.submit();
 assert.equal(f.catalog.orders.length,1);const order=f.catalog.orders[0];assert.equal(f.data.entries.filter(x=>x.type==='布草订单扣款').length,1);assert.equal(f.balance(hotel),1968000);assert.equal(f.account(hotel,sku).amount,10);
 order.progress=1;f.state.role='terminal';f.state.section='租赁备货';Object.assign(f.terminalDraft,{site:'site-factory-east',order:order.id,sku,quantity:'20'});f.stock();assert.equal(f.account(hotel,sku).amount,10);f.terminalDraft.fingerprint='';f.terminalDraft.quantity='20';f.stock();assert.equal(order.stocked['被套'],40);assert.equal(f.account(hotel,sku).amount,10);
 order.progress=3;order.deliveredAt=new Date().toISOString();f.state.role='hotel_admin';assert.equal(f.request(order.id,{[sku]:5},'污渍'),'');const req=f.data.returnRequests[0];f.state.role='factory_admin';assert.equal(f.review(req.id,true,''),'');
 f.state.role='terminal';assert.equal(f.receipt({token:'return-new',hotel,site:'site-factory-east',sku,quantity:5,request:req.id}),'');assert.equal(f.account(hotel,sku).amount,15);assert.equal(f.balance(hotel),1972000);
 const again=await fixture(f.store);again.setup();assert.equal(again.catalog.orders.length,1);assert.equal(again.account(hotel,sku).amount,15);assert.equal(again.balance(hotel),1972000);assert.equal(again.ledger(hotel).length,3);
});
test('stale app is blocked and cannot persist changed quantities over another tab',async()=>{
 const s=storage(),a=await fixture(s),b=await fixture(s);assert.equal(a.v19.saveFloorCaps(floor,[{sku,cap:100,initial:50}]),'');
 b.handlers.storage({key:STATE_KEY});assert.match(b.error(),/其他标签页/);b.v19.store.floorInitials[floor+'|'+sku]=999;assert.equal(b.save(),false);assert.equal((await fixture(s)).account(hotel,sku).initial,50);
});
test('failed storage commit preserves persisted data and cannot display a success modal or toast',async()=>{
 const s=storage(),f=await fixture(s),before=s.getItem(STATE_KEY),write=s.setItem;
 s.setItem=(key,value)=>{if(key===STATE_KEY)throw new Error('存储空间不足');write(key,value);};
 f.v19.store.floorInitials[floor+'|'+sku]=300;
 assert.equal(f.save(),false);assert.equal(s.getItem(STATE_KEY),before);assert.match(f.error(),/存储空间不足/);
 f.originalModal('成功','','已成功入账','');f.originalToast('已成功入账','success');f.originalRender();
 assert.match(f.root.innerHTML,/存储空间不足/);assert.doesNotMatch(f.root.innerHTML+f.modal.innerHTML,/已成功入账/);
 s.setItem=write;assert.equal((await fixture(s)).account(hotel,sku).initial,0);
});

test('dashboard includes retained posted WeChat recharges without counting pending requests',async()=>{
 const f=await fixture();f.state.role='platform_admin';
 f.data.entries.unshift({hotel,type:'微信充值',cents:11100,time:new Date().toISOString()});
 f.data.recharges=[{hotel,cents:999900,status:'PENDING',time:new Date().toISOString()}];
 assert.match(f.dashboard(f.roles.platform_admin),/¥20,111\.00/);assert.doesNotMatch(f.dashboard(f.roles.platform_admin),/¥30,110\.00/);
});
