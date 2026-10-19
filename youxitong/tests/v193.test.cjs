const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fixture(){
  const elements=new Map();
  const element=()=>({value:'',addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,classList:{contains:()=>false,add(){},remove(){}}});
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(){},querySelector:()=>null};
  const storage={getItem:()=>null,setItem(){}};
  const context={window:{addEventListener(){}},document,localStorage:storage,sessionStorage:storage,setTimeout,clearTimeout,URL,location:{href:'http://localhost/'},history:{replaceState(){}}};
  for(const file of ['v19.js','v193.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../'+file),'utf8'),context);
  let source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/\}\)\(\);\s*$/,`
    render=function(){testPage=identityRender(state.section);};closeModal=function(){testModal='';};modalShell=function(t,s,h,f){testModal=h+(f||'');modalCount++;};showToast=function(m){testToast=m;};var testModal='',testToast='',testPage='',modalCount=0;
    globalThis.api={assets:v193.api,v19:v19.api,state:state,data:syncData,catalog:catalog,users:identity.users,categories:linenCategories,roles:roles,nav:managementNavigation,terminal:terminalWorkspace,action:linenAction,html:function(){return testModal;},page:function(){return testPage;},modalCount:function(){return modalCount;},toast:function(){return testToast;},validate:identityValidate,members:managementMemberPage};
  })();`);
  vm.runInNewContext(source,context);return context.api;
}
test('all six Web roles get asset nav without standalone flow or device menus',()=>{
  const f=fixture();for(const role of ['platform_admin','platform_ops','platform_finance','factory_admin','factory_operator','factory_finance']){f.state.role=role;const nav=f.nav(f.roles[role]);for(const text of ['布草品类配置','布草资产'])assert.equal((nav.match(new RegExp('data-section="'+text+'"','g'))||[]).length,1);assert.doesNotMatch(nav,/终端设备|RFID 扫描记录|布草登记|data-section="流转记录"/);}
});
test('asset list, detail and flows share EPCs and unique completed wash cycles',()=>{
  const f=fixture();for(const asset of f.assets.assets()){const flows=f.assets.events().filter(x=>x.epc===asset.epc);assert.equal(asset.washes,new Set(flows.filter(x=>x.action==='WASH_COMPLETE').map(x=>x.cycle)).size);assert.equal(asset.updated,flows.at(-1).time);f.assets.detail(asset.epc);assert.match(f.html(),/追踪记录/);f.action('assetTraceSize:'+asset.epc+':100');for(const flow of flows)assert.ok(f.html().includes('data-record-id="'+flow.id+'"'));}assert.equal(f.assets.assets()[0].washes,2);
});
test('factory scope cannot inspect foreign EPC via direct detail action',()=>{
  const f=fixture(),foreign=f.assets.assets().find(x=>x.factory!=='org-factory-1');f.state.role='factory_operator';assert.ok(f.assets.assets().every(x=>x.factory==='org-factory-1'));assert.ok(f.assets.events().every(x=>x.factory==='org-factory-1'));f.action('assetDetail:'+foreign.epc);assert.match(f.toast(),/无权/);assert.equal(f.html(),'');f.state.role='hotel_admin';assert.equal(f.assets.assets().length,0);f.action('assetDetail:'+foreign.epc);assert.match(f.toast(),/无权/);
});
test('filters combine keyword, hotel, stage and dates before pagination and count',()=>{
  const f=fixture();Object.assign(f.assets.queries.assets,{q:'被套',hotel:'org-hotel-yunqi',stage:'AT_HOTEL',from:'2026-10-01',to:'2026-10-01'});assert.equal(f.assets.filtered('assets').length,1);assert.match(f.assets.assetPage(),/共 1 件/);f.assets.queries.assets.from='2026-10-02';assert.equal(f.assets.filtered('assets').length,0);assert.match(f.assets.assetPage(),/暂无符合条件/);f.action('assetReset:assets');assert.equal(f.assets.filtered('assets').length,6);assert.equal(f.assets.pages.assets,1);
});
test('asset links navigate to an order page without opening a modal and restore trace context',()=>{
  const f=fixture(),asset=f.assets.assets()[0];
  f.assets.queries.assets.q='被套';
  f.assets.detail(asset.epc);f.action('assetTracePage:'+asset.epc+':2');
  const order=f.assets.events().find(e=>e.epc===asset.epc&&e.action==='STOCKING').document;
  const before=f.modalCount();
  f.action('assetOrder:'+encodeURIComponent(asset.epc)+':'+encodeURIComponent(order));
  assert.equal(f.modalCount(),before);assert.equal(f.html(),'');assert.equal(f.state.section,'业务订单');
  assert.match(f.page(),/履约状态|关联芯片/);assert.match(f.page(),/返回布草资产/);
  f.action('assetOrderBack');assert.equal(f.state.section,'布草资产');
  assert.equal(f.assets.queries.assets.q,'被套');assert.match(f.html(),/aria-current="page">2/);assert.match(f.html(),/value="10" selected/);
  f.action('assetOrder:'+encodeURIComponent(asset.epc)+':UNRELATED');assert.match(f.toast(),/无权|不存在/);
  f.state.role='factory_operator';const foreign=f.assets.db.assets.find(a=>a.factory!=='org-factory-1');
  f.action('assetOrder:'+foreign.epc+':RP-SAMPLE-6-1');assert.match(f.toast(),/无权|不存在/);
});
test('trace pagination is complete and stable without repeating records or inventing fields',()=>{
  const f=fixture(),a=f.assets.assets()[0];f.assets.detail(a.epc);
  const first=Array.from(f.html().matchAll(/data-record-id="([^"]+)"/g),m=>m[1]);assert.equal(first.length,10);
  assert.match(f.html(),/共 15 条/);assert.match(f.html(),/追踪工位/);assert.match(f.html(),/工作组/);assert.doesNotMatch(f.html(),/第三方作业系统|asset-timeline|关联业务订单/);
  f.action('assetTracePage:'+a.epc+':2');const second=Array.from(f.html().matchAll(/data-record-id="([^"]+)"/g),m=>m[1]);assert.equal(second.length,5);assert.equal(new Set([...first,...second]).size,15);
  f.action('assetTracePage:'+a.epc+':99');assert.match(f.toast(),/请输入1至2/);assert.match(f.html(),/aria-current="page">2/);
  f.action('assetTraceSize:'+a.epc+':20');assert.equal((f.html().match(/data-record-id/g)||[]).length,15);assert.match(f.html(),/aria-current="page">1/);
});
test('asset list removes summary and stage filter while retaining lifecycle detail',()=>{
  const f=fixture(),html=f.assets.assetPage();assert.doesNotMatch(html,/唯一登记数量|查看流转记录|data-asset-field="stage"/);
  f.action('assetFlows');assert.equal(f.state.section,'布草资产');
});
test('legacy chips remain readonly and unknown wash counts are not replaced with zero',()=>{
  const f=fixture();f.data.v191={chips:[{epc:'E280FFFF',sku:'linen-duvet',factory:'org-factory-1',site:'site-factory-east'}],batches:[{id:'old'}],archives:[{epc:'E280AAAA'}]};f.v19.store.chips.push({chip:'E280FFFF',sku:'linen-duvet',factory:'org-factory-1'});const snapshot=JSON.stringify(f.data.v191);const asset=f.assets.assets().find(x=>x.epc==='E280FFFF');assert.equal(asset.washes,null);assert.equal(asset.stage,'UNKNOWN');assert.equal(f.assets.assets().filter(x=>x.epc==='E280FFFF').length,1);assert.ok(!f.assets.assets().some(x=>x.epc==='E280AAAA'));f.assets.detail(asset.epc);assert.match(f.html(),/待核查|待核对/);assert.equal(JSON.stringify(f.data.v191),snapshot);
});
test('old terminal URL has no scanning controls and obsolete actions cannot alter business data',()=>{
  const f=fixture();f.state.role='terminal';assert.match(f.terminal(),/第三方/);assert.doesNotMatch(f.terminal(),/开始扫描|连接设备|data-action/);const before=JSON.stringify(f.data);for(const action of ['rfidCommit','terminalSubmit','flowInboundSave','flowNewBatch'])f.action(action);assert.equal(JSON.stringify(f.data),before);assert.match(f.toast(),/第三方/);
});
test('operator creation no longer requires a station and factory members have no device controls',()=>{
  const f=fixture();f.state.role='platform_admin';const d={id:'',org:'org-factory-1',role:'factory_operator',memberKind:'factory',name:'新操作员',login:'newoperator',active:true,password:'Abc12345',confirmation:'Abc12345',hotels:[],area:''};assert.equal(f.validate(d),'');assert.doesNotMatch(f.members('factory'),/所属站点|设备绑定/);
});
test('long EPC and names are escaped, actions are readonly and no scrap is offered',()=>{
  const f=fixture();f.assets.db.assets[0].epc='E280<unsafe>';const html=f.assets.assetPage();assert.match(html,/E280&lt;unsafe&gt;/);assert.doesNotMatch(html,/<unsafe>|报废|预建芯片|登记设备|开始扫描/);f.assets.detail('E280<unsafe>');assert.match(f.html(),/E280&lt;unsafe&gt;/);
});
