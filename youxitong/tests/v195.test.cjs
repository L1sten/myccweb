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
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/\}\)\(\);\s*$/,`
    var testModal='',testPage='';
    render=function(){testPage=renderWebContent(roles[state.role]);};
    closeModal=function(){testModal='';};modalShell=function(t,s,h,f){testModal=h+(f||'');};showToast=function(){};
    globalThis.api={state:state,data:syncData,catalog:catalog,categories:linenCategories,roles:roles,v19:v19.api,assets:v193.api,
      stats:flowStatistics,resource:actualResource,nav:managementNavigation,navigate:managementNavigate,section:managementSection,
      web:function(){return renderWebContent(roles[state.role]);},identity:identityRender,action:linenAction,
      html:function(){return testModal;},page:function(){return testPage;},
      replenish:mobileReplenish,products:syncProducts};
  })();`);
  vm.runInNewContext(source,context);
  context.api.fields=values=>{document.getElementById('prototypeModal').querySelectorAll=selector=>selector==='[data-v19-field]'?Object.entries(values).map(([key,value])=>({dataset:{v19Field:key},value:String(value)})):[];};
  context.api.state.role='factory_admin';
  context.api.state.section='布草统计';
  context.api.data.receipts=[];
  return context.api;
}

const factory='org-factory-1',foreign='org-factory-legacy',sku='linen-duvet';
function receipt(hotel,type,quantity,extra={}){return {hotel,sku,type,quantity,factory,...extra};}
function stock(hotel,quantity,extra={}){return {id:'STOCK-'+hotel,hotel,factory,inventoryVersion:2,lines:[{sku,name:'历史被套',quantity:100}],stocked:{'历史被套':quantity},...extra};}
function totals(f,id=sku){const r=f.stats().rows.find(r=>r.sku===id);return r&&[r.daily,r.refund,r.incoming,r.out];}

test('statistics merge hotels into one SKU row using all historical receipts and successful stocking',()=>{
  const f=fixture();
  f.data.receipts.push(receipt('old-hotel','DAILY',12),receipt('second-hotel','DAILY',7),receipt('old-hotel','RETURN',3),receipt('second-hotel','RETURN',2));
  f.catalog.orders.push(stock('old-hotel',4,{inventoryVersion:1}),stock('second-hotel',5),stock('pending-hotel',0));
  f.catalog.mappings={'old-hotel':'site-factory-north'};f.catalog.hotel='unrelated-preview-hotel';f.data.quotas={};f.data.hotelLinen={};
  assert.equal(f.stats().error,'');assert.deepEqual(totals(f),[19,5,24,9]);
  assert.equal(f.stats().rows.filter(r=>r.sku===sku).length,1);
  const html=f.web();
  assert.deepEqual([...html.matchAll(/<th>(.*?)<\/th>/g)].map(m=>m[1]),['布草品类','日常入库','退污入库','累计入库','累计出库']);
  assert.doesNotMatch(html,/old-hotel|second-hotel|linen-duvet|SKU|当前可用|唯一登记数量|备货出库/);
  assert.match(html,/<td>被套<\/td><td>19<\/td><td>5<\/td><td>24<\/td><td>9<\/td>/);
});

test('factory identity isolates inbound and outbound even when a hotel has records in two factories',()=>{
  const f=fixture();
  f.data.receipts.push(receipt('shared-hotel','DAILY',3),receipt('shared-hotel','RETURN',2),receipt('shared-hotel','DAILY',800,{factory:foreign}));
  f.catalog.orders.push(stock('shared-hotel',4),stock('shared-hotel',99,{id:'FOREIGN',factory:foreign}));
  f.state.factory=foreign;f.catalog.mappings['shared-hotel']='site-factory-north';
  assert.deepEqual(totals(f),[3,2,5,4]);
  for(const role of ['platform_admin','platform_ops','platform_finance','factory_finance','hotel_admin']){
    f.state.role=role;assert.equal(f.stats().rows.length,0);
    assert.match(f.resource('布草统计',f.roles[role]),/无权/);
  }
});

test('enabled empty categories show zero while disabled historical inbound or outbound categories remain',()=>{
  const f=fixture();
  f.categories.find(s=>s.id===sku).active=false;
  f.categories.find(s=>s.id==='linen-sheet').active=false;
  f.categories.find(s=>s.id==='linen-towel').active=false;
  f.data.receipts.push(receipt('removed-hotel','DAILY',5));
  f.catalog.orders.push(stock('removed-hotel',0,{lines:[{sku:'linen-sheet',name:'旧床单',quantity:10}],stocked:{'旧床单':6}}));
  assert.deepEqual(totals(f),[5,0,5,0]);
  assert.deepEqual(totals(f,'linen-sheet'),[0,0,0,6]);
  assert.equal(totals(f,'linen-towel'),undefined);
  assert.deepEqual(totals(f,'linen-square-towel'),[0,0,0,0]);
});

test('statistics sort by category name and use SKU ID to keep equal names stable',()=>{
  const f=fixture();
  f.categories.splice(0,f.categories.length,{id:'id-z',name:'乙布草',active:true},{id:'id-b',name:'甲布草',active:true},{id:'id-a',name:'甲布草',active:false});
  f.data.receipts.push(receipt('old-hotel','DAILY',2,{sku:'id-a'}));
  assert.deepEqual(Array.from(f.stats().rows,r=>r.sku),['id-a','id-b','id-z']);
  f.categories.reverse();
  assert.deepEqual(Array.from(f.stats().rows,r=>r.sku),['id-a','id-b','id-z']);
});

test('initial quantities, first registration and third-party asset traces never inflate statistics',()=>{
  const f=fixture();
  assert.ok(f.assets.events().some(e=>e.action==='DAILY'));
  f.v19.store.floorInitials={'some-floor|linen-duvet':500};
  f.v19.store.chips.push({chip:'FIRST',sku,factory});
  f.data.receipts.push(receipt('old-hotel','REGISTER',40),receipt('old-hotel','DAILY',8,{token:'CONFIRMED'}));
  f.catalog.orders.push(stock('old-hotel',3));
  const before=JSON.stringify({receipts:f.data.receipts,orders:f.catalog.orders,initials:f.v19.store.floorInitials,events:f.assets.db.events});
  assert.deepEqual(totals(f),[8,0,8,3]);assert.deepEqual(totals(f),[8,0,8,3]);
  assert.equal(JSON.stringify({receipts:f.data.receipts,orders:f.catalog.orders,initials:f.v19.store.floorInitials,events:f.assets.db.events}),before);
});

test('every Web role has one linen group and ordered unique entries without widening statistics access',()=>{
  const f=fixture();
  for(const role of ['platform_admin','platform_ops','platform_finance','factory_admin','factory_operator','factory_finance']){
    f.state.role=role;const html=f.nav(f.roles[role]),allowed=['factory_admin','factory_operator'].includes(role);
    assert.equal((html.match(/class="nav-group-label">布草管理<\/div>/g)||[]).length,1);
    const linen=html.split('class="nav-group-label">布草管理</div>')[1];
    assert.deepEqual([...linen.matchAll(/data-section="([^"]+)"/g)].map(m=>m[1]),allowed?['品类配置','布草资产','布草统计']:['品类配置','布草资产']);
    for(const name of ['品类配置','布草资产','布草统计'])assert.equal((html.match(new RegExp('data-section="'+name+'"','g'))||[]).length,name==='布草统计'&&!allowed?0:1);
    assert.doesNotMatch(html,/布草与仓库|布草品类配置/);
  }
});

test('legacy sections resolve to canonical pages and highlight their canonical navigation item',()=>{
  const f=fixture();
  f.navigate('布草与仓库');assert.equal(f.state.section,'布草统计');assert.match(f.page(),/<h2>布草统计<\/h2>/);
  assert.match(f.nav(f.roles.factory_admin),/data-section="布草统计"[^>]*aria-current="page"/);
  f.navigate('布草品类配置');assert.equal(f.state.section,'品类配置');assert.match(f.page(),/<h2>品类配置<\/h2>/);
  f.state.section='布草与仓库';assert.match(f.resource(f.state.section,f.roles.factory_admin),/<h2>布草统计<\/h2>/);assert.equal(f.state.section,'布草统计');
  f.state.section='布草品类配置';assert.match(f.identity(f.state.section),/<h2>品类配置<\/h2>/);assert.equal(f.state.section,'品类配置');
  f.state.role='factory_finance';f.navigate('布草与仓库');assert.notEqual(f.state.section,'布草统计');
});

test('category edit removes image controls and preserves existing images across save and persistence',()=>{
  const f=fixture(),category=f.categories.find(s=>s.id===sku),image='data:image/png;base64,AA==';
  category.image=image;f.state.role='platform_admin';
  assert.doesNotMatch(f.v19.categoryPage(),/<th>图片<\/th>|<img/);
  f.action('v19CategoryEdit:'+sku);assert.doesNotMatch(f.html(),/type="file"|data-v19-image|PNG|JPEG|图片/);
  f.fields({name:'改名被套',unit:'套',active:'true'});f.action('v19CategorySave');
  assert.equal(category.name,'改名被套');assert.equal(category.unit,'套');assert.equal(category.image,image);
  assert.equal(f.v19.store.categories.find(s=>s.id===sku).image,image);
  f.state.role='hotel_admin';assert.match(f.replenish(f.roles.hotel_admin),/data:image\/png;base64,AA==/);
  f.state.role='platform_admin';f.action('v19CategoryEdit');assert.doesNotMatch(f.html(),/type="file"|data-v19-image|图片/);
  f.fields({name:'新建无图品类',unit:'条',active:'true'});f.action('v19CategorySave');
  assert.equal(f.categories.find(s=>s.name==='新建无图品类').image,'');
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../v19.js'),'utf8'),/categoryImage|data-v19-image|FileReader/);
});

test('statistics retain empty and error states with retry and never display invalid quantities',()=>{
  const f=fixture();
  for(const view of ['empty','error']){f.state.view=view;assert.match(f.web(),view==='error'?/数据加载失败/:/当前条件下暂无数据/);assert.match(f.web(),/data-action="restore"/);}
  f.state.view='normal';f.data.receipts.push(receipt('hotel','DAILY',-1));assert.match(f.web(),/入库记录异常/);assert.match(f.web(),/data-action="restore"/);
  f.data.receipts=[];f.catalog.orders=[];f.categories.splice(0);assert.match(f.web(),/暂无布草统计记录/);
});
