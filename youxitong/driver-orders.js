(function (global) {
  'use strict';
  // V1.9.6: one driver identity, explicit original-factory scope, no hotel impersonation.
  // Navigation is transient. This module never seeds, resets or rewrites business history.
  global.YouxitongDriverOrders = function (c) {
    var state=c.state, data=c.data, catalog=c.catalog, esc=c.esc, button=c.button;
    var navigation={hotel:'',hotels:{},homeScroll:0}, draft=null, restoreScroll=null;
    var labels={orders:'布草订单',store:'商城订单',refunds:'退污记录'}, pageSize=10;
    function amount(value){return c.amount(Number.isSafeInteger(value)&&value>=0?value:null);}
    function hotelState(id){
      if(!navigation.hotels[id])navigation.hotels[id]={tab:'orders',tabs:{orders:{page:1,scroll:0,view:'normal'},store:{page:1,scroll:0,view:'normal'},refunds:{page:1,scroll:0,view:'normal'}}};
      return navigation.hotels[id];
    }
    function active(){return hotelState(navigation.hotel);}
    function scrollElement(){return c.root.querySelector('.mobile-scroll');}
    function remember(){var el=scrollElement();if(state.section==='司机酒店订单'&&navigation.hotel)active().tabs[active().tab].scroll=el?el.scrollTop:0;else navigation.homeScroll=el?el.scrollTop:0;}
    function repaint(position){restoreScroll=position;c.render();}
    function afterRender(){
      if(state.role!=='driver')return;
      if(restoreScroll!==null){var el=scrollElement();if(el)el.scrollTop=restoreScroll;restoreScroll=null;}
      var field=c.document.getElementById('viewSelect');if(field)field.value=state.view;
    }
    function deny(message){c.close();c.toast(message||'订单不存在或无权访问');if(state.role==='driver'&&state.section==='司机酒店订单')repaint(0);return true;}
    function reset(){navigation={hotel:'',hotels:{},homeScroll:0};draft=null;restoreScroll=null;}
    function validHotel(id){return !c.scopeError(id);}
    function order(id){return catalog.orders.find(function(o){return o.id===id;});}
    function refund(id){return (data.returnRequests||[]).find(function(r){return r.id===id;})||(data.linenRefunds||[]).find(function(r){return r.id===id&&!r.protocol2;});}
    function refundError(row){var o=row&&order(row.order);return !row||!o||row.hotel!==o.hotel||row.factory!==o.factory?'退污记录不存在或归属待核查':c.orderError(o)||c.scopeError(row.hotel,row.factory);}
    function storeError(row){return !row?'商城订单不存在或无权访问':c.scopeError(row.hotel);}
    function rows(hotel,tab){
      c.setup();if(c.scopeError(hotel))return [];
      if(tab==='orders')return c.ordered(catalog.orders.filter(function(o){return o.hotel===hotel&&!c.orderError(o);}));
      if(tab==='store')return (data.storeOrders||[]).filter(function(o){return o.hotel===hotel&&!storeError(o);}).slice().sort(function(a,b){return (Date.parse(b.time)||0)-(Date.parse(a.time)||0);});
      return (data.returnRequests||[]).concat((data.linenRefunds||[]).filter(function(r){return !r.protocol2;})).filter(function(r){return r.hotel===hotel&&!refundError(r);}).slice().sort(function(a,b){return (Date.parse(b.time)||0)-(Date.parse(a.time)||0);});
    }
    function home(role){
      var driver=c.driver(),hotels=driver?(driver.hotels||[]).filter(function(id,i,ids){return ids.indexOf(id)===i&&validHotel(id);}).map(c.org):[];
      var hero='<div class="driver-hero"><div class="mobile-brandline"><span><b>优洗通</b><i></i>司机工作台</span><button type="button" data-action="signOut">退出</button></div><small>'+esc(driver?driver.name:role.label)+'</small><h1>本人负责范围</h1><p>'+esc(driver&&driver.area||'未设置区域')+'</p></div>';
      var body=hotels.map(function(h,i){var site=c.site(catalog.mappings[h.id]);return '<button type="button" class="driver-hotel-row driver-hotel-link" data-action="driverHotel:'+esc(h.id)+'" aria-label="查看'+esc(h.name)+'订单"><i>'+String(i+1).padStart(2,'0')+'</i><span><strong>'+esc(h.name)+'</strong><small>'+esc(h.address||'地址未配置')+'</small><small>当前服务点：'+esc(site?site.name:'未配置')+'</small></span><em aria-hidden="true">›</em></button>';}).join('');
      if(state.view!=='normal')body=statePanel(state.view,'负责酒店','driverRetry');
      else if(!body)body='<div class="driver-empty"><strong>暂无可访问的负责酒店</strong><small>请联系平台确认账号与酒店负责关系</small></div>';
      return hero+'<section class="mobile-page driver-list"><div class="section-title"><strong>负责酒店</strong><span>'+hotels.length+' 家酒店</span></div>'+body+'<article class="order-card v19-driver-info"><h3>车辆与联系人</h3><p>车牌号：'+esc(driver&&driver.plate||'未补齐')+'</p><p>车型：'+esc(driver&&driver.model||'未补齐')+'</p><p>联系人：'+esc(driver&&driver.contactName||'未补齐')+'</p><p>联系电话：'+esc(driver&&driver.contactPhone||'未补齐')+'</p></article></section>';
    }
    function heading(){var hotel=c.org(navigation.hotel);return '<header class="mobile-head simple driver-order-head">'+button('‹','driverBack','driver-back').replace('<button ','<button aria-label="返回负责酒店" ')+'<div><h1>'+esc(hotel?hotel.name:'酒店订单')+'</h1><small>酒店订单</small></div><span></span></header>';}
    function tabs(){var current=active().tab;return '<div class="mobile-tabs" role="tablist" aria-label="酒店订单类型">'+Object.keys(labels).map(function(tab){return '<button type="button" role="tab" aria-selected="'+(tab===current)+'" data-action="driverTab:'+tab+'" class="'+(tab===current?'active':'')+'">'+labels[tab]+'</button>';}).join('')+'</div>';}
    function statePanel(view,label,action){var title=view==='error'?label+'加载失败':view==='forbidden'?'无权查看'+label:'暂无'+label,copy=view==='error'?'已保留当前酒店、分类和页码，请重试。':view==='forbidden'?'请联系平台确认账号与负责关系。':'有新的业务记录后会显示在这里。';return '<div class="driver-order-state" role="status"><strong>'+title+'</strong><p>'+copy+'</p>'+button(view==='error'?'重新加载':'重新查看',action,'secondary-button')+'</div>';}
    function page(){
      var access=c.scopeError(navigation.hotel);if(access)return heading()+'<section class="mobile-page">'+statePanel('forbidden','酒店订单','driverBack')+'<p class="linen-note">'+esc(access)+'</p></section>';
      var local=active(),view=local.tabs[local.tab];view.view=state.view;
      var all=rows(navigation.hotel,local.tab),pages=Math.max(1,Math.ceil(all.length/pageSize));view.page=Math.max(1,Math.min(view.page,pages));
      var content=state.view!=='normal'?statePanel(state.view,labels[local.tab],'driverRetry'):!all.length?statePanel('empty',labels[local.tab],'driverRetry'):all.slice((view.page-1)*pageSize,view.page*pageSize).map(local.tab==='orders'?orderCard:local.tab==='store'?storeCard:refundCard).join('');
      return heading()+'<section class="mobile-page driver-orders">'+tabs()+content+(state.view==='normal'&&all.length?'<div class="driver-pagination"><span>共 '+all.length+' 条 · 第 '+view.page+' / '+pages+' 页</span><div>'+button('上一页','driverPage:'+(view.page-1),'secondary-button',view.page===1)+button('下一页','driverPage:'+(view.page+1),'secondary-button',view.page===pages)+'</div></div>':'')+'</section>';
    }
    function orderCard(o){
      var lines=c.lines(o),reason=c.reason(o),hasRefund=(data.returnRequests||[]).concat(data.linenRefunds||[]).some(function(r){return r.order===o.id;});
      return '<article class="order-card driver-order-card" data-driver-card data-action="driverOrder:'+esc(o.id)+'" role="button" tabindex="0" aria-label="查看订单 '+esc(o.id)+'"><header><span><strong>'+esc(o.id)+'</strong><small>'+esc(c.orderTime(o))+' · '+esc(o.floorName||'未指定')+'</small></span>'+c.badge(c.status(o),o.progress===3?'success':'warning')+'</header><div class="order-goods">'+lines.map(function(l){return '<span>'+esc(l.name)+' '+l.quantity+' 件</span>';}).join('')+'</div><footer><span><small>共 '+lines.reduce(function(n,l){return n+l.quantity;},0)+' 件</small><b>'+amount(c.financials(o).hotelOriginal)+'</b></span>'+button(reason?'查看详情':'申请退污',(reason?'driverOrder:':'driverApply:')+o.id)+'</footer>'+(hasRefund?c.summary(o,'hotel'):'')+(reason?'<p class="linen-note">'+esc(reason)+'</p>':'')+'</article>';
    }
    function storeCard(o){return '<article class="order-card driver-order-card" data-driver-card data-action="driverStore:'+esc(o.no)+'" role="button" tabindex="0" aria-label="查看商城订单 '+esc(o.no)+'"><header><span><strong>'+esc(o.no)+'</strong><small>'+esc(o.time||'下单时间未记录')+'</small></span>'+c.badge(o.statusLabel||'已创建','')+'</header><p>'+esc(o.lines)+'</p><footer><b>'+amount(o.cents)+'</b>'+button('查看详情','driverStore:'+o.no)+'</footer></article>';}
    function refundStatus(r){return r.version===2||Array.isArray(r.lines)?c.refundLabel(r.status):({PENDING:'待检测',APPROVED:'已退款',REJECTED:'已驳回'}[r.status]||r.status);}
    function requestedAmount(r){return Array.isArray(r.lines)?r.lines.reduce(function(n,l){return n+l.quantity*l.hotelPrice;},0):r.quantity*r.price;}
    function refundedAmount(r){return r.refundCents===undefined?(r.status==='APPROVED'?(r.approved||0)*r.price:0):r.refundCents;}
    function refundCard(r){return '<article class="order-card driver-order-card" data-driver-card data-action="driverRefund:'+esc(r.id)+'" role="button" tabindex="0" aria-label="查看退污 '+esc(r.id)+'"><header><span><strong>'+esc(r.id)+'</strong><small>'+esc(r.time||'申请时间未记录')+'</small></span>'+c.badge(refundStatus(r),['REFUNDED','APPROVED'].includes(r.status)?'success':'warning')+'</header><p>关联布草订单 '+esc(r.order)+'</p><p>申请金额 '+amount(requestedAmount(r))+' · 实退 '+amount(refundedAmount(r))+'</p>'+button('查看详情','driverRefund:'+r.id,'link-button')+'</article>';}
    function detail(o){
      var error=c.orderError(o);if(error)return deny(error);remember();var reason=c.reason(o);
      var loadingError=o.progress===1?c.loadingError(o):'',fulfilment=o.progress===1?button('装车完成','driverLoaded:'+o.id,'primary-button',!!loadingError):o.progress===2?button('确认送达','driverDelivered:'+o.id,'primary-button'):'';
      c.open('布草订单详情',o.id,'<div class="mobile-order-meta">'+c.badge(c.status(o),o.progress===3?'success':'warning')+'<p>'+esc((c.org(o.hotel)||{}).name)+' · '+esc(o.floorName||'未指定')+'</p><p>'+esc(c.orderTime(o))+'</p></div>'+c.summary(o,'hotel')+c.table(['布草品类','原数量','历史单价','原小计','已通过退污','已退金额','净支付'],c.financials(o).lines.map(function(x){return [esc(x.line.name),x.line.quantity,amount(x.line.hotelPrice),amount(x.hotelOriginal),x.approved,amount(x.hotelRefund),amount(x.hotelNet)];}))+'<p>配送地址：'+esc(o.address||'未记录')+'</p><p>承接配送：'+esc((o.factoryName||'')+' / '+(o.siteName||''))+'</p>'+(loadingError?'<p class="linen-note">'+esc(loadingError)+'</p>':'')+(reason?'<p class="linen-note">'+esc(reason)+'</p>':''),button('返回订单','closeModal','secondary-button')+fulfilment+(!reason?button('申请退污','driverApply:'+o.id,'primary-button'):''),true);return true;
    }
    function fulfil(id,target){
      var o=order(id),access=c.orderError(o);if(access)return deny(access);remember();
      var result=c.fulfil(id,target);if(result.error){c.toast(result.error);return true;}
      var position=state.section==='司机酒店订单'&&navigation.hotel?active().tabs[active().tab].scroll:navigation.homeScroll;
      c.close();repaint(position);detail(o);c.toast(result.duplicate?'该步骤已完成，未重复处理':target===2?'装车完成，订单进入配送中':'已确认送达');return true;
    }
    function storeDetail(no){var o=(data.storeOrders||[]).find(function(row){return row.no===no;}),error=storeError(o);if(error)return deny(error);remember();c.open('商城订单详情',o.no,'<p>'+esc((c.org(o.hotel)||{}).name)+' · '+esc(o.statusLabel||'已创建')+'</p>'+(o.itemLines?c.table(['商品','数量','历史单价','小计'],o.itemLines.map(function(l){return[esc(l.name),l.quantity,amount(l.unitPrice),amount(l.subtotal)];})):'<p>'+esc(o.lines)+'</p>')+'<p>总件数 '+esc(o.count)+' · '+amount(o.cents)+'</p><p>下单时间 '+esc(o.time)+'</p><p>收货地址 '+esc(o.address||'历史记录未保存')+'</p>',button('返回订单','closeModal','secondary-button'));return true;}
    function refundDetail(id){
      var r=refund(id),error=refundError(r);if(error)return deny(error);remember();var lines=Array.isArray(r.lines)?r.lines:[{name:r.name,quantity:r.quantity,received:0}],modern=Array.isArray(r.lines);
      c.open('退污详情',r.id,'<p>'+esc((c.org(r.hotel)||{}).name)+' · 关联布草订单 '+esc(r.order)+'</p>'+c.table(modern?['品类','申请','已入库','待入库','最终通过']:['品类','申请','通过'],lines.map(function(l){return modern?[esc(l.name),l.quantity,l.received,r.status==='AWAITING_INBOUND'?l.quantity-l.received:0,r.status==='REFUNDED'?l.quantity:r.status==='REJECTED'?0:'—']:[esc(l.name),l.quantity,r.status==='PENDING'?'待检测':r.approved||0];}))+'<p>状态：'+esc(refundStatus(r))+'</p><p>原因：'+esc(r.reason)+'</p>'+(modern&&r.reviewNote?'<p>工厂备注：'+esc(r.reviewNote)+'</p>':'')+'<p>申请金额：'+amount(requestedAmount(r))+' · 实际退款：'+amount(refundedAmount(r))+'</p>'+(!['REFUNDED','APPROVED','REJECTED'].includes(r.status)?'<p class="linen-note">工厂整单确认，全部退污布草入库后退款至酒店预存账户。</p>':''),button('返回列表','closeModal','secondary-button'));return true;
    }
    function apply(id){
      var o=order(id),error=c.orderError(o)||c.reason(o);if(error)return deny(error);remember();
      if(!draft||draft.order!==id)draft={order:id,token:'DR-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),quantities:{},reason:''};
      c.open('申请退污',o.id,'<p class="driver-apply-context">'+esc((c.org(o.hotel)||{}).name)+' · '+esc(o.floorName||'未指定')+'</p><p class="linen-note">送达后 24 小时内每单仅申请一次。请选择本次退污品类和数量，工厂确认并全部入库后退款。</p>'+c.lines(o).map(function(l){return '<label class="form-row"><span>'+esc(l.name)+' · 原数量 '+l.quantity+' · 单价 '+amount(l.hotelPrice)+'</span><input data-driver-quantity="'+esc(l.sku)+'" aria-label="'+esc(l.name)+'退污数量" type="number" min="0" max="'+l.quantity+'" step="1" value="'+esc(draft.quantities[l.sku]||0)+'"></label>';}).join('')+'<label class="form-row"><span>退污原因（必填，最多 200 字）</span><textarea id="driverReturnReason" maxlength="200">'+esc(draft.reason)+'</textarea></label><p class="identity-error" role="alert"></p>',button('取消','driverCancel','secondary-button')+button('提交申请','driverSubmit:'+id,'primary-button'));return true;
    }
    function submit(id){
      if(!draft||draft.order!==id)return deny('申请内容已失效，请重新打开订单');
      c.modal.querySelectorAll('[data-driver-quantity]').forEach(function(el){draft.quantities[el.dataset.driverQuantity]=el.value;});
      var reasonField=c.document.getElementById('driverReturnReason');if(!reasonField){c.toast('请重新打开退污申请后提交');return true;}draft.reason=reasonField.value;
      var error=c.submit(id,draft.quantities,draft.reason,draft.token);if(error){c.error(error);return true;}
      var r=(data.returnRequests||[]).find(function(row){return row.clientToken===draft.token;});if(!r){c.error('申请结果待核查，请保留页面');return true;}
      // Refresh the source list in place; the new refund detail is only an overlay.
      var position=state.section==='司机酒店订单'&&navigation.hotel?active().tabs[active().tab].scroll:navigation.homeScroll;
      draft=null;c.close();repaint(position);refundDetail(r.id);c.toast('退污申请已提交');return true;
    }
    function action(value){
      var p=value.split(':'),name=p[0],id=p.slice(1).join(':');
      if(name.indexOf('driver')===0&&state.role!=='driver')return deny('当前角色无司机订单权限');
      if(state.role!=='driver')return false;
      if(['linenDetail','catOrder','driverOrder'].includes(name))return detail(order(id));
      if(name==='driverLoaded')return fulfil(id,2);
      if(name==='driverDelivered')return fulfil(id,3);
      if(['flowStoreDetail','driverStore'].includes(name))return storeDetail(id);
      if(['flowReturnDetail','driverRefund'].includes(name))return refundDetail(id);
      if(['linenApply','driverApply'].includes(name))return apply(id);
      if(['flowSubmit','driverSubmit'].includes(name))return submit(id);
      if(['flowReview','flowApprove','flowReject','linenSubmit'].includes(name))return deny('当前角色无审核权限，请从订单发起整单退污');
      if(name==='driverCancel'){draft=null;c.close();return true;}
      if(name==='driverHotel'){if(c.scopeError(id))return deny(c.scopeError(id));remember();c.close();navigation.hotel=id;state.section='司机酒店订单';state.view=active().tabs[active().tab].view;repaint(active().tabs[active().tab].scroll);return true;}
      if(name==='driverBack'){remember();c.close();state.section='负责酒店';state.view='normal';repaint(navigation.homeScroll);return true;}
      if(name==='driverTab'){if(!labels[id]||c.scopeError(navigation.hotel))return deny(c.scopeError(navigation.hotel));remember();c.close();active().tab=id;state.view=active().tabs[id].view;repaint(active().tabs[id].scroll);return true;}
      if(name==='driverPage'){if(c.scopeError(navigation.hotel))return deny(c.scopeError(navigation.hotel));var local=active(),page=Number(id),pages=Math.max(1,Math.ceil(rows(navigation.hotel,local.tab).length/pageSize));if(!Number.isInteger(page)||page<1||page>pages)return true;local.tabs[local.tab].page=page;local.tabs[local.tab].scroll=0;repaint(0);return true;}
      if(name==='driverRetry'){state.view='normal';if(navigation.hotel)active().tabs[active().tab].view='normal';repaint(state.section==='司机酒店订单'?active().tabs[active().tab].scroll:navigation.homeScroll);return true;}
      if(name==='back'&&state.section==='司机酒店订单')return action('driverBack');
      return false;
    }
    c.root.addEventListener('keydown',function(event){if(event.target.matches('[data-driver-card]')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();action(event.target.dataset.action);}});
    return {home:home,page:page,detail:detail,action:action,afterRender:afterRender,reset:reset,api:{rows:rows,refundError:refundError,navigation:function(){return navigation;},pageSize:pageSize}};
  };
})(window);
