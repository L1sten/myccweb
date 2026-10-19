(function (global) {
  'use strict';
  global.YouxitongV193 = function (c, previous) {
    var state=c.state, esc=c.esc, button=c.button, size=10;
    var actions={REGISTER:'首次登记',DIRTY_INBOUND:'脏物入库',WASH_START:'洗涤开始',WASH_COMPLETE:'洗涤完成',CLEAN_INBOUND:'净物入库',STOCKING:'租赁备货',DISPATCH:'发运',DELIVERY:'送达酒店',DAILY:'日常回收',REFUND:'退污入库'};
    var stages={REGISTERED:'已登记',DIRTY:'脏物仓',WASHING:'洗涤中',WASHED:'洗涤完成',CLEAN:'净物仓',STOCKED:'已备货',IN_TRANSIT:'运输中',AT_HOTEL:'酒店',UNKNOWN:'待核查'};
    var stageFor={REGISTER:'REGISTERED',DIRTY_INBOUND:'DIRTY',WASH_START:'WASHING',WASH_COMPLETE:'WASHED',CLEAN_INBOUND:'CLEAN',STOCKING:'STOCKED',DISPATCH:'IN_TRANSIT',DELIVERY:'AT_HOTEL',DAILY:'DIRTY',REFUND:'DIRTY'};
    var queries={assets:blank()}, pages={assets:1}, trace={epc:'',page:1,size:10}, orderNavigation=null;
    function blank(){return {q:'',factory:'',hotel:'',stage:'',action:'',document:'',from:'',to:''};}
    function platform(){return state.role.indexOf('platform_')===0;}
    function allowed(){return /^(platform|factory)_/.test(state.role);}
    function visible(x){return allowed()&&(platform()||x.factory==='org-factory-1');}
    function name(id){var x=c.org(id);return x?x.name:id||'—';}
    function skuName(id){var s=c.categories.find(function(x){return x.id===id;});return s?s.name:id||'待核查';}
    function locationOf(a){if(a.stage==='AT_HOTEL')return name(a.hotel)+(a.floor?' · '+a.floor:'');if(a.stage==='IN_TRANSIT')return '运输途中';return (c.site(a.site)||{}).name||'待核查';}
    function time(value){return value?String(value).replace('T',' ').replace(/:00(?:\+08:00|Z)?$/,'').replace('+08:00',''):'待核查';}
    function epcLabel(epc){return '<span class="asset-epc">'+esc(epc)+'</span>';}
    function seeded(){
      var assets=[],events=[];
      var paths=[['REGISTER','DIRTY_INBOUND','WASH_START','WASH_COMPLETE','CLEAN_INBOUND','STOCKING','DISPATCH','DELIVERY','DAILY','WASH_START','WASH_COMPLETE','CLEAN_INBOUND','STOCKING','DISPATCH','DELIVERY'],['REGISTER','DIRTY_INBOUND','WASH_START','WASH_COMPLETE','CLEAN_INBOUND','STOCKING','DISPATCH','DELIVERY','REFUND'],['REGISTER','DIRTY_INBOUND','WASH_START'],['REGISTER','DIRTY_INBOUND','WASH_START','WASH_COMPLETE','CLEAN_INBOUND'],['REGISTER'],['REGISTER','DIRTY_INBOUND','WASH_START','WASH_COMPLETE','CLEAN_INBOUND','STOCKING','DISPATCH']];
      paths.forEach(function(path,i){
        var factory=i===5?'org-factory-legacy':'org-factory-1',hotel=i===5?'org-hotel-full':'org-hotel-yunqi',site=i===5?'site-factory-north':'site-factory-east',epc='E280116060000209'+String(i+1).padStart(8,'0');
        var asset={epc:epc,sku:['linen-duvet','linen-sheet','linen-towel'][i%3],factory:factory,site:site,hotel:'',floor:'',stage:'REGISTERED',washes:0,registered:'2026-10-01T08:00:00+08:00',updated:'',source:'第三方作业系统',sample:true};
        var cycle=0,currentOrder='';
        path.forEach(function(action,j){
          if(action==='WASH_START')cycle++;
          if(action==='STOCKING')currentOrder='RP-SAMPLE-'+(i+1)+'-'+cycle;
          var associated=['STOCKING','DISPATCH','DELIVERY','DAILY','REFUND'].includes(action);
          var evt={id:'SAMPLE-'+i+'-'+j,epc:epc,sku:asset.sku,factory:factory,site:site,hotel:associated?hotel:'',floor:associated?'1F':'',action:action,time:'2026-10-'+String(1+Math.floor(j/5)).padStart(2,'0')+'T'+String(8+j%5).padStart(2,'0')+':00:00+08:00',operator:i===5?'二厂作业员':'一厂作业员',document:action==='REFUND'?'RT-SAMPLE-2':currentOrder||'IN-SAMPLE-'+(i+1),source:'第三方作业系统',cycle:action.indexOf('WASH')===0?'WASH-'+i+'-'+cycle:'',status:'APPLIED'};
          events.push(evt);asset.stage=stageFor[action];asset.updated=evt.time;asset.hotel=evt.hotel;asset.floor=evt.floor;if(action==='WASH_COMPLETE')asset.washes++;
        });
        assets.push(asset);
      });
      return {assets:assets,events:events};
    }
    if(!c.data.v193)c.data.v193=seeded();
    var db=c.data.v193;
    function allAssets(){
      var result=db.assets.slice(),seen={};result.forEach(function(a){seen[a.epc]=true;});
      var old=(c.data.v191&&c.data.v191.chips||[]).concat((previous.api.store.chips||[]).map(function(x){return Object.assign({},x,{epc:x.chip});}));
      old.forEach(function(x){if(!x.epc||seen[x.epc])return;seen[x.epc]=true;result.push({epc:x.epc,sku:x.sku,factory:x.factory,site:x.site,hotel:x.hotel||'',floor:x.floor||'',stage:'UNKNOWN',washes:null,registered:x.time||'',updated:x.time||'',source:'历史登记',review:'历史流转及洗涤次数尚未核实'});});
      return result.filter(visible);
    }
    function allEvents(){
      var events=db.events.slice(),known={};allAssets().forEach(function(a){known[a.epc]=a;});
      (c.data.v191&&c.data.v191.batches||[]).forEach(function(b){var seen={};(b.rows||[]).forEach(function(r){var a=known[r.epc];if(!a||seen[r.epc]||r.skip||r.error)return;seen[r.epc]=true;events.push({id:b.id,epc:r.epc,sku:r.sku||a.sku,factory:a.factory,site:b.site||a.site,hotel:b.hotel||'',floor:b.floor||'',action:{REGISTER:'REGISTER',STOCKING:'STOCKING',DAILY:'DAILY',REFUND:'REFUND'}[b.mode]||b.mode,time:b.time||'',operator:b.operatorName||'待核查',document:b.request||b.order||'',source:'历史作业记录 · 待核对',status:'LEGACY'});});});
      return events.filter(visible);
    }
    function matching(x,q,flow){
      var searchable=(x.epc+' '+(flow?'':skuName(x.sku))).toLowerCase();
      var date=(flow?x.time:x.registered||'').slice(0,10);
      return (!q.q||searchable.includes(q.q.toLowerCase()))&&(!q.factory||x.factory===q.factory)&&(!q.hotel||x.hotel===q.hotel)&&(!q.stage||x.stage===q.stage)&&(!q.action||x.action===q.action)&&(!q.document||(x.document||'').toLowerCase().includes(q.document.toLowerCase()))&&(!q.from||date>=q.from)&&(!q.to||date<=q.to);
    }
    function filtered(kind){return (kind==='assets'?allAssets():allEvents()).filter(function(x){return matching(x,queries[kind],kind==='flows');}).sort(function(a,b){return String(b.time||b.updated).localeCompare(String(a.time||a.updated))||a.epc.localeCompare(b.epc);});}
    function field(label,key,value,type){return '<label class="form-row"><span>'+esc(label)+'</span><input aria-label="'+esc(label)+'" data-asset-field="'+key+'" type="'+(type||'text')+'" value="'+esc(value||'')+'"></label>';}
    function select(label,key,items,value,empty){return '<label class="form-row"><span>'+esc(label)+'</span><select aria-label="'+esc(label)+'" data-asset-field="'+key+'"><option value="">'+esc(empty||'全部')+'</option>'+items.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===value?' selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select></label>';}
    function dictionary(map){return Object.keys(map).map(function(k){return{id:k,name:map[k]};});}
    function filters(kind){var q=queries[kind],flow=kind==='flows',assets=allAssets();return '<form class="filter-bar asset-filters" data-asset-filter="'+kind+'">'+field(flow?'芯片编号':'EPC / 布草品类','q',q.q)+(platform()?select('工厂','factory',c.identity.orgs.filter(function(o){return o.type==='factory';}),q.factory,'全部工厂'):'')+select('酒店','hotel',c.identity.orgs.filter(function(o){return o.type==='hotel'&&(platform()||assets.some(function(a){return a.hotel===o.id;})||Object.keys(c.catalog.mappings).some(function(h){return h===o.id&&(c.site(c.catalog.mappings[h])||{}).factory==='org-factory-1';}));}),q.hotel,'全部酒店')+(flow?select('业务动作','action',dictionary(actions),q.action,'全部动作')+field('关联单据','document',q.document):'')+field(flow?'发生日期起':'登记日期起','from',q.from,'date')+field('截止日期','to',q.to,'date')+'<div class="filter-actions">'+button('查询','assetQuery:'+kind,'primary-button')+button('重置','assetReset:'+kind,'secondary-button')+'</div><p class="asset-filter-error" role="alert"></p></form>';}
    function paginate(kind,items,render){var total=Math.max(1,Math.ceil(items.length/size));pages[kind]=Math.min(pages[kind],total);return (items.length?render(items.slice((pages[kind]-1)*size,pages[kind]*size)):'<div class="asset-empty"><strong>暂无符合条件的'+(kind==='assets'?'布草资产':'流转记录')+'</strong><p>调整筛选条件后重新查询。</p></div>')+'<div class="pagination asset-pagination"><span>共 '+items.length+' 条 · 第 '+pages[kind]+' / '+total+' 页</span><div>'+button('上一页','assetPage:'+kind+':'+(pages[kind]-1),'secondary-button',pages[kind]<=1)+button('下一页','assetPage:'+kind+':'+(pages[kind]+1),'secondary-button',pages[kind]>=total)+'</div></div>';}
    function assetRows(items){return c.table(['芯片编号','布草品类','所属工厂','当前环节 / 位置','关联酒店 / 楼层','洗涤次数','登记时间','最近更新','操作'],items.map(function(a){return[epcLabel(a.epc),esc(skuName(a.sku)),esc(name(a.factory)),c.badge(stages[a.stage]||'待核查',a.stage==='UNKNOWN'?'warning':'')+'<small class="cell-sub">'+esc(locationOf(a))+'</small>',esc(a.hotel?name(a.hotel):'—')+(a.floor?'<small class="cell-sub">'+esc(a.floor)+'</small>':''),a.washes===null?'待核查':a.washes+' 次',esc(time(a.registered)),esc(time(a.updated)),button('详情','assetDetail:'+a.epc,'link-button')];}));}
    function assetPage(){var rows=filtered('assets');return c.header('布草资产','','')+filters('assets')+c.panel('布草资产','共 '+rows.length+' 件',paginate('assets',rows,assetRows),'asset-panel asset-list-panel');}
    function traceEvents(epc){return allEvents().filter(function(e){return e.epc===epc;}).sort(function(a,b){return String(b.time).localeCompare(String(a.time))||String(a.id).localeCompare(String(b.id));});}
    function traceButton(label,epc,page,disabled,current){return '<button type="button" data-action="assetTracePage:'+encodeURIComponent(epc)+':'+page+'"'+(disabled?' disabled':'')+(current?' aria-current="page"':'')+'>'+label+'</button>';}
    function traceTable(epc){
      var events=traceEvents(epc),total=events.length,last=Math.max(1,Math.ceil(total/trace.size));trace.page=Math.min(trace.page,last);
      var rows=events.slice((trace.page-1)*trace.size,trace.page*trace.size).map(function(e){
        var customer=e.hotel?name(e.hotel)+(e.floor?' / '+e.floor:''):name(e.factory)+((c.site(e.site)||{}).name?' / '+c.site(e.site).name:'');
        var doc=e.document&&e.document.indexOf('RP')===0?button(esc(e.document),'assetOrder:'+encodeURIComponent(epc)+':'+encodeURIComponent(e.document),'link-button'):esc(e.document||'—');
        return '<tr data-record-id="'+esc(e.id)+'">'+[esc(e.workstation||'—'),esc(time(e.time)),esc(e.operator||'—'),esc(actions[e.action]||e.action),esc(customer),esc(e.workgroup||'—'),doc,esc(e.note||'—')].map(function(value){return '<td>'+value+'</td>';}).join('')+'</tr>';
      }).join('');
      var numbered='',previousPage=0;for(var n=1;n<=last;n++){if(last>7&&n!==1&&n!==last&&Math.abs(n-trace.page)>1)continue;if(n>previousPage+1)numbered+='<span class="trace-ellipsis" aria-hidden="true">…</span>';numbered+=traceButton(n,epc,n,false,n===trace.page);previousPage=n;}
      return '<div class="asset-trace-title"><h3>追踪记录</h3></div><div class="asset-trace-scroll" tabindex="0" role="region" aria-label="布草追踪记录表格"><table class="asset-trace-table"><thead><tr>'+['追踪工位','追踪时间','操作员','操作','业务客户','工作组','关联业务单据','备注'].map(function(h){return '<th scope="col">'+h+'</th>';}).join('')+'</tr></thead><tbody>'+(rows||'<tr><td colspan="8" class="trace-empty">暂无追踪记录</td></tr>')+'</tbody></table></div><nav class="asset-trace-pagination" aria-label="追踪记录分页"><span>共 '+total+' 条</span><select aria-label="每页条数" data-asset-trace-size="'+esc(epc)+'">'+[10,20,50,100].map(function(n){return '<option value="'+n+'"'+(n===trace.size?' selected':'')+'>'+n+'条/页</option>';}).join('')+'</select><div class="trace-page-buttons">'+traceButton('首页',epc,1,trace.page===1)+traceButton('上一页',epc,trace.page-1,trace.page===1)+numbered+traceButton('下一页',epc,trace.page+1,trace.page===last)+traceButton('尾页',epc,last,trace.page===last)+'</div><span>共 '+last+' 页</span><label>前往 <input aria-label="前往页码" data-asset-trace-jump="'+esc(epc)+'" inputmode="numeric" type="number" min="1" max="'+last+'" value="'+trace.page+'"> 页</label></nav>';
    }
    function changeTrace(epc,page,pageSize){
      if(!allAssets().some(function(a){return a.epc===epc;})){c.toast('无权查看或资产不存在');return;}
      if(![10,20,50,100].includes(pageSize))return;
      var last=Math.max(1,Math.ceil(traceEvents(epc).length/pageSize));if(!Number.isSafeInteger(page)||page<1||page>last){c.toast('请输入1至'+last+'之间的页码');return;}
      trace={epc:epc,page:page,size:pageSize};var target=c.modal.querySelector('.asset-trace');if(target)target.innerHTML=traceTable(epc);else detail(epc);
    }
    function detail(epc){var a=allAssets().find(function(x){return x.epc===epc;});if(!a){c.toast('无权查看或资产不存在');return;}if(trace.epc!==epc)trace={epc:epc,page:1,size:10};
      var values=[['芯片编号',epc],['布草品类',skuName(a.sku)],['所属工厂',name(a.factory)],['登记站点',(c.site(a.site)||{}).name||'待核查'],['登记时间',time(a.registered)],['洗涤次数',a.washes===null?'待核查':a.washes+' 次']];
      var content='<div class="asset-detail"><dl class="asset-facts">'+values.map(function(x){return '<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>';}).join('')+'</dl><section class="asset-location"><strong>'+esc(stages[a.stage]||'待核查')+'</strong><span>'+esc(locationOf(a))+'</span><small>最近确认：'+esc(time(a.updated))+'</small></section>'+(a.review?'<p class="identity-alert">'+esc(a.review)+'；不以零次代替未知次数。</p>':'')+'<section class="asset-trace">'+traceTable(epc)+'</section></div>';
      c.open('布草资产详情',null,content,button('关闭','closeModal','secondary-button'),true);
    }
    function orderDetail(epc,orderId){
      var asset=allAssets().find(function(x){return x.epc===epc;});
      var related=allEvents().filter(function(e){return e.epc===epc&&e.document===orderId;});
      if(!asset||!related.length){c.toast('订单不存在或无权访问');return;}
      var order=c.catalog.orders.find(function(o){return o.id===orderId;});
      var back=button('返回布草资产','assetOrderBack','secondary-button'),content='';
      if(order){
        if(order.factory!==asset.factory){c.toast('订单归属不一致，请核查');return;}
        content=c.orderDetailContent(order);
      }
      else {
      if(!asset.sample||!/^RP-SAMPLE-\d+-\d+$/.test(orderId)){c.toast('关联订单暂不可用，请核对历史单据');return;}
      var rows=allEvents().filter(function(e){return e.document===orderId&&e.action==='STOCKING';});
      var first=related.find(function(e){return e.hotel;})||related[0],seen={},lines=[];
      rows.forEach(function(e){if(seen[e.epc])return;seen[e.epc]=true;lines.push([esc(skuName(e.sku)),epcLabel(e.epc),'1']);});
      var status=related.some(function(e){return e.action==='DELIVERY';})?'已送达':related.some(function(e){return e.action==='DISPATCH';})?'配送中':'备货中';
      content='<div class="asset-related-order"><dl class="asset-facts"><div><dt>酒店 / 楼层</dt><dd>'+esc(name(first.hotel))+' · '+esc(first.floor||'—')+'</dd></div><div><dt>工厂 / 站点</dt><dd>'+esc(name(asset.factory))+' · '+esc((c.site(first.site)||{}).name||'—')+'</dd></div><div><dt>履约状态</dt><dd>'+esc(status)+'</dd></div><div><dt>订单金额</dt><dd>未提供历史价格快照</dd></div></dl>'+c.table(['布草品类','关联芯片','数量'],lines)+'</div>';
      }
      orderNavigation={epc:epc,orderId:orderId,role:state.role,html:c.header('订单详情','',back)+c.panel(esc(orderId),'',content,'asset-order-page')};state.section='业务订单';c.close();c.render();
    }
    function action(a){var p=a.split(':'),key=p[0],kind=p[1];if(/^rfid/.test(key)||['terminalSubmit','flowInboundSave','flowNewBatch','flowTerminalNav'].includes(key)){c.toast('工厂现场作业由第三方终端处理');return true;}if(key.indexOf('asset')!==0)return false;
      if(!allowed()){c.toast('当前角色无权查看布草资产');return true;}
      if(key==='assetOrderBack'){var epc=orderNavigation&&orderNavigation.epc;orderNavigation=null;state.section='布草资产';c.render();if(epc)detail(epc);return true;}
      if(key==='assetDetail'){detail(p.slice(1).join(':'));return true;}
      if(key==='assetTracePage'){changeTrace(decodeURIComponent(p[1]||''),Number(p[2]),trace.size);return true;}
      if(key==='assetTraceSize'){changeTrace(decodeURIComponent(p[1]||''),1,Number(p[2]));return true;}
      if(key==='assetOrder'){orderDetail(decodeURIComponent(p[1]||''),decodeURIComponent(p[2]||''));return true;}
      if(key==='assetFlows'){state.section='布草资产';c.render();return true;}
      if(!queries[kind])return true;
      if(key==='assetQuery'){var q=blank();c.root.querySelectorAll('[data-asset-field]').forEach(function(el){q[el.dataset.assetField]=el.value.trim();});if(q.from&&q.to&&q.from>q.to){var error=c.root.querySelector('.asset-filter-error');if(error)error.textContent='开始日期不能晚于截止日期';return true;}queries[kind]=q;pages[kind]=1;}
      if(key==='assetReset'){queries[kind]=blank();pages[kind]=1;}
      if(key==='assetPage')pages[kind]=Math.max(1,Number(p[2])||1);
      c.render();return true;
    }
    function navItem(n){return '<button class="nav-item '+(state.section===n?'active':'')+'" data-section="'+n+'" aria-label="'+n+'"'+(state.section===n?' aria-current="page"':'')+'><span class="nav-symbol">'+c.icon(n,state.section===n)+'</span><span>'+n+'</span></button>';}
    c.root.addEventListener('submit',function(event){var form=event.target;if(form.dataset&&form.dataset.assetFilter){event.preventDefault();action('assetQuery:'+form.dataset.assetFilter);}});
    c.modal.addEventListener('change',function(event){var d=event.target.dataset||{};if(d.assetTraceSize)action('assetTraceSize:'+encodeURIComponent(d.assetTraceSize)+':'+event.target.value);if(d.assetTraceJump)action('assetTracePage:'+encodeURIComponent(d.assetTraceJump)+':'+event.target.value);});
    c.modal.addEventListener('keydown',function(event){var d=event.target.dataset||{};if(event.key==='Enter'&&d.assetTraceJump){event.preventDefault();action('assetTracePage:'+encodeURIComponent(d.assetTraceJump)+':'+event.target.value);}});
    Object.keys(c.roles).filter(function(k){return /^(platform|factory)_/.test(k);}).forEach(function(k){var role=c.roles[k];role.nav=role.nav.filter(function(n){return !['终端设备','RFID 扫描记录','布草登记','布草资产','流转记录'].includes(n);});role.nav.push('布草资产');});
    return {
      api:{db:db,assets:allAssets,events:allEvents,filtered:filtered,queries:queries,pages:pages,assetPage:assetPage,detail:detail},
      action:action,
      identityRender:function(section){if(orderNavigation){if(section==='业务订单'&&orderNavigation.role===state.role&&allowed())return orderNavigation.html;orderNavigation=null;}if(['终端设备','RFID 扫描记录','布草登记','流转记录'].includes(section)){state.section='布草资产';section='布草资产';}if(section==='布草资产')return allowed()?assetPage():c.header('无权访问','当前角色无权访问布草资产','');return previous.identityRender(section);},
      navigation:function(role){var managed=['品类配置','布草资产','布草统计'];var copy=Object.assign({},role,{nav:role.nav.filter(function(n){return !managed.includes(n);})});return c.legacy.navigation(copy)+'<div class="nav-group-label">布草管理</div>'+managed.filter(function(n){return role.nav.includes(n);}).map(navItem).join('');},
      terminal:function(){return '<section class="terminal-retired"><h1>工厂现场作业</h1><p>工厂终端由第三方提供，请使用现场作业系统。</p><p>平台和工厂管理端可查看布草资产及其追踪记录。</p></section>';}
    };
  };
})(window);
