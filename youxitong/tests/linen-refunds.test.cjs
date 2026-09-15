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
    globalThis.api={state:state,repair:linenRepairSnapshots,financials:linenFinancials,aggregate:linenAggregate,roles:roles,web:renderWebContent,resource:actualResource,ordered:linenOrdered,card:linenCard,html:function(tab){mobileOrderTab=tab;return mobileOrders(roles.hotel_admin);},catalog:catalog,data:syncData,setup:linenSetup,order:linenOrder,lines:linenLines,available:linenAvailable,action:linenAction,balance:syncBalance,error:function(){return testError;},draft:function(d){linenRefundDraft=d;},review:function(id){linenRefundReview=id;}};
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
