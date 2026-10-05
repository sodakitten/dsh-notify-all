window.__ModuleLoader__.load({
  id: 'dsh-notify-all',
  factory(require) {
    const React = require('react'), h = React.createElement;
    const NS = 'dsh-notify-all', API = '/api/dsh-notify-all';
    const FIELDS = [
      ['enabled', '启用插件', 'Enable plugin', 'bool'],
      ['toastsEnabled', 'Windows 通知', 'Windows notifications', 'bool'],
      ['sound', '通知声音', 'Notification sound', 'bool'],
      ['badgeColor', '数字底色', 'Badge color', 'choice', [['red','红色','Red'], ['black','黑色','Black']]],
      ['showBadge', '任务栏数字角标', 'Taskbar badge', 'bool'],
      ['trayIcon', '额外托盘图标（默认关闭）', 'Additional tray icon (off by default)', 'bool'],
      ['toastTarget', '点击通知时', 'When a notification is clicked', 'choice', [['app','唤起桌面端','Show desktop app'], ['browser','打开网页端','Open web app']]],
      ['clearOnFocus', '切回窗口清空全部未读', 'Clear all unread items on window focus', 'bool'],
      ['completion', '完成提醒', 'Completion notifications', 'bool'],
      ['failure', '失败／中止提醒', 'Failure / interruption notifications', 'bool'],
      ['blocked', '受阻提醒', 'Blocked notifications', 'bool'],
      ['approval', '审批提醒', 'Approval notifications', 'bool'],
      ['question', '提问提醒', 'Question notifications', 'bool'],
      ['planReview', '计划确认提醒', 'Plan review notifications', 'bool'],
      ['subagentUnread', '子智能体计入未读', 'Count subagent completions', 'bool'],
      ['completeMergeMs', '后续完成通知合并窗口（毫秒）', 'Merge subsequent completions (ms)', 'num', 0, 60000],
      ['toastMinIntervalMs', '同类通知最小间隔（毫秒）', 'Minimum notification interval (ms)', 'num', 0, 60000],
      ['summaryMaxChars', '摘要长度（字符）', 'Summary length (characters)', 'num', 40, 500],
    ];
    const zh = { title: '通知与角标', description: '任务完成或等待你处理时，显示系统通知和任务栏数字。打开对应会话清除该会话未读，待回复数在处理后减少。',
      pending:'待处理', unread:'未读', clear:'全部标记已读', loading:'加载中…', saved:'已保存', saving:'保存中…', failed:'保存失败，请重试',
      testBadge:'测试角标', testToast:'发送一条测试通知', native:'任务栏状态', noWindow:'尚未找到桌面窗口', ready:'已连接桌面窗口',
      unsupported:'系统角标不可用', unavailable:'此页面暂时无法读取设置', hint:'默认按会话已读。手动未读在切走后重新打开时清除，不发通知；切回窗口不会清除手动未读。额外托盘图标是插件自己的图标。',
      error:'接口错误', wait:'等待连接', running:'正在检测', testAdded:'测试角标已添加；验证后点击“全部标记已读”清除。',
      openFolder:'在资源管理器中打开',markUnread:'标记为未读',copyId:'复制会话ID',copyLink:'复制会话链接',
      markedUnread:'已标记为未读',idCopied:'会话ID已复制',linkCopied:'会话链接已复制',folderOpened:'已打开会话工作目录',
      noFolder:'此会话没有工作目录',copyFailed:'无法写入剪贴板，请手动复制：',dismiss:'关闭提示' };
    const en = { title:'Notifications & badges', description:'Show system notifications and a taskbar count for finished tasks and pending interactions. Opening a conversation clears its unread items; pending items clear after a response.',
      pending:'Pending', unread:'Unread', clear:'Mark all as read', loading:'Loading…', saved:'Saved', saving:'Saving…', failed:'Save failed. Try again.',
      testBadge:'Test badge', testToast:'Send one test notification', native:'Taskbar status', noWindow:'Desktop window not found yet', ready:'Connected to desktop window',
      unsupported:'Taskbar badge unavailable', unavailable:'Settings are temporarily unavailable', hint:'Unread items clear per conversation. Manual unread clears after leaving and reopening, without a notification. Window focus preserves manual unread. The extra tray icon belongs to this plugin.',
      error:'API error', wait:'Waiting for connection', running:'Checking', testAdded:'Test badge added. Use “Mark all as read” after verification.',
      openFolder:'Open in File Explorer',markUnread:'Mark as unread',copyId:'Copy conversation ID',copyLink:'Copy conversation link',
      markedUnread:'Marked as unread',idCopied:'Conversation ID copied',linkCopied:'Conversation link copied',folderOpened:'Conversation workspace opened',
      noFolder:'This conversation has no working directory',copyFailed:'Clipboard unavailable. Copy this text manually:',dismiss:'Dismiss' };
    for (const f of FIELDS) {
      zh[f[0]] = f[1]; en[f[0]] = f[2];
      if (f[3] === 'choice') for (const o of f[4]) { zh[f[0] + '.' + o[0]] = o[1]; en[f[0] + '.' + o[0]] = o[2]; }
    }
    const styles = `
      .dna-page{color:var(--dsw-alias-label-primary);font:inherit;max-width:720px;padding:4px 0 32px;line-height:1.55}
      .dna-page h2{font-size:20px;margin:0 0 8px;font-weight:600}
      .dna-page p,.dna-secondary{color:var(--dsw-alias-label-secondary)}
      .dna-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:4px 16px;margin:18px 0}
      .dna-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
      .dna-row:last-child{border-bottom:0}.dna-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
      .dna-page button,.dna-page select,.dna-page input[type=number]{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:6px 10px}
      .dna-page button{cursor:pointer}.dna-page button:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dna-page input[type=number]{width:110px}.dna-page input[type=checkbox]{width:18px;height:18px;accent-color:var(--dsw-alias-brand-primary-new-colorprimary-new-color)}
      .dna-page small{font-size:12px}.dna-error{color:var(--dsw-alias-state-error-primary)}
      .dna-menu-item{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:0;border-radius:var(--dsw-radius-md);background:transparent;cursor:pointer;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);text-align:left;box-sizing:border-box}
      .dna-menu-item:hover:not(:disabled),.dna-menu-item:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);outline:none}
      .dna-menu-icon{display:inline-flex;flex:none;width:14px;height:14px;align-items:center;justify-content:center;color:var(--dsw-alias-menu-icon)}
      .dna-menu-icon svg{width:14px;height:14px}.dna-menu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dna-menu-separator{height:.5px;margin:3px 2px;background:var(--dsw-alias-border-l2)}
      .dna-feedback{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:1200;max-width:min(520px,calc(100vw - 32px));padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-prominent);font-size:13px;display:flex;align-items:center;gap:12px}
      .dna-feedback button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;padding:4px}
      .dna-feedback textarea{display:block;box-sizing:border-box;width:100%;min-width:260px;margin-top:8px;background:var(--dsw-alias-bg-base);color:inherit;border:1px solid var(--dsw-alias-border-l2);font:inherit;resize:vertical}
    `;
    function request(path, body) {
      return fetch(API + path, body === undefined ? { cache:'no-store' } : {
        method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), keepalive:true,
      }).then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error || res.status); return data; });
    }
    /** Uses only public snapshot/subscription faces. All resources belong to this fiber. */
    function trackViewer(ctx) {
      const clientId = globalThis.crypto?.randomUUID?.() ?? 'client-' + Date.now() + '-' + Math.random();
      let active = true, sending = false, pending = null, lastError = null, covered = false, settingsClose = null;
      let selectedSessionId = ctx.uiSession.current.getSnapshot().key ?? null, viewEpoch = 0;
      function selection() {
        const next = ctx.uiSession.current.getSnapshot().key ?? null;
        if (next !== selectedSessionId) { selectedSessionId = next; viewEpoch++; }
        return {clientId,selectedSessionId,viewEpoch};
      }
      async function drain() {
        if (sending || !active) return;
        sending = true;
        while (pending && active) {
          const body = pending; pending = null;
          try { await request('/viewer', body); lastError = null; }
          catch (err) { lastError = err.message; }
        }
        sending = false;
      }
      function report() {
        if (!active) return;
        const revision = selection(), sessionId = revision.selectedSessionId;
        const inConversation = !covered && ctx.layout.panelInfo.getSnapshot().activePanelId === null;
        const rows = Object.values(ctx.sessions.list.getSnapshot().byId);
        pending = { ...revision, sessionId:inConversation ? sessionId : null,
          focused:!document.hidden && document.hasFocus(),
          titles:rows.filter(x => typeof x.title === 'string').map(x => ({ id:x.id, title:x.title })) };
        void drain();
      }
      ctx.effect(() => {
        const disposers = [ctx.uiSession.current.subscribe(report), ctx.layout.panelInfo.subscribe(report), ctx.sessions.list.subscribe(report)];
        const events = [[window,'focus'], [window,'blur'], [document,'visibilitychange']];
        for (const [target, event] of events) target.addEventListener(event, report);
        const timer = setInterval(report, 2000);
        report();
        return () => {
          active = false; pending = null; clearInterval(timer);
          for (const dispose of disposers) dispose();
          for (const [target, event] of events) target.removeEventListener(event, report);
          void request('/viewer', { clientId, sessionId:null, focused:false }).catch(() => {});
        };
      });
      ctx.on('connection/reset', report);
      return Object.assign(() => lastError, {
        selection,
        setCovered(value) { covered = value; report(); },
        setSettingsClose(value) { settingsClose = value; },
        closeSettings() { settingsClose?.(); },
        setError(value) { lastError = value; },
      });
    }
    function trackActivation(ctx, tracker) {
      const clientId = globalThis.crypto?.randomUUID?.() ?? 'activate-' + Date.now();
      let active = true, polling = false;
      async function navigate(sessionId) {
        if (!/^session-[a-f0-9-]{36}$/u.test(sessionId)) throw new Error('Invalid notification Session ID');
        tracker.closeSettings();
        ctx.uiWorkspace.openSession(sessionId);
        for (let n=0; n<32 && active; n++) {
          if (ctx.uiSession.current.getSnapshot().key === sessionId) return;
          await new Promise(resolve=>setTimeout(resolve,250));
        }
        if (active) throw new Error('Notification conversation did not open');
      }
      async function poll() {
        if (!active || polling || window.dshDesktop?.protocolVersion !== 1 || document.hidden || !document.hasFocus()) return;
        polling = true;
        try {
          const reply = await request('/activation',{clientId});
          if (!active || !reply.activation) return;
          if (reply.activation.sessionId) await navigate(reply.activation.sessionId);
          if (active) await request('/activation',{clientId,ack:reply.activation.id});
          tracker.setError(null);
        } catch (error) { if (active) tracker.setError(error.message); }
        finally { polling = false; }
      }
      ctx.effect(() => {
        // Web targets use a plugin-owned fragment; the host's authentication exchange preserves it.
        const prefix = '#dsh-notify-session=';
        if (location.hash.startsWith(prefix)) {
          try {
            const id = decodeURIComponent(location.hash.slice(prefix.length));
            void navigate(id).then(()=>history.replaceState(null,'',location.pathname+location.search)).catch(error=>tracker.setError(error.message));
          } catch(error) {tracker.setError(error.message);}
        }
        if (window.dshDesktop?.protocolVersion !== 1) return () => {active=false;};
        const timer = setInterval(poll,750);
        window.addEventListener('focus',poll); document.addEventListener('visibilitychange',poll);
        void poll();
        return () => {active=false;clearInterval(timer);window.removeEventListener('focus',poll);document.removeEventListener('visibilitychange',poll);};
      });
      ctx.on('connection/reset',poll);
    }
    // The settings dialog covers the conversation without changing Layout's panel ID.
    // Observe its official action slot's mount lifetime; no DOM query is needed.
    function ViewerCover({ setCovered }) {
      React.useEffect(() => { setCovered(true); return () => setCovered(false); }, [setCovered]);
      return null;
    }
    function feedbackStore(ctx) {
      let value = null, timer = null, active = true;
      const listeners = new Set(), emit = () => { for (const fn of listeners) fn(); };
      const clear = () => { clearTimeout(timer); timer = null; value = null; emit(); };
      ctx.effect(() => () => { active = false; clearTimeout(timer); listeners.clear(); });
      return { getSnapshot:()=>value, subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}, clear,
        show(message, error=false, copyText=null) {
          if (!active) return;
          clearTimeout(timer); value = {message,error,copyText}; emit();
          if (!error) timer = setTimeout(clear,3000);
        },
      };
    }
    function Feedback({ store, t }) {
      const note = React.useSyncExternalStore(store.subscribe,store.getSnapshot);
      return h(React.Fragment,null,h('style',null,styles),note && h('div',{className:'dna-feedback',role:note.error?'alert':'status'},
        h('div',null,note.message,note.copyText && h('textarea',{readOnly:true,value:note.copyText,'aria-label':t('copyFailed'),onFocus:e=>e.target.select()})),
        h('button',{type:'button',onClick:store.clear,'aria-label':t('dismiss')},'×')));
    }
    function sessionLink(id) {
      if (!/^session-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(id)) throw new Error('Invalid Session ID');
      return 'dsh-notify-all://session/' + id;
    }
    function menuActions(ctx, tracker, feedback, t) {
      const report = async work => { try { await work(); } catch(error) { feedback.show(error.message,true); } };
      const copy = async (value, label) => {
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(value); feedback.show(t(label));
        } catch { feedback.show(t('copyFailed'),true,value); }
      };
      return {
        openFolder:id=>report(async()=>{
          const cwd = ctx.sessions.list.getSnapshot().byId[id]?.cwd;
          if (typeof cwd !== 'string' || !cwd) throw new Error(t('noFolder'));
          await ctx.remote.session.openWorkspacePath({path:cwd}); feedback.show(t('folderOpened'));
        }),
        markUnread:id=>report(async()=>{await request('/unread',{sessionId:id,...tracker.selection()});feedback.show(t('markedUnread'));}),
        copyId:id=>copy(id,'idCopied'), copyLink:id=>report(()=>copy(sessionLink(id),'linkCopied')),
      };
    }
    function SessionMenuActions({sessionId,useMenuOpenState,actions,t}) {
      const [,setMenuOpen] = useMenuOpenState();
      const paths = {
        openFolder:'M2 5h7l2 2h11v13H2z M2 5V3h7l2 2',
        markUnread:'M3 5h18v14H3z M3 5l9 7 9-7',
        copyId:'M9 3H3v6 M15 3h6v6 M3 15v6h6 M21 15v6h-6 M9 8l-1 8 M15 8l-1 8 M6 11h12 M6 14h12',
        copyLink:'M10 13l4-4 M8 15l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 9l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
      };
      return h(React.Fragment,null,['openFolder','markUnread','copyId','copyLink'].map((key,index)=>h('div',{key,className:'dna-menu-wrap'},
        index===0 && h('div',{className:'dna-menu-separator',role:'separator'}),
        h('button',{type:'button',role:'menuitem',className:'dna-menu-item',onClick:()=>{setMenuOpen(false);void actions[key](sessionId);}},
          h('span',{className:'dna-menu-icon','aria-hidden':true},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round'},h('path',{d:paths[key]}))),
          h('span',{className:'dna-menu-label'},t(key))))));
    }
    function Page({ form, t, viewerError, close }) {
      const [snapshot, setSnapshot] = React.useState(() => form.getSnapshot());
      const [status, setStatus] = React.useState(null), [note, setNote] = React.useState(''), [error, setError] = React.useState('');
      React.useEffect(() => { viewerError.setSettingsClose(close); return()=>viewerError.setSettingsClose(null); },[close,viewerError]);
      React.useEffect(() => {
        const dispose = form.subscribe(() => setSnapshot(form.getSnapshot()));
        setSnapshot(form.getSnapshot()); return dispose;
      }, [form]);
      React.useEffect(() => {
        let active = true;
        const refresh = () => request('/status').then(data => { if (active) { setStatus(data); setError(''); } }).catch(err => { if (active) setError(err.message); });
        refresh(); const timer = setInterval(refresh, 2000);
        return () => { active = false; clearInterval(timer); };
      }, []);
      async function save(key, value) {
        setNote(t('saving')); setError('');
        try { setNote(await form.set(key, value) ? t('saved') : t('failed')); }
        catch (err) { setNote(t('failed')); setError(err.message); }
      }
      async function action(path, body) {
        try { setStatus(await request(path, body)); setError(''); setNote(path === '/test' && body.kind === 'badge' ? t('testAdded') : ''); }
        catch (err) { setError(err.message); }
      }
      const values = snapshot.value ?? {}, disabled = !snapshot.writable;
      const native = status?.native;
      const nativeText = !native ? t('running') : !native.hwnd ? t('noWindow') : native.hresult === 0 ? t('ready') : t('unsupported') + ' (' + native.hresult + ')';
      return h('section', {className:'dna-page', id:'dsh-notify-all-settings-page'},
        h('style', null, styles), h('h2', null, t('title')), h('p', null, t('description')),
        h('div', {className:'dna-card'},
          h('div', {className:'dna-row'}, h('span',null, t('pending') + ' ' + (status?.badge.pending ?? 0) + ' · ' + t('unread') + ' ' + (status?.badge.unread ?? 0)),
            h('button', {type:'button',onClick:()=>action('/clear',{})},t('clear'))),
          h('div', {className:'dna-row'}, h('span',null,t('native')),h('small',{className:'dna-secondary'},nativeText))),
        !snapshot.value ? h('p',null,snapshot.status === 'loading' ? t('loading') : t('unavailable')) :
          h('div',{className:'dna-card'},FIELDS.map(f => {
            const id = 'dna-' + f[0]; let control;
            if (f[3] === 'bool') control = h('input',{id,type:'checkbox',role:'switch','aria-checked':values[f[0]] === true,checked:values[f[0]] === true,disabled,onChange:e=>save(f[0],e.target.checked)});
            else if (f[3] === 'choice') control = h('select',{id,value:values[f[0]],disabled,onChange:e=>save(f[0],e.target.value)},f[4].map(o=>h('option',{key:o[0],value:o[0]},t(f[0]+'.'+o[0]))));
            else control = h('input',{id,type:'number',min:f[4],max:f[5],defaultValue:values[f[0]],key:String(values[f[0]]),disabled,onBlur:e=>{ const n=Number(e.target.value); if(Number.isInteger(n)&&n>=f[4]&&n<=f[5]&&n!==values[f[0]]) save(f[0],n); }});
            return h('div',{key:f[0],className:'dna-row'},h('label',{htmlFor:id},t(f[0])),control);
          })),
        h('div',{className:'dna-actions'},h('button',{type:'button',onClick:()=>action('/test',{kind:'badge'})},t('testBadge')),
          h('button',{type:'button',onClick:()=>action('/test',{kind:'completion',sessionId:viewerError.sessionId?.()})},t('testToast'))),
        h('small',{className:'dna-secondary'},t('hint')),
        h('p',{'aria-live':'polite',className:error || status?.notification?.error ? 'dna-error' : 'dna-secondary'},error ? t('error') + ': ' + error : status?.notification?.error ? t('error') + ': ' + status.notification.error : viewerError() ? t('error') + ': ' + viewerError() : note));
    }
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, {zh,en}));
      const t = ctx.locale.bind(NS), form = ctx.configForms.get(NS), viewerError = trackViewer(ctx);
      viewerError.sessionId = () => ctx.uiSession.current.getSnapshot().key;
      trackActivation(ctx,viewerError);
      const feedback = feedbackStore(ctx), actions = menuActions(ctx,viewerError,feedback,t);
      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name:'shell.overlay',id:'dsh-notify-all-feedback',order:850,locale:NS,inject:()=>({store:feedback,t}),
      },Feedback)));
      const menu = 'sidebar.workspaces.session.menu.item';
      ctx.effect(() => ctx.slots.inject(menu, () => ctx.slots.register({
        name:menu,id:'dsh-notify-all-session-actions',order:450,locale:NS,inject:()=>({actions,t}),
      },SessionMenuActions)));
      ctx.effect(() => ctx.slots.inject('settings.action', () => ctx.slots.register({
        name:'settings.action', id:'dsh-notify-all-viewer', order:100,
        inject:()=>({setCovered:viewerError.setCovered}),
      }, ViewerCover)));
      ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name:'settings.section', id:NS, order:40, label:()=>t('title'), locale:NS, inject:()=>({form,t,viewerError}),
      }, Page))));
    }
    return { apply, inject:['slots','locale','configForms','uiSession','sessions','layout','uiWorkspace','remote','remote.session'], FIELDS, trackViewer, trackActivation, ViewerCover, Page, SessionMenuActions, menuActions, sessionLink };
  },
});
