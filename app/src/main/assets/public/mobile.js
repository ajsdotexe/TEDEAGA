(function(){
  let alarmTimer;
  const nativeAlarms = async function(state){
    const native=window.TEDEAGANative;
    if(!native?.Capacitor?.isNativePlatform?.()||!native?.LocalNotifications)return;
    const LN=native.LocalNotifications;
    try{
      const status=await LN.checkPermissions();
      if(status.display!=='granted'){
        const asked=await LN.requestPermissions();
        if(asked.display!=='granted')return;
      }
      const old=JSON.parse(localStorage.getItem('tedeaga-native-alarm-ids')||'[]');
      if(old.length)await LN.cancel({notifications:old.map(id=>({id}))});
      const active=(state?.alarms||[]).filter(a=>a.on&&!a.tmp&&/^\d{2}:\d{2}$/.test(a.time||''));
      const now=new Date(),scheduled=[];
      const idFor=(a,dow)=>{let h=2166136261;for(const c of String(a.id)+':'+dow)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%2147483646+1};
      const make=(a,dow,at)=>({id:idFor(a,dow),title:'⏰ '+(a.label||'Alarme'),body:'TEDEAGA · '+a.time,schedule:at?{at,allowWhileIdle:true}:{on:{...(dow<0?{}:{weekday:dow}),hour:+a.time.slice(0,2),minute:+a.time.slice(3,5)},allowWhileIdle:true}});
      for(const a of active){
        if(a.freq==='once'){
          const localDate=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
          const at=new Date((a.date||localDate(now))+'T'+a.time+':00');
          if(!a.date&&at<=now)at.setDate(at.getDate()+1);
          if(at>now)scheduled.push(make(a,-1,at));
        }else{
          const days=a.freq==='weekdays'?[2,3,4,5,6]:a.freq==='weekends'?[1,7]:a.freq==='custom'?(a.days||[1,2,3,4,5]).map(d=>d===0?1:d+1):[0];
          for(const dow of days)scheduled.push(make(a,dow,-1));
        }
      }
      if(scheduled.length)await LN.schedule({notifications:scheduled});
      localStorage.setItem('tedeaga-native-alarm-ids',JSON.stringify(scheduled.map(n=>n.id)));
    }catch(e){console.warn('TEDEAGA alarm sync',e)}
  };
  window.mobileSyncAlarms=state=>{clearTimeout(alarmTimer);alarmTimer=setTimeout(()=>nativeAlarms(state),500)};
  const native=window.TEDEAGANative;
  const isNative=()=>!!native?.Capacitor?.isNativePlatform?.();
  window.mobileSyncWidget=async state=>{
    if(!isNative()||!native?.AndroidWidget)return;
    const now=new Date(),ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const due=(state?.fixed||[]).filter(f=>!(f.paid&&f.paid[ym])).map(f=>{const day=Math.min(+f.day||1,dim),diff=Math.round((new Date(now.getFullYear(),now.getMonth(),day)-today)/86400000);return{...f,day,diff}}).filter(f=>f.diff<=7).sort((a,b)=>a.day-b.day).slice(0,4);
    const lines=due.map(f=>f.name+' · '+(f.diff<0?'Atrasada':f.diff===0?'Hoje':'em '+f.diff+' d'));
    try{await native.AndroidWidget.update({text:lines.join('\n')||'Nenhuma conta pendente.'})}catch(e){console.warn('TEDEAGA widget sync',e)}
  };
  const storedGoogle=()=>{try{return JSON.parse(localStorage.getItem('tedeaga-g')||'{}')}catch(e){return {}}};
  const storeGoogle=o=>{try{localStorage.setItem('tedeaga-g',JSON.stringify({...storedGoogle(),...o}))}catch(e){}};
  const getSecret=async key=>{if(isNative()){const r=await native.SecureStore.get({key});return r.value||''}return sessionStorage.getItem(key)||''};
  const setSecret=async(key,value)=>{if(isNative()){if(value)await native.SecureStore.set({key,value});else await native.SecureStore.remove({key})}else if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key)};
  const http=async(url,method='GET',data,headers={},responseType='json')=>{
    if(!isNative())throw new Error('Disponível no app Android.');
    const r=await native.CapacitorHttp.request({url,method,headers,data,responseType});
    if(r.status<200||r.status>=300){const body=typeof r.data==='string'?r.data:JSON.stringify(r.data||{});throw new Error('Google '+r.status+': '+body.slice(0,160))}
    return r.data;
  };
  const drive=async(path,method='GET',data,headers={},responseType='json')=>{
    const auth=await native.GoogleDriveAuth.authorize();
    return http(path,method,data,{authorization:'Bearer '+auth.accessToken,...headers},responseType);
  };
  const DRIVE='https://www.googleapis.com/drive/v3/files',UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
  const listDrive=async query=>{const q=query+" and 'appDataFolder' in parents and trashed=false";const r=await drive(DRIVE+'?spaces=appDataFolder&q='+encodeURIComponent(q)+'&fields=files(id,name,modifiedTime)&pageSize=100');return r.files||[]};
  const putDrive=async(name,content)=>{
    const existing=(await listDrive("name='"+name.replace(/'/g,"\\'")+"'"))[0];
    if(existing){await drive(UPLOAD+'/'+existing.id+'?uploadType=media','PATCH',content,{'content-type':'application/json'},'text');return existing.id}
    const boundary='tdg'+Date.now(),body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name,parents:['appDataFolder']})+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+content+'\r\n--'+boundary+'--';
    const r=await drive(UPLOAD+'?uploadType=multipart&fields=id','POST',body,{'content-type':'multipart/related; boundary='+boundary});return r.id;
  };
  const getDrive=async id=>drive(DRIVE+'/'+encodeURIComponent(id)+'?alt=media','GET',undefined,{},'text');
  const googleAuth=async()=>{if(!isNative())throw new Error('Entre pelo app Android para conectar o Google.');return native.GoogleDriveAuth.authorize()};
  const googleProfile=async()=>{
    try{const a=await googleAuth(),u=await http('https://www.googleapis.com/oauth2/v3/userinfo','GET',undefined,{authorization:'Bearer '+a.accessToken});storeGoogle({signed:true,name:u.name||'Conta Google',email:u.email||'',picture:u.picture||''});return u}
    catch(e){throw e}
  };
  window.desktop={
    userName:async()=>localStorage.getItem('tedeaga-mobile-name')||'Você',
    hasKey:async()=>!!(await getSecret('anthropic-api-key')),
    setKey:async key=>{await setSecret('anthropic-api-key',String(key||'').trim());return !!String(key||'').trim()},
    getModel:async()=>localStorage.getItem('tedeaga-ai-model')||'',
    setModel:async model=>{localStorage.setItem('tedeaga-ai-model',String(model||'').trim());return true},
    ai:async body=>{
      if(!isNative())return{error:'none'};
      const key=await getSecret('anthropic-api-key');if(!key)return{error:'nokey'};
      try{const model=localStorage.getItem('tedeaga-ai-model')||'claude-sonnet-5-5';const data=await native.CapacitorHttp.request({url:'https://api.anthropic.com/v1/messages',method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},data:{...body,model},responseType:'json'});if(data.status<200||data.status>=300){const err=data.data?.error;return{error:data.status===401?'badkey':data.status===429?'rate':'http',message:err?.message||''}}return{data:data.data}}
      catch(e){return{error:'network',message:String(e.message||e)}}
    },
    gStatus:async()=>{const g=storedGoogle();return{configured:true,signed:!!g.signed,email:g.email||'',name:g.name||'',picture:g.picture||''}},
    gSetConfig:async()=>true,
    gClearConfig:async()=>{try{if(isNative())await native.GoogleDriveAuth.revoke()}catch(e){}localStorage.removeItem('tedeaga-g');return true},
    gLogin:async()=>{await googleProfile();return true},
    gLogout:async()=>{try{if(isNative())await native.GoogleDriveAuth.revoke()}finally{localStorage.removeItem('tedeaga-g')}return true},
    gPush:async text=>{try{await putDrive('tedeaga-sync.json',text);return{ok:true}}catch(e){return{error:String(e.message||e)}}},
    gPull:async()=>{try{const f=(await listDrive("name='tedeaga-sync.json'"))[0];return f?{data:await getDrive(f.id),modified:f.modifiedTime}:{data:null}}catch(e){return{error:String(e.message||e)}}},
    gBackup:async(text,day)=>{try{await putDrive('tedeaga-backup-'+day+'.json',text);const files=(await listDrive("name contains 'tedeaga-backup-'" )).sort((a,b)=>b.name.localeCompare(a.name));for(const f of files.slice(7)){try{await drive(DRIVE+'/'+f.id,'DELETE')}catch(e){}}return{ok:true}}catch(e){return{error:String(e.message||e)}}},
    gList:async()=>{try{return(await listDrive("name contains 'tedeaga-backup-'" )).sort((a,b)=>b.name.localeCompare(a.name))}catch(e){return{error:String(e.message||e)}}},
    gGet:async id=>{try{return{data:await getDrive(id)}}catch(e){return{error:String(e.message||e)}}},
    wOpen:async()=>false,wClose:async()=>false,wPin:async()=>false,wState:async()=>({open:[]}),getLogin:async()=>false,setLogin:async()=>false
  };
  window.claude={use:async function(name){
    if(name==='downloads')return{save:async function({filename,data}){const n=window.TEDEAGANative;if(n?.Capacitor?.isNativePlatform?.()){const f=await n.Filesystem.writeFile({path:filename,data,directory:n.Directory.Cache,encoding:n.Encoding.UTF8});await n.Share.share({title:filename,text:'Backup TEDEAGA',files:[f.uri],dialogTitle:'Salvar backup'});return}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download=filename;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}};
    if(name==='user')return{me:async()=>({name:localStorage.getItem('tedeaga-mobile-name')||'Você',email:''})};
    return null;
  }};
  window.deskBtn=()=>'';
  if('serviceWorker' in navigator && location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
