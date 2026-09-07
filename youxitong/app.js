(function(){
  'use strict';

  var roles={
    platform_admin:{label:'平台系统管理员',surface:'web',org:'优洗通平台',subtitle:'账号、权限、审计与基础设置',nav:['总览','酒店管理','洗涤厂与站点','订单中心','价格与映射','财务中心','商城管理','司机范围','账号权限','审计日志']},
    platform_ops:{label:'平台运营人员',surface:'web',org:'优洗通平台',subtitle:'客户、价格、订单、商城与司机范围',nav:['运营总览','酒店管理','洗涤厂与站点','订单中心','价格与映射','退污退款','商城管理','司机范围']},
    platform_finance:{label:'平台财务人员',surface:'web',org:'优洗通平台',subtitle:'充值、消费、退款与工厂结算',nav:['财务总览','酒店账户','充值管理','退款核对','工厂结算','资金报表']},
    hotel_admin:{label:'酒店管理员',surface:'mobile',org:'云栖酒店',subtitle:'补充、订单、账户、商城与员工',nav:['补充','订单','账户','商城','员工','我的']},
    hotel_operator:{label:'酒店操作员',surface:'mobile',org:'云栖酒店',subtitle:'原型默认：日常补充、订单与退污申请；最终权限待确认',nav:['补充','订单','我的']},
    factory_admin:{label:'洗涤厂管理员',surface:'factory',org:'桐乡洗涤一厂',subtitle:'订单、送洗入库、库存、退污与经营',nav:['工厂总览','履约订单','送洗入库','布草库存','退污检测','物流协作','仓库货架','站点设置','经营报表']},
    factory_operator:{label:'洗涤厂操作员',surface:'factory',org:'桐乡洗涤一厂',subtitle:'备货、出库、送洗入库和退污检测',nav:['待办工作台','履约订单','送洗入库','布草库存','退污检测','仓库货架']},
    factory_finance:{label:'洗涤厂财务',surface:'factory',org:'桐乡洗涤科技有限公司',subtitle:'本厂成本与结算只读',nav:['财务总览','成本明细','结算账单','期间报表']},
    driver:{label:'司机',surface:'mobile',org:'桐乡配送组',subtitle:'本人负责区域与酒店清单 · 载体待确认',nav:['负责酒店','我的']},
    terminal:{label:'洗涤终端操作员',surface:'terminal',org:'桐乡洗涤一厂',subtitle:'首次芯片入库与租赁备货',nav:['首次芯片入库','租赁备货']}
  };
  var state={role:'platform_ops',section:'运营总览',density:'standard',view:'normal',qty:{'被套':40,'床单':60,'浴巾':20},scan:28,progress:0};
  var roleSelect=document.getElementById('roleSelect');
  var densitySelect=document.getElementById('densitySelect');
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
  function sampleNote(){return '<div class="sample-note"><span>示例</span>页面数据仅用于交互评审，不作为真实经营统计</div>';}
  function filters(items){return '<div class="filter-bar">'+items.map(function(item){return item.type==='search'?'<label class="search-control"><span>⌕</span><input aria-label="'+esc(item.label)+'" placeholder="'+esc(item.placeholder)+'"></label>':'<label class="select-control"><span>'+esc(item.label)+'</span><select><option>'+esc(item.value)+'</option><option>全部</option></select></label>';}).join('')+'<div class="filter-actions">'+button('重置','resetFilters','text-button')+button('查询','filter','primary-button')+'</div></div>';}
  function table(headers,rows){return '<div class="data-table-wrap"><table class="data-table"><thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(cell){return '<td>'+cell+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><div class="pagination"><span>共 '+rows.length+' 条示例记录</span><div><button disabled>‹</button><button class="active">1</button><button disabled>›</button></div></div>';}
  function panel(title,aside,body,cls){return '<article class="panel '+(cls||'')+'"><div class="panel-head"><strong>'+esc(title)+'</strong><span>'+esc(aside||'')+'</span></div><div class="panel-body">'+body+'</div></article>';}
  function timeline(items){return '<div class="timeline">'+items.map(function(item,index){return '<div class="timeline-item '+(item.done?'done':'')+'"><i>'+((item.done||index===0)?'✓':'')+'</i><div><strong>'+esc(item.title)+'</strong><span>'+esc(item.time||'待处理')+'</span></div></div>';}).join('')+'</div>';}
  function navSymbol(name){var symbols={'总览':'概','运营总览':'概','财务总览':'财','工厂总览':'概','待办工作台':'待','酒店管理':'店','洗涤厂与站点':'厂','订单中心':'单','履约订单':'单','送洗入库':'入','价格与映射':'价','财务中心':'财','酒店账户':'账','充值管理':'充','退款核对':'退','工厂结算':'结','资金报表':'表','退污退款':'退','退污检测':'检','物流协作':'运','仓库货架':'仓','商城管理':'商','司机范围':'司','账号权限':'权','审计日志':'审','布草库存':'库','站点设置':'站','经营报表':'表','成本明细':'本','结算账单':'结','期间报表':'表'};return symbols[name]||name.slice(0,1);}

  function specialState(title){
    var map={
      empty:{icon:'○',title:'当前条件下暂无数据',desc:'调整筛选条件或清除筛选后再试。',action:'清除筛选'},
      error:{icon:'!',title:'数据加载失败',desc:'当前条件已保留，请检查网络后重试。',action:'重新加载'},
      forbidden:{icon:'×',title:'当前角色无权访问',desc:'该功能不在当前组织与角色的授权范围内。',action:'返回工作台'}
    },item=map[state.view];
    return header(title,'用于核对空、错误和权限边界的统一体验。')+'<div class="state-card '+state.view+'"><span class="state-icon">'+item.icon+'</span><h3>'+item.title+'</h3><p>'+item.desc+'</p>'+button(item.action,'restore','primary-button')+'</div>';
  }

  function dashboardFor(role){
    var factory=role.surface==='factory',finance=role.label.indexOf('财务')>-1;
    var title=factory?'工厂业务总览':finance?'资金与结算总览':'平台运营总览';
    var cards=factory?
      metric('今日待备货','12 单','本厂全部站点','warning','3 单临近时限')+metric('待出库','6 单','已完成备货','')+metric('待检测退污','4 单','最早申请 09:18','danger')+(finance?metric('本期成本','¥46,320.00','当前结算期间','success'):metric('可用库存','4,680 件','本厂全部站点','success')):
      finance?metric('平台预存余额','¥286,500','28 家合作酒店','success')+metric('待确认充值','6 笔','合计 ¥42,000','warning')+metric('今日退款','¥1,268.00','8 笔已核对','')+metric('待生成结算','2 个工厂','周期口径待确认','danger'):
      metric('合作酒店','28 家','24 家正常合作','success','+2 本月')+metric('服务站点','4 个','固定映射 28 家酒店','')+metric('履约中订单','36 单','备货 12 · 出库 6','warning')+metric('待处理退污','8 单','其中 2 单超过 24h','danger');
    return header(title,'今日 10:26 更新 · 金额与数量为交互示例数据。',button('导出当前视图','export','secondary-button'))+sampleNote()+'<section class="metric-grid">'+cards+'</section><section class="content-grid">'+
      panel('核心业务闭环','按有效业务数量', '<div class="flow-list"><div class="flow-row"><span class="flow-name">送洗入库</span><span class="flow-bar"><i style="width:100%"></i></span><em>形成额度</em></div><div class="flow-row"><span class="flow-name">补充下单</span><span class="flow-bar"><i style="width:82%"></i></span><em>额度 + 钱包</em></div><div class="flow-row"><span class="flow-name">工厂履约</span><span class="flow-bar"><i style="width:64%"></i></span><em>固定站点</em></div><div class="flow-row"><span class="flow-name">退污退款</span><span class="flow-bar"><i style="width:46%"></i></span><em>按实退款</em></div></div>')+
      panel('待确认事项','上线前书面确认','<div class="task-list"><button data-action="question" class="task-item"><i class="task-dot"></i><div><strong>额度形成与恢复</strong><span>首次入库、真实送洗和退款后的额度口径。</span></div></button><button data-action="question" class="task-item"><i class="task-dot"></i><div><strong>结算周期</strong><span>月结或半月结，以及核对、开票、付款流程。</span></div></button><button data-action="question" class="task-item"><i class="task-dot"></i><div><strong>RFID 硬件协议</strong><span>设备、芯片编码、并发扫描和离线补传。</span></div></button></div>')+
    '</section>';
  }

  function hotelManagement(){
    var rows=[
      ['<strong>云栖酒店</strong><small class="cell-sub">H-202609001</small>','城东片区','桐乡洗涤一厂 · 东区站',badge('正常','success'),'2026-09-01','<button class="link-button" data-action="hotelDetail">查看详情</button>'],
      ['<strong>悦澜酒店</strong><small class="cell-sub">H-202608018</small>','市中心','桐乡洗涤一厂 · 中心站',badge('正常','success'),'2026-08-18','<button class="link-button" data-action="hotelDetail">查看详情</button>'],
      ['<strong>栖岸精品酒店</strong><small class="cell-sub">H-202607012</small>','城南片区','桐乡洗涤一厂 · 南区站',badge('待完善','warning'),'2026-07-12','<button class="link-button" data-action="editHotel">继续配置</button>']
    ];
    return header('酒店管理','维护酒店资料、楼层布草、合同价格与默认站点。',button('新增酒店','createHotel','primary-button'))+sampleNote()+filters([{type:'search',label:'酒店名称',placeholder:'输入酒店名称或编号'},{label:'所属区域',value:'全部区域'},{label:'合作状态',value:'全部状态'},{label:'默认站点',value:'全部站点'}])+panel('酒店列表','固定映射 · 一店一默认站点',table(['酒店','所属区域','默认洗涤站点','状态','创建时间','操作'],rows));
  }

  function siteManagement(role){
    var rows=[
      ['<strong>桐乡洗涤一厂</strong><small class="cell-sub">当前业务洗涤主体</small>','东区站','城东片区','12 家',badge('启用','success'),'<button class="link-button" data-action="siteDetail">详情</button>'],
      ['<strong>桐乡洗涤一厂</strong>','中心站','市中心','9 家',badge('启用','success'),'<button class="link-button" data-action="siteDetail">详情</button>'],
      ['<strong>桐乡洗涤一厂</strong>','南区站','城南片区','4 家',badge('启用','success'),'<button class="link-button" data-action="siteDetail">详情</button>'],
      ['<strong>桐乡洗涤一厂</strong>','西区站','城西片区','3 家',badge('启用','success'),'<button class="link-button" data-action="siteDetail">详情</button>']
    ];
    return header(role.surface==='factory'?'本厂站点设置':'洗涤厂与站点',role.surface==='factory'?'仅展示桐乡洗涤一厂及所属站点。':'当前业务为一个洗涤厂、四个服务点；酒店一期固定映射一个默认站点。',button('新增站点','createSite','primary-button'))+sampleNote()+filters([{type:'search',label:'洗涤厂或站点',placeholder:'搜索名称'},{label:'覆盖区域',value:'全部区域'},{label:'合作状态',value:'启用'}])+panel('站点关系','停用前须处理绑定酒店与未完成订单',table(['洗涤厂','站点','覆盖区域','绑定酒店','状态','操作'],rows));
  }

  function orderCenter(role){
    var factory=role.surface==='factory';
    var base=[
      ['<strong>YX202609070018</strong><small class="cell-sub">今日 09:42</small>','云栖酒店 · 8F','东区站','120 件',money(706),badge(state.progress>1?'已出库':state.progress>0?'备货中':'已派发',state.progress>1?'success':'warning'),'<button class="link-button" data-action="orderDetail">详情</button>'],
      ['<strong>YX202609070012</strong><small class="cell-sub">今日 08:16</small>','悦澜酒店 · 5F','中心站','86 件',money(528),badge('备货中','warning'),'<button class="link-button" data-action="orderDetail">详情</button>'],
      ['<strong>YX202609060086</strong><small class="cell-sub">昨日 16:20</small>','栖岸精品酒店 · 3F','南区站','64 件',money(398),badge('已送达','success'),'<button class="link-button" data-action="orderDetail">详情</button>']
    ];
    var rows=factory?base.map(function(row){return [row[0],row[1],row[2],row[3],row[5],row[6]];}):base;
    var actions=factory?(state.progress<2?button(state.progress===0?'开始备货':'确认出库','advance','primary-button'):button('送达确认主体待定','question','secondary-button',true)):button('导出订单','export','secondary-button');
    return header(factory?'履约订单':'订单中心',factory?'处理本厂订单状态；酒店销售金额在工厂端不可见。':'查看补充订单、资金扣款与跨主体履约进度。',actions)+sampleNote()+filters([{type:'search',label:'订单号',placeholder:'输入订单号或酒店'},{label:'订单状态',value:'全部状态'},{label:'洗涤站点',value:factory?'本厂全部站点':'全部站点'},{label:'下单日期',value:'近 7 天'}])+panel(factory?'本厂履约列表':'全部补充订单',factory?'金额字段已从工厂数据面移除':'酒店合同销售价口径',table(factory?['订单','酒店 / 楼层','洗涤站点','总件数','状态','操作']:['订单','酒店 / 楼层','洗涤站点','总件数','应付金额','状态','操作'],rows));
  }

  function priceMapping(role){
    var canSeeCost=role.label==='平台系统管理员';
    return header('价格与映射','酒店销售价与工厂成本价分区、分权维护；历史成交价不随新价格改变。',button('新建价格方案','createPrice','primary-button'))+sampleNote()+
      '<div class="segmented"><button class="active">酒店销售价</button>'+(canSeeCost?'<button>工厂成本价</button>':'')+'<button>酒店—站点映射</button></div>'+
      panel('云栖酒店 · 合同销售价','2026-09-01 生效',table(['布草品类','销售单价','计价单位','生效时间','状态','操作'],[
        ['被套',money(8),'件','2026-09-01',badge('生效中','success'),'<button class="link-button" data-action="editPrice">调整</button>'],['床单',money(5.5),'件','2026-09-01',badge('生效中','success'),'<button class="link-button" data-action="editPrice">调整</button>'],['浴巾',money(2.8),'件','2026-09-01',badge('生效中','success'),'<button class="link-button" data-action="editPrice">调整</button>']
      ]))+'<div class="boundary-banner"><strong>价格隔离红线</strong><span>'+(canSeeCost?'成本价仅在独立授权区查看；':'当前运营角色无成本价入口；')+'洗涤厂端、司机端和固定终端不得展示酒店销售价格。</span></div>';
  }

  function refundCenter(role){
    var factory=role.surface==='factory';
    var platformRows=[
      ['<strong>TW202609070006</strong><small class="cell-sub">关联 YX202609060086</small>','栖岸精品酒店','12 件','8 件',money(22.4),badge('部分通过','warning'),badge('已退款','success'),'<button class="link-button" data-action="refundDetail">查看</button>'],
      ['<strong>TW202609070003</strong><small class="cell-sub">关联 YX202609050061</small>','云栖酒店','5 件','—',money(40),badge('待检测','danger'),badge('未进入退款',''),'<button class="link-button" data-action="refundDetail">查看</button>'],
      ['<strong>TW202609060018</strong><small class="cell-sub">关联 YX202609050048</small>','悦澜酒店','6 件','6 件',money(33),badge('已通过','success'),badge('退款异常','danger'),'<button class="link-button" data-action="refundDetail">核对</button>']
    ];
    var factoryRows=[
      ['<strong>TW202609070006</strong><small class="cell-sub">关联 YX202609060086</small>','栖岸精品酒店','浴巾','12 件','8 件',badge('部分通过','warning'),'<button class="link-button" data-action="refundDetail">查看检测</button>'],
      ['<strong>TW202609070003</strong><small class="cell-sub">关联 YX202609050061</small>','云栖酒店','被套','5 件','—',badge('待检测','danger'),'<button class="link-button" data-action="refundDetail">开始检测</button>']
    ];
    return header(factory?'退污检测':'退污退款',factory?'按实际检测数量通过或驳回；价格与退款金额字段已从工厂数据面移除。':'分别追踪实物处理状态与退款入账状态。',factory?button('进入批量检测','refundDetail','primary-button'):button('导出核对表','export','secondary-button'))+sampleNote()+filters([{type:'search',label:'申请单号',placeholder:'申请单或关联订单'},{label:'处理状态',value:'全部状态'},{label:'退款状态',value:'全部退款状态'},{label:'申请日期',value:'近 30 天'}])+panel(factory?'待检测与已处理':'退污申请列表',factory?'退污不换货 · 按实检测':'检测状态与资金状态分开呈现',table(factory?['申请单','酒店','品类','申请数量','通过数量','检测状态','操作']:['申请单','酒店','申请件数','通过件数','退款金额','处理状态','退款状态','操作'],factory?factoryRows:platformRows));
  }

  function financeCenter(section,role){
    var isAccount=/账户/.test(section),isRecharge=/充值/.test(section),isSettlement=/结算/.test(section),factory=role.surface==='factory';
    if(isSettlement){return settlementPage(factory);}
    if(isRecharge){return header('充值管理','充值渠道待客户确认；原型同时展示在线支付与线下核款两套候选状态。',button('演示线下核款候选','recharge','secondary-button'))+sampleNote()+'<div class="pending-banner"><b>渠道待确认</b><span>微信支付资料由客户申请；是否启用在线支付、是否保留线下核款及两者优先级尚未确认。</span></div>'+filters([{type:'search',label:'酒店',placeholder:'酒店名称或申请单号'},{label:'渠道',value:'全部候选渠道'},{label:'状态',value:'全部状态'},{label:'申请时间',value:'近 7 天'}])+panel('充值记录','不同渠道使用独立状态',table(['申请单','酒店','渠道','申请金额','申请时间','状态','操作'],[
      ['CZ202609070009','云栖酒店',badge('线下核款候选','warning'),money(20000),'今日 09:32',badge('待确认','warning'),'<button class="link-button" data-action="recharge">核对入账</button>'],['CZ202609060022','悦澜酒店',badge('微信支付候选',''),money(12000),'昨日 16:08',badge('支付成功','success'),'<button class="link-button" data-action="ledger">查看流水</button>']
    ]));}
    if(isAccount){return header('酒店账户','账户金额仅对平台财务和所属酒店管理员开放。',button('导出账户','export','secondary-button'))+sampleNote()+filters([{type:'search',label:'酒店',placeholder:'搜索酒店'},{label:'账户状态',value:'全部状态'}])+panel('预存账户','收入、支出和退款均可追溯',table(['酒店','可用余额','累计充值','累计消费','累计退款','账户状态','操作'],[
      ['云栖酒店',money(12680),money(80000),money(67680),money(360),badge('正常','success'),'<button class="link-button" data-action="ledger">资金明细</button>'],['悦澜酒店',money(32800),money(120000),money(87200),money(0),badge('正常','success'),'<button class="link-button" data-action="ledger">资金明细</button>']
    ]));}
    var cards=metric(factory?'本期成本':'预存账户总额',factory?'¥46,320':'¥286,500','本月统计','success')+metric('待核对充值','6 笔','合计 ¥42,000','warning')+metric('已退金额','¥1,268','本月 18 笔','')+metric('异常流水','0 笔','实时校验','success');
    return header(section,'资金数字按角色口径展示；所有记录均可追溯业务单号。',button('下载报表','export','secondary-button'))+sampleNote()+'<section class="metric-grid">'+cards+'</section><section class="content-grid">'+panel('最近资金变动','按发生时间','<div class="ledger-list"><div><i class="income">+</i><span><strong>账户充值</strong><small>候选渠道 · CZ202609060018</small></span><b>+ ¥20,000.00</b></div><div><i>−</i><span><strong>补充订单扣款</strong><small>YX202609070018</small></span><b>− ¥706.00</b></div><div><i class="income">+</i><span><strong>退污退款</strong><small>TW202609060012</small></span><b>+ ¥22.40</b></div></div>')+panel('资金原则','产品红线','<div class="rule-list"><p><b>01</b>充值成功后才增加可用余额</p><p><b>02</b>重复提交不得重复扣款</p><p><b>03</b>冲正必须保留完整审计记录</p></div>')+'</section>';
  }

  function settlementPage(factory){
    return header('工厂结算','按有效履约数量与工厂成本汇总；周期与账单状态仍待客户确认。',button('生成试算单','settlement','primary-button'))+sampleNote()+'<div class="pending-banner"><b>目标待实现</b><span>当前仅有成本汇总，正式结算周期（月结/半月结）、核对、开票与付款流程需客户确认。</span></div>'+filters([{type:'search',label:'洗涤厂',placeholder:factory?'当前工厂':'搜索洗涤厂'},{label:'结算期间',value:'2026-09 上半月'},{label:'状态',value:'全部状态'}])+panel('结算试算','不得包含酒店销售价',table(['结算单','洗涤厂','期间','有效件数','成本金额','方案状态','操作'],[
      ['JS202609A01','桐乡洗涤一厂','09-01 至 09-15','8,268 件',money(46320),badge('待确认','warning'),'<button class="link-button" data-action="settlement">查看试算</button>'],['JS202608M01','桐乡洗涤一厂','08-01 至 08-31','14,906 件',money(82160),badge('已结算','success'),'<button class="link-button" data-action="settlement">账单明细</button>']
    ]));
  }

  function storeManagement(){
    return header('商城管理','维护简单商品、统一售价、库存与上下架；履约售后为目标待实现。',button('新增商品','createProduct','primary-button'))+sampleNote()+'<div class="segmented"><button class="active">商品</button><button>分类</button><button>商城订单</button></div>'+panel('商品列表','全平台统一售价',table(['商品','分类','统一售价','可售库存','销售状态','更新时间','操作'],[
      ['<span class="product-cell"><i>清</i><span><strong>客房高效清洁剂</strong><small>500ml · 温和低泡</small></span></span>','客房清洁',money(39),'86',badge('上架','success'),'今日 09:10','<button class="link-button" data-action="editProduct">编辑</button>'],['<span class="product-cell"><i>香</i><span><strong>酒店香氛补充装</strong><small>清新木质调</small></span></span>','香氛用品',money(68),'0',badge('售罄','warning'),'昨日 18:42','<button class="link-button" data-action="editProduct">补库存</button>']
    ]))+'<div class="pending-banner"><b>目标待实现</b><span>商城发货、收货、物流和售后流程尚未最终确认。</span></div>';
  }

  function driverScope(){
    return header('司机范围','维护司机负责区域与酒店静态清单，不形成配送任务。',button('调整负责范围','editDriver','primary-button'))+sampleNote()+filters([{type:'search',label:'司机',placeholder:'姓名或手机号'},{label:'配送组',value:'全部配送组'},{label:'状态',value:'在岗'}])+panel('司机与负责酒店','一期静态只读范围',table(['司机','配送组','负责区域','负责酒店','状态','操作'],[
      ['<strong>李师傅</strong><small class="cell-sub">138****6021</small>','桐乡配送组','城东片区','6 家',badge('在岗','success'),'<button class="link-button" data-action="editDriver">查看范围</button>'],['<strong>王师傅</strong><small class="cell-sub">137****1908</small>','嘉兴配送组','城南片区','5 家',badge('在岗','success'),'<button class="link-button" data-action="editDriver">查看范围</button>']
    ]))+'<div class="boundary-banner"><strong>一期边界</strong><span>司机端不包含搜索、日期、任务状态、接单、路线、导航、定位和签收。</span></div>';
  }

  function accessPage(section){
    var audit=/审计/.test(section);
    if(audit){return header('审计日志','追踪关键业务与权限操作，敏感内容按规则脱敏。',button('导出日志','export','secondary-button'))+sampleNote()+filters([{type:'search',label:'操作对象',placeholder:'模块、对象或操作人'},{label:'操作结果',value:'全部结果'},{label:'操作时间',value:'今日'}])+panel('操作记录','不可修改',table(['时间','操作人 / 组织','模块','动作','对象','结果'],[
      ['10:18:26','张琳 · 优洗通平台','酒店管理','调整默认站点','云栖酒店',badge('成功','success')],['09:46:10','周宁 · 平台财务','充值入账','确认到账','CZ202609070009',badge('成功','success')],['09:32:04','系统','订单中心','重复提交拦截','YX202609070018',badge('已拦截','warning')]
    ]));}
    return header('账号权限','账号绑定组织与角色，权限按组织范围收敛。',button('新增账号','createUser','primary-button'))+sampleNote()+filters([{type:'search',label:'账号',placeholder:'姓名或手机号'},{label:'所属组织',value:'全部组织'},{label:'角色',value:'全部角色'},{label:'状态',value:'启用'}])+panel('账号列表','停用后立即失去业务权限',table(['姓名','所属组织','角色','手机号','状态','最近使用','操作'],[
      ['陈经理','云栖酒店','酒店管理员','138****1638',badge('启用','success'),'今日 09:42','<button class="link-button" data-action="editUser">编辑</button>'],['赵师傅','桐乡洗涤一厂','工厂操作员','137****8091',badge('启用','success'),'今日 08:36','<button class="link-button" data-action="editUser">编辑</button>'],['李师傅','桐乡配送组','司机','138****6021',badge('启用','success'),'昨日 17:20','<button class="link-button" data-action="editUser">编辑</button>']
    ]));
  }

  function inventoryPage(){
    return header('布草库存','当前为扫描事件聚合视图，不代表已建立每个芯片的完整资产状态机。',button('查看异常芯片','chipError','secondary-button'))+sampleNote()+'<div class="pending-banner"><b>能力边界</b><span>芯片唯一性、设备协议、并发扫描与离线补传需在硬件方案确认后验收。</span></div>'+filters([{label:'洗涤站点',value:'本厂全部站点'},{label:'布草品类',value:'全部品类'},{label:'库存状态',value:'全部状态'}])+panel('库存聚合','按扫描事件计算',table(['站点','布草品类','可用数量','备货占用','累计入库','异常数量','状态'],[
      ['东区站','被套','1,286 件','120 件','8,642 件','3 件',badge('充足','success')],['东区站','床单','986 件','180 件','7,906 件','1 件',badge('充足','success')],['中心站','浴巾','186 件','96 件','5,672 件','12 件',badge('偏低','warning')]
    ]));
  }

  function inboundPage(){
    return header('送洗入库与额度','追溯酒店日常送洗入库、异常事件和分品类额度变动；首次铺货单独核算。',button('登记异常处理','inboundError','primary-button'))+sampleNote()+'<div class="boundary-banner"><strong>额度来源</strong><span>日常脏布草经洗涤厂有效接收入库后形成对应酒店、对应品类的可补充额度；首次铺货是否形成额度待确认。</span></div>'+filters([{type:'search',label:'入库批次',placeholder:'批次号或酒店'},{label:'洗涤站点',value:'本厂全部站点'},{label:'事件类型',value:'日常送洗'},{label:'处理状态',value:'全部状态'}])+panel('送洗入库记录','本厂组织范围',table(['入库批次','酒店','站点','品类 / 有效数量','异常','额度变动','状态','操作'],[
      ['<strong>RK202609070028</strong><small class="cell-sub">今日 08:58</small>','云栖酒店','东区站','被套 42 · 床单 61','重复 2 件','+103 件',badge('已入账','success'),'<button class="link-button" data-action="inboundDetail">额度明细</button>'],
      ['<strong>RK202609070021</strong><small class="cell-sub">今日 08:16</small>','悦澜酒店','中心站','浴巾 36','无法识别 1 件','+36 件',badge('异常待处理','warning'),'<button class="link-button" data-action="inboundError">处理异常</button>'],
      ['<strong>RK202609060086</strong><small class="cell-sub">昨日 17:42</small>','栖岸酒店','南区站','首次铺货 200 件','—','待口径确认',badge('不自动入账',''),'<button class="link-button" data-action="question">规则说明</button>']
    ]))+'<div class="content-grid">'+panel('额度变动明细','按酒店与品类','<div class="ledger-list"><div><i class="income">+</i><span><strong>被套有效送洗入库</strong><small>云栖酒店 · RK202609070028</small></span><b>+42 件</b></div><div><i class="income">+</i><span><strong>床单有效送洗入库</strong><small>云栖酒店 · RK202609070028</small></span><b>+61 件</b></div><div><i>−</i><span><strong>补充订单占用</strong><small>YX202609070018</small></span><b>−120 件</b></div></div>')+panel('异常处理原则','不计入有效额度','<div class="rule-list"><p><b>01</b>重复芯片不重复累计</p><p><b>02</b>错酒店、错品类需人工核对</p><p><b>03</b>处理完成后保留原始事件</p></div>')+'</div>';
  }

  function logisticsPage(){
    return header('物流协作','一期只记录出库与线下配送交接，不向司机生成在线任务。',button('送达确认主体待定','question','secondary-button',true))+sampleNote()+'<div class="pending-banner"><b>目标待实现</b><span>收货确认主体、差异处理和签收凭证待客户确认；司机端仍保持静态酒店清单。</span></div>'+filters([{type:'search',label:'出库单',placeholder:'订单或酒店'},{label:'交接状态',value:'全部状态'},{label:'出库时间',value:'今日'}])+panel('出库与配送交接','不包含路线与定位',table(['出库单','关联订单','酒店','站点','出库件数','线下交接','送达状态'],[
      ['CK202609070012','YX202609070012','悦澜酒店','中心站','86 件',badge('已交接','success'),badge('待确认','warning')],['CK202609070008','YX202609060086','栖岸酒店','南区站','64 件',badge('已交接','success'),badge('已送达','success')]
    ]));
  }

  function warehousePage(){
    return header('仓库与货架','按本厂站点、仓区、货架和布草品类管理可用位置。',button('维护货架','warehouseEdit','primary-button'))+sampleNote()+filters([{label:'洗涤站点',value:'东区站'},{label:'仓区',value:'全部仓区'},{label:'货架状态',value:'全部状态'}])+panel('货架占用','本厂组织范围',table(['仓区 / 货架','布草品类','容量','当前数量','备货占用','可用余量','状态','操作'],[
      ['A 区 · A-01','被套','600 件','428 件','120 件','52 件',badge('正常','success'),'<button class="link-button" data-action="warehouseEdit">详情</button>'],['A 区 · A-02','床单','700 件','516 件','180 件','4 件',badge('接近满载','warning'),'<button class="link-button" data-action="warehouseEdit">详情</button>'],['B 区 · B-03','浴巾','400 件','186 件','96 件','118 件',badge('正常','success'),'<button class="link-button" data-action="warehouseEdit">详情</button>']
    ]));
  }

  function reportsPage(section,role){
    if(/结算/.test(section))return settlementPage(true);
    var cost=/成本/.test(section)||role.label==='洗涤厂财务';
    return header(section,'按期间、站点、酒店与品类查看本厂经营口径。',button('导出报表','export','secondary-button'))+sampleNote()+filters([{label:'统计期间',value:'2026 年 9 月'},{label:'洗涤站点',value:'全部站点'},{label:'酒店',value:'全部酒店'},{label:'布草品类',value:'全部品类'}])+'<section class="metric-grid">'+metric('有效履约','8,268 件','本统计期间','success')+metric('工厂成本',money(46320),'不含酒店销售价','')+metric('退污通过','126 件','通过率 78.6%','warning')+metric('异常扫描','16 件','待核对 4 件','danger')+'</section>'+panel(cost?'成本构成':'站点履约趋势','酒店售价始终不可见','<div class="simple-chart"><div style="height:44%"><span>东区站</span></div><div style="height:72%"><span>中心站</span></div><div style="height:58%"><span>南区站</span></div><div style="height:86%"><span>西区站</span></div></div>','chart-panel');
  }

  function renderWebContent(role){
    var s=state.section;
    if(state.view!=='normal')return specialState(s);
    if(/总览|工作台/.test(s))return dashboardFor(role);
    if(s==='酒店管理')return hotelManagement();
    if(s==='洗涤厂与站点'||s==='站点设置')return siteManagement(role);
    if(/订单/.test(s))return orderCenter(role);
    if(s==='价格与映射')return priceMapping(role);
    if(/退污|退款核对/.test(s))return refundCenter(role);
    if(/财务|账户|充值|结算|资金/.test(s)&&!(/成本|期间/.test(s)))return financeCenter(s,role);
    if(s==='商城管理')return storeManagement();
    if(s==='司机范围')return driverScope();
    if(/账号|审计/.test(s))return accessPage(s);
    if(s==='送洗入库')return inboundPage();
    if(s==='布草库存')return inventoryPage();
    if(s==='物流协作')return logisticsPage();
    if(s==='仓库货架')return warehousePage();
    if(/报表|成本|结算账单/.test(s))return reportsPage(s,role);
    return specialState(s);
  }

  function renderWeb(role){
    return '<div class="web-app"><aside class="web-sidebar"><div class="web-brand"><span class="brand-block">优</span><span><strong>优洗通</strong><small>'+(role.surface==='factory'?'洗涤业务协同平台':'平台运营中心')+'</small></span></div><nav class="web-nav"><div class="nav-group-label">工作空间</div>'+role.nav.map(function(item){return '<button class="nav-item '+(item===state.section?'active':'')+'" data-section="'+esc(item)+'"><span class="nav-symbol">'+navSymbol(item)+'</span><span>'+esc(item)+'</span></button>';}).join('')+'</nav><div class="web-user"><span class="avatar">'+esc(role.label.slice(0,1))+'</span><div><strong>'+esc(role.label)+'</strong><small>'+esc(role.org)+'</small></div></div></aside><section class="web-main"><header class="web-topbar"><div><h1>'+esc(state.section)+'</h1><p>'+esc(role.subtitle)+'</p></div><div class="topbar-actions"><button class="icon-button" data-action="notice">消息 <i class="notice-dot"></i></button><button class="secondary-button" data-action="roleInfo">权限说明</button></div></header><div class="web-content">'+renderWebContent(role)+'</div></section></div>';
  }

  function mobileHead(role,back){return '<header class="mobile-head '+(back?'simple':'')+'">'+(back?'<button data-action="back" aria-label="返回">‹</button>':'')+'<div><small>优洗通 · '+esc(role.label)+'</small><h1>'+esc(back||role.org)+'</h1></div>'+(back?'<span></span>':'<button class="mobile-record" data-action="mobileRecords">记录</button>')+'</header>';}
  function laundryRow(name,price,quota){var q=state.qty[name]||0;return '<div class="laundry-row"><span class="laundry-icon">'+name.slice(0,1)+'</span><span class="laundry-info"><strong>'+name+'</strong><small>'+money(price)+'/件 · 可补 '+quota+' 件</small></span><span class="stepper"><button data-action="minus" data-item="'+name+'" aria-label="减少'+name+'">−</button><b>'+q+'</b><button data-action="plus" data-item="'+name+'" data-max="'+quota+'" aria-label="增加'+name+'">＋</button></span></div>';}
  function mobileReplenish(role){
    var exact=role.label==='酒店管理员',total=state.qty['被套']*8+state.qty['床单']*5.5+state.qty['浴巾']*2.8,count=state.qty['被套']+state.qty['床单']+state.qty['浴巾'];
    if(state.view!=='normal')return mobileState();
    return '<div class="mobile-gradient"><div class="mobile-brandline"><span><b>优洗通</b><i></i>'+esc(role.org)+'</span><button data-action="mobileRecords">补充记录</button></div><div class="quota-label">已选总件数</div><div class="quota-number"><strong>'+count+'</strong><span>件</span></div><p>不设共享总额度，各品类分别按有效送洗量校验</p><div class="wallet-strip"><span class="wallet-symbol">¥</span><span>'+(exact?'余额 <b>'+money(12680)+'</b>':'预存账户')+'</span>'+badge('余额充足','lime')+'</div></div><section class="mobile-content">'+(exact?'':'<div class="mini-boundary warning"><b>原型默认</b><span>操作员可下单并查看合同单价，最终权限待客户确认。</span></div>')+'<div class="floor-row"><span><small>当前楼层</small><strong>8F 布草清单</strong></span><button data-action="floor">切换楼层 ›</button></div><div class="laundry-list">'+laundryRow('被套',8,80)+laundryRow('床单',5.5,90)+laundryRow('浴巾',2.8,30)+'</div><button class="add-laundry" data-action="otherLaundry">＋ 添加其他布草</button><div class="rule-hint"><b>额度规则</b><span>每个品类独立校验，不可跨品类抵扣；额度不按自然日重置。</span></div></section><footer class="mobile-checkout"><span><small>预计扣款</small><strong>'+money(total)+'</strong><i>'+count+' 件</i></span><button data-action="submitOrder"'+(count===0?' disabled':'')+'>确认下单</button></footer>';
  }

  function mobileOrders(role){
    if(state.view!=='normal')return mobileState();
    return mobileHead(role,'补充订单')+'<section class="mobile-page">'+(role.label==='酒店操作员'?'<div class="mini-boundary warning"><b>原型默认</b><span>操作员可看订单金额并申请退污，最终权限待确认。</span></div>':'')+'<div class="mobile-tabs"><button class="active">全部</button><button>履约中</button><button>已送达</button></div><div class="order-card"><header><span><strong>YX202609070018</strong><small>今日 09:42 · 8F</small></span>'+badge('备货中','warning')+'</header><div class="order-goods"><span>被套 40</span><span>床单 60</span><span>浴巾 20</span></div><footer><span><small>共 120 件</small><b>'+money(706)+'</b></span><button data-action="mobileOrderDetail">查看详情</button></footer></div><div class="order-card"><header><span><strong>YX202609060086</strong><small>昨日 16:20 · 3F</small></span>'+badge('已送达','success')+'</header><div class="order-goods"><span>被套 20</span><span>床单 32</span><span>浴巾 12</span></div><footer><span><small>共 64 件</small><b>'+money(369.6)+'</b></span><button data-action="applyRefund">申请退污</button></footer></div><div class="mini-boundary"><b>退污不换货</b><span>从已送达订单明细发起，检测通过后按原成交价退款。</span></div></section>';
  }

  function mobileAccount(role){
    if(state.view!=='normal')return mobileState();
    return mobileHead(role,'酒店账户')+'<section class="mobile-page"><div class="balance-card"><small>可用余额</small><strong>'+money(12680)+'</strong><div><span>累计充值<br><b>¥80,000</b></span><span>累计消费<br><b>¥67,680</b></span><span>累计退款<br><b>¥360</b></span></div><button data-action="rechargeRequest">查看充值方式</button></div><div class="section-title"><strong>最近资金流水</strong><button data-action="ledger">全部记录</button></div><div class="mobile-ledger"><div><i>−</i><span><strong>补充订单扣款</strong><small>今日 09:42 · YX202609070018</small></span><b>−¥706.00</b></div><div><i class="plus">+</i><span><strong>退污退款</strong><small>昨日 18:12 · TW202609060012</small></span><b>+¥22.40</b></div><div><i class="plus">+</i><span><strong>账户充值</strong><small>09-01 10:06 · 候选渠道示例</small></span><b>+¥20,000.00</b></div></div><div class="mini-boundary warning"><b>渠道待确认</b><span>微信支付与线下核款均为候选方案，最终以客户确认结果为准。</span></div></section>';
  }

  function mobileStore(role){
    if(state.view!=='normal')return mobileState();
    return mobileHead(role,'酒店用品商城')+'<section class="mobile-page store-page"><div class="store-search">⌕ 搜索酒店用品</div><div class="category-pills"><button class="active">精选</button><button>客房清洁</button><button>香氛用品</button></div><div class="product-grid"><article><span class="product-art">清</span><strong>客房高效清洁剂</strong><small>温和低泡 · 500ml</small><div><b>'+money(39)+'</b><button data-action="addCart">＋</button></div></article><article><span class="product-art green">香</span><strong>酒店香氛补充装</strong><small>清新木质调</small><div><b>'+money(68)+'</b><button data-action="soldOut" disabled>售罄</button></div></article></div><button class="cart-float" data-action="cart">购物车 <b>1</b></button><div class="mini-boundary"><b>待确认</b><span>一期已确认统一售价与库存字段；支付渠道、发货、收货和售后流程待确认。</span></div></section>';
  }

  function mobileEmployees(role){
    if(state.view!=='normal')return mobileState();
    return mobileHead(role,'酒店员工')+'<section class="mobile-page"><div class="section-title"><strong>员工账号 3</strong><button class="accent-link" data-action="createEmployee">＋ 新增员工</button></div><div class="employee-list"><button data-action="editEmployee"><i>陈</i><span><strong>陈经理</strong><small>酒店管理员 · 138****1638</small></span>'+badge('启用','success')+'<em>›</em></button><button data-action="editEmployee"><i>周</i><span><strong>周晓</strong><small>酒店操作员 · 137****9026</small></span>'+badge('启用','success')+'<em>›</em></button><button data-action="editEmployee"><i>王</i><span><strong>王琳</strong><small>酒店操作员 · 139****2810</small></span>'+badge('停用','')+'<em>›</em></button></div><div class="mini-boundary"><b>权限提示</b><span>酒店操作员不查看精确余额、账户流水、商城和员工管理。</span></div></section>';
  }

  function mobileProfile(role){
    return mobileHead(role,'我的')+'<section class="mobile-page"><div class="profile-card"><i>'+esc(role.label.slice(0,1))+'</i><span><strong>'+esc(role.label)+'</strong><small>'+esc(role.org)+'</small></span>'+badge('账号正常','success')+'</div><div class="menu-list"><button data-action="roleInfo"><span>角色与权限</span><em>›</em></button><button data-action="help"><span>使用帮助</span><em>›</em></button><button data-action="about"><span>关于优洗通</span><em>›</em></button></div><div class="version-line">优洗通业务原型 V1.0 · 非生产系统</div></section>';
  }

  function driverHome(role){
    if(state.view!=='normal')return mobileState();
    return '<div class="driver-hero"><div class="mobile-brandline"><span><b>优洗通</b><i></i>司机移动端</span></div><small>载体待确认 · 桐乡配送组</small><h1>我的负责范围</h1><div><span><b>2</b> 个区域</span><span><b>6</b> 家酒店</span></div></div><section class="mobile-page driver-list"><div class="section-title"><strong>城东片区</strong><span>4 家酒店</span></div><button data-action="driverHotel"><i>云</i><span><strong>云栖酒店</strong><small>负责酒店清单</small></span><b>›</b></button><button data-action="driverHotel"><i>悦</i><span><strong>悦澜酒店</strong><small>负责酒店清单</small></span><b>›</b></button><div class="mini-boundary"><b>一期最小字段</b><span>仅确认负责区域与酒店名称；地址、联系人、站点等附加字段待客户确认。</span></div><div class="mini-boundary"><b>无在线任务</b><span>不提供搜索、日期、路线、导航、定位、状态或签收。</span></div></section>';
  }

  function mobileState(){
    var map={empty:['○','暂无业务记录','新的记录会显示在这里'],error:['!','加载失败','网络异常，请稍后重试'],forbidden:['×','无权查看','当前角色不具备此功能权限']},item=map[state.view];
    return '<div class="mobile-state"><i>'+item[0]+'</i><strong>'+item[1]+'</strong><span>'+item[2]+'</span><button data-action="restore">'+(state.view==='error'?'重新加载':'返回首页')+'</button></div>';
  }

  function renderMobile(role){
    var content=state.section==='补充'?mobileReplenish(role):state.section==='订单'?mobileOrders(role):state.section==='账户'?mobileAccount(role):state.section==='商城'?mobileStore(role):state.section==='员工'?mobileEmployees(role):state.section==='负责酒店'?driverHome(role):mobileProfile(role);
    return '<div class="device-stage"><div class="phone-frame"><div class="phone-screen"><div class="mobile-scroll">'+content+'</div><nav class="mobile-nav">'+role.nav.map(function(item){return '<button class="'+(item===state.section?'active':'')+'" data-section="'+esc(item)+'"><i>'+navSymbol(item)+'</i><span>'+esc(item)+'</span></button>';}).join('')+'</nav></div></div><div class="device-caption"><b>'+esc(role.label)+'</b><span>'+(role.label==='司机'?'司机移动端 · 载体待确认':'微信小程序画布 · 交互示例')+'</span></div></div>';
  }

  function terminalWorkspace(){
    var inbound=state.section==='首次芯片入库';
    if(state.view!=='normal')return specialState(state.section);
    return header(state.section,inbound?'选择站点与品类后批量扫描；首次入库是否形成额度待客户确认。':'选择待备货订单后按品类扫描；错品类与重复芯片进入异常列表。',button('演示提交','terminalSubmit','secondary-button')+button('提交真实批次','realTerminalSubmit','primary-button',true))+'<div class="terminal-alert"><span class="device-offline"></span><b>设备未连接 · 原型演示模式</b><em>真实提交已禁用，演示提交不会写入数据</em></div><div class="terminal-form"><label><span>洗涤站点</span><select><option>桐乡洗涤一厂 · 东区站</option></select></label><label><span>'+(inbound?'布草品类':'待备货订单')+'</span><select><option>'+(inbound?'被套 · 标准规格':'YX202609070018 · 云栖酒店')+'</option></select></label></div><div class="scan-layout"><section class="scan-focus"><small>本次有效扫描</small><strong>'+state.scan+'</strong><span>'+(inbound?'件被套':'/ 40 件被套')+'</span><div class="scan-wave"><i></i><i></i><i></i><i></i><i></i></div><p>将布草芯片置于设备识别区域</p><button data-action="scanAdd">模拟识别 1 件</button></section><section class="scan-stats"><div><span>有效</span><b>'+state.scan+'</b></div><div><span>重复</span><b class="warning-text">2</b></div><div><span>异常</span><b class="danger-text">1</b></div><button data-action="chipError">查看 3 条异常记录 ›</button></section></div><div class="terminal-rule"><b>'+(inbound?'首次入库规则':'租赁备货规则')+'</b><span>'+(inbound?'同一芯片只计一次；异常记录需处理后再提交。':'有效数量封顶 40 件；超过订单数量的扫描进入异常，不能扩大有效数量。')+'</span></div>';
  }

  function renderTerminal(role){
    return '<div class="device-stage"><div class="terminal-frame"><div class="terminal-screen"><header class="terminal-head"><span><i>优</i><b>优洗通厂内终端</b></span><em>'+esc(role.org)+' · 操作员 赵师傅</em></header><div class="terminal-body"><nav class="workstation-nav"><small>选择工作工位</small>'+role.nav.map(function(item){return '<button class="'+(item===state.section?'active':'')+'" data-section="'+esc(item)+'"><i>'+navSymbol(item)+'</i><span><strong>'+esc(item)+'</strong><em>'+(item==='首次芯片入库'?'新芯片首次登记':'按订单扫描备货')+'</em></span></button>';}).join('')+'<div class="terminal-user"><i>赵</i><span><b>赵师傅</b><small>终端操作员</small></span></div></nav><section class="terminal-workspace">'+terminalWorkspace()+'</section></div></div></div><div class="device-caption"><b>洗涤厂固定终端</b><span>横屏工位 · 不模拟真实 RFID 硬件</span></div></div>';
  }

  function modalShell(title,kicker,content,footer,wide){
    modal.innerHTML='<section class="modal-card '+(wide?'wide':'')+'" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><header><span><small>'+esc(kicker||'BUSINESS ACTION')+'</small><h2 id="modalTitle">'+esc(title)+'</h2></span><button class="modal-close" data-action="closeModal" aria-label="关闭">×</button></header><div class="modal-content">'+content+'</div><footer>'+(footer||button('关闭','closeModal','secondary-button'))+'</footer></section>';
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');var close=modal.querySelector('.modal-close');if(close)close.focus();
  }
  function closeModal(){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');modal.innerHTML='';}
  function formRow(label,value,help){return '<label class="form-row"><span>'+esc(label)+'</span><input value="'+esc(value||'')+'">'+(help?'<small>'+esc(help)+'</small>':'')+'</label>';}
  function showHotelDetail(){modalShell('云栖酒店','酒店详情','<div class="detail-hero"><span class="detail-logo">云</span><div><h3>云栖酒店</h3><p>H-202609001 · 城东片区 · 正常合作</p></div>'+badge('资料完整','success')+'</div><div class="detail-grid"><div><small>默认洗涤站点</small><b>桐乡洗涤一厂 · 东区站</b></div><div><small>酒店管理员</small><b>陈经理 · 138****1638</b></div><div><small>已配置楼层</small><b>8 个楼层</b></div><div><small>合同价格</small><b>12 个布草品类</b></div></div><div class="detail-tabs"><button class="active">基本资料</button><button>楼层布草</button><button>价格方案</button><button>业务记录</button></div><div class="boundary-banner"><strong>停用检查</strong><span>该酒店存在 2 笔履约中订单，当前不可停用。</span></div>',button('编辑资料','editHotel','secondary-button')+button('查看价格方案','closeModal','primary-button'),true);}
  function showSiteDetail(){modalShell('东区站','洗涤站点详情','<div class="detail-hero"><span class="detail-logo">东</span><div><h3>桐乡洗涤一厂 · 东区站</h3><p>S-202609001 · 城东片区 · 正常服务</p></div>'+badge('启用','success')+'</div><div class="detail-grid"><div><small>所属洗涤厂</small><b>桐乡洗涤一厂</b></div><div><small>绑定酒店</small><b>12 家</b></div><div><small>履约中订单</small><b>16 单</b></div><div><small>站点负责人</small><b>赵师傅</b></div></div><div class="boundary-banner"><strong>组织隔离</strong><span>工厂角色只查看本厂所属站点；平台角色可维护跨主体基础关系。</span></div>',button('关闭','closeModal','secondary-button')+button('编辑站点','createSite','primary-button'),true);}

  function showConfigForm(action){
    var originalAction=action,aliases={editHotel:'createHotel',editPrice:'createPrice',editProduct:'createProduct',editUser:'createUser',editEmployee:'createEmployee'};action=aliases[action]||action;
    var config={
      createHotel:{title:'新增酒店',kicker:'四步建档 · 1/4 基本资料',content:'<div class="form-grid">'+formRow('酒店名称','云栖酒店')+formRow('所属区域','城东片区')+formRow('酒店管理员','陈经理')+formRow('联系手机号','13800001638')+'</div><h3 class="modal-subtitle">楼层与布草基线</h3><div class="form-grid">'+formRow('楼层范围','1F–8F')+formRow('客房数量','120','房间数 × 4 与床位数 × 3 的基准规则待确认')+'</div><h3 class="modal-subtitle">履约关系</h3><div class="form-grid">'+formRow('默认洗涤站点','桐乡洗涤一厂 · 东区站')+formRow('合作生效日','2026-09-15')+'</div><div class="pending-banner"><b>下一步</b><span>继续维护布草品类、各品类上限与合同销售价；未完成前保持“待完善”。</span></div>'},
      createPrice:{title:'新建酒店价格方案',kicker:'销售价独立授权',content:'<div class="form-grid">'+formRow('适用酒店','云栖酒店')+formRow('布草品类','被套')+formRow('销售单价','8.00 元/件')+formRow('生效日期','2026-09-15')+'</div><div class="boundary-banner"><strong>历史快照</strong><span>新价格只影响生效后的订单，历史订单保留原成交价。</span></div>'},
      createProduct:{title:'新增商城商品',kicker:'统一售价',content:'<div class="form-grid">'+formRow('商品名称','客房高效清洁剂')+formRow('商品分类','客房清洁')+formRow('统一售价','39.00 元')+formRow('可售库存','86')+'</div>'+formRow('商品描述','温和低泡 · 500ml')+'<div class="pending-banner"><b>待确认</b><span>商城支付渠道与发货、收货、售后流程尚未确定。</span></div>'},
      editDriver:{title:'调整司机负责范围',kicker:'静态范围',content:'<div class="form-grid">'+formRow('司机','李师傅')+formRow('配送组','桐乡配送组')+formRow('负责区域','城东片区、城南片区')+formRow('负责酒店','云栖酒店、悦澜酒店等 6 家')+'</div><div class="boundary-banner"><strong>一期边界</strong><span>只维护区域与酒店名称，不形成在线任务或路线。</span></div>'},
      createUser:{title:'新增平台账号',kicker:'组织与角色',content:'<div class="form-grid">'+formRow('姓名','张琳')+formRow('手机号','13800002816')+formRow('所属组织','优洗通平台')+formRow('角色','平台运营人员')+'</div><div class="boundary-banner"><strong>服务端校验</strong><span>权限必须同时受角色与组织范围限制。</span></div>'},
      createEmployee:{title:'新增酒店员工',kicker:'原型默认权限',content:'<div class="form-grid">'+formRow('姓名','周晓')+formRow('手机号','13700009026')+formRow('所属酒店','云栖酒店')+formRow('角色','酒店操作员')+'</div><div class="pending-banner"><b>待客户确认</b><span>操作员是否允许下单、退污和查看销售单价尚未最终确认；当前按原型默认方案展示。</span></div>'}
      ,createSite:{title:'新增洗涤站点',kicker:'本厂组织范围',content:'<div class="form-grid">'+formRow('所属洗涤厂','桐乡洗涤一厂')+formRow('站点名称','东区站')+formRow('覆盖区域','城东片区')+formRow('站点负责人','赵师傅')+'</div><div class="boundary-banner"><strong>固定映射</strong><span>酒店与站点的映射单独维护；停用前检查绑定酒店和未完成订单。</span></div>'},
      warehouseEdit:{title:'维护仓库货架',kicker:'库存位置',content:'<div class="form-grid">'+formRow('洗涤站点','东区站')+formRow('仓区 / 货架','A 区 · A-01')+formRow('布草品类','被套')+formRow('容量','600 件')+'</div><div class="boundary-banner"><strong>组织隔离</strong><span>只能维护本厂所属站点的仓库和货架。</span></div>'}
    },item=config[action];if(!item)return false;var title=originalAction.indexOf('edit')===0?item.title.replace('新增','编辑').replace('新建','编辑'):item.title;modalShell(title,item.kicker,item.content,button('取消','closeModal','secondary-button')+button(action==='createHotel'?'保存并继续':'保存配置','confirmGeneric','primary-button'),true);return true;
  }
  function showOrderDetail(){
    var role=roles[state.role],factory=role.surface==='factory';
    var summary=factory?'<div class="order-summary"><div><small>酒店 / 楼层</small><b>云栖酒店 · 8F</b></div><div><small>洗涤站点</small><b>东区站</b></div><div><small>总件数</small><b>120 件</b></div><div><small>当前待办</small><b>按品类完成备货</b></div></div>':'<div class="order-summary"><div><small>酒店 / 楼层</small><b>云栖酒店 · 8F</b></div><div><small>洗涤站点</small><b>东区站</b></div><div><small>总件数</small><b>120 件</b></div><div><small>扣款金额</small><b>'+money(706)+'</b></div></div>';
    var detailTable=factory?table(['品类','数量','备货进度'],[['被套','40 件','28 / 40 件'],['床单','60 件','60 / 60 件'],['浴巾','20 件','20 / 20 件']]):table(['品类','数量','销售单价','小计'],[['被套','40 件',money(8),money(320)],['床单','60 件',money(5.5),money(330)],['浴巾','20 件',money(2.8),money(56)] ]);
    modalShell('补充订单详情','YX202609070018',summary+detailTable+'<h3 class="modal-subtitle">履约时间线</h3>'+timeline([{title:'订单已派发',time:'今日 09:42',done:true},{title:'工厂备货中',time:'今日 10:08',done:state.progress>0},{title:'确认出库',time:state.progress>1?'今日 10:26':'待处理',done:state.progress>1},{title:'送达确认主体待定',time:'待客户确认',done:false}]),button('关闭','closeModal','secondary-button')+(factory?(state.progress<2?button(state.progress===0?'开始备货':'确认出库','advance','primary-button'):button('送达确认主体待定','question','secondary-button',true)):button('查看资金流水','ledger','primary-button')),true);
  }
  function showRefund(){
    var role=roles[state.role],factory=role.surface==='factory',hotel=role.surface==='mobile'&&state.role!=='driver',finance=state.role==='platform_finance';
    if(!factory&&!hotel){modalShell('退污与退款详情','TW202609070003','<div class="pending-banner"><b>双状态追踪</b><span>实物处理与资金入账分别记录，检测通过不等于退款已到账。</span></div><div class="detail-grid"><div><small>申请酒店</small><b>云栖酒店</b></div><div><small>实物状态</small><b>待检测</b></div><div><small>退款状态</small><b>未进入退款</b></div><div><small>预计退款</small><b>'+money(40)+'</b></div></div>'+timeline([{title:'酒店提交申请',time:'今日 09:18',done:true},{title:'线下取回',time:'待完成',done:false},{title:'工厂检测',time:'待处理',done:false},{title:'退款入账',time:'检测通过后',done:false}])+'<div class="boundary-banner"><strong>当前权限</strong><span>'+(finance?'平台财务仅核对退款入账与异常，不修改工厂检测结果。':'平台运营只读查看处理进度，不代酒店提交申请、不代工厂检测。')+'</span></div>',button('关闭','closeModal','secondary-button')+(finance?button('核对退款异常','confirmGeneric','primary-button'):''),true);return;}
    modalShell(factory?'退污检测':'发起退污申请','TW202609070003','<div class="pending-banner"><b>退污不换货</b><span>'+(factory?'按实际检测结果录入通过数量；工厂端没有销售价与退款金额字段。':'从已送达订单明细申请，检测通过后按原成交价退款。')+'</span></div><div class="refund-line"><span><strong>被套</strong><small>申请数量 5 件</small></span><label><small>'+(factory?'通过数量':'申请数量')+'</small><span class="mini-stepper"><button>−</button><b>3</b><button>＋</button></span></label><label><small>'+(factory?'驳回数量':'可申请上限')+'</small><b>'+(factory?'2 件':'5 件')+'</b></label></div>'+formRow(factory?'驳回原因':'退污原因',factory?'污渍不符合退污标准':'明显污渍')+formRow('补充说明','现场照片已留存','驳回数量大于 0 时原因必填'),button('取消','closeModal','secondary-button')+button(factory?'提交检测结果':'提交退污申请','confirmRefund','primary-button'));
  }
  function showRecharge(isHotel){
    if(isHotel){modalShell('选择充值方式','RECHARGE CANDIDATES','<div class="pending-banner"><b>渠道待确认</b><span>以下两种方式均为候选设计，不代表已确定上线。</span></div><div class="candidate-grid"><button data-action="candidatePay"><b>微信支付候选</b><span>资料由客户申请，支付成功后自动增加余额</span></button><button data-action="candidateOffline"><b>线下核款候选</b><span>酒店提交申请，平台财务确认到账后增加余额</span></button></div>'+formRow('充值金额','20000.00','最终限额、支付渠道与到账时效待确认'),button('关闭','closeModal','secondary-button'));return;}
    modalShell('核对线下充值候选','RECHARGE CANDIDATE',formRow('酒店','云栖酒店')+formRow('确认到账金额','20000.00','仅在线下核款方案被客户确认后启用')+formRow('到账凭证号','BANK-20260907-1826')+'<div class="pending-banner"><b>候选流程</b><span>确认后账户增加余额；微信支付是否作为主渠道、是否保留本流程均待客户确认。</span></div>',button('取消','closeModal','secondary-button')+button('演示确认入账','confirmRecharge','primary-button'));
  }
  function showGeneric(title,desc){modalShell(title,'INTERACTIVE DEMO','<div class="dialog-illustration">'+navSymbol(title)+'</div><p class="dialog-copy">'+esc(desc)+'</p><div class="pending-banner"><b>原型说明</b><span>该操作用于确认业务流程与页面反馈，不会写入真实业务数据。</span></div>',button('取消','closeModal','secondary-button')+button('确认演示','confirmGeneric','primary-button'));}
  function showSubmitOrder(){var total=state.qty['被套']*8+state.qty['床单']*5.5+state.qty['浴巾']*2.8,count=state.qty['被套']+state.qty['床单']+state.qty['浴巾'];modalShell('确认补充订单','云栖酒店 · 8F','<div class="confirm-amount"><small>本次预计扣款</small><strong>'+money(total)+'</strong><span>共 '+count+' 件 · 固定分配至东区站</span></div><div class="confirm-list"><p><span>被套 × '+state.qty['被套']+'</span><b>'+money(state.qty['被套']*8)+'</b></p><p><span>床单 × '+state.qty['床单']+'</span><b>'+money(state.qty['床单']*5.5)+'</b></p><p><span>浴巾 × '+state.qty['浴巾']+'</span><b>'+money(state.qty['浴巾']*2.8)+'</b></p></div><div class="check-row"><i>✓</i><span><b>余额充足</b><small>提交时将再次校验额度、余额、价格和站点映射</small></span></div>',button('返回修改','closeModal','secondary-button')+button('确认并扣款','confirmOrder','lime-button'));
  }

  function openForAction(action){
    if(action==='hotelDetail')return showHotelDetail();
    if(action==='siteDetail')return showSiteDetail();
    if(action==='orderDetail'||action==='mobileOrderDetail')return showOrderDetail();
    if(action==='refundDetail'||action==='applyRefund')return showRefund();
    if(action==='recharge'||action==='confirmRecharge')return showRecharge(false);
    if(action==='rechargeRequest')return showRecharge(true);
    if(action==='submitOrder')return showSubmitOrder();
    if(showConfigForm(action))return;
    var info={createHotel:['新增酒店','按基本资料、楼层布草、合同价格、默认站点四步完成建档。'],editHotel:['编辑酒店资料','修改基础资料不会直接改变历史订单。'],createSite:['新增洗涤站点','站点需归属洗涤厂并配置覆盖区域。'],createPrice:['新建价格方案','设置酒店、布草品类、销售单价与生效时间。'],editPrice:['调整销售价格','新价格仅影响生效后的新订单。'],createProduct:['新增商城商品','商品需完成名称、分类、图片、价格与库存后方可上架。'],editProduct:['编辑商城商品','库存为零时商品保持售罄并禁止购买。'],editDriver:['调整司机负责范围','只维护静态区域和酒店清单，不生成配送任务。'],createUser:['新增账号','账号必须绑定组织与角色。'],editUser:['编辑账号','停用后账号立即失去业务权限。'],createEmployee:['新增酒店员工','酒店操作员默认不具备账户、商城与员工管理权限。'],editEmployee:['编辑员工账号','可调整角色或停用账号。'],settlement:['结算试算','当前仅演示成本汇总，周期与账单状态需客户确认。'],chipError:['异常扫描记录','展示重复芯片、错品类和不可识别芯片。'],inboundError:['送洗入库异常','重复、错酒店、错品类与不可识别事件不计入有效额度。'],inboundDetail:['额度变动明细','按酒店、品类和来源批次追溯额度增加与占用。'],warehouseEdit:['货架维护','按本厂站点维护仓区、货架容量和布草品类。'],floor:['切换楼层','选择楼层后刷新适用布草清单；额度是否按楼层隔离待确认。'],otherLaundry:['添加其他布草','仅可添加酒店已配置合同价格的布草品类。'],cart:['购物车','提交时再次校验库存；支付渠道待客户确认。'],candidatePay:['微信支付候选','支付资料由客户申请；是否启用及限额待确认。'],candidateOffline:['线下核款候选','是否保留平台财务核款流程待客户确认。'],driverHotel:['负责酒店','一期只确认酒店名称与所属区域，其他字段待确认。'],roleInfo:['角色与权限','页面已按组织、角色和价格口径隔离信息。'],question:['待确认事项','该规则需客户书面确认后再进入生产验收。'],ledger:['资金流水','每笔资金变动关联业务单号和变动后余额。'],terminalSubmit:['演示提交','设备未连接，本次演示不会写入真实芯片或订单数据。'],mobileRecords:['补充记录','查看本酒店历史补充订单。'],help:['使用帮助','按当前角色展示操作说明。'],about:['关于优洗通','酒店、平台与洗涤厂的布草数字化协作平台。']};
    if(info[action])showGeneric(info[action][0],info[action][1]);
  }

  function render(){
    var role=roles[state.role];
    root.innerHTML=role.surface==='mobile'?renderMobile(role):role.surface==='terminal'?renderTerminal(role):renderWeb(role);
    document.body.dataset.density=state.density;
    var url=new URL(location.href);url.searchParams.set('role',state.role);history.replaceState(null,'',url.toString());
  }
  function setRole(key){if(!roles[key])return;state.role=key;state.section=roles[key].nav[0];state.view='normal';viewSelect.value='normal';render();}
  function showToast(message,tone){var el=document.getElementById('prototypeToast');el.textContent=message;el.className='prototype-toast show '+(tone||'');clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.className='prototype-toast';},2400);}
  function handleClick(event){
    var section=event.target.closest('[data-section]');if(section){state.section=section.dataset.section;if(state.section==='租赁备货')state.scan=Math.min(state.scan,40);render();return;}
    var actionEl=event.target.closest('[data-action]');if(!actionEl)return;var action=actionEl.dataset.action;
    if(action==='closeModal'||action==='back'){closeModal();return;}
    if(action==='restore'){state.view='normal';viewSelect.value='normal';render();return;}
    if(action==='plus'||action==='minus'){var item=actionEl.dataset.item,max=Number(actionEl.dataset.max||999),delta=action==='plus'?1:-1;state.qty[item]=Math.max(0,Math.min(max,(state.qty[item]||0)+delta));render();return;}
    if(action==='scanAdd'){var maxScan=state.section==='租赁备货'?40:9999;if(state.scan>=maxScan){showToast('已达到订单待备货上限，超量扫描记为异常');return;}state.scan+=1;render();showToast('已识别 1 件示例芯片','success');return;}
    if(action==='advance'){state.progress=Math.min(2,state.progress+1);closeModal();render();showToast(['','订单已开始备货','订单已确认出库'][state.progress],'success');return;}
    if(/^confirm/.test(action)){closeModal();showToast(action==='confirmOrder'?'订单 YX202609070019 已生成，已扣款 '+money(state.qty['被套']*8+state.qty['床单']*5.5+state.qty['浴巾']*2.8):action==='confirmRecharge'?'充值已确认入账，资金流水已生成':action==='confirmRefund'?'退污结果已提交，退款将按通过数量处理':'操作已完成（原型演示）','success');return;}
    if(action==='filter'||action==='resetFilters'||action==='export'||action==='notice'||action==='addCart'||action==='soldOut'){showToast(action==='filter'?'已按当前条件刷新示例列表':action==='resetFilters'?'筛选条件已重置':action==='export'?'已生成脱敏导出任务（原型演示）':action==='notice'?'暂无未读业务消息':action==='addCart'?'已加入购物车':'当前商品库存为 0');return;}
    openForAction(action);
  }

  function inline(text){return esc(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');}
  function parseMarkdown(md){
    var lines=md.replace(/\r/g,'').split('\n'),html=[],heads=[],i=0,listDepth=0,ordered=false;
    function closeLists(){if(listDepth){html.push(ordered?'</ol>':'</ul>');listDepth=0;ordered=false;}}
    while(i<lines.length){
      var line=lines[i],trim=line.trim();
      if(!trim){closeLists();i++;continue;}
      if(/^---+$/.test(trim)){closeLists();html.push('<hr>');i++;continue;}
      var heading=/^(#{1,4})\s+(.+)$/.exec(trim);
      if(heading){closeLists();var level=heading[1].length,id='prd-'+heads.length;heads.push({id:id,level:level,text:heading[2]});html.push('<h'+level+' id="'+id+'">'+inline(heading[2])+'</h'+level+'>');i++;continue;}
      if(trim.indexOf('|')===0&&i+1<lines.length&&/^\s*\|?[\s:|-]+\|\s*$/.test(lines[i+1])){closeLists();var rows=[],j=i;while(j<lines.length&&lines[j].trim().indexOf('|')===0){rows.push(lines[j].trim().replace(/^\||\|$/g,'').split('|').map(function(cell){return cell.trim();}));j++;}html.push('<table><thead><tr>'+rows[0].map(function(cell){return '<th>'+inline(cell)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.slice(2).map(function(row){return '<tr>'+row.map(function(cell){return '<td>'+inline(cell)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>');i=j;continue;}
      var numbered=/^\d+\.\s+(.+)$/.exec(trim),item=/^[-*]\s+(.+)$/.exec(trim);
      if(numbered||item){var useOrdered=!!numbered;if(!listDepth||ordered!==useOrdered){closeLists();ordered=useOrdered;html.push(ordered?'<ol>':'<ul>');listDepth=1;}html.push('<li>'+inline((numbered||item)[1])+'</li>');i++;continue;}
      closeLists();html.push('<p>'+inline(trim)+'</p>');i++;
    }
    closeLists();return {html:html.join(''),heads:heads};
  }
  function initPrd(){var md=document.getElementById('prdMdSource').textContent.replace(/^\n/,'');var parsed=parseMarkdown(md);document.getElementById('prdContent').innerHTML=parsed.html;document.getElementById('prdToc').innerHTML='<div class="prd-toc-title">产品需求目录</div>'+parsed.heads.filter(function(h){return h.level>1&&h.level<4;}).map(function(h){return '<button class="prd-toc-item level-'+h.level+'" data-prd-target="'+h.id+'">'+esc(h.text)+'</button>';}).join('');}
  function initDrag(){var drag=document.getElementById('splitDrag'),panel=document.getElementById('prdPanel'),startX=0,startW=0;drag.addEventListener('mousedown',function(event){if(panel.classList.contains('collapsed'))return;event.preventDefault();startX=event.clientX;startW=panel.offsetWidth;drag.classList.add('dragging');document.body.style.cursor='col-resize';document.body.style.userSelect='none';function move(e){panel.style.width=Math.max(330,Math.min(Math.floor(innerWidth*.72),startW-(e.clientX-startX)))+'px';}function up(){drag.classList.remove('dragging');document.body.style.cursor='';document.body.style.userSelect='';document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);}document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);});}
  function togglePrd(){var panel=document.getElementById('prdPanel'),button=document.getElementById('prdToggle');panel.classList.toggle('collapsed');button.textContent=panel.classList.contains('collapsed')?'展开 PRD':'收起 PRD';}
  function downloadPrd(){var blob=new Blob([document.getElementById('prdMdSource').textContent.replace(/^\n/,'')],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='优洗通全角色业务产品需求文档.md';a.click();setTimeout(function(){URL.revokeObjectURL(url);},0);}
  function showChangelog(){var mask=document.getElementById('changelogMask'),items=typeof changelogData==='undefined'?[]:changelogData;document.getElementById('changelogBody').innerHTML=items.map(function(item){return '<div class="release-item"><b>'+esc(item.time)+'</b><p>'+esc(item.desc)+'</p></div>';}).join('');mask.classList.add('show');mask.setAttribute('aria-hidden','false');}
  function closeChangelog(){var mask=document.getElementById('changelogMask');mask.classList.remove('show');mask.setAttribute('aria-hidden','true');}

  roleSelect.addEventListener('change',function(){setRole(this.value);});
  densitySelect.addEventListener('change',function(){state.density=this.value;render();});
  viewSelect.addEventListener('change',function(){state.view=this.value;render();});
  root.addEventListener('click',handleClick);modal.addEventListener('click',handleClick);modal.addEventListener('click',function(e){if(e.target===this)closeModal();});
  document.getElementById('prdToggle').addEventListener('click',togglePrd);document.getElementById('downloadPrdBtn').addEventListener('click',downloadPrd);document.getElementById('changelogBtn').addEventListener('click',showChangelog);document.getElementById('closeChangelog').addEventListener('click',closeChangelog);document.getElementById('changelogMask').addEventListener('click',function(e){if(e.target===this)closeChangelog();});
  document.getElementById('prdToc').addEventListener('click',function(e){var buttonEl=e.target.closest('[data-prd-target]');if(!buttonEl)return;var target=document.getElementById(buttonEl.dataset.prdTarget);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeModal();closeChangelog();}});
  document.addEventListener('DOMContentLoaded',function(){var initial=new URL(location.href).searchParams.get('role');if(initial&&roles[initial])state.role=initial;state.section=roles[state.role].nav[0];roleSelect.innerHTML=Object.keys(roles).map(function(key){return '<option value="'+key+'">'+esc(roles[key].label)+'</option>';}).join('');roleSelect.value=state.role;densitySelect.value=state.density;viewSelect.value=state.view;initPrd();initDrag();render();});
})();
