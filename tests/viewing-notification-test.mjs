import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DSH_NOTIFY_ALL_DRY_RUN='1';
const {apply,DEFAULTS,Config}=await import('../lib/index.js');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-notify-viewing-')),events=new Map(),routes=new Map(),cleanups=[];
const mutable={...DEFAULTS};
const config=Object.fromEntries(Object.keys(mutable).map(k=>[k,{get:()=>mutable[k]}]));
const connection={authenticatedUrl:u=>u,fetch:{register:r=>{routes.set(r.path,r);return()=>routes.delete(r.path);}}};
const ctx={connection,get:k=>({profileContext:{home:temp},webServer:{port:12345}})[k],effect:fn=>{const off=fn();if(typeof off==='function')cleanups.push(off);},on:(e,fn)=>{events.set(e,fn);cleanups.push(()=>events.delete(e));},inject:()=>{}};
apply(ctx,config);let seq=0,passed=0;
const check=(condition,label)=>{assert(condition,label);passed++;console.log('PASS '+label);};
const logFile=path.join(temp,'dsh-notify-all/log.txt');
const logs=()=>fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8'):'';
const viewer=async(sid,focused=true,desktop=true)=>{const r=await routes.get('/api/dsh-notify-all/viewer').fetch(new Request('http://localhost/api/dsh-notify-all/viewer',{method:'POST',body:JSON.stringify({clientId:'viewer',sessionId:sid,selectedSessionId:sid,focused,desktop})}));assert.equal(r.status,200);};
const fire=(sid,type='turn/end',data={reason:{kind:'completed'}})=>{const before=logs().length;events.get('session/event')({id:sid,header:{}},{type,data,seq:++seq});return logs().slice(before);};
try{
  check(Config.dict.suppressWhenViewing.meta.default===false&&Config.dict.muteWhenViewing.meta.default===false,'both focus switches default off in the native schema');
  await viewer('a');check(fire('a').includes('toast dry-run completion')&&logs().includes('sound=true'),'default still notifies with sound in the focused current conversation');
  mutable.muteWhenViewing=true;let out=fire('a');check(out.includes('toast dry-run completion')&&out.includes('sound=false'),'mute switch still sends the current conversation toast with native silent audio');
  out=fire('b');check(out.includes('toast dry-run completion')&&out.includes('sound=true'),'different conversation retains sound');
  await viewer('a',false);check(fire('a').includes('sound=true'),'DSH without focus retains sound');
  await viewer('a',true,false);check(fire('a').includes('sound=true'),'a focused browser page cannot mute DSH desktop notifications');
  await viewer('a');mutable.suppressWhenViewing=true;
  check(!fire('a').includes('toast dry-run'),'suppression takes precedence when both switches are on');
  check(fire('b').includes('toast dry-run'),'suppression only applies to the exact conversation ID');
  let before=logs().length;fire('a','approval/asked',{id:'approve',toolName:'shell'});
  check(!logs().slice(before).includes('toast dry-run')&&JSON.parse(fs.readFileSync(path.join(temp,'dsh-notify-all/state.json'))).waits.length===1,'suppressed approval keeps its pending badge');
  fire('a','approval/decided',{id:'approve'});
  await viewer(null);check(fire('a').includes('toast dry-run'),'other DSH panels do not suppress a hidden conversation');
  await viewer('a');const realNow=Date.now;try{Date.now=()=>realNow()+6100;check(fire('a').includes('sound=true'),'expired focus reports cannot suppress or mute notifications');}finally{Date.now=realNow;}
  mutable.completeMergeMs=40;await viewer('c');fire('b');fire('a');await viewer('a');before=logs().length;await new Promise(r=>setTimeout(r,80));
  check(!logs().slice(before).includes('toast dry-run'),'merged completion rechecks focus before it is delivered');
  mutable.muteWhenViewing=false;mutable.suppressWhenViewing=false;
  check(fire('a','turn/end',{reason:{kind:'error',message:'test'}}).includes('sound=true'),'switching both off restores error notification behavior');
  console.log(passed+' focused conversation notification checks passed; no real notifications sent');
}finally{cleanups.reverse().forEach(fn=>fn());assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));assert.equal(fs.realpathSync(temp),path.resolve(temp));fs.rmSync(temp,{recursive:true,force:true});}
