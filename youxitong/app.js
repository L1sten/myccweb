(function(){
  'use strict';

  var roles={
    platform_admin:{label:'平台管理员',surface:'web',org:'优洗通平台',subtitle:'平台业务、资金与基础资料管理',nav:['经营总览','业务订单','退污退款','客户与组织','酒店与楼层','协议价格','工厂站点映射','司机负责范围','钱包与流水','工厂结算','商城商品','商城订单','用户与权限']},
    platform_ops:{label:'平台运营',surface:'web',org:'优洗通平台',subtitle:'订单、客户、价格、商城与司机范围',nav:['业务订单','退污退款','客户与组织','酒店与楼层','协议价格','工厂站点映射','司机负责范围','工厂结算','商城商品','商城订单','用户与权限']},
    platform_finance:{label:'平台财务',surface:'web',org:'优洗通平台',subtitle:'经营数据、钱包流水与工厂结算',nav:['经营总览','业务订单','退污退款','客户与组织','酒店与楼层','协议价格','工厂站点映射','司机负责范围','钱包与流水','工厂结算','商城订单','用户与权限']},
    hotel_admin:{label:'酒店管理员',surface:'mobile',org:'云栖酒店',subtitle:'补充、订单、账户、商城与员工',nav:['补充','订单','商城','我的']},
    hotel_operator:{label:'酒店操作员',surface:'mobile',org:'云栖酒店',subtitle:'补充下单、订单与退污、商城',nav:['补充','订单','商城','我的']},
    factory_admin:{label:'工厂管理员',surface:'factory',org:'桐乡洗涤一厂',subtitle:'本厂订单、退款、仓库、结算与报表',nav:['经营总览','业务订单','退污退款','工厂结算','布草与仓库','RFID 扫描记录','业务报表']},
    factory_operator:{label:'工厂操作员',surface:'factory',org:'桐乡洗涤一厂',subtitle:'本厂订单履约、退款确认、仓库与扫描记录',nav:['经营总览','业务订单','退污退款','工厂结算','布草与仓库','RFID 扫描记录','业务报表']},
    factory_finance:{label:'工厂财务',surface:'factory',org:'桐乡洗涤一厂',subtitle:'本厂订单、结算与报表只读',nav:['经营总览','业务订单','工厂结算','业务报表']},
    driver:{label:'司机',surface:'mobile',org:'桐乡洗涤一厂',subtitle:'本人负责区域与酒店清单',nav:['负责酒店']},
    terminal:{label:'厂内终端（工厂操作员）',surface:'terminal',org:'桐乡洗涤一厂',subtitle:'首次芯片入库与租赁备货',nav:['首次芯片入库','租赁备货']}
  };
  var state={role:'platform_ops',section:'业务订单',view:'normal',navCollapsed:false,qty:{'被套':40,'床单':60,'浴巾':20},scan:28,progress:0};
  var terminalDraft={site:'',sku:'',reference:'',rfid:'',quantity:'1'};
  var terminalEvents=[{mode:'首次芯片入库',reference:'IN-20260907-028',quantity:28,time:'今日 10:08'},{mode:'租赁备货',reference:'RP202609060086',quantity:64,time:'昨日 16:26'}];
  var mobileOrderTab='orders';
  var roleSelect=document.getElementById('roleSelect');
  var viewSelect=document.getElementById('viewSelect');
  var root=document.getElementById('prototypeRoot');
  var modal=document.getElementById('prototypeModal');
  var toastTimer=0;

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
  function money(value){return '¥'+Number(value).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function badge(text,tone){return '<span class="status-pill '+(tone||'')+'"><i></i>'+esc(text)+'</span>';}
  function button(text,action,type,disabled){return '<button type="button" class="'+(type||'secondary-button')+'" data-action="'+esc(action)+'"'+(disabled?' disabled':'')+'>'+esc(text)+'</button>';}
  function header(title,desc,actions){return '<div class="screen-head"><div><div class="eyebrow">WORKSPACE</div><h2>'+esc(title)+'</h2><p>'+esc(desc)+'</p></div><div class="screen-actions">'+(actions||'')+'</div></div>';}
  function metric(label,value,note,tone,trend){return '<article class="metric-card"><div class="metric-label"><span>'+esc(label)+'</span><i class="metric-tone '+(tone||'')+'"></i></div><div class="metric-value">'+esc(value)+'</div><div class="metric-foot"><span>'+esc(note)+'</span>'+(trend?'<b class="trend '+tone+'">'+esc(trend)+'</b>':'')+'</div></article>';}
  function sampleNote(){return '';}
  function filters(items){return '<div class="filter-bar">'+items.map(function(item){return item.type==='search'?'<label class="search-control"><span>⌕</span><input aria-label="'+esc(item.label)+'" placeholder="'+esc(item.placeholder)+'"></label>':'<label class="select-control"><span>'+esc(item.label)+'</span><select aria-label="'+esc(item.label)+'">'+(item.label==='订单状态'?['全部状态','待派单','已派单','备货中','配送中','已送达']:item.label==='状态'?['全部状态','待确认','已同意','已驳回']:[item.value]).map(function(option){return '<option>'+esc(option)+'</option>';}).join('')+'</select></label>';}).join('')+'<div class="filter-actions">'+button('重置','resetFilters','text-button')+button('查询','filter','primary-button')+'</div></div>';}
  function table(headers,rows){return '<div class="data-table-wrap"><table class="data-table"><thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(cell){return '<td>'+cell+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><div class="pagination"><span>共 '+rows.length+' 条记录</span><div><button disabled>‹</button><button class="active">1</button><button disabled>›</button></div></div>';}
  function panel(title,aside,body,cls){return '<article class="panel '+(cls||'')+'"><div class="panel-head"><strong>'+esc(title)+'</strong><span>'+esc(aside||'')+'</span></div><div class="panel-body">'+body+'</div></article>';}
  function timeline(items){return '<div class="timeline">'+items.map(function(item,index){return '<div class="timeline-item '+(item.done?'done':'')+'"><i>'+((item.done||index===0)?'✓':'')+'</i><div><strong>'+esc(item.title)+'</strong><span>'+esc(item.time||'待处理')+'</span></div></div>';}).join('')+'</div>';}
  function navSymbol(name){var symbols={'经营总览':'总','业务订单':'单','退污退款':'退','客户与组织':'客','酒店与楼层':'店','协议价格':'价','工厂站点映射':'映','司机负责范围':'司','钱包与流水':'账','工厂结算':'结','商城商品':'商','商城订单':'购','用户与权限':'权','布草与仓库':'仓','RFID 扫描记录':'芯','业务报表':'报','补充':'补','订单':'单','商城':'商','我的':'我','负责酒店':'店','首次芯片入库':'入','租赁备货':'备'};return symbols[name]||name.slice(0,1);}

  function specialState(title){
    var map={
      empty:{icon:'○',title:'当前条件下暂无数据',desc:'调整筛选条件或清除筛选后再试。',action:'清除筛选'},
      error:{icon:'!',title:'数据加载失败',desc:'当前条件已保留，请检查网络后重试。',action:'重新加载'},
      forbidden:{icon:'×',title:'当前角色无权访问',desc:'该功能不在当前组织与角色的授权范围内。',action:'返回工作台'}
    },item=map[state.view];
    return header(title,'当前页面状态')+'<div class="state-card '+state.view+'"><span class="state-icon">'+item.icon+'</span><h3>'+item.title+'</h3><p>'+item.desc+'</p>'+button(item.action,'restore','primary-button')+'</div>';
  }

  function actualDashboard(role){
    var factory=role.surface==='factory';
    var cards=factory?
      metric('待处理订单','12 单','已派发','warning')+metric('备货中订单','6 单','本厂订单','')+metric('待确认退款','4 单','本厂申请','danger')+metric('工厂应收',money(46320),'已送达订单成本','success'):
      metric('合作酒店','28 家','当前有效酒店','')+metric('待处理订单','3 单','已派单','warning')+metric('待确认退款','8 单','全平台申请','danger')+metric('累计充值',money(286500),'已登记资金流水','success')+metric('累计消费',money(214680),'补充与商城扣款','')+metric('工厂应付',money(126320),'已派单至已送达订单成本','warning');
    return header(factory?'洗涤厂生产总览':'平台经营总览',role.org+' · 数据以服务端最新业务账本为准',button('刷新数据','filter','secondary-button'))+'<section class="metric-grid">'+cards+'</section>'+panel('待关注事项','业务列表为准','<div class="state-card"><span class="state-icon">i</span><h3>异常提醒尚未启用</h3><p>请进入订单、退款和资金流水列表查看当前业务记录。</p></div>','chart-panel');
  }

  function actualOrders(role){
    var factory=role.surface==='factory',canOperate=state.role==='factory_admin'||state.role==='factory_operator',canDispatch=state.role==='platform_admin'||state.role==='platform_ops';
    var platformRows=[
      ['<strong>RP202609070018</strong>','云栖酒店','8F','120',money(706),money(486),money(220),'桐乡洗涤一厂',badge('已派单',''),'2026-09-07 09:42','—'],
      ['<strong>RP202609070012</strong>','悦澜酒店','5F','86',money(528),money(362),money(166),'—',badge('待派单','warning'),'2026-09-07 08:16',canDispatch?'<button class="link-button" data-action="dispatchOrder">派单</button>':'—'],
      ['<strong>RP202609060086</strong>','栖岸酒店','3F','64',money(398),money(276),money(122),'桐乡洗涤一厂',badge('已送达','success'),'2026-09-06 16:20','—']
    ];
    var factoryRows=[
      ['<strong>RP202609070018</strong>','云栖酒店','8F','120',money(486),badge(state.progress>2?'已送达':state.progress>1?'配送中':state.progress>0?'备货中':'已派单',state.progress>2?'success':'warning'),'2026-09-07 09:42',canOperate&&state.progress<3?'<button class="link-button" data-action="orderDetail">更新进度</button>':'—'],
      ['<strong>RP202609060086</strong>','栖岸酒店','3F','64',money(276),badge('已送达','success'),'2026-09-06 16:20','—']
    ];
    return header('业务订单',factory?'查看承接订单并按已派单、备货中、配送中、已送达的顺序更新进度；页面只显示工厂结算金额。':'核对酒店补充订单、自动派单结果、酒店扣款、工厂结算和平台毛利。',button('刷新','filter','secondary-button'))+filters([{label:'订单状态',value:'全部状态'}])+panel(factory?'本厂履约订单':'平台订单','每页 20 条',table(factory?['订单号','酒店','楼层','布草件数','工厂结算','状态','下单时间','操作']:['订单号','酒店','楼层','布草件数','酒店扣款','工厂结算','平台毛利','承接洗涤厂','状态','下单时间','操作'],factory?factoryRows:platformRows));
  }

  function actualRefunds(role){
    var factory=role.surface==='factory',canConfirm=state.role==='factory_admin'||state.role==='factory_operator';
    var rows=factory?[
      ['<strong>RF202609070006</strong>','RP202609060086','栖岸酒店','12','8','明显污渍',badge('已同意','success'),'—'],
      ['<strong>RF202609070003</strong>','RP202609050061','云栖酒店','5','—','不可使用',badge('待确认','warning'),canConfirm?'<button class="link-button" data-action="refundDetail">同意 / 驳回</button>':'—']
    ]:[
      ['<strong>RF202609070006</strong>','RP202609060086','栖岸酒店','12','8',money(33.6),money(22.4),'明显污渍',badge('已同意','success')],
      ['<strong>RF202609070003</strong>','RP202609050061','云栖酒店','5','—',money(40),money(0),'不可使用',badge('待确认','warning')]
    ];
    return header('退污退款',factory?'核对本厂收到的退污申请，可全部、部分同意或驳回；同意后款项退回酒店预付余额。':'查看酒店退污申请、工厂确认数量与退款结果；平台角色仅查看。',button('刷新','filter','secondary-button'))+filters([{label:'状态',value:'全部状态'}])+panel('退款申请','每页 20 条',table(factory?['退款单号','原订单号','酒店','申请件数','确认件数','原因','状态','确认']:['退款单号','原订单号','酒店','申请件数','确认件数','申请退款','实际退款','原因','状态'],rows));
  }

  function actualResource(section,role){
    var platformWriter=state.role==='platform_admin'||state.role==='platform_ops';
    if(section==='协议价格')return header('酒店与工厂价格','按酒店、洗涤厂和布草品类查询两套价格；历史订单继续使用下单时价格。',platformWriter?button('设置价格','createPrice','primary-button'):'')+filters([{type:'search',label:'酒店组织编号',placeholder:'请输入酒店组织编号'},{type:'search',label:'工厂组织编号',placeholder:'请输入工厂组织编号'}])+panel('价格表','',table(['布草编号','布草品类','单位','酒店协议价','工厂成本价'],[['linen-duvet','被套','件',money(8),money(5.5)],['linen-sheet','床单','件',money(5.5),money(3.8)],['linen-towel','浴巾','件',money(2.8),money(1.9)]]));
    if(section==='工厂站点映射')return header(section,'酒店固定映射到承接洗涤厂和站点，新订单使用当前映射。',platformWriter?button('设置映射','createMapping','primary-button'):'')+panel('固定派厂表','',table(['酒店组织编号','酒店','洗涤厂','工厂站点','站点编号'],[['org-hotel-yunqi','云栖酒店','桐乡洗涤一厂','东区站','site-factory-east']]));
    if(section==='钱包与流水')return header(section,'按酒店查询不可修改的充值、消费和退款流水。',button('登记充值','recharge','primary-button'))+filters([{type:'search',label:'酒店组织编号',placeholder:'请输入酒店组织编号'}])+panel('资金流水','',table(['流水类型','变动金额','变动后余额','关联业务','摘要','发生时间'],[['布草订单扣款','-'+money(706),money(12680),'RP202609070018','布草补充单','2026-09-07 09:42'],['线下充值','+'+money(20000),money(13386),'BANK-20260901-01','已核验到账','2026-09-01 10:06']]));
    if(section==='工厂结算')return header(section,'按已送达订单中的工厂成本汇总各洗涤厂结算金额。',button('刷新','filter','secondary-button'))+panel('结算汇总','线下结算',table(['工厂组织编号','洗涤厂','已送达订单','结算金额'],[['org-factory-1','桐乡洗涤一厂','128',money(126320)]]));
    if(section==='商城商品')return header(section,'维护酒店耗材商品、统一售价和可售库存。',platformWriter?button('新增商品','createProduct','primary-button'):'')+panel('商品列表','',table(['商品名称','分类','商品说明','统一售价','可售库存','状态'],[['客房高效清洁剂','客房清洁','500ml，温和低泡',money(39),'86',badge('正常','success')],['酒店香氛补充装','香氛用品','清新木质调',money(68),'0',badge('正常','success')]]));
    if(section==='商城订单')return header(section,'查看商城订单金额、商品明细和库存扣减后的订单状态。',button('刷新','filter','secondary-button'))+panel('商城订单','每页 20 条',table(['商城订单号','商品明细','商品件数','订单金额','状态','下单时间'],[['SO202609070006','客房高效清洁剂 × 2','2',money(78),badge('已创建',''),'2026-09-07 10:12']]));
    if(section==='布草与仓库')return header(section,'按首次芯片入库和租赁备货事件汇总本工厂布草数量。',button('刷新','filter','secondary-button'))+panel('仓库汇总','',table(['布草编号','布草品类','累计入库','累计备货','当前可用'],[['linen-duvet','被套','8642','7356','1286'],['linen-sheet','床单','7906','6920','986'],['linen-towel','浴巾','5672','5486','186']]));
    if(section==='RFID 扫描记录')return header(section,'查看厂内终端已提交并由系统确认的扫描事件。',button('刷新','filter','secondary-button'))+panel('扫描事件','每页 20 条',table(['事件编号','工作模式','关联业务','布草品类','识别数量','采集方式','提交时间'],[['evt-20260907-028','首次芯片入库','IN-20260907-028','被套','42','MANUAL','2026-09-07 08:58'],['evt-20260907-019','租赁备货','RP202609070018','床单','60','MANUAL','2026-09-07 10:08']]));
    if(section==='业务报表')return header(section,'查看本工厂累计订单、已送达订单、布草总件数和工厂应收。',button('刷新','filter','secondary-button'))+panel('工厂履约汇总','',table(['累计订单','已送达订单','布草总件数','工厂应收'],[['196','128','8268',money(126320)]]));
    return specialState(section);
  }

  // Shared in-memory identity fixtures. Refreshing restores the demonstration data.
  var identity={orgs:[
    {id:'org-platform',name:'优洗通平台',type:'platform'},
    {id:'org-hotel-yunqi',name:'云栖酒店',type:'hotel',site:'云栖酒店站点',area:'城东片区',address:'桐乡市振兴路 18 号',floors:'1F、2F、3F、8F'},
    {id:'org-factory-1',name:'桐乡洗涤一厂',type:'factory',site:'东区站',area:'城东片区',address:'桐乡市工业园路 20 号'},
    {id:'org-hotel-full',name:'悦澜酒店（账号已满样例）',type:'hotel',site:'悦澜酒店站点',area:'城西片区',address:'桐乡市庆丰路 8 号',floors:'1F、2F'},
    {id:'org-factory-legacy',name:'洗涤二厂（待补管理员）',type:'factory',site:'北区站',area:'城北片区',address:'桐乡市环城北路 10 号'}
  ],users:[],query:{q:'',org:'',role:'',status:'',type:''},page:1,detail:'',draft:null,audit:[],next:100};
  var identityTypes={platform:'平台',hotel:'酒店',factory:'洗涤厂'};
  var identityRoleTypes={platform:['platform_admin','platform_ops','platform_finance','driver'],hotel:['hotel_admin','hotel_operator'],factory:['factory_admin','factory_operator','factory_finance','driver']};
  var identityCapabilities={platform_admin:'管理组织和全部账号；平台业务、资金与基础资料管理',platform_ops:'管理非平台角色账号；订单、客户、价格、商城及司机分配',platform_finance:'账号与组织只读；平台经营数据、钱包与结算',hotel_admin:'本酒店补充、订单、退款、账户、商城与员工管理',hotel_operator:'本酒店补充下单、订单、退污和商城',factory_admin:'本厂履约、退款确认、仓库、终端事件、结算与报表',factory_operator:'本厂履约、退款确认、仓库与终端事件',factory_finance:'本厂订单、结算与报表只读',driver:'仅查看本人分配的负责酒店与服务信息'};
  Object.keys(roles).filter(function(r){return r!=='terminal';}).forEach(function(r,i){identity.users.push({id:'user-'+r,org:r.indexOf('hotel_')===0?'org-hotel-yunqi':r.indexOf('factory_')===0||r==='driver'?'org-factory-1':'org-platform',role:r,name:roles[r].label,login:r,active:true,hotels:r==='driver'?['org-hotel-yunqi']:[],area:r==='driver'?'城东片区':'',sessions:1});});
  for(var identityIndex=0;identityIndex<10;identityIndex++)identity.users.push({id:'sample-'+identityIndex,org:'org-hotel-full',role:identityIndex===0?'hotel_admin':'hotel_operator',name:identityIndex===0?'悦澜管理员':'悦澜员工 '+identityIndex,login:'yuelan_'+identityIndex,active:true,hotels:[],sessions:1});
  identity.users.push({id:'sample-disabled',org:'org-hotel-full',role:'hotel_operator',name:'待恢复员工',login:'yuelan_disabled',active:false,hotels:[],sessions:0});
  identity.users.push({id:'legacy-worker',org:'org-factory-legacy',role:'factory_operator',name:'二厂操作员',login:'legacy_operator',active:true,hotels:[],sessions:1});
  identity.users.forEach(function(u,i){u.createdAt=new Date(Date.UTC(2026,8,1,1,i)).toISOString();});
  function identityCreatedAt(value){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value));}
  function identityOrg(id){return identity.orgs.find(function(o){return o.id===id;});}
  function identityUser(id){return identity.users.find(function(u){return u.id===id;});}
  function identityWritable(user){return state.role==='platform_admin'||state.role==='platform_ops'&&(!user||user.role.indexOf('platform_')!==0);}
  function identityAssignable(org,user){var values=(identityRoleTypes[(identityOrg(org)||{}).type]||[]).filter(function(r){return state.role==='platform_admin'||r.indexOf('platform_')!==0;});return user?values.filter(function(r){return (r==='driver')===(user.role==='driver');}):values;}
  function identityAdmins(org){return identity.users.filter(function(u){return u.org===org&&u.active&&u.role===(identityOrg(org).type+'_admin');});}
  function identityCount(org){return identity.users.filter(function(u){return u.org===org&&u.active;}).length;}
  function identityOptions(items,value,empty){return (empty!==undefined?'<option value="">'+esc(empty)+'</option>':'')+items.map(function(item){return '<option value="'+esc(item.id)+'"'+(item.id===value?' selected':'')+'>'+esc(item.name)+'</option>';}).join('');}
  function identitySelect(label,key,items,value,empty){return '<label class="form-row"><span>'+esc(label)+'</span><select data-identity-field="'+key+'" aria-label="'+esc(label)+'">'+identityOptions(items,value,empty)+'</select></label>';}
  function identityInput(label,key,value,extra){return '<label class="form-row"><span>'+esc(label)+'</span><input data-identity-field="'+key+'" aria-label="'+esc(label)+'" value="'+esc(value||'')+'" '+(extra||'')+'></label>';}
  function identityRoleInfo(r){if(!roles[r])return '';return '<div class="identity-role-info"><b>'+esc(roles[r].label)+'</b><span>'+esc(identityCapabilities[r])+'</span><small>使用端：'+(r.indexOf('hotel_')===0||r==='driver'?'移动端':r==='factory_operator'?'管理工作台、移动终端':'管理工作台')+' · 数据范围：'+(r==='driver'?'本人负责酒店':r.indexOf('platform_')===0?'全平台':r.indexOf('hotel_')===0?'所属酒店':'所属工厂')+'</small></div>';}
  function identityPaged(headers,rows){var pages=Math.max(1,Math.ceil(rows.length/20));identity.page=Math.min(identity.page,pages);var content=table(headers,rows.slice((identity.page-1)*20,identity.page*20));return content.replace(/<div class="pagination">[\s\S]*$/,'<div class="pagination identity-pagination"><span>共 '+rows.length+' 条 · 每页 20 条</span><div>'+button('上一页','identityPrev','text-button',identity.page===1)+'<span>'+identity.page+' / '+pages+'</span>'+button('下一页','identityNext','text-button',identity.page===pages)+'</div></div>');}
  function identityFilter(isOrg){var q=identity.query;return '<form class="filter-bar identity-filter">'+identityInput(isOrg?'组织名称':'姓名或账号','q',q.q,'placeholder="输入关键词"')+(isOrg?identitySelect('组织类型','type',Object.keys(identityTypes).map(function(t){return{id:t,name:identityTypes[t]};}),q.type,'全部类型'):identitySelect('所属组织','org',identity.orgs,q.org,'全部组织')+identitySelect('角色','role',Object.keys(identityCapabilities).map(function(r){return{id:r,name:roles[r].label};}),q.role,'全部角色')+identitySelect('状态','status',[{id:'enabled',name:'启用'},{id:'disabled',name:'停用'}],q.status,'全部状态'))+'<div class="filter-actions">'+button('重置','identityReset','text-button')+button('查询','identitySearch','primary-button')+'</div></form>';}
  function identityMemberRows(users){return users.slice().sort(function(a,b){return b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id);}).map(function(u){var o=identityOrg(u.org);return ['<strong>'+esc(u.name)+'</strong>',esc(u.login),esc(o.name),esc(identityTypes[o.type]),'<button class="link-button" data-action="identityRole:'+u.role+'">'+esc(roles[u.role].label)+'</button>',badge(u.active?'启用':'停用',u.active?'success':''),esc(identityCreatedAt(u.createdAt)),identityWritable(u)?button('维护','identityEdit:'+u.id,'link-button'):'只读'];});}
  function identityRender(section){
    if(section==='用户与权限')return header(section,'组织决定归属，角色决定业务能力；司机负责酒店独立管理。',identityWritable()?button('新增用户','identityAdd','primary-button'):'')+identityFilter(false)+panel('账号列表','模拟数据，刷新后还原',identityPaged(['姓名','登录账号','所属组织','组织类型','角色与权限','状态','创建时间','操作'],identityMemberRows(identity.users.filter(function(u){var q=identity.query;return (!q.q||(u.name+' '+u.login).toLowerCase().indexOf(q.q.toLowerCase())>=0)&&(!q.org||u.org===q.org)&&(!q.role||u.role===q.role)&&(!q.status||u.active===(q.status==='enabled'));}))));
    if(section==='客户与组织'&&identity.detail){var o=identityOrg(identity.detail),admins=identityAdmins(o.id),members=identity.users.filter(function(u){return u.org===o.id;});return header(o.name,'组织详情 · '+identityTypes[o.type],button('返回组织列表','identityBack','secondary-button')+(identityWritable()?button('添加成员','identityAdd:'+o.id,'primary-button'):''))+'<div class="identity-summary">'+panel('基本资料','', '<p>组织编号：'+esc(o.id)+'</p><p>状态：'+badge('正常','success')+'</p><p>站点：'+esc(o.site||'平台总部')+'</p><p>区域：'+esc(o.area||'—')+'</p><p>地址：'+esc(o.address||'—')+'</p>')+panel('管理员与成员','', '<p>启用管理员：'+(admins.length?admins.map(function(u){return esc(u.name);}).join('、'):'<strong class="danger-text">尚未配置</strong>')+'</p><p>启用成员：'+identityCount(o.id)+(o.type==='hotel'?' / 10':'')+' 人</p>'+(!admins.length&&identityWritable()?button('补齐管理员','identityAdmin:'+o.id,'primary-button'):''))+'</div>'+panel('组织成员','角色名称可查看权限说明',identityPaged(['姓名','登录账号','所属组织','组织类型','角色与权限','状态','创建时间','操作'],identityMemberRows(members)));}
    if(section==='客户与组织')return header(section,'建组织、配管理员、添加成员，集中维护组织账号。',identityWritable()?button('新增酒店','identityHotel','secondary-button')+button('新增洗涤厂','identityFactory','primary-button'):'')+identityFilter(true)+panel('组织清单','点击详情维护管理员和成员',identityPaged(['组织编号','组织名称','类型','状态','操作'],identity.orgs.filter(function(o){return (!identity.query.q||o.name.toLowerCase().indexOf(identity.query.q.toLowerCase())>=0)&&(!identity.query.type||o.type===identity.query.type);}).sort(function(a,b){for(var key of ['type','name','id']){if(a[key]!==b[key])return a[key]<b[key]?-1:1;}return 0;}).map(function(o){return [esc(o.id),button(o.name,'identityOrg:'+o.id,'link-button'),identityTypes[o.type],badge('正常','success'),button('详情','identityOrg:'+o.id,'link-button')];})));
    if(section==='酒店与楼层')return header(section,'酒店建档同时创建站点、楼层、零余额钱包和首个管理员。',identityWritable()?button('新增酒店','identityHotel','primary-button'):'')+panel('酒店档案','与组织及用户清单共享数据',table(['酒店名称','站点','区域','地址','楼层','操作'],identity.orgs.filter(function(o){return o.type==='hotel';}).map(function(o){return[esc(o.name),esc(o.site),esc(o.area),esc(o.address),esc(o.floors),button('组织详情','identityOrg:'+o.id,'link-button')];})));
    if(section==='司机负责范围')return header(section,'所属组织与负责酒店分别管理；新建司机至少分配一家酒店。',identityWritable()?button('新增司机','identityDriver','primary-button'):'')+panel('司机账号','与用户清单共享数据',table(['司机','账号','所属组织','负责区域','负责酒店','状态','操作'],identity.users.filter(function(u){return u.role==='driver';}).map(function(u){return [esc(u.name),esc(u.login),esc(identityOrg(u.org).name),esc(u.area),u.hotels.map(function(id){return esc(identityOrg(id).name);}).join('、'),badge(u.active?'启用':'停用',u.active?'success':''),identityWritable(u)?button('维护','identityEdit:'+u.id,'link-button'):'只读'];})));
    return null;
  }
  function identityOpenMember(org,user,role,adminOnly){if(!identityWritable(user)){showToast('当前角色只能查看');return;}identity.draft={kind:'member',id:user?user.id:'',org:org||'',locked:!!org,adminOnly:!!adminOnly,driverOnly:role==='driver',name:user?user.name:'',login:user?user.login:'',role:user?user.role:role||'',active:user?user.active:true,hotels:user?user.hotels.slice():[],area:user?user.area:'',password:'',confirmation:''};identityDrawMember();}
  function identityDrawMember(){var d=identity.draft,u=d.id?identityUser(d.id):null,valid=identityAssignable(d.org,u);if(d.driverOnly)valid=valid.filter(function(r){return r==='driver';});if(d.adminOnly)valid=valid.filter(function(r){return r===identityOrg(d.org).type+'_admin';});if(valid.indexOf(d.role)<0)d.role=d.adminOnly||d.driverOnly?valid[0]||'':'';var orgField=d.locked?identityInput('所属组织','orgLabel',identityOrg(d.org).name,'disabled'):'<label class="form-row"><span>所属组织（输入名称搜索并选择）</span><input data-identity-field="orgSearch" list="identityOrgOptions" aria-label="所属组织" value="'+esc((identityOrg(d.org)||{}).name)+'" placeholder="输入组织名称"><datalist id="identityOrgOptions">'+identity.orgs.filter(function(o){return identityAssignable(o.id).some(function(r){return !d.driverOnly||r==='driver';});}).map(function(o){return '<option value="'+esc(o.name)+'"></option>';}).join('')+'</datalist></label>';
    var fields=orgField+identityInput('姓名','name',d.name)+identityInput('登录账号','login',d.login,u?'disabled':'')+identitySelect('角色','role',valid.map(function(r){return{id:r,name:roles[r].label};}),d.role,!d.org?'请先选择组织':d.adminOnly||d.driverOnly?undefined:'请选择角色');
    if(d.role==='driver')fields+=identityInput('负责区域','area',d.area)+'<fieldset class="identity-hotels"><legend>负责酒店（至少一家）</legend>'+identity.orgs.filter(function(o){return o.type==='hotel';}).map(function(o){return '<label><input type="checkbox" data-identity-hotel="'+esc(o.id)+'"'+(d.hotels.indexOf(o.id)>=0?' checked':'')+'>'+esc(o.name)+'</label>';}).join('')+'</fieldset>';
    var actions=button('取消','closeModal','secondary-button')+(u?button(u.active?'停用账号':'恢复账号','identityToggle','secondary-button')+button('重置密码','identityPassword','secondary-button'):'')+button(u?'保存修改':'创建账号','identitySave','primary-button',!valid.length);
    modalShell(u?'维护账号':'添加组织成员','一个账号 · 一个组织 · 一个角色','<div class="form-grid">'+fields+(!u?formRow('初始密码',''):'')+'</div>'+identityRoleInfo(d.role)+'<p class="identity-error" role="alert"></p>'+(u?'<p class="dialog-copy">登录账号与所属组织不可修改。角色变更、停用和重置密码会使此账号现有会话失效。</p>':''),actions,true);if(!u){modal.querySelector('[data-create-password]').value=d.password;modal.querySelector('[data-confirm-password]').value=d.confirmation;}}
  function identityCapture(){var d=identity.draft;if(!d)return;modal.querySelectorAll('[data-identity-field]').forEach(function(el){var key=el.dataset.identityField;if(key!=='orgLabel'&&key!=='orgSearch')d[key]=el.value;});var input=modal.querySelector('[data-create-password]');if(input){d.password=input.value;d.confirmation=modal.querySelector('[data-confirm-password]').value;}if(modal.querySelector('.identity-hotels'))d.hotels=Array.from(modal.querySelectorAll('[data-identity-hotel]:checked')).map(function(el){return el.dataset.identityHotel;});}
  function identityError(message){var el=modal.querySelector('.identity-error');if(el)el.textContent=message;else showToast(message);return false;}
  function identityValidate(d,newOrg){var org=newOrg||identityOrg(d.org),u=d.id?identityUser(d.id):null;if(!identityWritable(u))return '当前角色无权维护此账号';if(!org)return '请从列表选择有效组织';if(!d.name.trim()||!d.login.trim())return '姓名和登录账号为必填项';if(identity.users.some(function(item){return item.id!==d.id&&item.login===d.login.trim();}))return '登录账号已存在，请更换';if(!d.role)return '请选择角色';if((identityRoleTypes[org.type]||[]).indexOf(d.role)<0||(state.role!=='platform_admin'&&d.role.indexOf('platform_')===0))return '角色与所属组织或当前管理权限不匹配';if(u&&(u.role==='driver')!==(d.role==='driver'))return '司机与其他角色不能直接转换';if(org.type==='hotel'&&!u&&identityCount(org.id)>=10)return '该酒店已达 10 个启用账号上限，请先停用不再使用的账号';if(d.role==='driver'&&(!d.area.trim()||!d.hotels.length))return '请填写负责区域，并至少选择一家负责酒店';if(!u){var error=passwordError(d.password);if(error)return error;if(d.password!==d.confirmation)return '两次输入的密码不一致';}if(u&&u.role!==d.role){if(u.id==='user-'+state.role&&u.role.endsWith('_admin'))return '不能降低自己的管理员角色';if(u.active&&u.role===org.type+'_admin'&&identityAdmins(org.id).length<=1)return '不能降级组织最后一个启用管理员，请先添加其他管理员';}return '';}
  function identityRecord(action,u){identity.audit.push({action:action,user:u.id,time:new Date().toISOString()});}
  function identityCommitMember(){var d=identity.draft,error=identityValidate(d);if(error)return identityError(error);var u=d.id?identityUser(d.id):null;if(u){var changed=u.role!==d.role;u.name=d.name.trim();u.role=d.role;u.area=d.area;u.hotels=d.hotels.slice();if(changed)u.sessions=0;identityRecord('修改账号',u);closeModal();render();showToast(changed?'修改成功，目标账号原有会话已失效':'修改成功','success');}else{u={id:'created-'+identity.next++,createdAt:new Date().toISOString(),org:d.org,name:d.name.trim(),login:d.login.trim(),role:d.role,active:true,hotels:d.hotels.slice(),area:d.area,sessions:0};identity.users.push(u);identityRecord('创建账号',u);d.password='';d.confirmation='';closeModal();render();showToast('账号创建成功，请安全告知初始密码','success');}}
  function identityOpenOrg(type){if(!identityWritable())return;identity.draft={kind:'org',type:type,step:1,name:'',site:'',area:'',address:'',floors:'',adminName:'',login:'',password:'',confirmation:'',role:type+'_admin',hotels:[]};identityDrawOrg();}
  function identityDrawOrg(){var d=identity.draft,steps='<ol class="identity-steps">'+['组织与业务资料','首个管理员','确认创建'].map(function(label,i){return '<li class="'+(d.step===i+1?'active':'')+'">'+(i+1)+' · '+label+'</li>';}).join('')+'</ol>',body='';if(d.step===1)body='<div class="form-grid">'+identityInput('组织名称','name',d.name)+identityInput('首个站点名称','site',d.site)+identityInput('所属区域','area',d.area)+identityInput('地址','address',d.address)+(d.type==='hotel'?identityInput('楼层名称（顿号或逗号分隔）','floors',d.floors):'')+'</div>';if(d.step===2)body='<div class="form-grid">'+identityInput('管理员姓名','adminName',d.adminName)+identityInput('管理员登录账号','login',d.login)+formRow('管理员初始密码','')+'</div>'+identityRoleInfo(d.role);if(d.step===3)body='<div class="identity-role-info"><b>'+esc(d.name)+' · '+identityTypes[d.type]+'</b><span>'+esc(d.site)+' · '+esc(d.area)+'</span><span>'+esc(d.address)+'</span>'+(d.floors?'<span>楼层：'+esc(d.floors)+'</span>':'')+'<span>首个管理员：'+esc(d.adminName)+'（'+esc(d.login)+'）</span><small>确认后一起创建组织、业务资料和管理员；任何校验失败均不保存。</small></div>';modalShell('新增'+identityTypes[d.type],'组织建档',steps+body+'<p class="identity-error" role="alert"></p>',button('取消','closeModal','secondary-button')+(d.step>1?button('上一步','identityOrgPrev','secondary-button'):'')+button(d.step===3?'确认创建':'下一步',d.step===3?'identityOrgCommit':'identityOrgNext','primary-button'),true);if(d.step===2){modal.querySelector('[data-create-password]').value=d.password;modal.querySelector('[data-confirm-password]').value=d.confirmation;}}
  function identityOrgError(){var d=identity.draft;if(!d.name.trim()||!d.site.trim()||!d.area.trim()||!d.address.trim()||d.type==='hotel'&&!d.floors.trim())return '请填写完整组织和业务资料';if(identity.orgs.some(function(o){return o.name===d.name.trim();}))return '组织名称已存在，请更换';if(d.step>=2)return identityValidate(Object.assign({},d,{name:d.adminName}),{id:'pending',type:d.type});return '';}
  function identityConfirm(title,desc,action){modalShell(title,'操作确认','<p class="dialog-copy">'+esc(desc)+'</p><p class="identity-error" role="alert"></p>',button('返回','identityReturn','secondary-button')+button('确认',''+action,'primary-button'));}
  function identityHandle(action){
    if(['createHotel','editHotel','createSite','createUser','editUser','editDriver'].indexOf(action)>=0)action={createHotel:'identityHotel',editHotel:'identityHotel',createSite:'identityFactory',createUser:'identityAdd',editUser:'identityAdd',editDriver:'identityDriver'}[action];
    if(action.indexOf('identity')!==0)return false;var parts=action.split(':'),name=parts[0],id=parts[1],d=identity.draft,u=d&&d.id?identityUser(d.id):null;
    if(name==='identityOrg'){identity.detail=id;identity.page=1;state.section='客户与组织';render();}
    if(name==='identityBack'){identity.detail='';identity.page=1;render();}
    if(name==='identityPrev'||name==='identityNext'){identity.page+=name==='identityNext'?1:-1;render();}
    if(name==='identitySearch'||name==='identityReset'){identity.query={q:'',org:'',role:'',status:'',type:''};if(name==='identitySearch')root.querySelectorAll('.identity-filter [data-identity-field]').forEach(function(el){identity.query[el.dataset.identityField]=el.value.trim();});identity.page=1;render();}
    if(name==='identityRole')modalShell('角色与权限',roles[id].label,identityRoleInfo(id),button('关闭','closeModal','secondary-button'));
    if(name==='identityAdd'||name==='identityAdmin')identityOpenMember(id,null,null,name==='identityAdmin');
    if(name==='identityDriver')identityOpenMember('',null,'driver');
    if(name==='identityEdit'){u=identityUser(id);identityOpenMember(u.org,u);}
    if(name==='identityHotel'||name==='identityFactory')identityOpenOrg(name==='identityHotel'?'hotel':'factory');
    if(name==='identityOrgPrev'){identityCapture();d.step--;identityDrawOrg();}
    if(name==='identityOrgNext'){identityCapture();var oe=identityOrgError();if(oe)identityError(oe);else{d.step++;identityDrawOrg();}}
    if(name==='identityOrgCommit'){var err=identityOrgError();if(err)identityError(err);else{var orgId='org-created-'+identity.next++;identity.orgs.push({id:orgId,name:d.name.trim(),type:d.type,site:d.site.trim(),area:d.area.trim(),address:d.address.trim(),floors:d.floors});var admin={id:'created-'+identity.next++,createdAt:new Date().toISOString(),org:orgId,name:d.adminName.trim(),login:d.login.trim(),role:d.role,active:true,hotels:[],area:'',sessions:0};identity.users.push(admin);identityRecord('建档并创建管理员',admin);d.password='';d.confirmation='';identity.detail=orgId;identity.page=1;state.section='客户与组织';closeModal();render();showToast('组织、业务资料和管理员已一起创建','success');}}
    if(name==='identitySave'){identityCapture();var error=identityValidate(d);if(error)identityError(error);else if(u&&u.role!==d.role)identityConfirm('确认调整角色','调整后目标账号的现有会话立即失效，需重新登录。','identitySaveConfirmed');else identityCommitMember();}
    if(name==='identitySaveConfirmed')identityCommitMember();
    if(name==='identityReturn')identityDrawMember();
    if(name==='identityToggle'){identityCapture();if(!identityWritable(u))identityError('当前角色无权维护');else if(u.active&&u.id==='user-'+state.role)identityError('不能停用自己的账号');else if(u.active&&u.role===identityOrg(u.org).type+'_admin'&&identityAdmins(u.org).length<=1)identityError('不能停用组织最后一个启用管理员，请先添加其他管理员');else if(!u.active&&identityOrg(u.org).type==='hotel'&&identityCount(u.org)>=10)identityError('该酒店已达 10 个启用账号上限，无法恢复');else identityConfirm(u.active?'确认停用账号':'确认恢复账号',u.active?'停用后此账号不可登录，现有会话立即失效。':'恢复后可重新登录，旧会话不会恢复。','identityToggleConfirmed');}
    if(name==='identityToggleConfirmed'){if(!identityWritable(u)||u.active&&u.id==='user-'+state.role||u.active&&u.role===identityOrg(u.org).type+'_admin'&&identityAdmins(u.org).length<=1||!u.active&&identityOrg(u.org).type==='hotel'&&identityCount(u.org)>=10){identityError('当前状态不允许执行，请返回重新检查');return true;}u.active=!u.active;u.sessions=0;identityRecord(u.active?'恢复账号':'停用账号',u);closeModal();render();showToast(u.active?'账号已恢复，需重新登录':'账号已停用，原有会话已失效','success');}
    if(name==='identityPassword'){identityCapture();modalShell('重置账号密码',u.login,formRow('新密码','')+'<p class="dialog-copy">重置后目标账号现有会话立即失效，请安全告知新密码。</p><p class="identity-error" role="alert"></p>',button('返回','identityReturn','secondary-button')+button('重置密码','identityPasswordReview','primary-button'));}
    if(name==='identityPasswordReview'){identityCapture();var pe=passwordError(d.password)||(d.password!==d.confirmation?'两次输入的密码不一致':'');if(pe)identityError(pe);else identityConfirm('确认重置密码','目标账号现有会话立即失效。新密码不再回显，请通过安全渠道告知。','identityPasswordCommit');}
    if(name==='identityPasswordCommit'){if(!identityWritable(u)){identityError('当前角色无权维护');return true;}u.sessions=0;d.password='';d.confirmation='';identityRecord('重置密码',u);closeModal();render();showToast('密码已重置，目标账号原有会话已失效','success');}
    return true;
  }

  function renderWebContent(role){
    var s=state.section;
    if(state.view!=='normal')return specialState(s);
    var identityContent=identityRender(s);if(identityContent!==null)return identityContent;
    if(s==='经营总览')return actualDashboard(role);
    if(s==='业务订单')return actualOrders(role);
    if(s==='退污退款')return actualRefunds(role);
    return actualResource(s,role);
  }

  function renderWeb(role){
    var roleNames={platform_admin:'平台管理员',platform_ops:'平台运营',platform_finance:'平台财务',factory_admin:'工厂管理员',factory_operator:'工厂操作员',factory_finance:'工厂财务'};
    var displayNames={platform_admin:'平台管理员',platform_ops:'平台运营',platform_finance:'平台财务',factory_admin:'洗涤厂管理员',factory_operator:'工厂备货员',factory_finance:'工厂财务'};
    var roleName=roleNames[state.role]||role.label,displayName=displayNames[state.role]||role.label,workspace=role.surface==='factory'?'洗涤厂工作台':'平台工作台';
    return '<div class="web-app '+(state.navCollapsed?'collapsed':'')+'"><aside class="web-sidebar"><div class="web-brand"><span class="brand-block">优</span><span><strong>优洗通</strong><small>运营管理平台</small></span></div><nav class="web-nav"><div class="nav-group-label">工作空间</div>'+role.nav.map(function(item){return '<button class="nav-item '+(item===state.section?'active':'')+'" data-section="'+esc(item)+'" title="'+esc(item)+'"><span class="nav-symbol">'+navSymbol(item)+'</span><span>'+esc(item)+'</span></button>';}).join('')+'</nav><button class="sidebar-collapse" type="button" data-action="collapseNav">'+(state.navCollapsed?'›':'‹ 收起导航')+'</button></aside><section class="web-main"><header class="web-topbar"><div class="admin-header-left"><div class="breadcrumb"><span>'+esc(workspace)+'</span><i>/</i><strong>'+esc(state.section)+'</strong></div></div><div class="admin-header-right"><div class="organization-chip"><span>'+esc(role.org)+'</span><small>'+esc(roleName)+'</small></div><div class="user-menu-wrap"><button class="user-button" type="button" data-action="userMenu" aria-label="用户菜单" aria-expanded="false"><span>'+esc(displayName.slice(0,1))+'</span><i>'+esc(displayName)+'</i><b>⌄</b></button><div class="user-menu" id="webUserMenu"><button type="button" disabled>'+esc(roleName)+'</button><button type="button" data-action="signOut">退出登录</button></div></div></div></header><div class="web-content">'+renderWebContent(role)+'</div></section></div>';
  }

  function mobileHead(role,back){return '<header class="mobile-head '+(back?'simple':'')+'">'+(back?'<button data-action="back" aria-label="返回">‹</button>':'')+'<div><small>优洗通 · '+esc(role.label)+'</small><h1>'+esc(back||role.org)+'</h1></div>'+(back?'<span></span>':'<button class="mobile-record" data-action="mobileRecords">记录</button>')+'</header>';}
  function laundryRow(name,price,quota){var q=state.qty[name]||0;return '<div class="laundry-row"><span class="laundry-icon">'+name.slice(0,1)+'</span><span class="laundry-info"><strong>'+name+'</strong><small>'+money(price)+'/件 · 可补 '+quota+' 件</small></span><span class="stepper"><button data-action="minus" data-item="'+name+'" aria-label="减少'+name+'">−</button><b>'+q+'</b><button data-action="plus" data-item="'+name+'" data-max="'+quota+'" aria-label="增加'+name+'">＋</button></span></div>';}
  function mobileReplenish(role){
    var total=state.qty['被套']*8+state.qty['床单']*5.5+state.qty['浴巾']*2.8,count=state.qty['被套']+state.qty['床单']+state.qty['浴巾'];
    if(state.view!=='normal')return mobileState();
    return '<div class="mobile-gradient"><div class="mobile-brandline"><span><b>优洗通</b><i></i>'+esc(role.org)+'</span><button data-action="mobileRecords">账户记录</button></div><div class="quota-label">可补总量</div><div class="quota-number"><strong>200</strong><span>件</span></div><p>按各品类可补数量分别核算</p><div class="wallet-strip"><span class="wallet-symbol">¥</span><span>余额 <b>'+money(12680)+'</b></span>'+badge('余额充足','lime')+'</div></div><section class="mobile-content"><div class="floor-row"><span><small>当前楼层</small><strong>8F 布草清单</strong></span><button data-action="floor">切换楼层 ›</button></div><div class="laundry-list">'+laundryRow('被套',8,80)+laundryRow('床单',5.5,90)+laundryRow('浴巾',2.8,30)+'</div><div class="rule-hint"><b>下单校验</b><span>提交时校验品类额度、账户余额、当前价格和承接工厂。</span></div></section><footer class="mobile-checkout"><span><small>预计扣款</small><strong>'+money(total)+'</strong><i>'+count+' 件</i></span><button data-action="submitOrder"'+(count===0?' disabled':'')+'>确认下单</button></footer>';
  }

  function mobileOrders(role){
    if(state.view!=='normal')return mobileState();
    var tabs='<div class="mobile-tabs"><button data-action="ordersTab" class="'+(mobileOrderTab==='orders'?'active':'')+'">补充订单</button><button data-action="refundsTab" class="'+(mobileOrderTab==='refunds'?'active':'')+'">退污记录</button></div>';
    if(mobileOrderTab==='refunds')return mobileHead(role,'补充订单')+'<section class="mobile-page">'+tabs+'<div class="order-card"><header><span><strong>RF202609070006</strong><small>关联订单 RP202609060086</small></span>'+badge('已同意','success')+'</header><footer><span><small>通过 8 件</small><b>'+money(22.4)+'</b></span></footer></div><div class="order-card"><header><span><strong>RF202609070003</strong><small>关联订单 RP202609050061</small></span>'+badge('待确认','warning')+'</header><footer><span><small>申请 5 件</small><b>'+money(40)+'</b></span></footer></div></section>';
    return mobileHead(role,'补充订单')+'<section class="mobile-page">'+tabs+'<div class="order-card"><header><span><strong>RP202609070018</strong><small>今日 09:42 · 8F</small></span>'+badge('备货中','warning')+'</header><div class="order-goods"><span>被套 40</span><span>床单 60</span><span>浴巾 20</span></div><footer><span><small>共 120 件</small><b>'+money(706)+'</b></span><button data-action="mobileOrderDetail">查看详情</button></footer></div><div class="order-card"><header><span><strong>RP202609060086</strong><small>昨日 16:20 · 3F</small></span>'+badge('已送达','success')+'</header><div class="order-goods"><span>被套 20</span><span>床单 32</span><span>浴巾 12</span></div><footer><span><small>共 64 件</small><b>'+money(369.6)+'</b></span><button data-action="applyRefund">申请退污</button></footer></div><div class="mini-boundary"><b>退污规则</b><span>仅已送达且仍有可退数量的订单明细可发起；通过后退款至预存账户。</span></div></section>';
  }

  function mobileAccount(role){
    if(state.view!=='normal')return mobileState();
    return mobileHead(role,'账户与账单')+'<section class="mobile-page"><div class="balance-card"><small>可用余额</small><strong>'+money(12680)+'</strong><button data-action="rechargeRequest">充值</button></div><div class="section-title"><strong>账户流水</strong><span>充值、消费与退款分别记账</span></div><div class="mobile-ledger"><div><i>−</i><span><strong>布草订单扣款</strong><small>今日 09:42 · RP202609070018</small></span><b>−¥706.00</b></div><div><i class="plus">+</i><span><strong>退污退款</strong><small>昨日 18:12 · RF202609060012</small></span><b>+¥22.40</b></div><div><i class="plus">+</i><span><strong>线下充值</strong><small>09-01 10:06 · BANK-20260901-01</small></span><b>+¥20,000.00</b></div></div></section>';
  }

  function mobileStore(role){
    if(state.view!=='normal')return mobileState();
    return mobileHead(role,'易耗品商城')+'<section class="mobile-page store-page"><div class="store-search">酒店易耗品</div><div class="product-grid"><article><span class="product-art">清</span><strong>客房高效清洁剂</strong><small>温和低泡 · 库存 86 件</small><div><b>'+money(39)+'</b><button data-action="addCart">＋</button></div></article><article><span class="product-art green">香</span><strong>酒店香氛补充装</strong><small>清新木质调 · 库存 0 件</small><div><b>'+money(68)+'</b><button data-action="soldOut" disabled>售罄</button></div></article></div><button class="cart-float" data-action="cart">提交订单 <b>1</b></button></section>';
  }

  function mobileEmployees(role){
    if(state.view!=='normal')return mobileState();
    return mobileHead(role,'员工账号')+'<section class="mobile-page"><div class="section-title"><strong>员工账号 3</strong><button class="accent-link" data-action="createEmployee">＋ 添加员工</button></div><div class="employee-list"><button type="button" disabled><i>陈</i><span><strong>陈经理</strong><small>hotel_admin · 酒店管理员</small></span>'+badge('正常','success')+'<em>›</em></button><button type="button" disabled><i>周</i><span><strong>周晓</strong><small>hotel_operator_01 · 酒店操作员</small></span>'+badge('正常','success')+'<em>›</em></button><button type="button" disabled><i>王</i><span><strong>王琳</strong><small>hotel_operator_02 · 酒店操作员</small></span>'+badge('停用','')+'<em>›</em></button></div></section>';
  }

  function mobileProfile(role){
    var admin=state.role==='hotel_admin';
    return mobileHead(role,'我的')+'<section class="mobile-page"><div class="profile-card"><i>'+esc(role.label.slice(0,1))+'</i><span><strong>'+esc(role.label)+'</strong><small>'+esc(role.org)+'</small></span>'+badge('当前身份','success')+'</div><div class="menu-list"><button data-action="'+(admin?'openAccount':'denied')+'"><span>账户与账单</span><em>›</em></button><button data-action="'+(admin?'openEmployees':'denied')+'"><span>员工账号</span><em>›</em></button><button data-action="openRefunds"><span>退污记录</span><em>›</em></button></div><button class="danger-button" data-action="signOut">退出登录</button></section>';
  }

  function driverHome(role){
    if(state.view!=='normal')return mobileState();
    return '<div class="driver-hero"><div class="mobile-brandline"><span><b>优洗通</b><i></i>司机工作台</span><button data-action="signOut">退出</button></div><small>司机张师傅</small><h1>本人负责范围</h1><div><span><b>1</b> 个区域</span><span><b>2</b> 家酒店</span></div></div><section class="mobile-page driver-list"><div class="section-title"><strong>城东片区</strong><span>2 家酒店</span></button><button type="button" aria-disabled="true"><i>01</i><span><strong>云栖酒店</strong><small>桐乡市振兴路 18 号 · 服务点：东区站</small></span></div><button type="button" aria-disabled="true"><i>02</i><span><strong>悦澜酒店</strong><small>桐乡市梧桐路 9 号 · 服务点：东区站</small></span></button></section>';
  }

  function mobileState(){
    var map={empty:['○','暂无业务记录','新的记录会显示在这里'],error:['!','加载失败','网络异常，请稍后重试'],forbidden:['×','无权查看','当前角色不具备此功能权限']},item=map[state.view];
    return '<div class="mobile-state"><i>'+item[0]+'</i><strong>'+item[1]+'</strong><span>'+item[2]+'</span><button data-action="restore">'+(state.view==='error'?'重新加载':'返回首页')+'</button></div>';
  }

  function renderMobile(role){
    var content=state.section==='补充'?mobileReplenish(role):state.section==='订单'?mobileOrders(role):state.section==='账户'?mobileAccount(role):state.section==='商城'?mobileStore(role):state.section==='员工'?mobileEmployees(role):state.section==='负责酒店'?driverHome(role):mobileProfile(role);
    var nav=state.role==='driver'?'':'<nav class="mobile-nav">'+role.nav.map(function(item){return '<button class="'+(item===state.section?'active':'')+'" data-section="'+esc(item)+'"><i>'+navSymbol(item)+'</i><span>'+esc(item)+'</span></button>';}).join('')+'</nav>';
    return '<div class="device-stage"><div class="phone-frame"><div class="phone-screen"><div class="mobile-scroll">'+content+'</div>'+nav+'</div></div><div class="device-caption"><b>'+esc(role.label)+'</b><span>'+(role.label==='司机'?'司机负责范围':'微信小程序')+'</span></div></div>';
  }

  function terminalWorkspace(role){
    var inbound=state.section==='首次芯片入库';
    if(state.view!=='normal')return mobileState();
    var fields=[['site','洗涤站点 ID','由后台站点配置提供'],['sku','布草品类 ID','由后台品类配置提供'],['reference','业务引用',inbound?'厂商事件唯一标识，用于防重':'关联本站备货订单或厂商事件号'],['rfid','芯片号',inbound?'由设备适配器写入':'批量计数时可由适配器留空'],['quantity','有效数量','设备本次有效计数']];
    return '<header class="terminal-mobile-head"><div><small>'+esc(role.org)+'</small><h1>终端工位</h1></div><button type="button" data-action="signOut">退出</button></header><section class="terminal-mobile-content"><div class="terminal-mode-switch">'+role.nav.map(function(item){return '<button type="button" class="'+(item===state.section?'active':'')+'" data-section="'+esc(item)+'">'+esc(item)+'</button>';}).join('')+'</div><div class="terminal-mobile-form">'+fields.map(function(field){return '<label><span>'+field[1]+'</span><input data-terminal-field="'+field[0]+'" value="'+esc(terminalDraft[field[0]])+'" placeholder="'+esc(field[2])+'" aria-label="'+field[1]+'"'+(field[0]==='quantity'?' type="number" min="1" step="1"':'')+'></label>';}).join('')+'<button type="button" class="terminal-submit" data-action="terminalSubmit">校验并提交事件</button></div><div class="terminal-history-title"><strong>最近事件</strong><span>当前工厂</span></div><div class="terminal-events">'+terminalEvents.map(function(item){return '<article><div><strong>'+esc(item.mode)+'</strong><small>'+esc(item.reference)+' · '+esc(item.time)+'</small></div><span>'+badge('有效 '+item.quantity,'success')+badge('MANUAL','')+'</span></article>';}).join('')+'</div></section>';
  }

  function submitTerminal(){
    var quantity=Number(terminalDraft.quantity);
    if(!terminalDraft.site.trim()||!terminalDraft.sku.trim()||!terminalDraft.reference.trim()||!Number.isInteger(quantity)||quantity<1){showToast('请完整输入事件数据，有效数量须为正整数');return;}
    if(state.section==='首次芯片入库'&&!terminalDraft.rfid.trim()){showToast('首次入库必须提供芯片号');return;}
    terminalEvents.unshift({mode:state.section,reference:terminalDraft.reference.trim(),quantity:quantity,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})});
    terminalDraft.reference='';terminalDraft.rfid='';terminalDraft.quantity='1';render();showToast('设备事件已提交','success');
  }

  function renderTerminal(role){
    return '<div class="device-stage"><div class="phone-frame terminal-phone"><div class="phone-screen"><div class="terminal-mobile-scroll">'+terminalWorkspace(role)+'</div></div></div><div class="device-caption"><b>厂内终端</b><span>非微信构建 · 竖屏工位</span></div></div>';
  }

  function modalShell(title,kicker,content,footer,wide){
    modal.innerHTML='<section class="modal-card '+(wide?'wide':'')+'" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><header><span><small>'+esc(kicker||'BUSINESS ACTION')+'</small><h2 id="modalTitle">'+esc(title)+'</h2></span><button class="modal-close" data-action="closeModal" aria-label="关闭">×</button></header><div class="modal-content">'+content+'</div><footer>'+(footer||button('关闭','closeModal','secondary-button'))+'</footer></section>';
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');var close=modal.querySelector('.modal-close');if(close)close.focus();
  }
  function closeModal(){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');modal.innerHTML='';}
  function passwordError(value){
    if(!value)return '请输入初始密码';
    if(value.length<8||value.length>20)return '密码须为 8～20 位';
    if(!/^[!-~]+$/.test(value))return '密码仅支持英文半角字符，不允许空格、中文或其他非英文字符';
    if(Number(/[A-Za-z]/.test(value))+Number(/[0-9]/.test(value))+Number(/[^A-Za-z0-9]/.test(value))<2)return '字母、数字、特殊字符至少包含两种';
    return '';
  }
  function formRow(label,value,help){
    if(/密码/.test(label))return '<div class="password-fields"><label class="form-row"><span>'+esc(label)+'</span><input data-create-password aria-label="'+esc(label)+'" type="password" autocomplete="new-password" value="" placeholder="8～20 位，至少包含两种字符"><small>英文字母、数字、特殊字符至少包含两种；仅支持英文半角字符，不允许空格或中文。</small></label><label class="form-row"><span>确认初始密码</span><input data-confirm-password aria-label="确认初始密码" type="password" autocomplete="new-password" value="" placeholder="请再次输入初始密码"></label><button type="button" class="text-button" data-action="toggleCreatePassword" aria-pressed="false">显示密码</button><p class="password-error" role="alert" aria-live="polite"></p></div>';
    return '<label class="form-row"><span>'+esc(label)+'</span><input aria-label="'+esc(label)+'"'+(/（分）|库存/.test(label)?' type="number" min="0" step="1"':'')+' value="'+esc(value||'')+'">'+(help?'<small>'+esc(help)+'</small>':'')+'</label>';
  }
  function showConfigForm(action){
    var originalAction=action,aliases={editHotel:'createHotel',editPrice:'createPrice',editProduct:'createProduct',editUser:'createUser',editEmployee:'createEmployee'};action=aliases[action]||action;
    var config={
      createMapping:{title:'设置酒店固定派厂',kicker:'工厂站点映射',content:'<div class="form-grid">'+formRow('酒店组织编号','org-hotel-yunqi')+formRow('洗涤厂组织编号','org-factory-1')+formRow('工厂站点编号','site-factory-east')+'</div>'},
      createPrice:{title:'设置当前布草价格',kicker:'酒店与工厂价格',content:'<div class="form-grid">'+formRow('价格类型','酒店协议价')+formRow('酒店组织编号','org-hotel-yunqi')+formRow('工厂组织编号','org-factory-1')+formRow('布草品类编号','linen-duvet')+formRow('单价（分）','800')+'</div><div class="boundary-banner"><strong>历史订单</strong><span>修改当前价格不改写已生成订单的价格。</span></div>'},
      createProduct:{title:'新增商城商品',kicker:'商城商品',content:'<div class="form-grid">'+formRow('商品名称','客房高效清洁剂')+formRow('商品分类','客房清洁')+formRow('统一售价（分）','3900')+formRow('初始库存','86')+'</div>'+formRow('商品说明','温和低泡 · 500ml')+formRow('商品图片地址','')},
      createEmployee:{title:'添加酒店员工',kicker:'员工账号',content:'<div class="form-grid">'+formRow('姓名','周晓')+formRow('登录账号','hotel_operator_02')+formRow('初始密码','********')+'</div><p class="dialog-copy">新增账号角色为酒店操作员。</p>'}
      ,warehouseEdit:{title:'维护仓库货架',kicker:'库存位置',content:'<div class="form-grid">'+formRow('洗涤站点','东区站')+formRow('仓区 / 货架','A 区 · A-01')+formRow('布草品类','被套')+formRow('容量','600 件')+'</div><div class="boundary-banner"><strong>组织隔离</strong><span>只能维护本厂所属站点的仓库和货架。</span></div>'}
    },item=config[action];if(!item)return false;var title=originalAction.indexOf('edit')===0?item.title.replace('新增','编辑').replace('新建','编辑'):item.title;modalShell(title,item.kicker,item.content,button('取消','closeModal','secondary-button')+button(action==='createHotel'?'保存并继续':'保存配置','confirmGeneric','primary-button'),true);return true;
  }
  function showOrderDetail(){
    var role=roles[state.role],factory=role.surface==='factory';
    var nextAction=state.progress===0?'开始备货':state.progress===1?'确认出库':state.progress===2?'确认送达':'履约完成';
    var summary=factory?'<div class="order-summary"><div><small>酒店 / 楼层</small><b>云栖酒店 · 8F</b></div><div><small>洗涤站点</small><b>东区站</b></div><div><small>总件数</small><b>120 件</b></div><div><small>当前待办</small><b>'+nextAction+'</b></div></div>':'<div class="order-summary"><div><small>酒店 / 楼层</small><b>云栖酒店 · 8F</b></div><div><small>洗涤站点</small><b>东区站</b></div><div><small>总件数</small><b>120 件</b></div><div><small>扣款金额</small><b>'+money(706)+'</b></div></div>';
    var detailTable=factory?table(['品类','数量'],[['被套','40 件'],['床单','60 件'],['浴巾','20 件']]):table(['品类','数量','销售单价','小计'],[['被套','40 件',money(8),money(320)],['床单','60 件',money(5.5),money(330)],['浴巾','20 件',money(2.8),money(56)] ]);
    modalShell('补充订单详情','RP202609070018',summary+detailTable+'<h3 class="modal-subtitle">履约状态</h3>'+timeline([{title:'订单已派发',time:'今日 09:42',done:true},{title:'工厂备货中',time:state.progress>0?'今日 10:08':'待处理',done:state.progress>0},{title:'配送中',time:state.progress>1?'今日 10:26':'待处理',done:state.progress>1},{title:'已送达',time:state.progress>2?'今日 11:06':'待处理',done:state.progress>2}]),button('关闭','closeModal','secondary-button')+(factory&&(state.role==='factory_admin'||state.role==='factory_operator')&&state.progress<3?button(nextAction,'advance','primary-button'):''),true);
  }
  function showDispatchOrder(){
    modalShell('派发补充订单','RP202609070012','<div class="order-summary"><div><small>酒店</small><b>悦澜酒店</b></div><div><small>楼层</small><b>5F</b></div><div><small>布草件数</small><b>86 件</b></div><div><small>当前状态</small><b>待派单</b></div></div><div class="form-grid">'+formRow('承接洗涤厂组织编号','org-factory-1')+formRow('工厂站点编号','site-factory-center')+'</div>',button('取消','closeModal','secondary-button')+button('确认派单','confirmDispatch','primary-button'));
  }
  function showRefund(){
    var role=roles[state.role],factory=role.surface==='factory',hotel=role.surface==='mobile'&&state.role!=='driver';
    if(!factory&&!hotel){modalShell('退污退款详情','RF202609070003','<div class="detail-grid"><div><small>申请酒店</small><b>云栖酒店</b></div><div><small>关联订单</small><b>RP202609050061</b></div><div><small>申请件数</small><b>5 件</b></div><div><small>当前状态</small><b>待确认</b></div></div>'+formRow('退污原因','不可使用'),button('关闭','closeModal','secondary-button'),true);return;}
    modalShell(factory?'确认退污退款':'发起退污申请','RF202609070003','<div class="pending-banner"><b>退污不换货</b><span>'+(factory?'可全部、部分同意或驳回；同意金额按原订单单价退回酒店预付余额。':'从已送达订单的一条明细申请，并填写退污原因。')+'</span></div><div class="refund-line"><span><strong>被套</strong><small>申请数量 5 件</small></span><label><small>'+(factory?'确认数量':'申请数量')+'</small><input id="refundQuantity" aria-label="'+(factory?'确认数量':'申请数量')+'" type="number" min="1" max="5" step="1" value="5"></label><label><small>上限</small><b>5 件</b></label></div>'+formRow(factory?'核验备注':'退污原因',factory?'部分同意':'明显污渍'),button('取消','closeModal','secondary-button')+(factory?button('驳回申请','rejectRefund','secondary-button'):'')+button(factory?'确认提交':'提交退污申请','confirmRefund','primary-button'));
  }
  function showRecharge(isHotel){
    if(isHotel){modalShell('充值方式待开通','账户充值','<p class="dialog-copy">当前请联系优洗通财务处理授权充值，页面不会直接入账。</p>',button('知道了','closeModal','primary-button'));return;}
    modalShell('登记已核验的线下充值','钱包与流水',formRow('酒店组织编号','org-hotel-yunqi')+formRow('到账金额（分）','2000000')+formRow('银行流水号','BANK-20260907-1826')+formRow('核验备注','线下到账已核验'),button('取消','closeModal','secondary-button')+button('确认登记','confirmRecharge','primary-button'));
  }
  function showGeneric(title,desc){modalShell(title,'操作确认','<div class="dialog-illustration">'+navSymbol(title)+'</div><p class="dialog-copy">'+esc(desc)+'</p>',button('取消','closeModal','secondary-button')+button('确认','confirmGeneric','primary-button'));}
  function showSubmitOrder(){var total=state.qty['被套']*8+state.qty['床单']*5.5+state.qty['浴巾']*2.8,count=state.qty['被套']+state.qty['床单']+state.qty['浴巾'];modalShell('确认补充订单','云栖酒店 · 8F','<div class="confirm-amount"><small>本次预计扣款</small><strong>'+money(total)+'</strong><span>共 '+count+' 件 · 固定分配至东区站</span></div><div class="confirm-list"><p><span>被套 × '+state.qty['被套']+'</span><b>'+money(state.qty['被套']*8)+'</b></p><p><span>床单 × '+state.qty['床单']+'</span><b>'+money(state.qty['床单']*5.5)+'</b></p><p><span>浴巾 × '+state.qty['浴巾']+'</span><b>'+money(state.qty['浴巾']*2.8)+'</b></p></div><div class="check-row"><i>✓</i><span><b>余额充足</b><small>提交时将再次校验额度、余额、价格和站点映射</small></span></div>',button('返回修改','closeModal','secondary-button')+button('确认并扣款','confirmOrder','lime-button'));
  }

  function openForAction(action){
    if(action==='orderDetail'||action==='mobileOrderDetail')return showOrderDetail();
    if(action==='dispatchOrder')return showDispatchOrder();
    if(action==='refundDetail'||action==='applyRefund')return showRefund();
    if(action==='recharge'||action==='confirmRecharge')return showRecharge(false);
    if(action==='rechargeRequest')return showRecharge(true);
    if(action==='submitOrder')return showSubmitOrder();
    if(showConfigForm(action))return;
    var info={floor:['切换楼层','选择楼层后刷新当前酒店可补布草。'],otherLaundry:['添加其他布草','仅可添加酒店已配置价格的布草品类。'],cart:['提交商城订单','提交时再次校验商品状态、库存和预存余额。'],driverHotel:['负责酒店','查看当前分配的酒店、地址和服务点。'],roleInfo:['角色与权限','页面按组织和角色隔离信息。'],ledger:['资金流水','每笔资金变动关联业务单号和变动后余额。'],help:['使用帮助','按当前角色展示操作说明。'],about:['关于优洗通','酒店、平台与洗涤厂的布草业务协作平台。']};
    if(info[action])showGeneric(info[action][0],info[action][1]);
  }

  function render(){
    var role=roles[state.role];
    root.innerHTML=role.surface==='mobile'?renderMobile(role):role.surface==='terminal'?renderTerminal(role):renderWeb(role);
    var url=new URL(location.href);url.searchParams.set('role',state.role);history.replaceState(null,'',url.toString());
  }
  function setRole(key){if(!roles[key])return;closeModal();identity.detail='';identity.page=1;identity.query={q:'',org:'',role:'',status:'',type:''};state.role=key;state.section=roles[key].nav[0];state.view='normal';viewSelect.value='normal';render();}
  function showToast(message,tone){var el=document.getElementById('prototypeToast');el.textContent=message;el.className='prototype-toast show '+(tone||'');clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className='prototype-toast';},2400);}
  function handleClick(event){
    var userMenu=document.getElementById('webUserMenu');
    if(userMenu&&!event.target.closest('.user-menu-wrap'))userMenu.classList.remove('show');
    var section=event.target.closest('[data-section]');if(section){state.section=section.dataset.section;identity.detail='';identity.page=1;identity.query={q:'',org:'',role:'',status:'',type:''};render();return;}
    var actionEl=event.target.closest('[data-action]');if(!actionEl)return;var action=actionEl.dataset.action;
    if(identityHandle(action))return;
    if(action==='userMenu'){var trigger=actionEl,menu=document.getElementById('webUserMenu'),open=!menu.classList.contains('show');menu.classList.toggle('show',open);trigger.setAttribute('aria-expanded',String(open));return;}
    if(action==='signOut'){showToast('已打开退出登录操作');return;}
    if(action==='collapseNav'){state.navCollapsed=!state.navCollapsed;render();return;}
    if(action==='openAccount'){state.section='账户';render();return;}
    if(action==='openEmployees'){state.section='员工';render();return;}
    if(action==='mobileRecords'){if(state.role==='hotel_admin'){state.section='账户';render();}else{showToast('请联系酒店管理员查看账户记录');}return;}
    if(action==='denied'){showToast('当前账号无此权限');return;}
    if(action==='back'){if(roles[state.role].surface==='mobile'){state.section=state.role==='driver'?'负责酒店':'我的';render();}else{closeModal();}return;}
    if(action==='closeModal'){closeModal();return;}
    if(action==='restore'){state.view='normal';viewSelect.value='normal';render();return;}
    if(action==='plus'||action==='minus'){var item=actionEl.dataset.item,max=Number(actionEl.dataset.max||999),delta=action==='plus'?1:-1;state.qty[item]=Math.max(0,Math.min(max,(state.qty[item]||0)+delta));render();return;}
    if(action==='advance'){state.progress=Math.min(3,state.progress+1);closeModal();render();showToast(['','订单已开始备货','订单已确认出库','订单已确认送达'][state.progress],'success');return;}
    if(action==='rejectRefund'){modalShell('确认驳回申请','RF202609070003',formRow('驳回原因',''),button('取消','closeModal','secondary-button')+button('确认驳回','confirmRejectRefund','primary-button'));return;}
    if(action==='confirmRefund'){var quantityInput=document.getElementById('refundQuantity'),quantity=Number(quantityInput&&quantityInput.value);if(!Number.isInteger(quantity)||quantity<1||quantity>5){showToast('数量须为 1 至 5 的整数');return;}}
    if(action==='confirmRejectRefund'){var reason=modal.querySelector('input');if(!reason||!reason.value.trim()){showToast('请填写驳回原因');return;}}
    if(action==='toggleCreatePassword'){var passwordInputs=modal.querySelectorAll('[data-create-password],[data-confirm-password]'),show=passwordInputs[0].type==='password';passwordInputs.forEach(function(input){input.type=show?'text':'password';});event.target.textContent=show?'隐藏密码':'显示密码';event.target.setAttribute('aria-pressed',String(show));return;}
    if(action==='confirmGeneric'&&modal.querySelector('[data-create-password]')){var initial=modal.querySelector('[data-create-password]'),confirmation=modal.querySelector('[data-confirm-password]'),error=passwordError(initial.value)||(!confirmation.value?'请再次输入初始密码':initial.value!==confirmation.value?'两次输入的密码不一致':'');modal.querySelector('.password-error').textContent=error;if(error){(passwordError(initial.value)?initial:confirmation).focus();return;}}
    if(/^confirm/.test(action)){var createdAccount=!!modal.querySelector('[data-create-password]');closeModal();showToast(createdAccount?'账号创建成功，请通过安全渠道告知使用者初始密码':action==='confirmOrder'?'订单 RP202609070019 已生成，已扣款 '+money(state.qty['被套']*8+state.qty['床单']*5.5+state.qty['浴巾']*2.8):action==='confirmRecharge'?'充值已登记，资金流水已生成':action==='confirmRefund'?'退污结果已提交，退款将按通过数量处理':action==='confirmDispatch'?'订单已派发至指定洗涤厂站点':action==='confirmRejectRefund'?'已驳回申请':'操作已完成','success');return;}
    if(action==='ordersTab'||action==='refundsTab'||action==='openRefunds'){mobileOrderTab=action==='ordersTab'?'orders':'refunds';state.section='订单';render();return;}
    if(action==='terminalSubmit'){submitTerminal();return;}
    if(action==='filter'||action==='resetFilters'){var controls=root.querySelectorAll('.filter-bar input,.filter-bar select');if(action==='resetFilters')controls.forEach(function(control){if(control.tagName==='SELECT')control.selectedIndex=0;else control.value='';});var selected=root.querySelector('.filter-bar select'),term=selected?selected.value:'';root.querySelectorAll('.data-table tbody tr').forEach(function(row){row.hidden=!!term&&term.indexOf('全部')!==0&&row.textContent.indexOf(term)<0;});showToast(action==='filter'?'已按当前条件查询':'筛选条件已重置');return;}
    if(action==='filter'||action==='resetFilters'||action==='export'||action==='notice'||action==='addCart'||action==='soldOut'){showToast(action==='filter'?'已按当前条件刷新':action==='resetFilters'?'筛选条件已重置':action==='export'?'已生成导出任务':action==='notice'?'暂无未读业务消息':action==='addCart'?'已加入订单':'当前商品库存为 0');return;}
    openForAction(action);
  }

  function inline(text){return esc(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');}
  function parseMarkdown(md){
    var lines=md.replace(/\r/g,'').split('\n'),html=[],heads=[],i=0,lists=[];
    function closeList(){var list=lists.pop();html.push('</li></'+list.tag+'>');}
    function closeLists(){while(lists.length)closeList();}
    while(i<lines.length){
      var line=lines[i],trim=line.trim();
      if(!trim){i++;continue;}
      if(/^---+$/.test(trim)){closeLists();html.push('<hr>');i++;continue;}
      var heading=/^(#{1,4})\s+(.+)$/.exec(trim);
      if(heading){closeLists();var level=heading[1].length,id='prd-'+heads.length;heads.push({id:id,level:level,text:heading[2]});html.push('<h'+level+' id="'+id+'">'+inline(heading[2])+'</h'+level+'>');i++;continue;}
      if(trim.indexOf('|')===0&&i+1<lines.length&&/^\s*\|?[\s:|-]+\|\s*$/.test(lines[i+1])){closeLists();var rows=[],j=i;while(j<lines.length&&lines[j].trim().indexOf('|')===0){rows.push(lines[j].trim().replace(/^\||\|$/g,'').split('|').map(function(cell){return cell.trim();}));j++;}html.push('<table><thead><tr>'+rows[0].map(function(cell){return '<th>'+inline(cell)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.slice(2).map(function(row){return '<tr>'+row.map(function(cell){return '<td>'+inline(cell)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>');i=j;continue;}
      var numbered=/^\d+\.\s+(.+)$/.exec(trim),item=/^[-*]\s+(.+)$/.exec(trim);
      if(numbered||item){var indent=line.match(/^\s*/)[0].length,tag=numbered?'ol':'ul';while(lists.length&&indent<lists[lists.length-1].indent)closeList();if(lists.length&&indent===lists[lists.length-1].indent&&tag!==lists[lists.length-1].tag)closeList();if(!lists.length||indent>lists[lists.length-1].indent){html.push('<'+tag+'>');lists.push({indent:indent,tag:tag});}else html.push('</li>');html.push('<li>'+inline((numbered||item)[1]));i++;continue;}
      closeLists();html.push('<p>'+inline(trim)+'</p>');i++;
    }
    closeLists();return {html:html.join(''),heads:heads};
  }
  function initPrd(){var md=document.getElementById('prdMdSource').textContent.replace(/^\n/,'');var parsed=parseMarkdown(md);document.getElementById('prdContent').innerHTML=parsed.html;document.getElementById('prdToc').innerHTML='<div class="prd-toc-title">产品需求目录</div>'+parsed.heads.filter(function(h){return h.level>1&&h.level<4;}).map(function(h){return '<button class="prd-toc-item level-'+h.level+'" data-prd-target="'+h.id+'">'+esc(h.text)+'</button>';}).join('');}
  function initDrag(){var drag=document.getElementById('splitDrag'),panel=document.getElementById('prdPanel'),startX=0,startW=0;drag.addEventListener('mousedown',function(event){if(panel.classList.contains('collapsed'))return;event.preventDefault();startX=event.clientX;startW=panel.offsetWidth;drag.classList.add('dragging');document.body.style.cursor='col-resize';document.body.style.userSelect='none';function move(e){panel.style.width=Math.max(330,Math.min(Math.floor(innerWidth*.72),startW-(e.clientX-startX)))+'px';}function up(){drag.classList.remove('dragging');document.body.style.cursor='';document.body.style.userSelect='';document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);}document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);});}
  function togglePrd(){var panel=document.getElementById('prdPanel'),button=document.getElementById('prdToggle');panel.classList.toggle('collapsed');button.textContent=panel.classList.contains('collapsed')?'展开 PRD':'收起 PRD';}
  function downloadPrd(){var blob=new Blob([document.getElementById('prdMdSource').textContent.replace(/^\n/,'')],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='优洗通当前系统产品需求文档.md';a.click();setTimeout(function(){URL.revokeObjectURL(url);},0);}
  function showChangelog(){var mask=document.getElementById('changelogMask'),items=typeof changelogData==='undefined'?[]:changelogData;document.getElementById('changelogBody').innerHTML=items.map(function(item){return '<div class="release-item"><b>'+esc(item.time)+'</b><p>'+esc(item.desc)+'</p></div>';}).join('');mask.classList.add('show');mask.setAttribute('aria-hidden','false');}
  function closeChangelog(){var mask=document.getElementById('changelogMask');mask.classList.remove('show');mask.setAttribute('aria-hidden','true');}

  modal.addEventListener('change',function(e){if(!identity.draft||identity.draft.kind!=='member')return;if(e.target.dataset.identityField==='orgSearch'){identityCapture();var selected=identity.orgs.find(function(o){return o.name===e.target.value&&identityAssignable(o.id).some(function(r){return !identity.draft.driverOnly||r==='driver';});});identity.draft.org=selected?selected.id:'';identity.draft.role='';identity.draft.hotels=[];identityDrawMember();if(!selected)identityError('请从列表选择有效组织');}else if(e.target.dataset.identityField==='role'){identityCapture();identityDrawMember();}});
  root.addEventListener('submit',function(e){if(e.target.matches('.identity-filter')){e.preventDefault();identityHandle('identitySearch');}});
  roleSelect.addEventListener('change',function(){setRole(this.value);});
  viewSelect.addEventListener('change',function(){state.view=this.value;render();});
  root.addEventListener('click',handleClick);modal.addEventListener('click',handleClick);modal.addEventListener('click',function(e){if(e.target===this)closeModal();});
  root.addEventListener('input',function(e){var key=e.target.dataset.terminalField;if(key&&Object.prototype.hasOwnProperty.call(terminalDraft,key))terminalDraft[key]=e.target.value;});
  document.getElementById('prdToggle').addEventListener('click',togglePrd);document.getElementById('downloadPrdBtn').addEventListener('click',downloadPrd);document.getElementById('changelogBtn').addEventListener('click',showChangelog);document.getElementById('closeChangelog').addEventListener('click',closeChangelog);document.getElementById('changelogMask').addEventListener('click',function(e){if(e.target===this)closeChangelog();});
  document.getElementById('prdToc').addEventListener('click',function(e){var buttonEl=e.target.closest('[data-prd-target]');if(!buttonEl)return;var target=document.getElementById(buttonEl.dataset.prdTarget);if(target){var content=document.getElementById('prdContent');content.scrollTop+=target.getBoundingClientRect().top-content.getBoundingClientRect().top;}});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeModal();closeChangelog();}});
  document.addEventListener('DOMContentLoaded',function(){var initial=new URL(location.href).searchParams.get('role');if(initial&&roles[initial])state.role=initial;state.section=roles[state.role].nav[0];roleSelect.innerHTML=Object.keys(roles).map(function(key){return '<option value="'+key+'">'+esc(roles[key].label)+'</option>';}).join('');roleSelect.value=state.role;viewSelect.value=state.view;initPrd();initDrag();render();});
})();
