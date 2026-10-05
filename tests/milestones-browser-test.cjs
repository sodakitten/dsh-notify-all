// Development-only fixture. Requires Playwright, React, React DOM and esbuild;
// these packages and DSH's reference CSS are never included in the plugin TGZ.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const deps=process.env.DSH_NOTIFY_BROWSER_TEST_DEPS, pw=process.env.DSH_NOTIFY_PLAYWRIGHT;
if(!deps || !pw || !process.env.DSH_NOTIFY_TURN_CSS)throw new Error('Set DSH_NOTIFY_BROWSER_TEST_DEPS, DSH_NOTIFY_PLAYWRIGHT and DSH_NOTIFY_TURN_CSS');
const {chromium}=require(pw),{buildSync}=require(path.join(deps,'esbuild'));
const client=fs.readFileSync(path.join(__dirname,'../lib/client.js'),'utf8');
const css=client.match(/const styles = `([\s\S]*?)`;/)[1],nativeCss=fs.readFileSync(process.env.DSH_NOTIFY_TURN_CSS,'utf8');
const A='session-00000000-0000-4000-8000-000000000001',B='session-00000000-0000-4000-8000-000000000002';
const fixture=`import React from 'react';import {createRoot} from 'react-dom/client';window.React=React;
 const id='${A}', rows=Array.from({length:100},(_,index)=>({turn:index*4+2,seq:index*100}));
 const source=value=>{const listeners=new Set();return{getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},set:next=>{value=next;for(const fn of listeners)fn();}};};
 const outline=source(rows), chat=source({navigation:{items:()=>rows.slice(-10)}}),binding=id=>({key:id,hooks:{chat},keyedHooks:{projection:()=>outline}});
 window.current=source(binding(id));window.form=source({value:{enabled:true}});window.cleanups=[];
 window.ctx={uiSession:{current},effect:fn=>{const off=fn();if(typeof off==='function')cleanups.push(off);},on:()=>{}};
 window.boot=()=>{
  const plugin=window.plugin;window.store=plugin.milestoneStore(ctx,form,key=>({milestoneSet:'设为里程碑',milestoneRename:'重命名',milestoneRemove:'取消里程碑',milestoneName:'里程碑名称',milestoneHint:'保存在本机，不触发通知',milestoneTurn:'轮次',save:'保存',cancel:'取消',saving:'保存中…'}[key]??key));
  plugin.milestoneRailAdapter(ctx,store,key=>({milestoneSet:'设为里程碑',milestoneRename:'重命名',milestoneRemove:'取消里程碑'}[key]??key));
  const t=key=>({milestoneSet:'设为里程碑',milestoneRename:'重命名',milestoneRemove:'取消里程碑',milestoneName:'里程碑名称',milestoneHint:'保存在本机，不触发通知',save:'保存',cancel:'取消',saving:'保存中…'}[key]??key);
  function Fixture(){
   const [preview,setPreview]=React.useState(null),[offset,setOffset]=React.useState(0);const ref=React.useRef(null),session=React.useSyncExternalStore(current.subscribe,current.getSnapshot);
   const visible=rows.slice(offset,offset+25);
   return React.createElement(React.Fragment,null,
    React.createElement('div',{'data-conversation-session':session.key,style:{height:'700px'}},
     React.createElement('div',{className:'xpvNua_slot'},React.createElement('nav',{className:'xpvNua_frame','aria-label':'轮次导航',onPointerLeave:()=>setPreview(null)},
      React.createElement('div',{className:'xpvNua_scroller',ref,onScroll:()=>{setOffset(Math.floor(ref.current.scrollTop/10));setPreview(null);}},
       React.createElement('div',{className:'xpvNua_marks',style:{height:'1002px'}},visible.map((row,index)=>React.createElement('button',{key:index,className:'xpvNua_mark','data-index':offset+index,'aria-label':'跳转轮次 '+row.turn,'aria-current':row.turn===82?'true':undefined,'aria-busy':row.turn===82?'true':undefined,'aria-describedby':preview===row.turn?'turn-preview':undefined,style:{transform:'translateY('+((offset+index)*10+1)+'px)'},onPointerMove:()=>setPreview(row.turn),onFocus:()=>setPreview(row.turn),onBlur:()=>setPreview(null),onClick:()=>{window.nativeClicks=(window.nativeClicks??0)+1;}})))),
      preview!==null && React.createElement('div',{id:'turn-preview',role:'tooltip',className:'xpvNua_preview',style:{'--turn-preview-center':((rows.findIndex(row=>row.turn===preview)*10+6)-(ref.current?.scrollTop??0))+'px'}},
       React.createElement('div',{className:'xpvNua_previewPrompt'},'原生悬浮预览'),React.createElement('div',{className:'xpvNua_previewResponse'},'这条消息的回复内容，仍由 DSH 原生组件呈现。'))))),
    React.createElement(plugin.MilestoneDialog,{store,t}));
  }
  window.root=createRoot(document.getElementById('root'));root.render(React.createElement(Fixture));
  window.switchSession=id=>current.set(binding(id));window.dispose=()=>{for(const off of cleanups.reverse())off();root.unmount();};
 };`;
const bundle=buildSync({stdin:{contents:fixture,resolveDir:__dirname,loader:'js'},bundle:true,write:false,platform:'browser',nodePaths:[deps],define:{'process.env.NODE_ENV':'"development"'}}).outputFiles[0].text;
const data=new Map(),writes=[];let revision=0;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/dsh-notify-all/milestones'){
  let id=url.searchParams.get('sessionId');
  if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);writes.push(body);id=body.sessionId;const records=data.get(id)??new Map();if(body.op==='remove')records.delete(body.turn);else records.set(body.turn,{sessionId:id,turn:body.turn,seq:body.seq,name:body.name});data.set(id,records);revision++;}
  res.setHeader('content-type','application/json');res.end(JSON.stringify({sessionId:id,generation:'fixture',revision,milestones:[...(data.get(id)?.values()??[])]}));return;
 }
 if(url.pathname==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(bundle);return;}
 if(url.pathname==='/client.js'){res.setHeader('content-type','text/javascript');res.end(client);return;}
 const dark=url.searchParams.get('dark')==='true';
 res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><style>${nativeCss}${css}
 :root{--dsw-alias-bg-layer-1:${dark?'#222630':'#f8fafc'};--dsw-alias-bg-layer-2:${dark?'rgba(28,32,40,.8)':'rgba(255,255,255,.8)'};--dsw-alias-bg-base:${dark?'#141820':'#fff'};--dsw-alias-label-primary:${dark?'#e8ebef':'#171b21'};--dsw-alias-label-secondary:${dark?'#b9bec6':'#647080'};--dsw-alias-border-l2:${dark?'#3c424f':'#dce0e8'};--dsw-alias-border-l4:${dark?'#596170':'#b9bec6'};--dsw-alias-border-focusring:#517bde;--dsw-alias-brand-primary-new-colorprimary-new-color:${dark?'#7a9aff':'#416dd3'};--dsw-radius-lg:12px;--dsw-radius-md:6px;--dsw-elevation-panel:0 4px 16px #0002;--dsh-conversation-viewport-height:700px;--dsh-composer-height:152px;--dsh-composer-side-clearance:0px}
 body{margin:0;background:${dark?'#202830':'#e8dce3'};font:13px/20px sans-serif}.xpvNua_slot{width:100%;box-sizing:border-box}.xpvNua_mark[aria-busy=true]:before{animation:xpvNua_dsh-turn-mark-busy 1s infinite}.xpvNua_previewPrompt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.xpvNua_previewResponse{line-height:18px}.dna-milestone-controls button:disabled{opacity:.5}
 </style></head><body><div id=root></div><script>window.__ModuleLoader__={load:row=>window.plugin=row.factory(()=>window.React)};</script><script src=/bundle.js></script><script src=/client.js></script><script>boot();</script></body></html>`);
});
(async()=>{
 server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1200,height:750}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));let passed=0;
 const check=(label,result)=>{assert.ok(result,label);passed++;console.log('PASS '+label);};
 const open=async dark=>{await page.goto('http://127.0.0.1:'+server.address().port+'/?dark='+dark);await page.waitForSelector('[data-dna-rail]');await page.waitForTimeout(100);};
 const mark=()=>page.locator('button.xpvNua_mark[data-index="20"]');
 const preview=async()=>{await mark().hover();await page.waitForSelector('.dna-milestone-footer');};
 try {
  await open(false);await preview();
  check('hover card gets exactly one Set milestone action',await page.getByRole('button',{name:'设为里程碑',exact:true}).count()===1);
  const button=page.getByRole('button',{name:'设为里程碑',exact:true}),box=await button.boundingBox(),m=await mark().boundingBox();
  await page.mouse.move(m.x+m.width/2,m.y+m.height/2);await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:20});
  check('moving across native 10px gap keeps hover action reachable',await button.isVisible());
  await button.click();
  check('naming dialog has an opaque theme surface despite translucent wallpaper tokens',await page.getByRole('dialog').evaluate(el=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(el).backgroundColor;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].join(',')==='255,255,255,255';}));
  await page.getByRole('textbox',{name:'里程碑名称'}).fill('交付完成');await page.getByRole('button',{name:'保存',exact:true}).click();await page.waitForSelector('[data-dna-milestone]');
  assert.equal(writes.at(-1).turn,82,JSON.stringify(writes.at(-1)));
  check('save highlights real turn 82 rather than visible index 20',writes.at(-1).turn===82 && writes.at(-1).seq===2000);
  check('saving closes naming dialog',await page.getByRole('dialog').count()===0);
  check('running and current flags remain owned by the native rail',await mark().getAttribute('aria-busy')==='true' && await mark().getAttribute('aria-current')==='true');
  check('milestone preserves native busy animation',await mark().evaluate(el=>getComputedStyle(el,':before').animationName)!=='none');
  await preview();check('saved name appears as text in original hover card',await page.locator('.dna-milestone-name').textContent()==='◆ 交付完成');
  await page.getByRole('button',{name:'重命名',exact:true}).click();
  check('rename editor is prefilled',await page.getByRole('textbox').inputValue()==='交付完成');
  await page.getByRole('textbox').fill('修改后取消');await page.keyboard.press('Escape');
  check('Escape cancels editing without a new write',writes.length===1 && await page.getByRole('dialog').count()===0);
  await mark().focus();await page.keyboard.press('Alt+m');await page.getByRole('textbox').fill('<img src=x onerror=alert(1)>');await page.getByRole('button',{name:'保存',exact:true}).click();await page.waitForFunction(()=>store.getSnapshot().dialog===null);await preview();
  check('keyboard shortcut opens editor and literal names never become HTML',await page.locator('.dna-milestone-name img').count()===0 && (await page.locator('.dna-milestone-name').textContent()).includes('<img'));
  await mark().click();check('highlighted mark retains native jump click',await page.evaluate(()=>nativeClicks)===1);
  check('highlight uses current theme accent',await mark().evaluate(el=>getComputedStyle(el,':before').backgroundColor)==='rgb(65, 109, 211)');
  const nameWrites=writes.length;await open(true);await preview();
  check('restart reloads the saved name and marker',await mark().getAttribute('data-dna-milestone')!==null && (await page.locator('.dna-milestone-name').textContent()).includes('<img'));
  check('dark theme supplies its own visible accent',await mark().evaluate(el=>getComputedStyle(el,':before').backgroundColor)==='rgb(122, 154, 255)');
  await page.screenshot({path:path.join(process.env.DSH_NOTIFY_BROWSER_OUTPUT??osTmp(),'milestone-dark.png')});
  await page.evaluate(id=>switchSession(id),B);await page.waitForFunction(id=>store.getSnapshot().sessionId===id && !store.getSnapshot().milestones.length,B);await page.waitForTimeout(80);
  check('switching conversation removes another session marker',await page.locator('[data-dna-milestone]').count()===0);
  await page.evaluate(id=>switchSession(id),A);await page.waitForSelector('[data-dna-milestone]');
  await page.locator('.xpvNua_scroller').evaluate(el=>{el.scrollTop=600;});await page.waitForTimeout(100);
  check('recycled virtual buttons do not retain stale highlights',await page.locator('[data-dna-milestone]').count()===0);
  await page.locator('.xpvNua_scroller').evaluate(el=>{el.scrollTop=0;});await page.waitForSelector('[data-dna-milestone]');await preview();
  await page.getByRole('button',{name:'取消里程碑',exact:true}).click();await page.waitForFunction(()=>!store.getSnapshot().milestones.length);await page.waitForTimeout(80);
  check('remove clears only its marker and restores Set action',await page.locator('[data-dna-milestone]').count()===0 && await page.getByRole('button',{name:'设为里程碑',exact:true}).count()===1);
  check('remove does not open a milestone list or another dialog',await page.getByRole('dialog').count()===0 && await page.locator('.dna-milestone-list,.dna-milestone-header').count()===0);
  check('rename, reload, switch and virtual scroll do not create extra writes',writes.length===nameWrites+1);
  await page.mouse.move(500,500);await mark().focus();await page.waitForSelector('.dna-milestone-footer');
  await page.evaluate(()=>{for(const off of cleanups.reverse())off();});await page.waitForTimeout(80);
  check('unload restores original marks and removes only plugin-owned footer',await page.locator('[data-dna-rail],[data-dna-preview],.dna-milestone-footer').count()===0 && await page.locator('.xpvNua_previewPrompt').count()===1);
  check('browser fixture has no runtime errors',errors.length===0);
  console.log(passed+' native-style milestone browser checks passed.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
function osTmp(){return require('node:os').tmpdir();}
