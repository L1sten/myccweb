/* Existing report capability. All records and edits are local demonstration data. */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=n=>new Date(Date.UTC(2026,9,n)).toISOString().slice(0,10);
 const daily=Array.from({length:27},(_,i)=>({id:'d'+i,date:date(20-i),end:date(21-i),label:date(20-i)+' 星期'+'日一二三四五六'[new Date(date(20-i)).getUTCDay()]}));
 const weekly=Array.from({length:11},(_,i)=>({id:'w'+i,date:date(14-i*7),start:date(7-i*7),label:date(7-i*7)+' 16:00 至 '+date(14-i*7)+' 16:00'}));
 const events=['社区银龄志愿者持续参与便民服务，温暖居民日常生活。','文化交流活动在杭州举行，共同探讨文化遗产保护与传承。','青年创业者从校园出发，以创新产品服务城市生活。'];
 const demo=window.WeeklyReportDemo;
 let localReportStorage;try{localReportStorage=window.localStorage;}catch{}
 const reportStore=window.WeeklyReportStore.create(localReportStorage);
 const storedReports=reportStore.list();
 const newReportId=()=>{if(window.crypto.randomUUID)return 'custom-'+window.crypto.randomUUID();const bytes=window.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');return 'custom-'+[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');};
 const beijingNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium'}).format(new Date());
 const state={mode:'auto',period:'weekly',weeklyPermission:true,start:'',end:'',page:1,detail:null,detailTab:'topics',manual:[],comments:{},editing:-1,customStart:demo.defaultRange.start,customEnd:demo.defaultRange.end,customReport:null,customExpanded:false,queryError:'',generating:false,savedReports:storedReports.ok?storedReports.reports:[],savedLoadError:storedReports.ok?'':storedReports.error,listMessage:''};
 let root,selectedFile=null,focusBefore=null,generationSequence=0;
 const btn=(text,action,extra='')=>`<button type="button" data-report-action="${action}" ${extra}>${text}</button>`;
 function table(headers,body){return `<div class="report-table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${headers.length}" class="report-table-empty">暂无数据</td></tr>`}</tbody></table></div>`;}
 function close(){root.querySelector('.report-overlay')?.remove();if(focusBefore?.isConnected)focusBefore.focus();}
 function modal(title,content){focusBefore=document.activeElement;root.querySelector('.report-overlay')?.remove();root.insertAdjacentHTML('beforeend',`<div class="report-overlay"><section class="report-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2>${btn('×','close','aria-label="关闭报告弹窗"')}</header><div class="report-dialog-body">${content}</div></section></div>`);root.querySelector('[data-report-action="close"]').focus();}
 function weeklyContent(r){
  const d=window.ZhoushanWeekly?.[r.date];
  if(!d)return '<h2>涉舟山网络正能量数据简报</h2><p class="report-doc-date">'+esc(r.label)+'</p><div class="report-chart-empty">该期舟山周报数据尚未补入本地，请查看 2026-10-07 至 2026-10-14 周报。</div>';
  const value=n=>n===null?'—':Number(n).toLocaleString('zh-CN');
  const row=cells=>'<tr>'+cells.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>';
  return '<h2>涉舟山网络正能量数据简报</h2><p class="report-doc-date">'+esc(d.start)+' 至 '+esc(d.end)+'</p><p class="report-sample">线上可见数据快照 · 核对日期 '+esc(d.verifiedOn)+' · 非实时更新</p><h3>一、总体情况</h3><p>2026年10月7日至10月14日，我办监测发现主要新闻APP网站和社交平台涉舟山信息共计 '+esc(d.informationDisplay)+'条。整体来看，正向情绪内容占比'+value(d.positivePercent)+'%（见图1）。</p><div class="report-chart-empty">原报告情感分布图暂无数据；正文正向情绪占比为 '+value(d.positivePercent)+'%</div><p class="report-doc-date">图1：正能量稿件情感分布图</p><h3>二、工作情况</h3><p>10月7日至10月14日，共产生全网涉舟山正能量热点事件 '+value(d.eventCount)+' 个（见表1），其中阅读量超500万热点事件 '+value(d.overFiveMillionCount)+' 个，涉舟山正面热点报道事件总阅读量超过 '+esc(d.totalViewsDisplay)+'。'+value(d.contributorCount)+' 个网络传播主体向省“新莓汇”正能量稿池推送正能量稿件作品 '+value(d.submissionCount)+' 篇次（见表2）。从账号表现来看，本周共有 '+value(d.activeAccounts)+' 个活跃正能量账号参与传播（见表3）。</p><p>表1. 涉舟山正能量热点事件</p>'+table(['序号','事件','属地','传播量','主持人'],d.events.map((e,i)=>row([i+1,...e])).join(''))+'<h3>三、“新莓汇”正能量稿池投稿情况</h3><p>表2. “新莓汇”正能量稿池投稿情况</p>'+table(['序号','投稿账号','篇次'],d.submissions.map((e,i)=>row([i+1,e[0],e[1]+'（热点选题稿件 '+e[2]+' 篇）'])).join(''))+'<h3>四、正能量账号名单</h3><p>表3. 正能量账号名单</p>'+table(['地区','数量','账号名单'],d.accounts.map(row).join(''));
 }
 function preview(r){
  const week=r.id.startsWith('w');
  const text=week?weeklyContent(r):`<h2>涉杭州正能量网络传播日报</h2><p class="report-doc-date">${r.date} 00:00 ~ ${r.end} 00:00</p><p>本示例未接入稿件、热点及传播统计，相关指标暂无有效数据。</p><div class="report-chart-empty">涉杭州稿件情绪分布图 · 暂无有效数据</div><h3>一、全网涉杭州正能量热点话题</h3>${table(['序号','事件','属地','话题阅读量','渠道'],'')}<h3>二、全网涉杭州正能量热点事件</h3>${events.map((e,i)=>`<p>${i+1}. ${esc(e)}</p>${state.comments[r.id+':'+i]?`<blockquote>${esc(state.comments[r.id+':'+i])}</blockquote>`:''}`).join('')}`;
  modal(week?'周报正文预览':'日报正文预览',`<article class="report-document"><p class="report-sample">${week?'舟山周报 · 本地数据':'演示数据 · 沿用线上既有报告结构'}</p>${text}</article>`);
 }
 const timeLabel=value=>value.replace('T',' ');
 const number=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('zh-CN'):'数据缺失';
 const views=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0)return '数据缺失';const unit=value>=100000000?100000000:value>=10000?10000:1;return Number((value/unit).toFixed(2)).toLocaleString('zh-CN',{useGrouping:false,maximumFractionDigits:2})+(unit===100000000?'亿':unit===10000?'万':'');};
 function customForm(){
  return `<form id="weeklyQueryForm" class="report-custom-query" novalidate aria-label="自定义时间生成周报" ${state.customExpanded?'':'hidden'}><div class="report-query-title"><h3>自定义时间统计</h3></div><div class="report-query-fields"><label>开始时间<span class="report-query-date"><input type="date" id="weeklyStart" aria-label="周报统计开始日期" value="${esc(state.customStart)}" required ${state.generating?'disabled':''}></span></label><span class="report-range-separator">至</span><label>结束时间<span class="report-query-date"><input type="date" id="weeklyEnd" aria-label="周报统计结束日期" value="${esc(state.customEnd)}" required ${state.generating?'disabled':''}></span></label><button type="submit" class="report-primary" ${state.generating?'disabled':''}>${state.generating?'正在生成…':'查询并生成报告'}</button></div><p id="weeklyQueryError" class="report-query-error" role="alert" ${state.queryError?'':'hidden'}>${esc(state.queryError)}</p></form>`;
 }
 function customContent(r){
  const s=r.stats,none=r.coverageStatus==='none',partial=r.coverageStatus==='partial';
  const stat=value=>none?'数据不足':(partial?'已知 ':'')+number(value);
  const row=cells=>'<tr>'+cells.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>';
  const sourceNote=none?'暂无所选时段的演示明细，无法计算统计结果。':partial?'所选时段超出演示明细覆盖范围，以下仅为覆盖部分的已知结果，不代表完整时段。':'以下结果按所选时段内的独立演示明细重新统计，非线上真实数据。';
  const emptyRow=count=>`<tr><td colspan="${count}" class="report-table-empty">${none?'所选时段缺少明细，无法统计':partial?'覆盖部分暂无匹配记录，完整时段数据不足':'所选时段暂无匹配记录'}</td></tr>`;
  const total=none?'数据不足':s.totalViews===null?`已知 ${views(s.knownTotalViews)}（${s.missingViewsCount} 条事件传播量缺失，合计不完整）`:(partial?'已知 ':'')+views(s.totalViews);
  const over=none?'数据不足':s.overFiveMillionCount===null?`已知 ${number(s.knownOverFiveMillionCount)} 个，完整数量待补全`:stat(s.overFiveMillionCount)+' 个';
  const positive=none?'数据不足':s.positivePercent===null?'暂无可计算的占比':(partial?'已知记录中 ':'')+s.positivePercent.toFixed(1)+'%';
  return `<h2>涉${esc(r.region)}网络正能量数据简报</h2><p class="report-doc-date">${esc(timeLabel(r.start))} 至 ${esc(timeLabel(r.end))}（北京时间）</p><p class="report-sample report-source-note">自定义报告 · 独立演示数据<br>${esc(sourceNote)}</p><h3>一、总体情况</h3><p>${none?'所选时段数据不足，无法统计监测信息量及正向情绪内容占比。':`本期监测信息 ${stat(s.informationCount)} 条，正向情绪内容占比：${positive}。`}</p><h3>二、工作情况</h3><p>${none?'所选时段缺少事件、投稿和账号活动明细，无法统计工作情况。':`本期正能量热点事件 ${stat(s.eventCount)} 个，其中阅读量超过500万的事件：${over}。本期纳入事件的传播量合计：${esc(total)}。共有 ${stat(s.contributorCount)} 个投稿账号提交稿件 ${stat(s.submissionCount)} 篇次，${stat(s.activeAccounts)} 个活跃账号参与传播。`}</p><p>表1. 本期正能量热点事件</p>${table(['序号','事件','发生时间','属地','传播量','主持人'],none?emptyRow(6):r.events.length?r.events.map((e,i)=>row([i+1,e.title,new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(e.at)),e.region,views(e.views),e.host])).join(''):emptyRow(6))}<h3>三、“新莓汇”正能量稿池投稿情况</h3><p>表2. 本期投稿账号汇总</p>${table(['序号','投稿账号','投稿篇次','热点选题稿件'],none?emptyRow(4):r.submissions.length?r.submissions.map((e,i)=>row([i+1,e.account,e.count,e.topicCount])).join(''):emptyRow(4))}<h3>四、正能量账号名单</h3><p>表3. 本期有传播活动的账号</p>${table(['地区','数量','账号名单'],none?emptyRow(3):r.accounts.length?r.accounts.map(e=>row([e.region,e.count,e.names.join('、')])).join(''):emptyRow(3))}<p class="report-sample">本地演示统计说明：信息、事件、投稿及账号活动分别按各自发生时间纳入实际统计区间，包含实际开始、不含实际结束；重复记录仅统计一次。传播量合计为本期纳入事件记录值之和，活跃账号按账号去重。报告生成于 ${esc(r.generatedAt)}。</p>`;
 }
 function previewCustom(report=state.customReport){
  if(!report)return;state.customReport=report;
  const saved=state.savedReports.some(item=>item.id===report.id);
  modal('自定义周报预览',`<article class="report-document">${customContent(report)}</article><p class="report-save-feedback" id="reportSaveFeedback" role="status" hidden></p><div class="report-bottom">${btn('下载报告','custom-download','class="report-primary"')}${btn(saved?'已保存':'保存到列表','custom-save',saved?'disabled':'')}</div>`);
 }
 function weeklyRecords(){
  return [...weekly,...state.savedReports.map(report=>({id:report.id,date:report.savedAt.slice(0,10),publishedAt:report.savedAt,label:timeLabel(report.start)+' 至 '+timeLabel(report.end),name:'正能量热点周报 · '+report.region,isCustom:true}))].sort((a,b)=>(b.publishedAt||b.date+' 16:00:00').localeCompare(a.publishedAt||a.date+' 16:00:00'));
 }
 function reportCard(r){
  const cover=`<button type="button" class="report-cover${r.isCustom?' report-cover-custom':''}" data-report-action="open" data-id="${r.id}">${r.isCustom?'<span class="report-custom-badge">自定义</span>':''}<h2>${esc(r.name||('正能量热点'+(state.period==='daily'?'日报':'周报 · 舟山')))}</h2><p>${esc(r.label)}</p><span class="report-cover-preview">预览</span></button>`;
  return r.isCustom?`<article class="report-card">${cover}${btn('删除','custom-delete',`data-id="${r.id}" class="report-delete" aria-label="删除自定义报告 ${esc(r.label)}"`)}</article>`:cover;
 }
 function requestCustomDelete(id){
  const report=state.savedReports.find(item=>item.id===id);if(!report)return;
  modal('删除自定义报告',`<p>确定删除这份自定义报告吗？</p><p id="reportDeleteError" class="report-storage-error" role="alert" hidden></p><div class="report-bottom">${btn('取消','cancel')}${btn('确认删除','confirm-custom-delete',`data-id="${report.id}" class="report-primary report-danger"`)}</div>`);
  root.querySelector('.report-dialog').classList.add('report-confirm-dialog');
 }
 function deleteCustom(id,button){
  button.disabled=true;button.textContent='正在删除…';
  const result=reportStore.remove(id);
  if(!result.ok){button.disabled=false;button.textContent='确认删除';const error=root.querySelector('#reportDeleteError');error.hidden=false;error.textContent=result.error;return;}
  state.savedReports=result.reports;state.savedLoadError='';
  if(state.customReport?.id===id)state.customReport=null;
  state.listMessage=result.deleted?'自定义报告已删除':'该自定义报告已移除';
  render(root);root.querySelector('#weeklyQueryToggle')?.focus({preventScroll:true});
 }
 function saveCustom(){
  const report=state.customReport,button=root.querySelector('[data-report-action="custom-save"]');
  if(!report||!button||button.disabled)return;
  button.disabled=true;button.textContent='正在保存…';
  const result=reportStore.save({...report,savedAt:beijingNow()});
  if(!result.ok){button.disabled=false;button.textContent='保存到列表';const feedback=root.querySelector('#reportSaveFeedback');feedback.hidden=false;feedback.classList.add('error');feedback.textContent=result.error;const body=root.querySelector('.report-dialog-body');body.scrollTop=body.scrollHeight;return;}
  state.customReport=result.report;
  const latest=reportStore.list();
  state.savedReports=latest.ok?latest.reports:[result.report,...state.savedReports.filter(item=>item.id!==result.report.id)];
  state.savedLoadError=latest.ok?'':latest.error;state.listMessage='';state.page=1;
  // Refresh the list while retaining the open report and its reading position.
  const overlay=root.querySelector('.report-overlay'),body=overlay.querySelector('.report-dialog-body'),scrollTop=body.scrollTop;
  overlay.remove();render(root);root.append(overlay);body.scrollTop=scrollTop;
  button.textContent='已保存';button.disabled=true;
  const savedDate=result.report.savedAt.slice(0,10),visible=(!state.start||savedDate>=state.start)&&(!state.end||savedDate<=state.end);
  const feedback=root.querySelector('#reportSaveFeedback');feedback.hidden=false;feedback.classList.remove('error');feedback.textContent=visible?'已保存到周报列表':'已保存到周报列表，当前发布时间筛选未包含该报告。';
  focusBefore=root.querySelector(`[data-id="${result.report.id}"]`)||root.querySelector('#weeklyQueryToggle');
  root.querySelector('[data-report-action="custom-download"]').focus({preventScroll:true});
  body.scrollTop=body.scrollHeight;
 }
 function downloadCustom(){
  const r=state.customReport;if(!r)return;
  const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>自定义周报 · 独立演示数据</title><style>body{max-width:1000px;margin:40px auto;padding:0 24px;color:#303133;font:16px/1.9 serif}h2,.report-doc-date{text-align:center}h3{margin-top:28px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f7fa}.report-sample{font-size:13px;color:#666}.report-source-note{padding:12px;background:#f5f7fa}</style><article>'+customContent(r)+'</article></html>';
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download=`舟山自定义周报_演示_${r.start.replace(/[:T]/g,'-')}_${r.end.replace(/[:T]/g,'-')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function canQuery(){return state.weeklyPermission&&state.mode==='auto'&&state.period==='weekly';}
 function setWeeklyPermission(enabled){
  state.weeklyPermission=enabled===true;
  generationSequence++;
  state.generating=false;
  if(!state.weeklyPermission){state.customExpanded=false;state.queryError='';}
  if(root)render(root);
 }
 async function generateCustom(){
  if(!canQuery()||!state.customExpanded||state.generating)return;
  const startInput=root.querySelector('#weeklyStart'),endInput=root.querySelector('#weeklyEnd');
  if(!startInput||!endInput)return;
  state.customStart=startInput.value;state.customEnd=endInput.value;
  const sequence=++generationSequence;
  state.queryError='';state.listMessage='';state.generating=true;render(root);
  // Let the loading state paint, then recheck permission before calculating.
  await new Promise(resolve=>setTimeout(resolve,0));
  if(sequence!==generationSequence)return;
  if(!canQuery()){state.generating=false;render(root);return;}
  try{
   const result=window.WeeklyReportModel.buildReport({start:state.customStart,end:state.customEnd},demo);
   state.generating=false;
   if(!result.ok){state.queryError=result.error;render(root);root.querySelector(!state.customStart?'#weeklyStart':!state.customEnd?'#weeklyEnd':'#weeklyStart')?.focus();return;}
   result.id=newReportId();result.generatedAt=beijingNow();state.customReport=result;
   render(root);previewCustom();
  }catch{
   state.generating=false;state.queryError='报告生成失败，请重试。';render(root);
  }
 }
 function render(target){root=target;close();
  if(state.detail){const r=state.detail;root.innerHTML=`<section class="report-workspace report-detail">${btn('‹ 返回','back')}<h1>正能量热点日报</h1><p class="report-doc-date">${r.date} 00:00 ~ ${r.end} 00:00</p><div class="report-tabs" role="tablist">${['topics','events'].map((x,i)=>btn(['正能量热点话题','正能量热点事件'][i],'detail-tab',`data-value="${x}" role="tab" aria-selected="${state.detailTab===x}" class="${state.detailTab===x?'active':''}"`)).join('')}</div>${state.detailTab==='topics'?`<div class="report-topic-tools">${btn('批量移除','remove','disabled')}<span>正能量热点日报默认选择近24小时来自微博、抖音以及热门稿件传播量前10的内容</span></div>${table(['<input type="checkbox" disabled aria-label="全选话题">','正能量热点话题','原文地址','类型','来源渠道','传播量','时间','操作'],'')}<p class="report-count">共 0 条记录 第 1 / 1 页</p>`:`<div class="report-events">${events.map((e,i)=>`<section><p>${esc(e)}</p>${btn(state.editing===i?'点评':'评论','comment',`data-index="${i}"`)}${state.editing===i?`<textarea data-comment="${i}" aria-label="事件${i+1}点评" placeholder="请输入内容">${esc(state.comments[r.id+':'+i]||'')}</textarea>`:state.comments[r.id+':'+i]?`<blockquote>${esc(state.comments[r.id+':'+i])}</blockquote>`:''}</section>`).join('')}</div>`}<div class="report-bottom">${btn('预览','preview','class="report-primary"')}</div></section>`;bind();return;}
  const all=state.mode==='manual'?state.manual:state.period==='daily'?daily:weeklyRecords();
  const customMode=canQuery();
  const rows=all.filter(r=>(!state.start||r.date>=state.start)&&(!state.end||r.date<=state.end));const pages=Math.max(1,Math.ceil(rows.length/9));state.page=Math.min(state.page,pages);
  root.innerHTML=`<section class="report-workspace" aria-label="正能量热点报告"><div class="report-tabs" role="tablist">${['auto','manual'].map((x,i)=>btn(['自动报告','人工报告'][i],'mode',`data-value="${x}" class="${state.mode===x?'active':''}" role="tab" aria-selected="${state.mode===x}"`)).join('')}</div><div class="report-filters"><label>发布时间：<span class="report-date"><input type="date" aria-label="报告开始日期" value="${state.start}"><span>至</span><input type="date" aria-label="报告结束日期" value="${state.end}"></span></label>${state.mode==='manual'?btn('上传','upload','class="report-primary"'):`<div class="report-filter-actions">${customMode?btn(state.customExpanded?'收起自定义查询':'自定义时间查询','toggle-custom',`id="weeklyQueryToggle" class="report-secondary" aria-controls="weeklyQueryForm" aria-expanded="${state.customExpanded}" ${state.generating?'disabled':''}`):''}<div class="report-period">${['daily','weekly'].map((x,i)=>btn(['日报','周报'][i],'period',`data-value="${x}" class="${state.period===x?'active':''}" aria-pressed="${state.period===x}"`)).join('')}</div></div>`}</div>${customMode?customForm():''}${customMode&&state.savedLoadError?`<p class="report-storage-error" role="alert">${esc(state.savedLoadError)}</p>`:''}${state.listMessage?`<p class="report-list-feedback" role="status">${esc(state.listMessage)}</p>`:''}<div class="report-grid">${rows.slice((state.page-1)*9,state.page*9).map(reportCard).join('')||'<div class="report-empty">暂无数据</div>'}</div>${rows.length?`<nav class="report-pagination" aria-label="报告分页"><span>共 ${rows.length} 条</span>${btn('‹','page',`data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="报告上一页"`)}${Array.from({length:pages},(_,i)=>btn(String(i+1),'page',`data-page="${i+1}" class="${state.page===i+1?'active':''}" aria-current="${state.page===i+1?'page':'false'}"`)).join('')}${btn('›','page',`data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="报告下一页"`)}</nav>`:''}<p class="report-preview-note">既有报告能力 · 演示数据；自定义报告可保存至当前浏览器，附件与点评仅在本次预览中保留</p></section>`;bind();
 }
 function bind(){root.onclick=e=>{const b=e.target.closest('[data-report-action]');if(!b||b.disabled)return;const a=b.dataset.reportAction;
  if(['mode','period','page','open','toggle-custom'].includes(a))state.listMessage='';
  if(a==='custom-delete'){requestCustomDelete(b.dataset.id);return;}
  if(a==='confirm-custom-delete'){deleteCustom(b.dataset.id,b);return;}
  if(a==='close'||a==='cancel'){close();selectedFile=null;return;}
  if(a==='preview'){preview(state.detail);return;}
  if(a==='toggle-custom'){if(!canQuery()||state.generating)return;state.customExpanded=!state.customExpanded;render(root);root.querySelector('#weeklyQueryToggle').focus();return;}
  if(a==='custom-download'){downloadCustom();return;}
  if(a==='custom-save'){saveCustom();return;}
  if(a==='upload'){selectedFile=null;modal('上传',`<label class="report-upload-pick">点击上传<input type="file" id="reportUpload" aria-label="选择报告附件"></label><p>上传说明：支持上传一个附件，每个附件不超过50M</p><p id="reportFileName" role="status"></p><p class="report-sample">附件只在本地演示中使用，不上传到服务器。</p><div class="report-bottom">${btn('取 消','cancel')}${btn('确 定','confirm-upload','class="report-primary" disabled')}</div>`);root.querySelector('#reportUpload').onchange=e=>{const file=e.target.files[0];selectedFile=file&&file.size<=50*1024*1024?file:null;root.querySelector('#reportFileName').textContent=selectedFile?file.name:file?'附件不能超过50M':'请选择附件';root.querySelector('[data-report-action="confirm-upload"]').disabled=!selectedFile;};return;}
  if(a==='confirm-upload'){if(!selectedFile)return;const now=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());state.manual.unshift({id:'m'+Date.now(),date:now,label:now,name:selectedFile.name,file:selectedFile});selectedFile=null;state.start='';state.end='';state.page=1;close();}
  if(a==='open'){const r=[...daily,...weekly,...state.manual,...state.savedReports].find(x=>x.id===b.dataset.id);if(!r)return;if(r.id.startsWith('custom-')){previewCustom(r);return;}if(r.id.startsWith('w')){preview(r);return;}if(r.file){const url=URL.createObjectURL(r.file);modal('报告附件',`<p>${esc(r.name)}</p><a class="report-primary" href="${url}" download="${esc(r.name)}">下载附件</a>`);root.querySelector('[data-report-action="close"]').addEventListener('click',()=>URL.revokeObjectURL(url),{once:true});return;}state.detail=r;state.detailTab='topics';state.editing=-1;}
  if(a==='back')state.detail=null;
  if(a==='detail-tab')state.detailTab=b.dataset.value;
  if(a==='comment')state.editing=Number(b.dataset.index);
  if(a==='mode'){state.mode=b.dataset.value;state.page=1;state.customExpanded=false;}
  if(a==='period'){state.period=b.dataset.value;state.page=1;state.customExpanded=false;}
  if(a==='page')state.page=Number(b.dataset.page);
  render(root);
 };
 root.oninput=e=>{
  if(e.target.matches('[data-comment]'))state.comments[state.detail.id+':'+e.target.dataset.comment]=e.target.value;
  if(e.target.id==='weeklyStart'||e.target.id==='weeklyEnd'){
   state[e.target.id==='weeklyStart'?'customStart':'customEnd']=e.target.value;state.queryError='';
   const error=root.querySelector('#weeklyQueryError');if(error)error.hidden=true;
  }
 };
 root.onkeydown=e=>{const overlay=root.querySelector('.report-overlay');if(!overlay)return;if(e.key==='Escape'){close();return;}if(e.key==='Tab'){const controls=[...overlay.querySelectorAll('button:not(:disabled),a,input')],first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 const customQuery=root.querySelector('#weeklyQueryForm');if(customQuery)customQuery.onsubmit=e=>{e.preventDefault();generateCustom();};
 const inputs=root.querySelectorAll('.report-date input');inputs.forEach(input=>input.onchange=()=>{const start=inputs[0].value,end=inputs[1].value;inputs.forEach(el=>el.setCustomValidity(''));if(start&&end&&start>end){input.setCustomValidity('开始日期不能晚于结束日期');input.reportValidity();return;}state.start=start;state.end=end;state.page=1;state.listMessage='';render(root);});
 }
 window.ReportView={render,setWeeklyPermission};
})();
