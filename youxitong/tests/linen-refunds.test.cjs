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
    globalThis.api={state:state,roles:roles,web:renderWebContent,resource:actualResource,ordered:linenOrdered,card:linenCard,html:function(tab){mobileOrderTab=tab;return mobileOrders(roles.hotel_admin);},catalog:catalog,data:syncData,setup:linenSetup,order:linenOrder,lines:linenLines,available:linenAvailable,action:linenAction,balance:syncBalance,error:function(){return testError;},draft:function(d){linenRefundDraft=d;},review:function(id){linenRefundReview=id;}};
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
    f.state.section = '业务订单'; assert.match(f.web(role), /工厂结算/);
  }
  for (const key of ['platform_admin','platform_ops','platform_finance']) {
    const role = f.roles[key]; assert.ok(role.nav.includes('工厂结算'));
    f.state.role = key; f.state.section = '工厂结算'; assert.match(f.web(role), /结算汇总/);
  }
});
