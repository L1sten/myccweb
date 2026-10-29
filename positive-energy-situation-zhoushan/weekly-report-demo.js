/* Independent, synthetic detail records for local custom-period report testing.
 * Never derive timestamps or daily values from the published Zhoushan snapshot.
 */
(function(root,factory){
 const data=factory();
 if(typeof module==='object'&&module.exports)module.exports=data;
 else root.WeeklyReportDemo=data;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const dataset={
  region:'舟山',label:'独立演示明细 · 非线上真实数据',
  coverage:{start:'2026-10-01T00:00',end:'2026-10-29T00:00'},
  defaultRange:{start:'2026-10-21',end:'2026-10-28'},
  information:[],events:[],submissions:[],activities:[]
 };
 const accounts=[
  {id:'demo-a1',name:'定海示例融媒',region:'定海'},
  {id:'demo-a2',name:'普陀示例发布',region:'普陀'},
  {id:'demo-a3',name:'岱山示例融媒',region:'岱山'},
  {id:'demo-a4',name:'嵊泗示例发布',region:'嵊泗'}
 ];
 const titles=['海岛志愿服务温暖社区','公共阅读空间迎来新读者','渔港便民服务走进居民生活','青年共建文明街区','绿色出行让城市更宜居','社区食堂守护长者日常','海洋文化活动走进校园'];
 for(let day=1;day<=28;day++){
  const date='2026-10-'+String(day).padStart(2,'0');
  const at=time=>date+'T'+time+':00+08:00';
  for(let i=0;i<20+day%7;i++)dataset.information.push({id:`demo-info-${day}-${i}`,at:at(String(8+i%12).padStart(2,'0')+':'+String(i%6*10).padStart(2,'0')),sentiment:i%9===0?'neutral':i%13===0?'negative':'positive'});
  for(let i=0;i<2;i++){
   const account=accounts[(day+i)%accounts.length];
   dataset.events.push({id:`demo-event-${day}-${i}`,at:at(i?'17:00':'10:00'),title:`【演示】${titles[(day+i)%titles.length]}（${day}日）`,region:account.region,host:account.name,views:day===12&&i===1?null:(day%6+1)*1000000+i*350000});
  }
  for(let i=0;i<3;i++){
   const account=accounts[(day+i)%accounts.length];
   dataset.submissions.push({id:`demo-submission-${day}-${i}`,at:at(['09:20','13:00','18:10'][i]),account:account.name,topicRelated:(day+i)%2===0});
   dataset.activities.push({id:`demo-activity-${day}-${i}`,at:at(['09:40','14:00','19:00'][i]),accountId:account.id,name:account.name,region:account.region});
  }
 }
 return dataset;
});
