const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture() {
  const elements = new Map();
  const element = () => ({ value: '', addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, classList: { contains: () => false, add() {}, remove() {} } });
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, addEventListener() {}, querySelector: () => null };
  const storage = { getItem: () => null, setItem() {} };
  const context = { window: { addEventListener() {} }, document, localStorage: storage, sessionStorage: storage, setTimeout, clearTimeout, URL, location: { href: 'http://localhost/' }, history: { replaceState() {} } };
  let source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  source = source.replace(/\}\)\(\);\s*$/, `
    render=function(){}; closeModal=function(){}; modalShell=function(){}; showToast=function(){}; identityError=function(message){testError=message;};
    var testError='';
    globalThis.api={terminalTotals:flowTerminalTotals,flowSetup:flowSetup,flowAccount:flowAccount,flowQuotaSave:flowQuotaSave,flowReason:flowReason,flowSubmit:flowSubmit,flowReview:flowReview,flowReceipt:flowReceipt,flowDirectRecharge:flowDirectRecharge,businessMatch:businessMatch,businessCandidates:businessCandidates,businessScope:businessScope,identityUsers:identity.users,dashboardDates:dashboardDates,within:dashboardWithin,validateMember:identityValidate,wallet:syncWallet,dashboard:actualDashboard,state:state,menu:managementNavigation,membersHtml:function(kind,id){identity.query={org:id,q:'',role:'',status:''};return managementMemberPage(kind);},mobile:renderMobile,profile:mobileProfile,replenish:mobileReplenish,org:identityOrg,eligible:syncEligible,directoryHtml:managementDirectory,priceHtml:function(kind,id){managementPrices[kind]=id;return managementPricePage(kind);},managementRows:managementPriceRows,managementAction:managementAction,managementSection:managementSection,managementDraft:function(d){managementPriceDraft=d;},getManagementDraft:function(){return managementPriceDraft;},repair:linenRepairSnapshots,financials:linenFinancials,aggregate:linenAggregate,roles:roles,web:renderWebContent,resource:actualResource,ordered:linenOrdered,card:linenCard,html:function(tab){mobileOrderTab=tab;return mobileOrders(roles.hotel_admin);},catalog:catalog,data:syncData,setup:linenSetup,order:linenOrder,lines:linenLines,available:linenAvailable,action:linenAction,balance:syncBalance,error:function(){return testError;},draft:function(d){linenRefundDraft=d;},review:function(id){linenRefundReview=id;}};
  })();`);
  vm.runInNewContext(source, context);
  context.api.setup();
  return { ...context.api, input(id, value) { document.getElementById(id).value = value; } };
}
function apply(f, quantity) {
  f.state.role = 'hotel_admin';
  f.draft({ order: 'RP202609060086', sku: 'linen-duvet', quantity: String(quantity), reason: '明显污渍' });
  f.input('linenRefundQuantity', String(quantity)); f.input('linenRefundReason', '明显污渍');
  f.action('linenSubmit');
}

test('pending occupancy, partial approval, rejection and one-time ledger form a closed loop', () => {
  const f = fixture(), o = f.order('RP202609060086'), l = f.lines(o)[0];
  assert.equal(f.available(o, l), 20);
  apply(f, 5); f.action('linenSubmit'); assert.equal(f.data.linenRefunds.length, 1); assert.equal(f.available(o, l), 15);
  const request = f.data.linenRefunds[0], before = f.balance(o.hotel);
  f.state.role = 'factory_admin'; f.review(request.id); f.input('linenApproved', '3'); f.input('linenReviewNote', '部分通过'); f.action('linenApprove');
  assert.equal(f.available(o, l), 17); assert.equal(f.balance(o.hotel), before + 2400);
  f.review(request.id); f.action('linenApprove'); assert.equal(f.data.entries.length, 1);
  apply(f, 2); assert.equal(f.available(o, l), 15);
  f.state.role = 'factory_operator'; f.review(f.data.linenRefunds[0].id); f.input('linenReviewNote', '可正常使用'); f.action('linenReject');
  assert.equal(f.available(o, l), 17); assert.equal(f.data.entries.length, 1);
});

test('reject invalid quantity, cross-hotel request, undelivered order and missing historical price', () => {
  const f = fixture(), o = f.order('RP202609060086'), l = f.lines(o)[0];
  for (const quantity of [0, 1.5, 21]) { apply(f, quantity); assert.equal(f.data.linenRefunds.length, 0); }
  f.catalog.hotel = 'org-hotel-floorless'; apply(f, 1); assert.equal(f.data.linenRefunds.length, 0);
  o.progress = 2; assert.equal(f.available(o, l), 0);
  o.progress = 3; l.hotelPrice = null; assert.equal(f.available(o, l), 0);
});


test('reason limit is enforced even when called without native input limits', () => {
  const f = fixture(); f.state.role = 'hotel_admin';
  f.draft({ order: 'RP202609060086', sku: 'linen-duvet', quantity: '1', reason: '污'.repeat(201) });
  f.input('linenRefundQuantity', '1'); f.input('linenRefundReason', '污'.repeat(201)); f.action('linenSubmit');
  assert.equal(f.data.linenRefunds.length, 0); assert.match(f.error(), /200/);
});


test('hotel refund labels and terminal-only quantities match the PRD without review notes', () => {
  const f = fixture(); apply(f, 5);
  let html = f.html('refunds'); assert.match(html, /待检测/); assert.doesNotMatch(html, /通过 0|实退/);
  const row = f.data.linenRefunds[0]; row.status = 'APPROVED'; row.approved = 3; row.reviewNote = '不展示的核验内容';
  html = f.html('refunds'); assert.match(html, /已退款/); assert.match(html, /通过 3 件/); assert.match(html, /实退 ¥24.00/); assert.doesNotMatch(html, /不展示的核验内容|核验：/);
  row.status = 'REJECTED'; row.approved = 0; assert.match(f.html('refunds'), /已驳回/);
  const order = f.order('RP202609060086'); order.floorName = null; assert.match(f.card(order), / · 未指定</); assert.doesNotMatch(f.card(order), /未指定楼层/);
});

test('dated orders sort descending and missing or invalid dates remain stable at the end', () => {
  const f = fixture();
  const orders = [{id:'missing'}, {id:'old',createdAt:'2026-09-01 10:00'}, {id:'invalid',createdAt:'unknown'}, {id:'new',createdAt:'2026-09-15 10:00'}, {id:'same',createdAt:'2026-09-15 10:00'}];
  assert.equal(f.ordered(orders).map(o => o.id).join(','), 'new,same,old,missing,invalid');
  assert.equal(orders[0].id, 'missing');
});


test('all factory roles hide settlements and recover stale sections while platform retains the module', () => {
  const f = fixture();
  for (const key of ['factory_admin','factory_operator','factory_finance']) {
    const role = f.roles[key]; assert.equal(role.nav.includes('工厂结算'), false);
    f.state.role = key; f.state.section = '工厂结算';
    assert.doesNotMatch(f.web(role), /结算汇总/); assert.equal(f.state.section, '经营总览');
    assert.doesNotMatch(f.resource('工厂结算', role), /结算汇总/);
    assert.ok(role.nav.includes('业务报表'));
    f.state.section = '业务订单'; assert.match(f.web(role), /原工厂应收/);
  }
  for (const key of ['platform_admin','platform_ops','platform_finance']) {
    const role = f.roles[key]; assert.ok(role.nav.includes('工厂结算'));
    f.state.role = key; f.state.section = '工厂结算'; assert.match(f.web(role), /结算汇总/);
  }
});


test('approved historical refunds use frozen cost and actual refund across all aggregates', () => {
  const f=fixture(); const order={id:'MONEY',hotel:'org-hotel-yunqi',factory:'org-factory-1',total:800,progress:3,qty:{布草:100},lines:[{sku:'x',name:'布草',quantity:100,hotelPrice:800,factoryPrice:500}]};
  f.data.linenRefunds.push({id:'old',order:'MONEY',sku:'x',status:'APPROVED',quantity:10,approved:10,price:800});
  let m=f.financials(order);assert.deepEqual([m.hotelOriginal,m.hotelRefund,m.hotelNet,m.factoryOriginal,m.factoryDeduction,m.factoryNet,m.margin],[80000,8000,72000,50000,5000,45000,27000]);
  f.data.linenRefunds.push({id:'pending',order:'MONEY',sku:'x',status:'PENDING',quantity:5,approved:0,price:800},{id:'rejected',order:'MONEY',sku:'x',status:'REJECTED',quantity:6,approved:0,price:800});
  assert.equal(f.financials(order).factoryDeduction,5000);assert.equal(f.aggregate([order]).factoryNet,45000);
  f.data.entries.push({businessKey:'linen-refund:old',cents:7900});assert.equal(f.financials(order).hotelRefund,7900);
  delete order.lines[0].factoryPrice;m=f.financials(order);assert.equal(m.factoryNet,null);assert.equal(m.margin,null);assert.equal(m.hotelNet,72100);
  assert.equal(f.aggregate([order]).factoryNet,null);
});

test('overapproved quantities and duplicate refund entries are anomalies, never zero or current prices',()=>{
  const f=fixture(),o=f.order('RP202609060086');f.data.linenRefunds.push({id:'bad',order:o.id,sku:'linen-duvet',status:'APPROVED',quantity:21,approved:21,price:800});assert.equal(f.financials(o).factoryNet,null);
  f.data.linenRefunds[0].quantity=1;f.data.linenRefunds[0].approved=1;f.data.entries.push({businessKey:'linen-refund:bad',cents:800},{businessKey:'linen-refund:bad',cents:800});assert.equal(f.financials(o).hotelNet,null);
});

test('report retains all order counts while delivered-only approval counts and amounts match settlements',()=>{
  const f=fixture(); apply(f,5); const row=f.data.linenRefunds[0]; row.status='APPROVED';row.approved=3;
  f.state.role='factory_admin';let html=f.resource('业务报表',f.roles.factory_admin);
  assert.match(html,/<td>2<\/td><td>184<\/td><td>1<\/td><td>3<\/td><td>¥254\.40<\/td><td>¥16\.50<\/td><td>¥237\.90<\/td>/);
  assert.match(html,/累计原布草件数/);assert.match(html,/退污通过件数/);
  f.state.section='退污退款';html=f.web(f.roles.factory_admin);assert.match(html,/¥16\.50/);assert.doesNotMatch(html,/¥24\.00|¥40\.00|申请金额|实际退款/);
  f.state.role='platform_admin';html=f.resource('工厂结算',f.roles.platform_admin);
  assert.match(html,/<td>1<\/td><td>64<\/td><td>3<\/td><td>¥254\.40<\/td><td>¥16\.50<\/td><td>¥237\.90<\/td>/);
});


test('legacy cache snapshot upgrade is evidence-based, idempotent and preserves approved refunds',()=>{
  const f=fixture(),o=f.order('RP202609060086');delete o.lines[0].factoryPrice;delete o.lines[1].factoryPrice;delete o.lines[2].factoryPrice;
  const seed=f.order('RP202609070018');delete seed.lines;
  const old={id:'RP1789000000000',hotel:'org-hotel-yunqi',factory:'org-factory-1',qty:{'被套':2,'床单':3,'浴巾':4},total:43.7,progress:3};f.catalog.orders.push(old);
  f.data.balances[old.hotel]=123456;f.data.linenRefunds.push({id:'legacy-approved',order:old.id,sku:'linen-duvet',quantity:1,approved:1,price:800,status:'APPROVED'});
  const balances=JSON.stringify(f.data.balances),refunds=JSON.stringify(f.data.linenRefunds),entries=JSON.stringify(f.data.entries);
  assert.equal(f.repair(),true);assert.equal(o.lines[0].factoryPrice,550);assert.equal(seed.lines[0].hotelPrice,800);assert.equal(old.lines[0].factoryPrice,550);assert.equal(f.financials(old).factoryDeduction,550);
  const audit=JSON.stringify(f.catalog.snapshotRepairs);assert.equal(f.repair(),false);assert.equal(JSON.stringify(f.catalog.snapshotRepairs),audit);
  assert.equal(JSON.stringify(f.data.balances),balances);assert.equal(JSON.stringify(f.data.linenRefunds),refunds);assert.equal(JSON.stringify(f.data.entries),entries);
});

test('newer cache uses only a unique saved total and leaves ambiguous or valid snapshots intact',()=>{
  const f=fixture();const unique={id:'RP1789000000001-new',total:24,factoryTotal:17,qty:{A:2,B:1},lines:[{sku:'a',name:'A',quantity:2,hotelPrice:800,factoryPrice:500},{sku:'b',name:'B',quantity:1,hotelPrice:800}],progress:3};
  const ambiguous={id:'RP1789000000002-new',total:24,factoryTotal:17,qty:{A:2,B:1},lines:[{sku:'a',name:'A',quantity:2,hotelPrice:800},{sku:'b',name:'B',quantity:1,hotelPrice:800}],progress:3};
  const unknown={id:'RP1789000000003',total:999,qty:{被套:2},progress:3};f.catalog.orders.push(unique,ambiguous,unknown);f.repair();assert.equal(unique.lines[1].factoryPrice,700);assert.equal(unique.lines[0].factoryPrice,500);assert.equal(ambiguous.lines[0].factoryPrice,undefined);assert.equal(unknown.lines,undefined);assert.equal(f.financials(ambiguous).factoryNet,null);
});


test('repair rejects excessive precision and empty legacy orders, retaining legitimate zero quantity lines',()=>{
  const f=fixture();const precision={id:'RP1789000000004-new',total:8,factoryTotal:5.001,qty:{A:1},lines:[{sku:'a',name:'A',quantity:1,hotelPrice:800}]};const empty={id:'RP1789000000005',total:0,qty:{被套:0,床单:0,浴巾:0}};const nonempty={id:'RP1789000000006',total:8,qty:{被套:1,床单:0,浴巾:0}};f.catalog.orders.push(precision,empty,nonempty);f.repair();assert.equal(precision.lines[0].factoryPrice,undefined);assert.equal(empty.lines,undefined);assert.equal(nonempty.lines.length,3);assert.equal(f.financials(nonempty).factoryOriginal,550);
});


test('hotel card shows financial summary only when the order has a refund request of any status',()=>{
  const f=fixture(),order=f.order('RP202609060086');
  assert.doesNotMatch(f.card(order),/原订单金额|已退金额|净支付|已通过退污/);
  assert.match(f.card(order),/369.60/);
  apply(f,1);
  for(const status of ['PENDING','APPROVED','REJECTED']) {
    f.data.linenRefunds[0].status=status;
    assert.match(f.card(order),/原订单金额/);
    assert.match(f.card(order),/净支付/);
  }
  assert.doesNotMatch(f.card(f.order('RP202609070018')),/原订单金额|净支付/);
});


test('platform modules are split and legacy names resolve without exposing factory-only data',()=>{
 const f=fixture();for(const key of ['platform_admin','platform_ops','platform_finance']){const nav=f.roles[key].nav;assert.ok(nav.includes('酒店档案'));assert.ok(nav.includes('工厂协议价'));assert.ok(!nav.includes('客户与组织'));assert.ok(!nav.includes('协议价格'));}
 assert.equal(f.managementSection('酒店与站点'),'酒店档案');assert.equal(f.managementSection('洗涤厂与站点'),'工厂档案');assert.equal(f.managementSection('协议价格'),'酒店协议价');
 for(const key of ['factory_admin','factory_operator','factory_finance'])assert.ok(!f.roles[key].nav.includes('酒店协议价'));
});

test('split price rows include unset SKUs and save zero independently without changing order snapshots',()=>{
 const f=fixture();f.state.role='platform_admin';const rows=f.managementRows('hotel','org-hotel-yunqi');assert.ok(rows.some(r=>!r.configured));const beforeOrders=JSON.stringify(f.catalog.orders),factoryBefore=JSON.stringify(f.data.linenPrices.factory);
 f.managementDraft({kind:'hotel',org:'org-hotel-yunqi',sku:'linen-duvet',before:800,saving:false});f.input('managementPriceAmount','0');f.managementAction('managementPriceSave');
 assert.equal(f.data.linenPrices.hotel['org-hotel-yunqi|linen-duvet'],0);assert.equal(f.managementRows('hotel','org-hotel-yunqi').find(r=>r.sku.id==='linen-duvet').configured,true);assert.equal(JSON.stringify(f.data.linenPrices.factory),factoryBefore);assert.equal(JSON.stringify(f.catalog.orders),beforeOrders);assert.equal(f.getManagementDraft(),null);f.managementAction('managementPriceSave');
 for(const kind of ['hotel','factory']){const html=f.priceHtml(kind,kind==='hotel'?'org-hotel-yunqi':'org-factory-1');assert.doesNotMatch(html,/设置状态|已设置/);assert.match(html,/当前协议价/);assert.match(html,/未设置/);}assert.match(f.priceHtml('hotel','org-hotel-yunqi'),/¥0\.00/);
});

test('price errors preserve input and stale snapshots cannot overwrite another change',()=>{
 const f=fixture();f.state.role='platform_admin';f.managementRows('hotel','org-hotel-yunqi');f.managementDraft({kind:'hotel',org:'org-hotel-yunqi',sku:'linen-duvet',before:800,saving:false});f.input('managementPriceAmount','1.234');f.managementAction('managementPriceSave');assert.equal(f.getManagementDraft().amount,'1.234');assert.equal(f.data.linenPrices.hotel['org-hotel-yunqi|linen-duvet'],800);
 f.data.linenPrices.hotel['org-hotel-yunqi|linen-duvet']=900;f.input('managementPriceAmount','10');f.managementAction('managementPriceSave');assert.match(f.error(),/其他操作/);assert.equal(f.data.linenPrices.hotel['org-hotel-yunqi|linen-duvet'],900);
 f.state.role='factory_operator';f.managementAction('managementPriceSave');assert.equal(f.data.linenPrices.hotel['org-hotel-yunqi|linen-duvet'],900);
});


test('directory and immediate price pages omit simulated paging and sort SKU names',()=>{
 const f=fixture();f.state.role='platform_admin';assert.doesNotMatch(f.directoryHtml('hotel'),/class="pagination"/);const html=f.priceHtml('hotel','org-hotel-yunqi');assert.doesNotMatch(html,/class="pagination"/);const names=f.managementRows('hotel','org-hotel-yunqi').map(r=>r.sku.name);assert.equal(names.join(','),[...names].sort((a,b)=>a.localeCompare(b,'zh-CN')).join(','));
});

test('inactive organizations can maintain prices without restoring order eligibility',()=>{
 const f=fixture();f.state.role='platform_admin';f.managementRows('hotel','org-hotel-yunqi');f.org('org-hotel-yunqi').active=false;assert.match(f.priceHtml('hotel','org-hotel-yunqi'),/managementPriceEdit/);f.managementDraft({kind:'hotel',org:'org-hotel-yunqi',sku:'linen-duvet',before:800,saving:false});f.input('managementPriceAmount','9.50');f.managementAction('managementPriceSave');assert.equal(f.data.linenPrices.hotel['org-hotel-yunqi|linen-duvet'],950);assert.equal(f.org('org-hotel-yunqi').active,false);assert.equal(f.eligible('org-hotel-yunqi').length,0);
});


test('hotel mobile uses image tabs and removes employee paths, identity badge and repeated header copy',()=>{
 const f=fixture();f.state.role='hotel_admin';f.state.section='员工';let html=f.mobile(f.roles.hotel_admin);assert.equal(f.state.section,'我的');assert.doesNotMatch(html,/员工账号|当前身份|优洗通 · 酒店管理员/);assert.equal((html.match(/class="mobile-tab-icon"/g)||[]).length,4);assert.match(html,/tab-profile-active.svg/);assert.doesNotMatch(f.replenish(f.roles.hotel_admin),/下单校验|提交时校验品类额度/);
 for(const name of ['replenish','orders','store','profile'])for(const suffix of ['','-active'])assert.match(fs.readFileSync(path.join(__dirname,'../assets/icons/tab-'+name+suffix+'.svg'),'utf8'),/viewBox="0 0 24 24"/);
});

test('sidebar renders local stateful SVGs and accessible labels',()=>{
 const f=fixture();f.state.role='platform_admin';f.state.section='酒店档案';const html=f.menu(f.roles.platform_admin);assert.match(html,/nav-hotel-active.svg/);assert.match(html,/aria-label="酒店档案" aria-current="page"/);assert.doesNotMatch(html,/class="nav-symbol">[^<]/);for(const match of html.matchAll(/src="([^"]+)"/g))assert.ok(fs.existsSync(path.join(__dirname,'..',match[1])));
});

test('member pages default to all members of the selected type with one filter group',()=>{
 const f=fixture();f.state.role='platform_admin';const html=f.membersHtml('hotel','');assert.match(html,/<table/);assert.match(html,/managementMemberAdd:hotel/);assert.doesNotMatch(html,/维护账号/);assert.match(html,/>编辑<\/button>/);assert.equal((html.match(/class="filter-bar/g)||[]).length,1);assert.doesNotMatch(html,/value="org-factory-1"/);assert.match(html,/全部酒店/);assert.match(f.membersHtml('factory',''),/managementMemberAdd:factory/);assert.doesNotMatch(f.membersHtml('factory','org-hotel-yunqi'),/<table/);
});

test('all-organizations prices and wallet defaults do not invent an aggregate balance',()=>{
 const f=fixture();f.state.role='platform_admin';assert.ok(f.managementRows('hotel','').length>f.managementRows('hotel','org-hotel-yunqi').length);const html=f.priceHtml('hotel','');assert.match(html,/酒店名称/);assert.match(html,/managementPriceKeyword/);assert.doesNotMatch(html,/设置状态/);const wallet=f.wallet();assert.match(wallet,/全部酒店/);assert.doesNotMatch(wallet,/sync-wallet-balance/);assert.match(wallet,/酒店名称/);
});
test('dashboard grouping preserves factory isolation',()=>{
 const f=fixture();const p=f.dashboard(f.roles.platform_admin),factory=f.dashboard(f.roles.factory_operator);for(const label of ['业务概况','酒店金额','工厂应付','平台资金'])assert.match(p,new RegExp('<h3>'+label));assert.match(factory,/<h3>工厂应收/);assert.doesNotMatch(factory,/酒店金额|酒店原额|平台资金|平台净毛利/);
});

test('typed member creation rejects other organization kinds and stopped organizations',()=>{
 const f=fixture();f.state.role='platform_admin';assert.match(f.validateMember({memberKind:'hotel',org:'org-factory-1'}),/当前类型/);f.org('org-hotel-yunqi').active=false;assert.match(f.validateMember({memberKind:'hotel',org:'org-hotel-yunqi'}),/启用组织/);
});

test('dashboard date cohort includes boundary days and filters orders without changing prices',()=>{
 const f=fixture();f.dashboardDates.preset='custom';f.dashboardDates.start='2026-09-06';f.dashboardDates.end='2026-09-06';assert.equal(f.within('2026-09-06 23:59'),true);assert.equal(f.within('2026-09-07 00:00'),false);assert.equal(f.within('unknown'),false);const html=f.dashboard(f.roles.platform_admin);assert.match(html,/369.60/);assert.doesNotMatch(html,/WORKSPACE|1,075.60/);f.dashboardDates.start='2025-01-01';f.dashboardDates.end='2025-12-31';assert.doesNotMatch(f.dashboard(f.roles.platform_admin),/369.60/);
});

test('invalid dashboard drafts never change the applied date cohort',()=>{
 const f=fixture();f.dashboardDates.preset='custom';f.dashboardDates.start='2026-09-06';f.dashboardDates.end='2026-09-06';f.dashboardDates.draftStart='2026-10-01';f.dashboardDates.draftEnd='2026-09-01';const html=f.dashboard(f.roles.platform_admin);assert.match(html,/369.60/);assert.match(html,/id="dashboardStart" type="date" value="2026-10-01"/);assert.match(html,/id="dashboardEnd" type="date" value="2026-09-01"/);assert.equal(f.within('2026-09-06'),true);
});

test('user permissions page is fixed to platform org while retaining existing role policy',()=>{
 const f=fixture();f.state.role='platform_admin';f.state.section='平台成员';let html=f.web(f.roles.platform_admin);assert.match(html,/identityAdd:org-platform/);assert.doesNotMatch(html,/hotel_operator|factory_operator|value="org-hotel-yunqi"/);assert.doesNotMatch(html,/value="driver"/);assert.match(html,/value="platform_admin"/);f.state.role='platform_ops';html=f.web(f.roles.platform_ops);assert.doesNotMatch(html,/identityAdd/);assert.doesNotMatch(html,/data-action="identityEdit:user-platform_admin"/);f.state.role='platform_finance';html=f.web(f.roles.platform_finance);assert.doesNotMatch(html,/identityAdd|identityEdit/);
});

test('platform organization cannot accept driver accounts',()=>{
 const f=fixture();f.state.role='platform_admin';const error=f.validateMember({org:'org-platform',name:'司机测试',login:'new_driver_probe',role:'driver',area:'东区',hotels:['org-hotel-yunqi']});assert.match(error,/角色与所属组织/);
});

test('unknown cached platform drivers are preserved and flagged rather than reassigned',()=>{
 const f=fixture();f.identityUsers.push({id:'old-platform-driver',org:'org-platform',role:'driver',name:'历史司机',login:'legacy_driver',active:true,createdAt:'2026-09-01',hotels:[],area:''});f.state.role='platform_admin';f.state.section='平台成员';assert.doesNotMatch(f.web(f.roles.platform_admin),/legacy_driver/);f.state.section='司机管理';const html=f.web(f.roles.platform_admin);assert.match(html,/legacy_driver/);assert.match(html,/归属异常，待核查/);assert.doesNotMatch(html,/identityEdit:old-platform-driver/);assert.equal(f.identityUsers.find(u=>u.id==='old-platform-driver').org,'org-platform');
});

test('factory members exclude drivers while driver management retains them',()=>{
 const f=fixture();f.state.role='platform_admin';f.state.section='工厂成员';const members=f.web(f.roles.platform_admin);assert.doesNotMatch(members,/value="driver"|identityEdit:user-driver/);assert.match(members,/factory_admin/);assert.match(f.validateMember({memberKind:'factory',org:'org-factory-1',role:'driver'}),/司机管理/);f.state.section='司机管理';assert.match(f.web(f.roles.platform_admin),/identityEdit:user-driver/);
});

test('legacy platform menu resolves and shared member tables retain organization and action spacing',()=>{
 const f=fixture();f.state.role='platform_admin';assert.equal(f.managementSection('用户与权限'),'平台成员');f.state.section='平台成员';const html=f.web(f.roles.platform_admin);assert.match(html,/所属组织/);assert.match(html,/member-row-actions/);assert.doesNotMatch(html,/data-identity-field="org"/);assert.equal((html.match(/class="filter-bar/g)||[]).length,1);
});

test('order filters combine dates and organizations, retaining undated rows only without range',()=>{
 const f=fixture(),order=f.order('RP202609060086');assert.equal(f.businessMatch('orders',order,{hotel:order.hotel,factory:order.factory,status:'3',start_date:'2026-09-06',end_date:'2026-09-06'}),true);assert.equal(f.businessMatch('orders',order,{hotel:'other'}),false);assert.equal(f.businessMatch('orders',order,{start_date:'2026-09-07'}),false);const unknown={...order,id:'old-undated',createdAt:''};assert.equal(f.businessMatch('orders',unknown,{}),true);assert.equal(f.businessMatch('orders',unknown,{end_date:'2026-12-31'}),false);
});
test('refund filters derive hotel and historical linen candidates from original order scope',()=>{
 const f=fixture(),o=f.order('RP202609060086');f.data.linenRefunds.push({id:'filter-refund',order:o.id,hotel:'wrong-cache-hotel',factory:'wrong-cache-factory',sku:'linen-duvet',name:'被套',status:'PENDING'});const scope=f.businessScope('refunds',f.roles.factory_operator);assert.equal(scope.length,1);assert.equal(f.businessCandidates('refunds',scope,'hotel')[0].id,o.hotel);assert.equal(f.businessCandidates('refunds',scope,'sku')[0].id,'linen-duvet');assert.equal(f.businessMatch('refunds',scope[0],{hotel:o.hotel,sku:'linen-duvet',status:'PENDING'}),true);assert.equal(f.businessMatch('refunds',scope[0],{sku:'other'}),false);
});

test('version 2 whole-order return refunds once only after every approved item is received',()=>{
 const f=fixture(),o=f.order('RP202609060086');o.deliveredAt=new Date().toISOString();f.flowSetup();f.state.role='platform_admin';assert.equal(f.flowQuotaSave([{hotel:o.hotel,sku:'linen-duvet',cap:80},{hotel:o.hotel,sku:'linen-sheet',cap:90}]),'');assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,0);const balance=f.balance(o.hotel);f.state.role='hotel_admin';assert.equal(f.flowSubmit(o.id,{'linen-duvet':5,'linen-sheet':2},'污渍'), '');const r=f.data.returnRequests[0];assert.match(f.card(o),/有退污/);assert.match(f.flowSubmit(o.id,{'linen-duvet':1},'再次'),/仅可申请一次/);f.state.role='factory_operator';assert.equal(f.flowReview(r.id,true,''),'');assert.equal(r.status,'AWAITING_INBOUND');assert.equal(f.balance(o.hotel),balance);assert.equal(f.financials(o).hotelRefund,0);f.state.role='terminal';const receipt=(token,sku,quantity)=>f.flowReceipt({token,site:o.site,hotel:o.hotel,request:r.id,sku,quantity});assert.equal(receipt('batch-1','linen-duvet',3),'');assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,3);assert.equal(receipt('batch-1','linen-duvet',3),'');assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,3);assert.match(receipt('too-many','linen-duvet',3),/数量已变化/);assert.equal(receipt('batch-2','linen-duvet',2),'');assert.equal(f.balance(o.hotel),balance);assert.equal(receipt('batch-3','linen-sheet',2),'');assert.equal(r.status,'REFUNDED');assert.equal(f.balance(o.hotel),balance+5100);assert.equal(f.financials(o).hotelRefund,5100);assert.equal(f.financials(o).factoryDeduction,3510);assert.equal(receipt('batch-3','linen-sheet',2),'');assert.equal(f.balance(o.hotel),balance+5100);o.stocked={'被套':20};assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,5);
});
test('return cutoff and rejected once-only remain, quota uses only actual inbound and new orders',()=>{
 const f=fixture(),o=f.order('RP202609060086');f.flowSetup();assert.match(f.flowReason(o),/可靠送达时间/);o.deliveredAt=new Date(Date.now()-86400000).toISOString();assert.match(f.flowReason(o),/24小时/);o.deliveredAt=new Date().toISOString();f.state.role='hotel_admin';assert.equal(f.flowSubmit(o.id,{'linen-duvet':1},'脏污'),'');f.state.role='factory_operator';assert.equal(f.flowReview(f.data.returnRequests[0].id,false,'不符合'),'');assert.match(f.flowReason(o),/仅可申请一次/);assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,0);f.state.role='terminal';assert.equal(f.flowReceipt({token:'daily',site:o.site,hotel:o.hotel,sku:'linen-duvet',quantity:50}),'');assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,50);f.catalog.orders.push({...o,id:'new-order',inventoryVersion:2,lines:[{sku:'linen-duvet',name:'被套',quantity:10}],qty:{'被套':10},stocked:{}});assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,40);f.catalog.orders.at(-1).stocked={'被套':10};assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,40);f.state.role='platform_admin';f.flowQuotaSave([{hotel:o.hotel,sku:'linen-duvet',cap:0}]);assert.equal(f.flowAccount(o.hotel,'linen-duvet').amount,0);
});
test('platform direct recharge posts exactly once without bank reference or approval request',()=>{
 const f=fixture();f.state.role='platform_finance';const before=f.balance('org-hotel-yunqi'),requests=(f.data.rechargeRequests||[]).length;assert.equal(f.flowDirectRecharge('direct-1','org-hotel-yunqi',10000,'平台登记'),'');assert.equal(f.flowDirectRecharge('direct-1','org-hotel-yunqi',10000,'平台登记'),'');assert.equal(f.balance('org-hotel-yunqi'),before+10000);assert.equal((f.data.rechargeRequests||[]).length,requests);const entry=f.data.entries.find(e=>e.businessKey==='direct-recharge:direct-1');assert.equal(entry.bank,'');
});

test('terminal inbound and stocking totals are selected-hotel scoped and never mix directions',()=>{
 const f=fixture(),o=f.order('RP202609060086');f.flowSetup();f.data.receipts.push({hotel:o.hotel,sku:'linen-duvet',factory:o.factory,type:'DAILY',quantity:50},{hotel:o.hotel,sku:'linen-duvet',factory:o.factory,type:'RETURN',quantity:3},{hotel:'other',sku:'linen-duvet',factory:o.factory,type:'DAILY',quantity:999},{hotel:o.hotel,sku:'linen-duvet',factory:'other',type:'DAILY',quantity:888});o.stocked={'被套':12};const incoming=f.terminalTotals(o.hotel,'in'),outgoing=f.terminalTotals(o.hotel,'out');assert.match(incoming,/>53<\/td>/);assert.doesNotMatch(incoming,/累计出库|999|888/);assert.match(outgoing,/>12<\/td>/);assert.doesNotMatch(outgoing,/累计入库|日常入库|退污入库/);assert.doesNotMatch(f.terminalTotals('','in'),/<table/);assert.doesNotMatch(f.terminalTotals('','out'),/<table/);
});
