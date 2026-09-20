'use strict';
// Captured role content and source assets, 2026-09-20. No authenticated URLs retained.
const ROLE_UI={
 visitor:{name:'普通用户',subtitle:'您的逛展贴心小助手',title:'展会速览',tagline:'观展一站式指南',features:[['展会速览','action-overview'],['展区介绍','visitor-action-zone'],['活动日程','visitor-action-schedule'],['展商推荐','visitor-action-exhibitor'],['首发首秀','visitor-action-launch'],['伴游导航','action-navigation'],['一键亮码','action-checkin'],['UGC活动','visitor-action-schedule']],quick:['逛展服务','打卡活动','通用权益'],questions:['智慧空间展区有什么沉浸体验？','数字文娱展区的看点和互动环节？','丝路电商展区的核心亮点是什么？','停车场和服务台离我最近的是哪里？']},
 exhibitor:{name:'展商',subtitle:'您的展会服务专属助手',title:'展商服务',tagline:'专属服务，参展无忧',features:[['产业对接','action-handshake'],['供采大厅','action-supply'],['商机匹配','action-target'],['首发首秀','action-rocket'],['伴游导航','action-navigation'],['智能创作','exhibitor-action-create'],['传播投手','exhibitor-action-promotion'],['一键亮码','action-checkin'],['公共素材库','exhibitor-action-library']],quick:['逛展服务','DT奖','参展权益'],questions:['智慧空间展区有什么沉浸体验？','请整理适合媒体报道的现场亮点。','今天有哪些值得推荐的活动安排？','帮我梳理适合宣传稿的展区和企业名单。']},
 trader:{name:'客商',subtitle:'您的采购与商贸对接助手',title:'客商服务',tagline:'精准选品，高效对接',features:[['供采大厅','action-supply'],['智能选品','action-selection'],['展商搜索','action-exhibitor-search'],['产业对接','action-handshake'],['伴游导航','action-navigation'],['一键亮码','action-checkin']],quick:['逛展服务','展会回访','参展权益'],questions:['帮我推荐适合采购的数字贸易展品。','有哪些展商与我的采购需求匹配？','今天有哪些产业对接活动？','如何快速找到目标展商的展位？']},
 media:{name:'媒体',subtitle:'您的媒体采编与传播助手',title:'媒体服务',tagline:'聚焦现场，高效传播',features:[['媒体手册','action-overview'],['智能创作','exhibitor-action-create'],['现场素材','action-gallery'],['活动日程','visitor-action-schedule'],['传播热点','action-hotspot'],['一键亮码','action-checkin'],['公共素材库','exhibitor-action-library']],quick:['逛展服务','参展权益'],questions:['帮我整理今天最值得报道的展会热点。','有哪些适合现场采访的企业和嘉宾？','请生成一份数字贸易大会新闻提纲。','今天有哪些重要活动适合跟拍？']}
};
let currentRole='visitor',questionOffset=0,toastTimer;
function uiToast(text){const toast=document.getElementById('uiToast');toast.textContent=text;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2400);}
function showRoleHome(key){
 currentRole=key;questionOffset=0;const cfg=ROLE_UI[key],phone=document.getElementById('phone');phone.dataset.role=key;
 document.getElementById('roleSubtitle').textContent=cfg.subtitle;
 document.getElementById('featureTitle').textContent=cfg.title;document.getElementById('featureTagline').textContent=cfg.tagline;
 document.getElementById('featureGrid').innerHTML=cfg.features.map(([name,asset])=>'<button type="button" class="feature" data-feature="'+name+'"><img alt="" src="assets/'+asset+'.png"><span>'+name+'</span></button>').join('');
 document.getElementById('quickActions').innerHTML=cfg.quick.map((name,i)=>'<button type="button" data-quick="'+name+'">'+name+(i===0?'<img alt="" src="assets/chevron-right.svg">':'')+'</button>').join('');
 document.getElementById('role').value=key;document.querySelectorAll('[data-role-switch]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.roleSwitch===key)));
 document.getElementById('voiceMenu').hidden=true;document.getElementById('languageMenu').hidden=true;document.getElementById('serviceMenu').hidden=true;renderQuestions();
}
function renderQuestions(){const cfg=ROLE_UI[currentRole];document.getElementById('questions').innerHTML=cfg.questions.map((_,i)=>{const q=cfg.questions[(i+questionOffset)%cfg.questions.length];return '<button type="button" class="source-question" data-question="'+q+'"><img class="tinted" src="assets/visitor-question-icon.png" alt=""><span>'+q+'</span></button>';}).join('');}
