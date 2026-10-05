import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
process.env.DSH_NOTIFY_ALL_DRY_RUN = '1';
const {apply,DEFAULTS,activationSession} = await import('../lib/index.js');
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const A='session-00000000-0000-4000-8000-000000000001', B='session-00000000-0000-4000-8000-000000000002';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-session-menu-'));
const dir=path.join(temp,'dsh-notify-all'), cleanups=[],routes=new Map(),tools=new Map(),events=new Map();
const cfg={...DEFAULTS};
const effect=fn=>{const off=fn();if(typeof off==='function')cleanups.push(off);return off;};
const ctx={fiber:{},get:key=>({profileContext:{home:temp},sessionQuery:{listSessions:async()=>[A,B].map(id=>({header:{id}}))}})[key],
  effect,on:(event,fn)=>{events.set(event,fn);return()=>events.delete(event);},
  connection:{fetch:{register:r=>{routes.set(r.path,r);return()=>routes.delete(r.path);}}},
  inject:(deps,fn)=>{if(deps.includes('tools'))fn({effect,tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}});},
};
apply(ctx,Object.fromEntries(Object.keys(cfg).map(k=>[k,{get:()=>cfg[k]}])));
const post=async(action,body)=>{
 const res=await routes.get('/api/dsh-notify-all/'+action).fetch(new Request('http://localhost/',{method:'POST',body:JSON.stringify(body)}));
 return {code:res.status,data:await res.json()};
};
const state=()=>JSON.parse(fs.readFileSync(path.join(dir,'state.json')));
const count=()=>JSON.parse(fs.readFileSync(path.join(dir,'badge.json'))).count;
const view=(id,epoch,extra={})=>post('viewer',{clientId:'desktop',sessionId:id,selectedSessionId:id,viewEpoch:epoch,focused:true,...extra});
const mark=(id,selected=A,epoch=0)=>post('unread',{sessionId:id,clientId:'desktop',selectedSessionId:selected,viewEpoch:epoch});
try {
 await view(A,0);
 const logBefore=fs.readFileSync(path.join(dir,'log.txt'),'utf8');
 await mark(A); await view(A,0); await view(A,0);
 check('marking current conversation survives repeated viewer heartbeats',()=>assert.equal(count(),1));
 check('manual unread writes no system notification',()=>assert.ok(!fs.readFileSync(path.join(dir,'log.txt'),'utf8').slice(logBefore.length).includes('toast')));
 await mark(A);
 check('repeated manual marking is idempotent',()=>assert.equal(count(),1));
 await view(A,0,{sessionId:null});await view(A,0);
 check('opening and closing settings preserves manual unread',()=>assert.equal(count(),1));
 cfg.clearOnFocus=true;
 await view(A,0,{focused:false}); await view(A,0);
 check('window focus and clear-on-focus do not erase manual unread',()=>assert.equal(count(),1));
 await view(A,0,{viewEpoch:-1});
 check('invalid viewer epoch cannot release an unread hold',()=>assert.equal(count(),1));
 await view(B,1);
 check('leaving conversation retains its taskbar count',()=>assert.equal(count(),1));
 await view(A,2);
 check('returning to manually marked conversation clears it',()=>assert.equal(count(),0));
 await mark(A,A,2);await view(A,4);
 check('epoch detects leave-and-return even when an intermediate report was coalesced',()=>assert.equal(count(),0));
 await mark(B,A,4);await view(A,4,{focused:false});await view(A,4);
 check('marking another row cannot be erased by focus in current conversation',()=>assert.equal(count(),1));
 await view(B,5);
 check('opening a marked inactive row clears exactly its unread flag',()=>assert.equal(count(),0));
 await view(A,6,{focused:false});
 events.get('session/event')({id:B,header:{}},{type:'turn/end',seq:1,data:{reason:{kind:'completed'}}});
 events.get('session/event')({id:B,header:{}},{type:'turn/end',seq:2,data:{reason:{kind:'completed'}}});
 await mark(B,A,6);
 check('marking existing unread retains completion count',()=>assert.equal(count(),2));
 check('manual flags persist alongside original unread data',()=>assert.deepEqual(state().manualUnread,[B]));
 await post('viewed',{sessionId:B});
 check('explicit read removes its manual hold and count',()=>{assert.equal(count(),0);assert.equal(state().manualUnread.length,0);});
 cfg.enabled=false;const disabled=await mark(A,A,6);
 check('disabled plugin reports failure without creating phantom unread',()=>{assert.equal(disabled.code,400);assert.equal(state().unread.length,0);});cfg.enabled=true;
 const bad=await mark('session-invalid');
 check('invalid session ID is rejected by menu route',()=>assert.equal(bad.code,400));
 const absent=await mark('session-ffffffff-ffff-4fff-8fff-ffffffffffff');
 check('unknown conversation cannot create a phantom badge',()=>{assert.equal(absent.code,400);assert.equal(state().unread.length,0);});
 const toolResult=await tools.get('dsh_notify_mark_unread').execute({sessionId:B});
 check('agent tool uses same silent Host operation and return value',()=>{assert.equal(toolResult.sessionId,B);assert.equal(toolResult.unread,1);assert.equal(count(),1);});
 await post('clear',{});
 check('mark all read removes persisted manual flags',()=>{assert.equal(count(),0);assert.equal(state().manualUnread.length,0);});

 const key='a'.repeat(48),cases=JSON.parse(fs.readFileSync(new URL('./activation-cases.json',import.meta.url),'utf8'));
 for(const c of cases){const uri=c.uri.replaceAll('{SID}',A).replaceAll('{KEY}',key);
   check('Host activation: '+c.name,()=>{if(c.valid)assert.equal(activationSession(uri,key),c.session?A:null);else assert.throws(()=>activationSession(uri,key));});}
 const inbox=path.join(dir,'activation-inbox'),activationId='a'.repeat(32);
 fs.writeFileSync(path.join(inbox,activationId+'.uri'),'dsh-notify-all://session/'+B);
 const click=await post('activation',{clientId:'desktop'});
 check('public copied link reaches exact conversation through existing inbox',()=>assert.equal(click.data.activation.sessionId,B));

 let exported;const copied=[],opened=[],posts=[],notes=[],menuChanges=[];
 const fakeReact={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props??{},children})};
 const sandbox={window:{__ModuleLoader__:{load:row=>{exported=row.factory(name=>{assert.equal(name,'react');return fakeReact;});}}},
  navigator:{clipboard:{writeText:async text=>copied.push(text)}},
  fetch:async(url,init)=>{posts.push({url,body:JSON.parse(init.body)});return{ok:true,json:async()=>({})};},
 };
 vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),sandbox);
 // DSH's dynamic Client Context separately guards the Remote root and namespace.
 const clientCtx=new Proxy({sessions:{list:{getSnapshot:()=>({byId:{[A]:{id:A,cwd:'C:\\selected-session'},[B]:{id:B,cwd:'C:\\other-session'}}})}},
   remote:new Proxy({session:{openWorkspacePath:async request=>opened.push(request)}},{get:(target,key)=>{if(key==='session'&&!exported.inject.includes('remote.session'))throw new Error('Session Remote not injected');return target[key];}})},
   {get:(target,key)=>{if(key==='remote'&&!exported.inject.includes('remote'))throw new Error('Remote root not injected');return target[key];}});
 const actions=exported.menuActions(clientCtx,
   {selection:()=>({clientId:'test',selectedSessionId:A,viewEpoch:9})},{show:(...args)=>notes.push(args)},key=>key);
 const tree=exported.SessionMenuActions({sessionId:B,useMenuOpenState:()=>[true,value=>menuChanges.push(value)],actions,t:key=>key});
 const all=[];function walk(node){if(Array.isArray(node))node.forEach(walk);else if(node&&typeof node==='object'){all.push(node);walk(node.children);}}walk(tree);
 const buttons=all.filter(x=>x.type==='button');
 check('native slot renders four accessible menu items in requested order',()=>assert.deepEqual(buttons.map(x=>x.children[1].children[0]),['openFolder','markUnread','copyId','copyLink']));
 check('menu buttons participate in native keyboard navigation',()=>assert.ok(buttons.every(x=>x.props.role==='menuitem'&&x.props.type==='button')));
 for(const button of buttons){button.props.onClick();await new Promise(resolve=>setImmediate(resolve));}
 check('each menu action closes native menu before async work',()=>assert.deepEqual(menuChanges,[false,false,false,false]));
 check('Explorer opens selected row workspace rather than active workspace',()=>assert.equal(opened[0].path,'C:\\other-session'));
 check('mark unread sends row ID and viewer revision separately',()=>{assert.equal(posts[0].body.sessionId,B);assert.equal(posts[0].body.selectedSessionId,A);assert.equal(posts[0].body.viewEpoch,9);});
 check('copy ID uses selected row exact ID',()=>assert.equal(copied[0],B));
 check('copy link carries only session ID and no private key',()=>assert.equal(copied[1],'dsh-notify-all://session/'+B));
 sandbox.navigator.clipboard.writeText=async()=>{throw new Error('denied');};await actions.copyId(B);
 check('clipboard failure offers selectable text in plugin feedback',()=>{assert.equal(notes.at(-1)[0],'copyFailed');assert.equal(notes.at(-1)[2],B);});
 await actions.openFolder('missing');
 check('missing workspace reports failure and opens no arbitrary directory',()=>{assert.equal(notes.at(-1)[0],'noFolder');assert.equal(opened.length,1);});
} finally {cleanups.reverse().forEach(fn=>fn());fs.rmSync(temp,{recursive:true,force:true});}
check('Host unload unregisters its agent tool',()=>assert.equal(tools.size,0));
console.log('\n'+passed+' Session menu checks passed. No system notifications shown.');
