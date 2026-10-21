const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const hotel='org-hotel-yunqi',otherHotel='org-hotel-full',factory='org-factory-1',foreignFactory='org-factory-legacy',sku='linen-duvet',floor=hotel+'-floor-0';
function fixture(){
  const elements=new Map(),scroll={scrollTop:0};
  const element=()=>({value:'',addEventListener(){},querySelectorAll:()=>[],querySelector:selector=>selector==='.mobile-scroll'?scroll:null,classList:{contains:()=>false,add(){},remove(){}}});
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){},querySelector:()=>null};
  const storage={getItem:()=>null,setItem(){}};
  const context={window:{addEventListener(){}},document,localStorage:storage,sessionStorage:storage,setTimeout,clearTimeout,URL,location:{href:'http://localhost/'},history:{replaceState(){}}};
  for(const file of ['v19.js','v193.js','driver-orders.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../'+file),'utf8'),context);
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/\}\)\(\);\s*$/,`
    var testModal='',testPage='',testError='',testToast='';
    render=function(){testPage=state.role==='driver'?(state.section==='司机酒店订单'?driverOrders.page():driverHome(roles.driver)):mobileOrders(roles[state.role]);driverOrders.afterRender();};
    closeModal=function(){testModal='';};modalShell=function(t,s,h,f){testModal=t+' '+s+' '+h+(f||'');};showToast=function(m){testToast=m;};identityError=function(m){testError=m;};
    linenSetup();flowSetup();catalog.orders=[];syncData.returnRequests=[];syncData.linenRefunds=[];syncData.receipts=[];syncData.storeOrders=[];
    globalThis.api={state:state,data:syncData,catalog:catalog,identity:identity,driver:driverOrders.api,v19:v19.api,
      action:linenAction,click:function(action){handleClick({target:{closest:function(selector){return selector==='[data-action]'?{dataset:{action:action}}:null;}}});},detail:catOrderDetail,submit:flowSubmit,review:flowReview,receipt:flowReceipt,financials:linenFinancials,
      card:linenCard,orders:function(tab){mobileOrderTab=tab;return mobileOrders(roles[state.role]);},
      render:render,page:function(){return testPage;},html:function(){return testModal;},toast:function(){return testToast;},error:function(){return testError;}};
  })();`);
  vm.runInNewContext(source,context);
  const f=context.api;f.state.role='driver';f.state.section='负责酒店';
  f.driverUser=()=>f.identity.users.find(u=>u.id==='user-driver');f.scroll=scroll;
  f.fields=(values,reason='明显污渍')=>{document.getElementById('prototypeModal').querySelectorAll=sel=>sel==='[data-driver-quantity]'?Object.entries(values).map(([key,value])=>({dataset:{driverQuantity:key},value:String(value)})):[];document.getElementById('driverReturnReason').value=reason;};
  return f;
}
function addOrder(f,id='ORDER',extra={}){
  const o={id,hotel,hotelName:'云栖酒店',factory,site:'site-factory-east',factoryName:'桐乡洗涤一厂',siteName:'东区站',floorId:floor,floorName:'1F',address:'酒店地址',progress:3,deliveredAt:new Date().toISOString(),createdAt:new Date().toISOString(),inventoryVersion:2,stocked:{'被套':10,'床单':6},qty:{'被套':10,'床单':6},total:113,lines:[{sku,name:'被套',quantity:10,hotelPrice:800,factoryPrice:550},{sku:'linen-sheet',name:'床单',quantity:6,hotelPrice:550,factoryPrice:380}],...extra};f.catalog.orders.push(o);return o;
}
function addStore(f,no='STORE',extra={}){const o={no,hotel,lines:'清洁剂 × 2',count:2,cents:7800,time:'2026-10-21 09:10',itemLines:[{name:'清洁剂',quantity:2,unitPrice:3900,subtotal:7800}],address:'酒店收货处',...extra};f.data.storeOrders.push(o);return o;}
function addRefund(f,o,id='REFUND',extra={}){const r={id,version:2,order:o.id,hotel:o.hotel,factory:o.factory,status:'AWAITING_INBOUND',lines:[{sku,name:'被套',quantity:3,received:1,hotelPrice:800,factoryPrice:550}],reason:'污渍',refundCents:0,time:'2026-10-21 10:00',...extra};f.data.returnRequests.push(r);return r;}

test('driver hotel list links only assigned active hotels and never switches the hotel account',()=>{
  const f=fixture();f.render();assert.match(f.page(),/data-action="driverHotel:org-hotel-yunqi"/);assert.doesNotMatch(f.page(),/driverHotel:org-hotel-full/);
  const original=f.catalog.hotel;f.action('driverHotel:'+hotel);assert.match(f.page(),/云栖酒店/);assert.match(f.page(),/布草订单.*商城订单.*退污记录/);assert.equal(f.state.role,'driver');assert.equal(f.catalog.hotel,original);
  f.action('driverHotel:'+otherHotel);assert.match(f.toast(),/无权/);assert.equal(f.driver.navigation().hotel,hotel);
  f.driverUser().active=false;f.render();assert.match(f.page(),/无权查看/);assert.equal(f.driver.rows(hotel,'orders').length,0);
});

test('linen and refunds use every floor of original factory while store orders use assigned hotel',()=>{
  const f=fixture(),own=addOrder(f,'OWN'),floorTwo=addOrder(f,'FLOOR-TWO',{floorId:hotel+'-floor-1',floorName:'2F'}),foreign=addOrder(f,'FOREIGN',{factory:foreignFactory}),other=addOrder(f,'OTHER-HOTEL',{hotel:otherHotel});
  addRefund(f,own,'R-OWN');addRefund(f,floorTwo,'R-FLOOR-TWO');addRefund(f,foreign,'R-FOREIGN');addRefund(f,other,'R-OTHER');addStore(f);addStore(f,'OTHER-STORE',{hotel:otherHotel});
  assert.deepEqual(Array.from(f.driver.rows(hotel,'orders'),o=>o.id).sort(),['FLOOR-TWO','OWN']);assert.equal(f.driver.rows(hotel,'refunds').length,2);assert.deepEqual(Array.from(f.driver.rows(hotel,'store'),o=>o.no),['STORE']);
  f.catalog.mappings[hotel]='site-factory-north';assert.equal(f.driver.rows(hotel,'orders').length,2);f.action('driverOrder:OWN');assert.match(f.html(),/布草订单详情/);
  for(const action of ['driverOrder:FOREIGN','linenDetail:FOREIGN','catOrder:OTHER-HOTEL','driverRefund:R-FOREIGN','flowReturnDetail:R-OTHER','driverStore:OTHER-STORE','flowStoreDetail:OTHER-STORE']){f.action(action);assert.equal(f.html(),'');assert.match(f.toast(),/无权|归属/);}
  f.driverUser().hotels=[];assert.equal(f.driver.rows(hotel,'orders').length,0);assert.equal(f.driver.rows(hotel,'store').length,0);assert.equal(f.driver.rows(hotel,'refunds').length,0);
});

test('driver details show hotel frozen amounts and progress without any factory costs',()=>{
  const f=fixture(),o=addOrder(f);const r=addRefund(f,o);addStore(f);
  f.data.linenRefunds.push({id:'OLD',order:o.id,hotel,factory,sku,name:'被套',quantity:1,approved:1,price:800,refundCents:800,status:'APPROVED',reason:'历史污渍'});
  f.action('driverOrder:ORDER');assert.match(f.html(),/原订单金额.*¥113\.00/);assert.match(f.html(),/已退金额.*¥8\.00/);assert.match(f.html(),/净支付.*¥105\.00/);assert.doesNotMatch(f.html(),/工厂扣减|成本|毛利|工厂净|¥3\.80/);
  f.action('driverRefund:'+r.id);assert.match(f.html(),/待退污入库|已入库|待入库/);assert.match(f.html(),/¥24\.00/);assert.doesNotMatch(f.html(),/工厂扣减|¥16\.50/);
  f.action('driverStore:STORE');assert.match(f.html(),/¥78\.00|¥39\.00/);assert.match(f.html(),/酒店收货处/);
  f.action('driverRefund:OLD');assert.match(f.html(),/历史污渍|已退款/);assert.match(f.html(),/¥8\.00/);
});

test('both hotel roles are read-only for refund actions including internal submit calls',()=>{
  const f=fixture(),o=addOrder(f);addRefund(f,o);addStore(f);f.v19.store.floorBindings[floor]='user-hotel_operator';
  for(const role of ['hotel_admin','hotel_operator']){
    f.state.role=role;const snapshot=JSON.stringify(f.data);
    assert.doesNotMatch(f.card(o),/data-action="linenApply:/);f.detail(o);assert.doesNotMatch(f.html(),/data-action="(?:linenApply|driverApply):/);
    for(const tab of ['orders','store','refunds'])assert.doesNotMatch(f.orders(tab),/data-action="(?:linenApply|driverApply):/);
    for(const action of ['linenApply:ORDER','flowSubmit:ORDER','linenSubmit','driverApply:ORDER','driverSubmit:ORDER'])f.action(action);
    assert.match(f.submit(o.id,{[sku]:1},'污渍','HOTEL-TOKEN'),/司机|无权/);assert.equal(JSON.stringify(f.data),snapshot);
    assert.match(f.orders('refunds'),/REFUND/);assert.match(f.orders('store'),/STORE/);
  }
});

test('successful multi-category submission opens exact refund detail and preserves real driver identity',()=>{
  const f=fixture(),o=addOrder(f);f.action('driverHotel:'+hotel);f.action('driverApply:'+o.id);assert.match(f.html(),/被套退污数量/);assert.match(f.html(),/床单退污数量/);assert.doesNotMatch(f.html(),/成本|工厂扣减/);
  const selectedHotel=f.catalog.hotel;f.fields({[sku]:2,'linen-sheet':3},' 两类布草有污渍 ');f.action('driverSubmit:'+o.id);
  assert.equal(f.data.returnRequests.length,1);const r=f.data.returnRequests[0];assert.equal(r.submittedBy,'user-driver');assert.equal(r.reason,'两类布草有污渍');assert.equal(r.lines.length,2);assert.equal(r.factory,factory);assert.equal(r.floorId,floor);assert.match(f.html(),/退污详情/);assert.ok(f.html().includes(r.id));assert.match(f.html(),/¥32\.50/);assert.equal(f.driver.navigation().hotels[hotel].tab,'orders');assert.equal(f.state.role,'driver');assert.equal(f.catalog.hotel,selectedHotel);
});

for(const viaDetail of [false,true])test('successful refund from '+(viaDetail?'order detail':'order card')+' returns to the same hotel, tab, page and scroll',()=>{
  const f=fixture();
  for(let n=0;n<25;n++)addOrder(f,'ORDER-'+n);
  for(let n=0;n<15;n++)addRefund(f,addOrder(f,'OLD-'+n,{createdAt:'2026-09-01T00:00:00Z'}),'OLD-REFUND-'+n);
  f.action('driverHotel:'+hotel);f.action('driverTab:refunds');f.action('driverPage:2');f.scroll.scrollTop=80;
  f.action('driverTab:orders');f.action('driverPage:2');f.scroll.scrollTop=235;
  const target=f.driver.rows(hotel,'orders')[12];
  assert.match(f.page(),new RegExp('driverApply:'+target.id+'"'));assert.match(f.page(),/第 2 \/ 4 页/);
  if(viaDetail){f.click('driverOrder:'+target.id);assert.match(f.html(),/布草订单详情/);}
  f.click('driverApply:'+target.id);const before=JSON.stringify(f.driver.navigation());
  f.fields({[sku]:2,'linen-sheet':1},'退污上下文回归');f.click('driverSubmit:'+target.id);
  const request=f.data.returnRequests[0];assert.equal(request.order,target.id);assert.match(f.html(),/退污详情/);assert.ok(f.html().includes(request.id));
  assert.equal(JSON.stringify(f.driver.navigation()),before);assert.equal(f.scroll.scrollTop,235);assert.equal(f.state.section,'司机酒店订单');
  assert.match(f.page(),/aria-selected="true" data-action="driverTab:orders"/);assert.match(f.page(),/第 2 \/ 4 页/);
  f.click('closeModal');assert.equal(f.html(),'');assert.equal(JSON.stringify(f.driver.navigation()),before);assert.equal(f.scroll.scrollTop,235);
  assert.match(f.page(),new RegExp('driverOrder:'+target.id+'"'));assert.doesNotMatch(f.page(),new RegExp('driverApply:'+target.id+'"'));
  f.action('driverTab:refunds');assert.equal(f.driver.navigation().hotels[hotel].tabs.refunds.page,2);assert.equal(f.scroll.scrollTop,80);
});

test('idempotent retry revalidates driver status, assignment, hotel and original factory before returning',()=>{
  const changes=[f=>f.driverUser().active=false,f=>f.driverUser().hotels=[],f=>f.driverUser().org=foreignFactory,f=>f.identity.orgs.find(o=>o.id===hotel).active=false,f=>f.identity.orgs.find(o=>o.id===factory).active=false,f=>f.state.role='hotel_admin'];
  for(const change of changes){const f=fixture(),o=addOrder(f),payload={[sku]:2};assert.equal(f.submit(o.id,payload,'污渍','SAME'),'');assert.equal(f.submit(o.id,payload,'污渍','SAME'),'');assert.equal(f.data.returnRequests.length,1);change(f);assert.match(f.submit(o.id,payload,'污渍','SAME'),/无权|司机/);assert.equal(f.data.returnRequests.length,1);}
  const f=fixture(),o=addOrder(f);assert.equal(f.submit(o.id,{[sku]:1},'污渍','SAME'),'');assert.match(f.submit(o.id,{[sku]:2},'污渍','SAME'),/不能更换/);assert.match(f.submit(o.id,{[sku]:1},'污渍','OTHER'),/仅可申请一次/);
});

test('draft survives invalid data and submitting after assignment revocation cannot create a request',()=>{
  const f=fixture(),o=addOrder(f);f.action('driverApply:'+o.id);const before=f.html();f.fields({[sku]:11},'保留原因');f.action('driverSubmit:'+o.id);assert.equal(f.html(),before);assert.match(f.error(),/数量/);assert.equal(f.data.returnRequests.length,0);
  f.driverUser().hotels=[];f.fields({[sku]:2},'保留原因');f.action('driverSubmit:'+o.id);assert.match(f.error(),/无权/);assert.equal(f.data.returnRequests.length,0);
});

test('24h cutoff, one request, unknown categories and malformed quantities fail without mutation',()=>{
  for(const [extra,quantities,reason,expected] of [[{deliveredAt:new Date(Date.now()-86400000).toISOString()},{[sku]:1},'污渍',/24小时/],[{progress:2},{[sku]:1},'污渍',/尚未送达/],[{}, {unknown:1},'污渍',/数量/],[{}, {[sku]:1.1},'污渍',/数量/],[{}, {[sku]:1},'污'.repeat(201),/200/]]){
    const f=fixture(),o=addOrder(f,'ORDER',extra);assert.match(f.submit(o.id,quantities,reason,'TOKEN'),expected);assert.equal(f.data.returnRequests.length,0);
  }
});

test('each tab has independent paging, scroll, empty/error and retry state across hotel return',()=>{
  const f=fixture();for(let n=0;n<23;n++){addOrder(f,'ORDER-'+n);addStore(f,'STORE-'+n);}f.action('driverHotel:'+hotel);f.action('driverPage:2');assert.match(f.page(),/第 2 \/ 3 页/);f.scroll.scrollTop=235;f.action('driverTab:store');assert.match(f.page(),/第 1 \/ 3 页/);f.action('driverPage:3');f.scroll.scrollTop=160;f.action('driverTab:orders');assert.equal(f.scroll.scrollTop,235);assert.match(f.page(),/第 2 \/ 3 页/);
  f.state.view='error';f.render();assert.match(f.page(),/布草订单加载失败/);f.action('driverTab:store');assert.equal(f.state.view,'normal');assert.match(f.page(),/第 3 \/ 3 页/);assert.equal(f.scroll.scrollTop,160);f.action('driverTab:orders');assert.match(f.page(),/布草订单加载失败/);f.action('driverRetry');assert.match(f.page(),/第 2 \/ 3 页/);
  f.scroll.scrollTop=90;f.action('driverOrder:ORDER-10');f.action('driverBack');f.action('driverHotel:'+hotel);assert.equal(f.scroll.scrollTop,90);assert.match(f.page(),/第 2 \/ 3 页/);
  f.action('driverTab:refunds');assert.match(f.page(),/暂无退污记录/);f.state.view='error';f.render();assert.match(f.page(),/退污记录加载失败/);f.action('driverRetry');assert.match(f.page(),/暂无退污记录/);
});

test('old assigned hotel survives factory switch in driver edit until explicit removal',()=>{
  const f=fixture();f.catalog.mappings[hotel]='site-factory-north';f.state.role='factory_admin';const driver=f.driverUser();const values={...driver,name:'司机甲',login:'driver',area:'城区',plate:'浙F12345',model:'厢货',contactName:'司机甲',contactPhone:'13800000000'};
  assert.equal(f.v19.saveDriver(values),'');assert.deepEqual(Array.from(driver.hotels),[hotel]);f.state.role='driver';const old=addOrder(f);assert.equal(f.submit(old.id,{[sku]:1},'污渍'),'');f.state.role='factory_admin';assert.equal(f.v19.saveDriver({...values,hotels:[],active:false}),'');assert.equal(driver.hotels.length,0);
});

test('partial inbound still credits only final full refund once and preserves original floor',()=>{
  const f=fixture(),o=addOrder(f);f.v19.store.floorCaps[floor+'|'+sku]=100;f.v19.store.floorCaps[floor+'|linen-sheet']=100;
  assert.equal(f.submit(o.id,{[sku]:3,'linen-sheet':2},'污渍','TOKEN'),'');const r=f.data.returnRequests[0];f.state.role='factory_admin';assert.equal(f.review(r.id,true,''),'');f.state.role='terminal';
  const entry=()=>f.data.entries.filter(e=>e.businessKey==='return-complete:'+r.id);assert.equal(f.receipt({token:'A',hotel,site:o.site,request:r.id,sku,quantity:1}),'');assert.equal(entry().length,0);assert.equal(r.status,'AWAITING_INBOUND');assert.equal(f.data.receipts[0].floorId,floor);
  assert.equal(f.receipt({token:'B',hotel,site:o.site,request:r.id,sku:'linen-sheet',quantity:2}),'');assert.equal(entry().length,0);const last={token:'C',hotel,site:o.site,request:r.id,sku,quantity:2};assert.equal(f.receipt(last),'');assert.equal(f.receipt(last),'');assert.equal(r.status,'REFUNDED');assert.equal(entry().length,1);assert.equal(entry()[0].cents,3500);assert.equal(f.financials(o).hotelRefund,3500);
});

test('driver fulfilment buttons follow stocking and delivery states, preserve context and never advance twice',()=>{
  const f=fixture();for(let n=0;n<12;n++)addOrder(f,'ORDER-'+n,{progress:1,deliveredAt:undefined});
  const o=f.catalog.orders[10];f.action('driverHotel:'+hotel);f.action('driverPage:2');f.scroll.scrollTop=123;f.click('driverOrder:'+o.id);
  assert.match(f.html(),new RegExp('data-action="driverLoaded:'+o.id+'"'));assert.doesNotMatch(f.html(),/driverDelivered:|stockResultOpen:|申请退污<\/button>/);
  const navigation=JSON.stringify(f.driver.navigation()),money=JSON.stringify(f.data),stock=JSON.stringify(o.stocked);
  f.click('driverLoaded:'+o.id);assert.equal(o.progress,2);assert.match(f.html(),/data-action="driverDelivered:/);assert.doesNotMatch(f.html(),/driverLoaded:/);assert.equal(f.scroll.scrollTop,123);assert.equal(JSON.stringify(f.driver.navigation()),navigation);
  f.click('driverLoaded:'+o.id);assert.equal(o.progress,2);assert.equal(o.prototypeFulfilmentEvents.length,1);assert.equal(o.deliveredAt,undefined);
  f.click('driverDelivered:'+o.id);assert.equal(o.progress,3);assert.ok(Number.isFinite(Date.parse(o.deliveredAt)));const deliveredAt=o.deliveredAt;assert.match(f.html(),/data-action="driverApply:/);assert.doesNotMatch(f.html(),/driverLoaded:|driverDelivered:/);
  f.click('driverDelivered:'+o.id);f.click('driverLoaded:'+o.id);assert.equal(o.deliveredAt,deliveredAt);assert.equal(o.prototypeFulfilmentEvents.length,2);assert.equal(o.prototypeFulfilmentEvents[1].actor,'user-driver');assert.equal(JSON.stringify(f.data),money);assert.equal(JSON.stringify(o.stocked),stock);assert.equal(JSON.stringify(f.driver.navigation()),navigation);assert.match(f.page(),/第 2 \/ 2 页/);
});

test('driver cannot load incomplete orders, skip stages or gain factory and hotel write operations',()=>{
  const f=fixture(),o=addOrder(f,'ORDER',{progress:1,deliveredAt:undefined,stocked:{'被套':10,'床单':5}});f.click('driverOrder:'+o.id);assert.match(f.html(),/driverLoaded:ORDER" disabled/);assert.match(f.html(),/尚未备齐/);
  f.click('driverLoaded:'+o.id);assert.equal(o.progress,1);assert.match(f.toast(),/尚未备齐/);f.click('driverDelivered:'+o.id);assert.equal(o.progress,1);assert.match(f.toast(),/先完成装车/);
  o.progress=0;f.click('driverOrder:'+o.id);assert.doesNotMatch(f.html(),/driverLoaded:|driverDelivered:/);f.click('driverLoaded:'+o.id);assert.equal(o.progress,0);f.click('advance:'+o.id);assert.equal(o.progress,0);
  for(const role of ['hotel_admin','hotel_operator','factory_finance','platform_finance']){f.state.role=role;f.click('driverLoaded:'+o.id);f.click('driverDelivered:'+o.id);assert.equal(o.progress,0);}
});

test('driver fulfilment rechecks assignment, original factory and enabled identity, including duplicate attempts',()=>{
  for(const change of [f=>f.driverUser().hotels=[],f=>f.driverUser().active=false,f=>f.driverUser().org=foreignFactory,f=>f.identity.orgs.find(o=>o.id===hotel).active=false,f=>f.identity.orgs.find(o=>o.id===factory).active=false]){
    const f=fixture(),o=addOrder(f,'ORDER',{progress:1,deliveredAt:undefined});f.click('driverLoaded:'+o.id);assert.equal(o.progress,2);change(f);const before=JSON.stringify(o);f.click('driverLoaded:'+o.id);assert.match(f.toast(),/无权/);f.click('driverDelivered:'+o.id);assert.match(f.toast(),/无权/);assert.equal(JSON.stringify(o),before);
  }
  const f=fixture(),foreign=addOrder(f,'FOREIGN',{factory:foreignFactory,progress:1}),unassigned=addOrder(f,'OTHER',{hotel:otherHotel,progress:2}),own=addOrder(f,'OWN',{progress:1,deliveredAt:undefined});
  f.click('driverLoaded:FOREIGN');assert.equal(foreign.progress,1);f.click('driverDelivered:OTHER');assert.equal(unassigned.progress,2);f.catalog.mappings[hotel]='site-factory-north';f.click('driverLoaded:OWN');assert.equal(own.progress,2);
});
