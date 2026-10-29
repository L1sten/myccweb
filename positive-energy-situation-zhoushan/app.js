/* Standalone Zhoushan weekly report prototype; local demonstration only. */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let toastTimer, priorFocus;
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
  function openModal(title,content){priorFocus=document.activeElement;$('modalTitle').textContent=title;$('modalContent').innerHTML=content;$('modalMask').hidden=false;$('closeModal').focus();}
  function closeModal(){$('modalMask').hidden=true;if(priorFocus?.isConnected)priorFocus.focus();}
  $('closeModal').addEventListener('click',closeModal);
  $('modalMask').addEventListener('click',e=>{if(e.target===$('modalMask'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalMask').hidden)closeModal();});
  $('weeklyPermission').addEventListener('change',e=>window.ReportView.setWeeklyPermission(e.target.checked));
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
  $('downloadPrd').addEventListener('click',()=>{const a=document.createElement('a');a.href='PRD.md';a.download='舟山自定义周报-PRD.md';document.body.appendChild(a);a.click();a.remove();toast('已发起 PRD 下载');});
  $('changeLog').addEventListener('click',()=>{const entries=JSON.parse($('changelogData').textContent);openModal('更新记录',entries.length?entries.map(item=>`<p><small>${esc(item.time)}</small></p><p>${esc(item.description)}</p>`).join(''):'<p>暂无发布记录</p>');});
  const drag=$('splitDrag'),panel=$('prdPanel');
  function setWidth(value){const width=Math.max(300,Math.min(window.innerWidth*.7,value));panel.style.width=width+'px';drag.setAttribute('aria-valuenow',String(Math.round(width)));drag.setAttribute('aria-valuemax',String(Math.round(window.innerWidth*.7)));}
  drag.addEventListener('pointerdown',e=>{e.preventDefault();const initial=e.clientX,width=panel.getBoundingClientRect().width;drag.classList.add('dragging');document.body.style.userSelect='none';document.body.style.cursor='col-resize';function move(ev){setWidth(width+initial-ev.clientX);}function up(){document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);document.body.style.userSelect='';document.body.style.cursor='';drag.classList.remove('dragging');}document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);});
  drag.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setWidth(panel.getBoundingClientRect().width+(e.key==='ArrowLeft'?25:-25));}});
  renderMarkdown($('prdMdSource').textContent);
  window.ReportView.render($('viewRoot'));
});
