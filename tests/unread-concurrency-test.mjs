import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
process.env.DSH_NOTIFY_ALL_DRY_RUN = '1';
const {apply,DEFAULTS,SESSION_LOOKUP_TIMEOUT_MS} = await import('../lib/index.js');
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const A='session-00000000-0000-4000-8000-000000000001',B='session-00000000-0000-4000-8000-000000000002',C='session-00000000-0000-4000-8000-000000000003';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-unread-concurrency-'));
const cleanups=[],routes=new Map(),events=new Map(),cfg={...DEFAULTS};
const live=new Map([A,B].map(id=>[id,{id,header:{},running:id===A}]));
let listCalls=0,lookupSignal,resolveLookup;
const effect=fn=>{const off=fn();if(typeof off==='function')cleanups.push(off);return off;};
const ctx={fiber:{},get:key=>({profileContext:{home:temp},sessions:{get:id=>live.get(id)},
  sessionQuery:{listSessions:signal=>{listCalls++;lookupSignal=signal;return new Promise(resolve=>{resolveLookup=resolve;});}}})[key],
  effect,on:(event,fn)=>events.set(event,fn),inject:()=>{},
  connection:{fetch:{register:r=>{routes.set(r.path,r);return()=>routes.delete(r.path);}}},
};
apply(ctx,cfg);
const post=async(action,body,signal)=>{
  const response=await routes.get('/api/dsh-notify-all/'+action).fetch(new Request('http://localhost/',{method:'POST',body:JSON.stringify(body),signal}));
  return {code:response.status,data:await response.json()};
};
const mark=id=>post('unread',{sessionId:id,clientId:'desktop',selectedSessionId:A,viewEpoch:0});
const viewer=()=>post('viewer',{clientId:'desktop',sessionId:A,selectedSessionId:A,viewEpoch:0,focused:true});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const state=()=>JSON.parse(fs.readFileSync(path.join(temp,'dsh-notify-all','state.json')));
try {
  await viewer();
  const running=live.get(A),before={...running};
  const marked=await mark(A);
  check('running conversation is marked immediately without persistence listing',()=>{assert.equal(marked.code,200);assert.equal(listCalls,0);});
  check('marking unread cannot modify running state or Session object',()=>assert.deepEqual(running,before));
  check('mark response includes state for immediate sidebar refresh',()=>assert.equal(marked.data.state.unread[0].manual,true));
  events.get('session/event')(running,{type:'turn/end',seq:1,data:{reason:{kind:'completed'}}});
  await viewer();
  check('completion preserves current conversation manual unread hold',()=>assert.deepEqual(state().unread,[[A,1]]));
  check('completion event does not overwrite DSH running status',()=>assert.equal(running.running,true));

  const start=Date.now(),slow=mark(C);await flush();
  const other=await mark(B),heartbeat=await viewer();
  check('blocked cold lookup does not serialize other unread operations',()=>{assert.equal(other.code,200);assert.equal(other.data.unread,1);});
  check('viewer heartbeats remain responsive while a lookup is pending',()=>assert.equal(heartbeat.code,200));
  const timedOut=await slow;
  check('cold lookup has a bounded timeout and cancels the provider signal',()=>{assert.equal(timedOut.code,400);assert.match(timedOut.data.error,/timed out/);assert.ok(lookupSignal.aborted);assert.ok(Date.now()-start<SESSION_LOOKUP_TIMEOUT_MS+2500);});
  resolveLookup([{header:{id:C}}]);await flush();
  check('late lookup success cannot create a phantom unread flag',()=>assert.ok(!state().manualUnread.includes(C)));

  const cancel=new AbortController(),cancelled=post('unread',{sessionId:C},cancel.signal);await flush();
  cancel.abort();const cancelResult=await cancelled;
  check('request cancellation aborts lookup and returns without changing badge',()=>{assert.equal(cancelResult.code,400);assert.ok(lookupSignal.aborted);assert.ok(!state().manualUnread.includes(C));});

  const disabled=mark(C);await flush();cfg.enabled=false;resolveLookup([{header:{id:C}}]);
  const disabledResult=await disabled;cfg.enabled=true;
  check('disabling plugin during lookup prevents a late unread mutation',()=>{assert.equal(disabledResult.code,400);assert.ok(!state().manualUnread.includes(C));});

  let exported;
  const timers=new Map(),intervals=new Set(),subscriptions=[],clientCleanups=[],listeners=[];
  const source=value=>({value,getSnapshot(){return this.value;},subscribe(fn){subscriptions.push(fn);return()=>subscriptions.splice(subscriptions.indexOf(fn),1);}});
  const current=source({key:A}),panel=source({activePanelId:null}),list=source({byId:{[A]:{id:A,title:'A'}}});
  const target={addEventListener:(key,fn)=>listeners.push([key,fn]),removeEventListener:(key,fn)=>listeners.splice(listeners.findIndex(x=>x[0]===key&&x[1]===fn),1)};
  const sandbox={window:{...target,__ModuleLoader__:{load:row=>{exported=row.factory(id=>{
    assert.equal(id,'react');return {createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_subscribe,get)=>get(),Fragment:'fragment'};
  });}}},document:{...target,hidden:false,hasFocus:()=>true},AbortController,Date,Math,
    setTimeout:(fn,ms)=>{const timer={};timers.set(timer,{fn,ms});return timer;},clearTimeout:id=>timers.delete(id),
    setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn),
  };
  vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),sandbox);
  const clientEffect=fn=>{const off=fn();if(typeof off==='function')clientCleanups.push(off);};
  const store=exported.unreadStore({effect:clientEffect});
  let publications=0;store.subscribe(()=>publications++);
  store.update(marked.data);store.update(marked.data);
  check('manual unread snapshot updates once when heartbeat state is unchanged',()=>assert.equal(publications,1));
  const dot=exported.UnreadMarker({sessionId:A,store,t:key=>key});
  check('manual unread is a static accessible dot rather than a spinner',()=>{assert.equal(dot.props.className,'dna-unread-dot');assert.equal(dot.props.role,'img');assert.equal(dot.props['aria-label'],'markedUnread');});
  check('unmarked row contributes no unread decoration',()=>assert.equal(exported.UnreadMarker({sessionId:B,store,t:key=>key}),null));
  store.update({generation:'ordering-test',revision:2,unread:[{id:B,count:1,manual:true}]});
  store.update({generation:'ordering-test',revision:1,unread:[]});
  check('older viewer response cannot erase a newly marked conversation',()=>assert.ok(store.getSnapshot().has(B)));
  store.update({generation:'restarted-host',revision:0,unread:[]});
  check('new Host generation resets response ordering after restart',()=>assert.equal(store.getSnapshot().size,0));
  store.update({unread:[{id:B,count:2,manual:false}]});
  check('automatic completion state is left to DSH native indicator',()=>assert.equal(store.getSnapshot().size,0));
  store.update(marked.data);store.update({unread:marked.data.state.unread,config:{enabled:false}});
  check('disabled plugin hides its manual markers',()=>assert.equal(store.getSnapshot().size,0));
  store.update(marked.data);
  const menu=exported.SessionMenuActions({sessionId:A,store,actions:{},t:key=>key,useMenuOpenState:()=>[true,()=>{}]});
  const nodes=[];const walk=node=>{if(Array.isArray(node))node.forEach(walk);else if(node&&typeof node==='object'){nodes.push(node);walk(node.children);}};walk(menu);
  check('reopened menu confirms unread state without a popup',()=>assert.ok(nodes.some(n=>n.type==='span'&&n.children?.includes('markedUnread'))));

  let fetchCalls=0;const requests=[];
  sandbox.fetch=async(_url,init)=>{fetchCalls++;requests.push(JSON.parse(init.body));if(fetchCalls===1)return new Promise(()=>{});return {ok:true,json:async()=>({unread:[]})};};
  const tracker=exported.trackViewer({uiSession:{current},layout:{panelInfo:panel},sessions:{list},effect:clientEffect,on:()=>{}},store);
  current.value={key:B};subscriptions.slice().forEach(fn=>fn());
  const deadline=[...timers.values()].find(timer=>timer.ms===8000);assert.ok(deadline);deadline.fn();await flush();
  check('timed out viewer request releases queue for newest selection',()=>{assert.equal(requests[1].sessionId,B);assert.equal(requests[1].viewEpoch,1);});
  check('recovered viewer clears stale manual marker snapshot',()=>assert.equal(store.getSnapshot().size,0));
  check('recovered viewer clears its transient request error',()=>assert.equal(tracker(),null));

  let clipboard='';const feedback=[];
  sandbox.navigator={clipboard:{writeText:async text=>{clipboard=text;}}};
  sandbox.fetch=async()=>({ok:true,json:async()=>marked.data});
  const actions=exported.menuActions({sessions:{list:{getSnapshot:()=>({byId:{[A]:{cwd:'C:\\workspace'}}})}},remote:{session:{openWorkspacePath:async()=>{}}}},
    {selection:()=>({clientId:'desktop',selectedSessionId:A,viewEpoch:0})},{show:(...args)=>feedback.push(args)},key=>key,store);
  await actions.copyId(A);await actions.copyLink(A);await actions.markUnread(A);await actions.openFolder(A);
  check('all successful menu operations are silent',()=>assert.equal(feedback.length,0));
  check('silent copied link still has the exact navigation ID',()=>assert.equal(clipboard,'dsh-notify-all://session/'+A));
  check('silent unread action updates sidebar immediately',()=>assert.ok(store.getSnapshot().has(A)));
  sandbox.navigator.clipboard.writeText=async()=>{throw new Error('denied');};await actions.copyId(A);
  check('failed clipboard write retains selectable recovery text',()=>{assert.equal(feedback.at(-1)[1],true);assert.equal(feedback.at(-1)[2],A);});
  clientCleanups.reverse().forEach(fn=>fn());await flush();
  check('client unload releases timers and all sidebar observers',()=>{assert.equal(timers.size,0);assert.equal(intervals.size,0);assert.equal(subscriptions.length,0);assert.equal(listeners.length,0);});

  const unloading=mark(C);await flush();cleanups.reverse().forEach(fn=>fn());
  const unloadedResult=await unloading;
  check('plugin unload cancels pending lookup without a late badge update',()=>{assert.equal(unloadedResult.code,400);assert.ok(lookupSignal.aborted);assert.ok(!state().manualUnread.includes(C));});
} finally {cleanups.reverse().forEach(fn=>fn());fs.rmSync(temp,{recursive:true,force:true});}
console.log('\n'+passed+' unread concurrency checks passed. No system notifications shown.');
