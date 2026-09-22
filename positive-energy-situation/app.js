/* Local prototype: all business data below is explicitly illustrative. */
(function () {
  'use strict';
  const M = window.TopicModel;
  const $ = id => document.getElementById(id);
  const esc = text => String(text == null ? '' : text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {view:'board',start:'2026-09-16',end:'2026-09-22',scenario:'normal',boardCategory:'央媒报道',cockpitCategory:'央媒报道',boardSelected:null,cockpitSelected:null,expanded:false,attention:'央媒关注',subject:'近一年'};
  let current, charts = [], toastTimer, priorFocus, chartObserver;
  const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const dateText = value => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
  const metricRules = [
    '统计所选日期内上线、属于租户所属地区且已上线、已播报的三类话题传播量。先统一单位再求和；不受话题分类切换及话题选择影响。',
    '沿用驾驶舱既有的新莓汇播报数口径。此处209为独立演示值，不由话题数量推算，也不随原型话题日期筛选重算。',
    '所选日期内上线且符合条件的去重话题数，包含央媒报道、正能量热点、正能量线索三类，不仅统计“正能量热点”分类。',
    '沿用驾驶舱既有稿件统计口径。此处24为独立演示值，不等同于话题条数，不随原型话题日期筛选重算。',
    '沿用驾驶舱既有央媒报道量口径。此处3.85万为独立演示值，不按央媒话题数量推算，不随原型话题日期筛选重算。',
    '沿用驾驶舱既有省媒报道量口径。此处8.61万为独立演示值，不从新话题集合推算，不随原型话题日期筛选重算。'
  ];
  const metricNames = ['正能量话题传播量','新莓汇播报数','正能量热点数','正能量稿件数','央媒报道量','省媒报道量'];
  const iconPaths = [
    '<path d="M3 17l5-6 4 3 8-10M15 4h5v5"/><path d="M3 4v16h18"/>',
    '<path d="M5 9v7h4l8 4V5L9 9H5zM9 16l1 5M20 9c2 2 2 5 0 7"/>',
    '<path d="M13 2c2 6-3 6-1 10 2 0 4-2 4-4 5 5 5 13-3 14C2 22 3 12 7 8c-1 5 3 5 3 2 0-4 3-6 3-8z"/>',
    '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
    '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M9 21h6M12 18v3M10 8l5 3-5 3z"/>',
    '<path d="M4 21V6h7V3h9v18H4zM7 10h1M7 14h1M7 18h1M14 7h3M14 11h3M14 15h3M14 19h3"/>'
  ];
  const colors = ['#338afa','#22b99b','#ed9b42','#3aa5d8','#9c84e4','#ccab35'];
  function rawRecords() {
    if (state.scenario === 'empty') return [];
    return M.records.map((topic, i) => {
      const copy = {...topic};
      if (state.scenario === 'missing' && (i % 4 === 0 || topic.onlineAt.startsWith('2026-09-17'))) copy.volume = null;
      if (state.scenario === 'online' && i < 2) copy.onlineAt = null;
      // Keep copies of the same fixture identity consistent, so a duplicate cannot mask missing data.
      if (state.scenario === 'online' && copy.id === 'topic-01') copy.onlineAt = null;
      return copy;
    });
  }
  function derive() {
    const blocked = state.scenario === 'error' || state.scenario === 'region';
    const raw = rawRecords();
    const region = state.scenario === 'region' ? '' : '杭州市';
    const filtered = M.filter(raw,{region,start:state.start,end:state.end});
    const topics = blocked ? [] : filtered.topics;
    const summary = M.aggregate(topics,state.start,state.end);
    const heatTopics = blocked ? [] : M.filter(raw,{region,start:'2026-09-16',end:'2026-09-22'}).topics;
    return {topics,summary,missingOnlineCount:filtered.missingOnlineCount,blocked,heat:M.heatSeries('2026-09-16','2026-09-22',heatTopics)};
  }
  function sortedTopics(category) {
    return current.topics.filter(t=>!category||t.category===category).sort((a,b)=>{
      if (valid(a.volume)!==valid(b.volume)) return valid(a.volume)?-1:1;
      return (valid(a.volume)?b.volume-a.volume:0)||new Date(b.onlineAt)-new Date(a.onlineAt)||(a.source+':'+a.id).localeCompare(b.source+':'+b.id);
    });
  }
  function blockedText() {return state.scenario==='error'?'加载失败':state.scenario==='region'?'未配置地区':'';}
  function emptyBlock(what='话题') {
    const failed = state.scenario === 'error', region = state.scenario === 'region';
    return `<div class="empty"><div class="empty-mark" aria-hidden="true">${failed?'!':'—'}</div><p>${failed?'话题来源暂时加载失败，请重试。':region?'租户尚未配置所属地区，无法展示话题。':`当前条件下暂无${what}`}</p>${failed?'<button class="secondary" data-action="retry">重新加载</button>':''}</div>`;
  }
  function metrics() {
    let volume = blockedText() || (current.summary.missingCount ? (current.summary.count===current.summary.missingCount?'数据缺失':M.format(current.summary.knownTotal)) : M.format(current.summary.total));
    const values = [volume,'209',blockedText()||String(current.summary.count),'24','3.85万','8.61万'];
    return `<div class="metrics">${metricNames.map((name,i)=>`<section class="metric" style="--accent:${colors[i]}"><span class="metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${iconPaths[i]}</svg></span><div><div class="metric-value ${values[i].length>6?'long':''}" data-metric="${i}">${values[i]}</div><div class="metric-label">${name}<button class="info" data-rule="${i}" aria-label="${name}口径说明" title="${esc(metricRules[i])}">?</button></div>${i===0&&(current.summary.missingCount||current.missingOnlineCount)?`<div class="metric-note">${current.summary.count===current.summary.missingCount&&current.summary.missingCount?'数据不完整':'已知合计 · 数据不完整'}</div>`:''}</div><span class="metric-mini">${i===0||i===2?'所选周期':'独立示例'}</span></section>`).join('')}</div>`;
  }
  const topicKey = topic => topic.source+':'+topic.id;
  function selectedTopic(){return current.topics.find(t=>topicKey(t)===state[state.view+'Selected'])||null;}
  function categoryTabs() {
    const categories=['央媒报道','正能量热点','正能量线索'],active=state[state.view+'Category'];
    return `<div class="tabs category-tabs" role="group" aria-label="话题分类">${categories.map(category=>`<button data-category="${category}" class="${category===active?'active':''}" aria-pressed="${category===active}">${category}</button>`).join('')}</div>`;
  }
  function topicTitle(t){
    const url=M.originalUrl(t);
    return url?`<a class="topic-title topic-original" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(t.title)} · 打开原文">${esc(t.title)}</a>`:`<button class="topic-title topic-original missing-original" data-original-missing="true" title="${esc(t.title)} · 原文地址未提供">${esc(t.title)}</button>`;
  }
  function listMarkup(topics) {
    return `<ol class="rank-list topic-list">${topics.map((t,i)=>{const key=topicKey(t),selected=state.boardSelected===key;return `<li data-select="${esc(key)}" class="${selected?'selected':''}"><button class="rank-number topic-select" data-select="${esc(key)}" aria-pressed="${selected}" aria-label="查看${esc(t.title)}的走势">${i+1}</button><div class="rank-main">${topicTitle(t)}<div class="rank-meta"><span>${dateText(t.onlineAt)}</span><span class="selection-hint">${selected?'已选中':'点击行查看走势'}</span></div></div><span class="rank-volume">${M.format(t.volume)}</span></li>`;}).join('')}</ol>`;
  }
  function rankPanel() {
    const topics=sortedTopics(state.boardCategory);
    return `<section class="panel"><div class="panel-head"><h2>杭州正能量热榜</h2>${categoryTabs()}${topics.length>5?`<button class="more" data-action="more">${state.expanded?'收起':'更多 >'}</button>`:''}</div>${current.blocked||!topics.length?emptyBlock():listMarkup(state.expanded?topics:topics.slice(0,5))}</section>`;
  }
  const attentionTitles = {
    '央媒关注':['数字贸易连接世界，杭州创新活力持续释放','运河两岸焕新颜，文化传承融入百姓生活','从一间社区食堂，看见城市的温度','科技赋能公共服务，让美好生活触手可及','走进杭州：绿色发展书写城市新篇'],
    '省媒关注':['浙江观察：数贸盛会里的发展新机遇','家门口的幸福，杭州社区服务再升级','青年与城市双向奔赴，创新创业正当时','一条绿道串起市民的幸福生活','文明实践在身边，志愿服务暖人心']
  };
  function attentionPanel(compact=false) {
    const names=state.attention==='央媒关注'?['人民日报客户端','新华社客户端','央视新闻客户端','中国新闻网','光明日报客户端']:['潮新闻客户端','浙江日报','中国蓝新闻客户端','浙江之声','杭州日报'];
    return `<section class="panel"><div class="panel-head"><div class="tabs" role="group" aria-label="媒体关注类型">${['央媒关注','省媒关注'].map(x=>`<button data-attention="${x}" class="${state.attention===x?'active':''}" aria-pressed="${state.attention===x}">${x}</button>`).join('')}</div><span class="chart-legend">独立示例</span></div><ol class="rank-list">${attentionTitles[state.attention].slice(0,compact?4:5).map((title,i)=>`<li><span class="rank-number">${i+1}</span><div class="rank-main"><span class="topic-title" title="${title}">${title}</span><div class="rank-meta"><span>${names[i]}</span><span>09-22</span></div></div>${compact?'':'<span class="category-chip">官方媒体</span>'}</li>`).join('')}</ol></section>`;
  }
  function chartPanel(type,small=false) {
    const heat=type==='heat',topic=selectedTopic(),individual=!!topic&&(heat||state.view==='board');
    const series=individual?(heat?M.heatSeries('2026-09-16','2026-09-22',[topic]):M.topicSeries(topic,state.start,state.end)):heat?current.heat:current.summary.series;
    const chartType=individual?(heat?'topicHeat':'topicVolume'):type;
    const id=charts.length;charts.push({type:chartType,series,topic:individual?topic:null,heat});
    const title=heat?(individual?'话题热度趋势':'全网热度趋势'):(individual?'话题传播量走势图':state.view==='board'?'正能量话题传播量走势图':'正能量话题传播走势图');
    const subtitle=individual?`<span class="selected-topic-name" title="${esc(topic.title)}">${esc(topic.title)}</span><button class="reset-topic" data-action="clear-topic">全部话题</button>`:heat?'近7日 · 09.16—09.22':`按上线日期 · ${state.start.slice(5).replace('-','.')}—${state.end.slice(5).replace('-','.')}`;
    return `<section class="panel trend-panel" data-trend="${chartType}"><div class="panel-head"><h2>${title}</h2><span class="chart-legend"><i style="${heat?'background:#36c9e7':''}"></i>${heat?'热度':individual?'累计传播量':'话题传播量'}</span></div><div class="panel-sub trend-caption">${subtitle}</div>${current.blocked?emptyBlock('统计数据'):`<div class="chart-wrap" data-chart-wrap="${id}">${chartSvg(id,series,heat,small)}</div>`}</section>`;
  }
  function chartSvg(id,series,heat,small,width=600) {
    const w=width,h=state.view==='cockpit'?190:285,left=58,right=20,top=27,bottom=38,plotW=w-left-right,plotH=h-top-bottom;
    const vals=series.map(p=>Object.prototype.hasOwnProperty.call(p,'value')?p.value:p.total), max=Math.max(1,...vals.filter(valid)), ceiling=Math.ceil(max/4)*4;
    const x=i=>left+(series.length===1?plotW/2:i*plotW/(series.length-1));
    const y=v=>top+plotH-(v/ceiling)*plotH;
    const color=heat?'#32c8e7':'#f08c58';
    let svg=`<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="group" aria-label="${charts[id].topic?'所选话题'+(heat?'热度':'传播量')+'趋势':heat?'全网热度示例趋势':'每日话题传播量趋势'}"><defs><linearGradient id="area${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".22"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
    for(let i=0;i<5;i++){const v=ceiling*i/4, yy=y(v);svg+=`<line class="chart-grid" x1="${left}" x2="${w-right}" y1="${yy}" y2="${yy}"/><text x="${left-11}" y="${yy+3}" text-anchor="end">${M.format(v)}</text>`;}
    // Missing values split the path: no invented zeros and no interpolation across missing days.
    let segments=[],segment=[];
    vals.forEach((v,i)=>{if(valid(v))segment.push([x(i),y(v)]);else if(segment.length){segments.push(segment);segment=[];}});if(segment.length)segments.push(segment);
    segments.forEach(points=>{const path=points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');svg+=`<path d="${path} L${points[points.length-1][0]},${top+plotH} L${points[0][0]},${top+plotH} Z" fill="url(#area${id})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;});
    const tickStep=Math.max(1,Math.ceil(series.length/8));
    series.forEach((point,i)=>{if(valid(vals[i]))svg+=`<circle cx="${x(i)}" cy="${y(vals[i])}" r="3.5" fill="var(--card)" stroke="${color}" stroke-width="2"/>`;else svg+=`<text x="${x(i)}" y="${top+plotH-9}" text-anchor="middle">—</text>`;
      if(i%tickStep===0||i===series.length-1)svg+=`<text x="${x(i)}" y="${h-12}" text-anchor="middle">${point.date.slice(5).replace('-','/')}</text>`;
      const slot=plotW/Math.max(series.length-1,1);const hitW=Math.max(8,Math.min(64,slot));
      svg+=`<rect class="chart-hit" x="${x(i)-hitW/2}" y="${top-8}" width="${hitW}" height="${plotH+15}" tabindex="0" role="button" aria-label="${point.date} ${heat?'热度':'传播量'} ${M.format(vals[i])}，查看详情" data-chart="${id}" data-point="${i}"/>`;
    });
    return svg+'</svg>';
  }
  function regionPanel(){return `<section class="panel"><div class="panel-head"><h2>正能量稿件地域分布</h2><span class="chart-legend">独立示例</span></div><div class="bar-chart" aria-label="示例稿件地域分布：上城区9，西湖区7，余杭区5，滨江区3">${['上城区','西湖区','余杭区','滨江区'].map((n,i)=>`<div class="bar-col"><b>${[9,7,5,3][i]}</b><div class="bar-fill" style="height:${[78,61,44,26][i]}%"></div><span>${n}</span></div>`).join('')}</div></section>`;}
  function cloudPanel(){
    const topics=sortedTopics(state.cockpitCategory),max=Math.max(1,...topics.map(t=>valid(t.volume)?t.volume:0));
    return `<section class="panel"><div class="panel-head"><h2>实时正能量热点</h2><span class="chart-legend">${topics.length} 个话题</span></div><div class="cloud-tabs">${categoryTabs()}</div>${current.blocked||!topics.length?emptyBlock():`<div class="word-cloud">${topics.map(t=>{const key=topicKey(t),selected=state.cockpitSelected===key;return `<span class="cloud-item ${selected?'selected':''}" data-select="${esc(key)}" style="--word-size:${valid(t.volume)?13+Math.round(t.volume/max*10):13}px"><button class="cloud-select" data-select="${esc(key)}" aria-pressed="${selected}" aria-label="查看${esc(t.title)}的走势" title="查看走势">${selected?'●':'○'}</button>${topicTitle(t)}${valid(t.volume)?'':'<small>数据缺失</small>'}</span>`;}).join('')}</div>`}</section>`;
  }
  function subjectPanel(){
    const values={'7日':['1268万',38,26,31],'30日':['2850万',96,78,85],'近一年':['1.26亿',533,161,462]},v=values[state.subject];
    return `<section class="panel"><div class="panel-head"><h2>正能量专题</h2><span class="chart-legend">独立示例</span></div><div class="subject-controls" role="group" aria-label="专题统计周期">${Object.keys(values).map(x=>`<button data-subject="${x}" class="${state.subject===x?'active':''}" aria-pressed="${state.subject===x}">${x}</button>`).join('')}</div><div class="subject-title">共建文明城市</div><div class="subject-total"><small>专题总传播量</small><strong>${v[0]}</strong><small>专题周期独立于页面统计周期</small></div><div class="media-split">${['央视新闻','人民日报','新华社'].map((n,i)=>`<div><strong>${v[i+1]}</strong><span>${n}</span></div>`).join('')}</div></section>`;
  }
  function mediaPanel(){return `<section class="panel"><div class="panel-head"><h2>媒体报道分布</h2><span class="chart-legend">独立示例</span></div><div class="bar-chart" style="height:150px">${['客户端','网站','微博','微信'].map((x,i)=>`<div class="bar-col"><b>${[126,89,72,56][i]}</b><div class="bar-fill" style="height:${[78,55,44,34][i]}%"></div><span>${x}</span></div>`).join('')}</div><ul class="article-list"><li><p>城市文明向前一步，幸福生活更近一程</p><span>杭州发布 · 09-22 10:30</span></li><li><p>社区里的暖心故事，点亮城市微光</p><span>潮新闻客户端 · 09-21 16:20</span></li><li><p>让公共服务更有温度，让城市生活更美好</p><span>杭州日报 · 09-20 09:15</span></li></ul></section>`;}
  function render() {
    if(chartObserver)chartObserver.disconnect();
    current=derive();charts=[];$('tooltip').hidden=true;
    $('prototype').classList.toggle('cockpit-mode',state.view==='cockpit');
    document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false');});
    let warning='';
    if(state.scenario==='error')warning='<div class="banner error">话题来源加载失败。话题相关统计暂不可用，其他独立示例不受影响。<button data-action="retry">重试</button></div>';
    else if(state.scenario==='region')warning='<div class="banner">租户所属地区尚未配置，无法确定话题范围。请在租户配置中补全所属地区后查看。</div>';
    else if(current.missingOnlineCount)warning=`<div class="banner">有 ${current.missingOnlineCount} 条符合来源条件的话题缺少真实上线时间，无法归日，暂未纳入统计。以下为已知数据，未使用其他时间替代。</div>`;
    else if(current.summary.missingCount)warning=`<div class="banner">当前范围内有 ${current.summary.missingCount} 条话题传播量缺失。已知合计不代表完整总量；受影响日期不确认最高话题。</div>`;
    $('statusBanner').innerHTML=warning;
    if(state.view==='board')$('viewRoot').innerHTML=metrics()+`<div class="board-grid">${rankPanel()}${attentionPanel()}${chartPanel('volume')}${regionPanel()}</div>`;
    else $('viewRoot').innerHTML=`<div class="cockpit-layout"><div class="cockpit-column left-column">${subjectPanel()}${mediaPanel()}</div><div class="cockpit-column center-column">${metrics()}${cloudPanel()}${chartPanel('heat')}</div><div class="cockpit-column right-column">${attentionPanel(true)}${chartPanel('volume',true)}${regionPanel()}</div></div>`;
    bindChartEvents();
    chartObserver=new ResizeObserver(entries=>entries.forEach(entry=>{const wrap=entry.target,id=Number(wrap.dataset.chartWrap),chart=charts[id];if(!chart)return;const width=Math.max(230,Math.round(entry.contentRect.width));if(wrap.dataset.width===String(width))return;wrap.dataset.width=String(width);wrap.innerHTML=chartSvg(id,chart.series,chart.heat,false,width);bindChartEvents(wrap);}));
    document.querySelectorAll('[data-chart-wrap]').forEach(el=>chartObserver.observe(el));
  }
  function tipContents(chart,point) {
    if(chart.topic)return `<div class="tip-date">${point.date} · ${chart.heat?'话题热度':'累计传播量'}</div><div class="tip-top">${esc(chart.topic.title)}</div><strong>${valid(point.value)?M.format(point.value):'暂无观测数据'}</strong>`;

    if(chart.type==='heat')return `<div class="tip-date">${point.date} · 独立热度示例</div><div>全网热度 <strong>${M.format(point.value)}</strong></div><div class="tip-top">沿用既有热度口径，非传播量</div>`;
    let html=`<div class="tip-date">${point.date} · 按上线日期统计</div>`;
    if(point.missingCount){html+=`<div>${point.count===point.missingCount?'当日传播量 <strong>数据缺失</strong>':`已知合计 <strong>${M.format(point.knownTotal)}</strong>`}</div><div class="tip-top">${point.missingCount} 条传播量缺失 · 数据不完整<br>无法确定当日最高话题</div>`;}
    else {html+=`<div>${current.missingOnlineCount?'当日已知传播量':'当日总传播量'} <strong>${M.format(point.total)}</strong></div><div class="tip-top">${current.missingOnlineCount?'已知记录中':''}${point.top.length>1?'并列最高话题':'最高话题'}${point.top.length?point.top.map(t=>`<div>${esc(t.title)}：${M.format(t.volume)}</div>`).join(''):'：无话题'}</div>`;}
    if(current.missingOnlineCount)html+='<div class="tip-top">部分话题上线时间缺失，仅展示已知结果</div>';
    return html;
  }
  function showTip(el,event){
    const chart=charts[Number(el.dataset.chart)],point=chart.series[Number(el.dataset.point)],tip=$('tooltip'),box=$('prototype').getBoundingClientRect();
    tip.innerHTML=tipContents(chart,point);tip.hidden=false;
    const hit=el.getBoundingClientRect(),px=event&&event.clientX?event.clientX:hit.left+hit.width/2,py=event&&event.clientY?event.clientY:hit.top+hit.height/2;
    tip.style.left=Math.max(8,Math.min(px-box.left+15,box.width-tip.offsetWidth-12))+'px';
    tip.style.top=Math.max(8,Math.min(py-box.top+14,box.height-tip.offsetHeight-12))+'px';
  }
  function bindChartEvents(root=document){root.querySelectorAll('[data-chart]').forEach(el=>{el.addEventListener('pointerenter',e=>showTip(el,e));el.addEventListener('pointermove',e=>showTip(el,e));el.addEventListener('pointerleave',()=>{$('tooltip').hidden=true;});el.addEventListener('focus',()=>showTip(el));el.addEventListener('blur',()=>{$('tooltip').hidden=true;});el.addEventListener('click',()=>showTip(el));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showTip(el);}});});}
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
  function openModal(title,content){priorFocus=document.activeElement;$('tooltip').hidden=true;$('modalTitle').textContent=title;$('modalContent').innerHTML=content;$('modalMask').hidden=false;$('closeModal').focus();}
  function closeModal(){$('modalMask').hidden=true;if(priorFocus&&priorFocus.isConnected)priorFocus.focus();}
  function selectTopic(key){state[state.view+'Selected']=key;render();}
  document.addEventListener('click',e=>{
    const original=e.target.closest('.topic-original');
    if(original){if(original.hasAttribute('data-original-missing'))toast('原文地址未提供');return;}
    const choice=e.target.closest('[data-select]');
    if(choice){selectTopic(choice.dataset.select);return;}
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.view){state.view=b.dataset.view;render();$('systemMain').scrollTop=0;}
    else if(b.dataset.category){state[state.view+'Category']=b.dataset.category;state[state.view+'Selected']=null;state.expanded=false;render();document.querySelector(`[data-category="${b.dataset.category}"]`)?.focus({preventScroll:true});}
    else if(b.dataset.attention){state.attention=b.dataset.attention;render();}
    else if(b.dataset.subject){state.subject=b.dataset.subject;render();}
    else if(b.dataset.rule!==undefined)openModal(metricNames[Number(b.dataset.rule)]+' · 统计说明',`<p>${metricRules[Number(b.dataset.rule)]}</p>`);
    else if(b.dataset.action==='more'){state.expanded=!state.expanded;render();}
    else if(b.dataset.action==='clear-topic'){state[state.view+'Selected']=null;render();}
    else if(b.dataset.action==='retry'){
      b.disabled=true;b.textContent='重新加载中…';setTimeout(()=>{state.scenario='normal';$('scenario').value='normal';render();toast('已恢复示例数据');},450);
    }
  });
  function applyDates(){const start=$('startDate').value,end=$('endDate').value;if(!M.days(start,end).length){toast('请填写有效日期，开始日期不能晚于结束日期');return;}state.start=start;state.end=end;state.boardSelected=null;state.cockpitSelected=null;state.expanded=false;render();}
  $('dateForm').addEventListener('submit',e=>{e.preventDefault();applyDates();});
  $('startDate').addEventListener('change',applyDates);$('endDate').addEventListener('change',applyDates);
  $('scenario').addEventListener('change',e=>{state.scenario=e.target.value;state.boardSelected=null;state.cockpitSelected=null;render();});
  $('closeModal').addEventListener('click',closeModal);
  $('modalMask').addEventListener('click',e=>{if(e.target===$('modalMask'))closeModal();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(!$('modalMask').hidden)closeModal();$('tooltip').hidden=true;}
    if(e.key==='Tab'&&!$('modalMask').hidden){const items=[...$('modalMask').querySelectorAll('button:not(:disabled),[tabindex="0"]')];const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  $('systemMain').addEventListener('scroll',()=>{$('tooltip').hidden=true;});
  function inline(text){return esc(text).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');}
  function renderMarkdown(markdown){
    const lines=markdown.split('\n'),toc=[];let html='',listStack=[],table=false,headingIndex=0;
    function closeLists(){while(listStack.length)html+=`</${listStack.pop().tag}>`;}
    for(let i=0;i<lines.length;i++){
      const line=lines[i],head=line.match(/^(#{1,4})\s+(.+)$/),item=line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
      if(line.trim().startsWith('|')){closeLists();if(/^\s*\|[\s:|\-]+\|\s*$/.test(line))continue;const cells=line.trim().split('|').slice(1,-1);if(!table){html+='<table><thead><tr>'+cells.map(c=>'<th>'+inline(c.trim())+'</th>').join('')+'</tr></thead><tbody>';table=true;}else html+='<tr>'+cells.map(c=>'<td>'+inline(c.trim())+'</td>').join('')+'</tr>';continue;}
      if(table){html+='</tbody></table>';table=false;}
      if(head){closeLists();const level=head[1].length,id='prd-heading-'+headingIndex++;html+=`<h${level} id="${id}">${inline(head[2])}</h${level}>`;if(level===2||level===3)toc.push({id,label:head[2],level:level-1});}
      else if(item){const depth=item[1].length,tag=/\d/.test(item[2])?'ol':'ul';while(listStack.length&&listStack[listStack.length-1].depth>depth)html+=`</${listStack.pop().tag}>`;if(!listStack.length||listStack[listStack.length-1].depth<depth){html+=`<${tag}>`;listStack.push({depth,tag});}else if(listStack[listStack.length-1].tag!==tag){html+=`</${listStack.pop().tag}><${tag}>`;listStack.push({depth,tag});}html+='<li>'+inline(item[3])+'</li>';}
      else {closeLists();if(/^---+$/.test(line.trim()))html+='<hr>';else if(line.startsWith('> '))html+='<blockquote>'+inline(line.slice(2))+'</blockquote>';else if(line.trim())html+='<p>'+inline(line)+'</p>';}
    }
    closeLists();if(table)html+='</tbody></table>';$('prdContent').innerHTML=html;$('prdToc').innerHTML=toc.map(t=>`<button class="level-${t.level}" data-heading="${t.id}">${esc(t.label)}</button>`).join('');
  }
  function togglePrd(open){const panel=$('prdPanel');const visible=open===undefined?panel.classList.contains('collapsed'):open;panel.classList.toggle('collapsed',!visible);panel.inert=!visible;$('prdToggle').setAttribute('aria-expanded',String(visible));$('prdToggle').textContent=visible?'收起文档':'需求文档';if(!visible)$('prdToggle').focus({preventScroll:true});}
  $('prdToggle').addEventListener('click',()=>togglePrd());$('closePrd').addEventListener('click',()=>togglePrd(false));
  $('prdToc').addEventListener('click',e=>{const b=e.target.closest('[data-heading]');if(b){const el=$(b.dataset.heading),container=$('prdContent');container.scrollTo({top:container.scrollTop+el.getBoundingClientRect().top-container.getBoundingClientRect().top-12,behavior:'smooth'});}});
  $('downloadPrd').addEventListener('click',()=>{const a=document.createElement('a');a.href='PRD.md';a.download='正能量态势感知-PRD.md';a.hidden=true;document.body.appendChild(a);a.click();a.remove();toast('已发起 PRD 下载');});
  $('changeLog').addEventListener('click',()=>openModal('更新记录',JSON.parse($('changelogData').textContent).map(item=>`<p><small>${esc(item.time)}</small></p><p>${esc(item.description)}</p>`).join('')));
  const drag=$('splitDrag'),panel=$('prdPanel');
  function setWidth(value){const width=Math.max(300,Math.min(window.innerWidth*.7,value));panel.style.width=width+'px';drag.setAttribute('aria-valuenow',String(Math.round(width)));drag.setAttribute('aria-valuemax',String(Math.round(window.innerWidth*.7)));}
  drag.addEventListener('pointerdown',e=>{e.preventDefault();const initial=e.clientX,width=panel.getBoundingClientRect().width;drag.classList.add('dragging');document.body.style.userSelect='none';document.body.style.cursor='col-resize';function move(ev){setWidth(width+initial-ev.clientX);}function up(){document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);document.body.style.userSelect='';document.body.style.cursor='';drag.classList.remove('dragging');}document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);});
  drag.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setWidth(panel.getBoundingClientRect().width+(e.key==='ArrowLeft'?25:-25));}});
  renderMarkdown($('prdMdSource').textContent);render();
})();
