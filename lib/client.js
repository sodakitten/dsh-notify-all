window.__ModuleLoader__.load({
  id: 'dsh-notify-all',
  factory(require) {
    const React = require('react'), h = React.createElement;
    const NS = 'dsh-notify-all', API = '/api/dsh-notify-all';
    const FIELDS = [
      ['enabled', '启用插件', 'Enable plugin', 'bool'],
      ['toastsEnabled', 'Windows 通知', 'Windows notifications', 'bool'],
      ['sound', '通知声音', 'Notification sound', 'bool'],
      ['suppressWhenViewing', '查看当前会话且 DSH 有焦点时不弹通知', 'Suppress notifications while viewing this conversation in focused DSH', 'bool'],
      ['muteWhenViewing', '查看当前会话且 DSH 有焦点时通知静音', 'Mute notifications while viewing this conversation in focused DSH', 'bool'],
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
      noFolder:'此会话没有工作目录',copyFailed:'无法写入剪贴板，请手动复制：',dismiss:'关闭提示',
      milestoneSet:'设为里程碑',milestoneRename:'重命名',milestoneRemove:'取消里程碑',milestoneName:'里程碑名称',
      milestoneHint:'最多 80 个字符，保存在本机；不会触发通知或未读角标。',
      milestoneTurn:'轮次',milestoneInvalid:'请输入 1–80 个字符的名称。',save:'保存',cancel:'取消' };
    const en = { title:'Notifications & badges', description:'Show system notifications and a taskbar count for finished tasks and pending interactions. Opening a conversation clears its unread items; pending items clear after a response.',
      pending:'Pending', unread:'Unread', clear:'Mark all as read', loading:'Loading…', saved:'Saved', saving:'Saving…', failed:'Save failed. Try again.',
      testBadge:'Test badge', testToast:'Send one test notification', native:'Taskbar status', noWindow:'Desktop window not found yet', ready:'Connected to desktop window',
      unsupported:'Taskbar badge unavailable', unavailable:'Settings are temporarily unavailable', hint:'Unread items clear per conversation. Manual unread clears after leaving and reopening, without a notification. Window focus preserves manual unread. The extra tray icon belongs to this plugin.',
      error:'API error', wait:'Waiting for connection', running:'Checking', testAdded:'Test badge added. Use “Mark all as read” after verification.',
      openFolder:'Open in File Explorer',markUnread:'Mark as unread',copyId:'Copy conversation ID',copyLink:'Copy conversation link',
      markedUnread:'Marked as unread',idCopied:'Conversation ID copied',linkCopied:'Conversation link copied',folderOpened:'Conversation workspace opened',
      noFolder:'This conversation has no working directory',copyFailed:'Clipboard unavailable. Copy this text manually:',dismiss:'Dismiss',
      milestoneSet:'Set milestone',milestoneRename:'Rename',milestoneRemove:'Remove milestone',milestoneName:'Milestone name',
      milestoneHint:'Up to 80 characters. Saved locally, without notifications or unread badges.',
      milestoneTurn:'Turn',milestoneInvalid:'Enter a name with 1–80 characters.',save:'Save',cancel:'Cancel' };
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
      .dna-unread-dot{display:inline-block;flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-brand-primary-new-colorprimary-new-color)}
      .dna-feedback{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:1200;max-width:min(520px,calc(100vw - 32px));padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-prominent);font-size:13px;display:flex;align-items:center;gap:12px}
      .dna-feedback button{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;padding:4px}
      .dna-feedback textarea{display:block;box-sizing:border-box;width:100%;min-width:260px;margin-top:8px;background:var(--dsw-alias-bg-base);color:inherit;border:1px solid var(--dsw-alias-border-l2);font:inherit;resize:vertical}
      [data-dna-rail] [data-dna-milestone]:before{background:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#4c7bf3)!important;transform:translateY(-50%) scaleX(1)!important;height:3px!important}
      [data-dna-rail] [data-dna-milestone][aria-current=true]:before{height:4px!important}
      [data-dna-rail] [data-dna-preview]{pointer-events:auto;overflow:visible;max-height:none;--turn-preview-height:148px}
      [data-dna-preview]:after{content:'';position:absolute;top:0;bottom:0;right:-12px;width:12px;pointer-events:auto}
      .dna-milestone-footer{margin-top:8px;padding-top:7px;border-top:1px solid var(--dsw-alias-border-l2);font-size:12px;line-height:18px;cursor:default}
      .dna-milestone-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--dsw-alias-label-primary)}
      .dna-milestone-controls{display:flex;gap:6px;align-items:center;justify-content:flex-end;margin-top:3px}
      .dna-milestone-controls button,.dna-milestone-dialog button{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);padding:4px 8px;cursor:pointer}
      .dna-milestone-controls button:hover,.dna-milestone-dialog button:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dna-milestone-backdrop{position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,.28);display:grid;place-items:center;padding:20px}
      .dna-milestone-dialog{box-sizing:border-box;width:min(440px,100%);max-height:80vh;overflow:auto;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-panel);font-size:13px;line-height:1.5}
      .dna-milestone-dialog{background:rgb(from var(--dsw-alias-bg-layer-2) r g b / 1)}
      .dna-milestone-dialog h2{font-size:17px;margin:0 0 16px}.dna-milestone-dialog label{display:block;margin:8px 0}
      .dna-milestone-dialog input{box-sizing:border-box;width:100%;font:inherit;color:inherit;padding:8px 10px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md)}
      .dna-milestone-dialog input:focus-visible,.dna-milestone-dialog button:focus-visible{outline:2px solid var(--dsw-alias-border-focusring);outline-offset:2px}
      .dna-milestone-dialog button:disabled{opacity:.5;cursor:default}.dna-milestone-dialog .dna-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base)}
      .dna-milestone-dialog small{display:block;color:var(--dsw-alias-label-secondary);margin-top:10px}
    `;
    async function request(path, body) {
      const controller = new AbortController();
      let timer;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort(); reject(new Error('Notification request timed out. Please try again.'));
        }, 8000);
      });
      try {
        return await Promise.race([deadline, (async () => {
          const res = await fetch(API + path, body === undefined ? { cache:'no-store',signal:controller.signal } : {
            method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), signal:controller.signal,
          });
          const data = await res.json(); if (!res.ok) throw new Error(data.error || res.status); return data;
        })()]);
      } finally { clearTimeout(timer); }
    }
    function unreadStore(ctx) {
      let value = new Map(), active = true, generation = null, revision = -1;
      const listeners = new Set();
      ctx.effect(() => () => { active = false; listeners.clear(); });
      return { getSnapshot:()=>value, subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
        update(reply) {
          const data = reply.state ?? reply;
          if (!active || !Array.isArray(data.unread)) return;
          if (typeof data.generation === 'string' && Number.isSafeInteger(data.revision)) {
            if (generation === data.generation && data.revision < revision) return;
            generation = data.generation; revision = data.revision;
          }
          const next = new Map(data.config?.enabled === false ? [] : data.unread.filter(row=>row.manual && row.count>0).map(row=>[row.id,row.count]));
          if (next.size === value.size && [...next].every(([id,count])=>value.get(id)===count)) return;
          value = next; for (const fn of listeners) fn();
        },
      };
    }
    // DSH owns the running/completed indicator and only renders this official
    // decoration seat on idle rows. Manual unread never becomes a running state.
    function UnreadMarker({sessionId,store,t}) {
      const rows = React.useSyncExternalStore(store.subscribe,store.getSnapshot);
      return rows.has(sessionId) ? h('span',{className:'dna-unread-dot',role:'img','aria-label':t('markedUnread'),title:t('markedUnread')}) : null;
    }
    /** Uses only public snapshot/subscription faces. All resources belong to this fiber. */
    function trackViewer(ctx, unread) {
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
          try { const reply = await request('/viewer', body); if (active) unread?.update(reply); lastError = null; }
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
          desktop:window.dshDesktop?.protocolVersion === 1,
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
    function menuActions(ctx, tracker, feedback, t, unread) {
      const report = async work => { try { await work(); } catch(error) { feedback.show(error.message,true); } };
      const copy = async value => {
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(value);
        } catch { feedback.show(t('copyFailed'),true,value); }
      };
      return {
        openFolder:id=>report(async()=>{
          const cwd = ctx.sessions.list.getSnapshot().byId[id]?.cwd;
          if (typeof cwd !== 'string' || !cwd) throw new Error(t('noFolder'));
          await ctx.remote.session.openWorkspacePath({path:cwd});
        }),
        markUnread:id=>report(async()=>{const reply=await request('/unread',{sessionId:id,...tracker.selection()});unread?.update(reply);}),
        copyId:id=>copy(id), copyLink:id=>report(()=>copy(sessionLink(id))),
      };
    }
    function SessionMenuActions({sessionId,useMenuOpenState,actions,t,store}) {
      const [,setMenuOpen] = useMenuOpenState();
      const unread = React.useSyncExternalStore(store.subscribe,store.getSnapshot).has(sessionId);
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
          h('span',{className:'dna-menu-label'},t(key==='markUnread' && unread ? 'markedUnread' : key))))));
    }
    const sessionIdValid = id => /^session-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(id ?? '');
    const turnValid = n => Number.isSafeInteger(n) && n >= 0 && !Object.is(n,-0);
    /** Same ordered union as DSH's rail, read from public UiSession sources. */
    function milestoneTurns(binding) {
      const byTurn = new Map();
      const outline = binding?.keyedHooks?.projection?.('turnOutline')?.getSnapshot();
      for (const row of Array.isArray(outline) ? outline : []) if (row && turnValid(row.turn) && turnValid(row.seq)) byTurn.set(row.turn,{turn:row.turn,seq:row.seq});
      const chat = binding?.hooks?.chat?.getSnapshot();
      for (const row of chat?.navigation?.items?.() ?? []) if (turnValid(row.turn)) {
        byTurn.set(row.turn,{turn:row.turn,...(byTurn.get(row.turn)?.seq !== undefined ? {seq:byTurn.get(row.turn).seq} : {})});
      }
      return [...byTurn.values()].sort((a,b)=>a.turn-b.turn);
    }
    const milestoneMatches = (row, item) => !!row && !!item && row.turn === item.turn && (row.seq === undefined || item.seq === undefined || row.seq === item.seq);
    function milestoneStore(ctx, form, t) {
      let active = true, epoch = 0, binding, stops = [], generation, revision = -1, fetchingEpoch = null, mutatingEpoch = null, dialogId = 0;
      let value = {sessionId:null,items:[],milestones:[],dialog:null,error:'',enabled:true,busy:false};
      const listeners = new Set(), retired = new Set();
      const emit = patch => { if (!active) return; value={...value,...patch}; for (const fn of listeners) fn(); };
      const accept = (data, token) => {
        if (!active || token !== epoch || data.sessionId !== value.sessionId || !Array.isArray(data.milestones)) return;
        if (retired.has(data.generation) || generation === data.generation && data.revision < revision) return;
        if (generation && generation !== data.generation) retired.add(generation);
        generation=data.generation; revision=data.revision;
        emit({milestones:data.milestones.filter(row=>sessionIdValid(row.sessionId) && row.sessionId===value.sessionId && turnValid(row.turn) && typeof row.name==='string' && row.name.length<=80),error:''});
      };
      async function refresh() {
        const id=value.sessionId, token=epoch;
        if (!active || !value.enabled || !id || fetchingEpoch === token) return;
        fetchingEpoch=token;
        try { accept(await request('/milestones?sessionId='+encodeURIComponent(id)),token); }
        catch(error) { if (active && token===epoch) emit({error:error.message}); }
        finally { if (fetchingEpoch===token) fetchingEpoch=null; }
      }
      function selection() {
        const next=ctx.uiSession.current.getSnapshot(), id=sessionIdValid(next.key) ? next.key : null;
        const enabled=form.getSnapshot().value?.enabled !== false;
        if (next !== binding) {
          for (const stop of stops) stop(); stops=[]; binding=next;
          const update=()=>emit({items:milestoneTurns(binding)});
          for (const source of [binding.hooks?.chat,binding.keyedHooks?.projection?.('turnOutline')]) if (source?.subscribe) stops.push(source.subscribe(update));
        }
        if (id !== value.sessionId || enabled !== value.enabled) {
          epoch++; generation=undefined;revision=-1;retired.clear();
          emit({sessionId:id,enabled,items:milestoneTurns(binding),milestones:[],dialog:null,error:'',busy:false});
          void refresh();
        } else emit({items:milestoneTurns(binding)});
      }
      function edit(item) {
        if (!active || !value.enabled || !value.sessionId || mutatingEpoch===epoch || !value.items.some(x=>milestoneMatches(item,x))) return;
        const row=value.milestones.find(x=>milestoneMatches(x,item));
        emit({error:'',dialog:{id:++dialogId,sessionId:value.sessionId,item:{...item},existing:!!row,name:row?.name ?? t('milestoneTurn')+' '+item.turn,busy:false,error:''}});
      }
      const close = () => emit({dialog:null});
      async function mutate(item,name,removing=false) {
        const id=value.sessionId, token=epoch, dialog=value.dialog;
        if (!active || !value.enabled || !id || mutatingEpoch===token || !value.items.some(x=>milestoneMatches(item,x))) return;
        if (!removing && (typeof name!=='string' || !name.trim() || name.trim().length>80 || /[\p{Cc}\p{Cf}]/u.test(name))) { if(dialog)emit({dialog:{...dialog,error:t('milestoneInvalid')}}); return; }
        mutatingEpoch=token;
        emit({dialog:dialog ? {...dialog,busy:true,error:''} : null,error:'',busy:true});
        try {
          const data=await request('/milestones',{op:removing?'remove':'set',sessionId:id,...item,...(removing?{}:{name:name.trim()})});
          accept(data,token);
          if (active && token===epoch && value.dialog?.id === dialog?.id) emit({dialog:null});
        } catch(error) { if (active && token===epoch) emit(value.dialog && value.dialog.id===dialog?.id ? {dialog:{...value.dialog,busy:false,error:error.message}} : {error:error.message}); }
        finally { if(mutatingEpoch===token)mutatingEpoch=null;if(active && token===epoch)emit({busy:false}); }
      }
      ctx.effect(() => {
        const off=ctx.uiSession.current.subscribe(selection), offForm=form.subscribe(selection);
        const timer=setInterval(()=>{if(!document.hidden) void refresh();},2000);
        selection();
        return ()=>{active=false;epoch++;clearInterval(timer);off();offForm();for(const stop of stops) stop();listeners.clear();};
      });
      ctx.on('connection/reset',()=>{epoch++;fetchingEpoch=null;emit({busy:false,dialog:null});void refresh();});
      return {getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},edit,close,mutate,refresh,
      };
    }
    // DSH rc.2 has no TurnNavigator extension seat. This presentation-only adapter
    // scopes to DSH's explicit session attribute and reads data-index solely to
    // map its virtualized buttons to the public, ordered turn roster above.
    const RAIL = 'nav.xpvNua_frame', MARK='button.xpvNua_mark[data-index]', PREVIEW='.xpvNua_preview[role=tooltip]';
    function milestoneRailAdapter(ctx, store, t) {
      if (!document.querySelectorAll || typeof MutationObserver === 'undefined') return;
      let active=true, frame=0;
      const originals = new Map(), footers = new Map(), rails = new Set(), previews = new Set();
      const remember=(el,attr,val)=>{
        let row=originals.get(el);if(!row){row=new Map();originals.set(el,row);}
        if(!row.has(attr)) row.set(attr,el.getAttribute(attr));
        if(val===null) {if(el.hasAttribute(attr))el.removeAttribute(attr);} else if(el.getAttribute(attr)!==val)el.setAttribute(attr,val);
      };
      const restore=el=>{for(const [attr,val] of originals.get(el)??[]) {if(val===null)el.removeAttribute(attr);else el.setAttribute(attr,val);}originals.delete(el);};
      const itemFor = (mark,state) => {
        const raw=mark?.getAttribute('data-index');
        return raw !== null && /^(0|[1-9]\d*)$/u.test(raw) ? state.items[Number(raw)] : undefined;
      };
      const navs=state=>[...document.querySelectorAll(RAIL)].filter(nav=>nav.closest('[data-conversation-session]')?.getAttribute('data-conversation-session')===state.sessionId);
      function sync() {
        frame=0;if(!active)return;
        const state=store.getSnapshot(), current=new Set(state.enabled ? navs(state) : []), alive=new Set();
        for(const nav of rails) if(!current.has(nav)){restore(nav);rails.delete(nav);}
        for(const nav of current){rails.add(nav);remember(nav,'data-dna-rail','');
          for(const mark of nav.querySelectorAll(MARK)) {
            const item=itemFor(mark,state), row=state.milestones.find(x=>milestoneMatches(x,item));alive.add(mark);
            if(row) {remember(mark,'data-dna-milestone','');remember(mark,'title',row.name);}
            else if(originals.has(mark)){restore(mark);}
            remember(mark,'aria-keyshortcuts','Alt+M');
          }
          const preview=nav.querySelector(PREVIEW);
          if(!preview)continue;
          const mark=[...nav.querySelectorAll(MARK)].find(x=>x.getAttribute('aria-describedby')===preview.id), item=itemFor(mark,state);
          if(!item)continue;
          alive.add(preview);previews.add(preview);remember(preview,'data-dna-preview','');
          const row=state.milestones.find(x=>milestoneMatches(x,item)), signature=state.sessionId+':'+item.turn+':'+item.seq+':'+(row?.name??'')+':'+state.error+':'+state.busy;
          if(footers.get(preview)?.signature===signature)continue;
          footers.get(preview)?.node.remove();
          const footer=document.createElement('div');footer.className='dna-milestone-footer';
          if(row){const label=document.createElement('div');label.className='dna-milestone-name';label.textContent='◆ '+row.name;label.title=row.name;footer.append(label);}
          const controls=document.createElement('div');controls.className='dna-milestone-controls';
          const addButton=(label,fn)=>{const button=document.createElement('button');button.type='button';button.textContent=label;
            // The native mark's blur dismisses its preview. Keep mark focus on
            // pointer activation; keyboard users can focus the native mark and use Alt+M.
            button.tabIndex=-1;button.disabled=state.busy;button.addEventListener('pointerdown',event=>event.preventDefault());
            button.addEventListener('click',event=>{event.stopPropagation();const now=store.getSnapshot();if(now.sessionId===state.sessionId && now.enabled)fn();});controls.append(button);};
          addButton(t(row?'milestoneRename':'milestoneSet'),()=>store.edit(item));
          if(row)addButton(t('milestoneRemove'),()=>void store.mutate(item,'',true));
          footer.append(controls);
          if(state.error){const error=document.createElement('div');error.className='dna-error';error.setAttribute('role','alert');error.textContent=state.error;footer.append(error);}
          preview.append(footer);footers.set(preview,{node:footer,signature});
        }
        for(const [preview,{node}] of footers) if(!alive.has(preview)){node.remove();footers.delete(preview);previews.delete(preview);restore(preview);}
        for(const el of originals.keys()) if(!rails.has(el) && !alive.has(el))restore(el);
      }
      const schedule=()=>{if(active && !frame)frame=requestAnimationFrame(sync);};
      const onPointerMove=event=>{
        // Once a preview has actions, a diagonal move to the left is intent to
        // enter that card. Keep the current preview while crossing adjacent
        // marks; ordinary vertical rail movement still uses DSH's handler.
        if(event.pointerType!=='mouse' || event.movementX>=0)return;
        const mark=event.target.closest?.(MARK), nav=mark?.closest(RAIL), state=store.getSnapshot();
        if(state.enabled && nav && navs(state).includes(nav) && nav.querySelector('[data-dna-preview] .dna-milestone-controls'))event.stopPropagation();
      };
      const onKey=event=>{
        if(!event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase()!=='m')return;
        const mark=event.target.closest?.(MARK), state=store.getSnapshot();
        if(!mark || !state.enabled || !navs(state).includes(mark.closest(RAIL)))return;
        const item=itemFor(mark,state);if(item){event.preventDefault();event.stopPropagation();store.edit(item);}
      };
      ctx.effect(()=>{
        const observer=new MutationObserver(schedule);
        observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-index','aria-describedby','data-conversation-session']});
        const off=store.subscribe(schedule);document.addEventListener('keydown',onKey,true);document.addEventListener('pointermove',onPointerMove,true);schedule();
        return()=>{active=false;observer.disconnect();off();cancelAnimationFrame(frame);document.removeEventListener('keydown',onKey,true);document.removeEventListener('pointermove',onPointerMove,true);
          for(const {node} of footers.values())node.remove();footers.clear();for(const el of originals.keys())restore(el);rails.clear();previews.clear();};
      });
    }
    function MilestoneDialog({store,t}) {
      const state=React.useSyncExternalStore(store.subscribe,store.getSnapshot), dialog=state.dialog;
      return dialog ? h(MilestoneDialogBody,{key:dialog.id,store,t,dialog,state}) : null;
    }
    function MilestoneDialogBody({store,t,dialog,state}) {
      const [name,setName]=React.useState(dialog.name??''), root=React.useRef(null), labelId=React.useId();
      React.useEffect(()=>{
        const previous=document.activeElement, node=root.current;
        const focusables=()=>[...node.querySelectorAll('input,button:not(:disabled)')];
        const initial=node.querySelector('input')??focusables()[0];initial?.focus();initial?.select?.();
        const key=event=>{
          if(event.key==='Escape'){event.preventDefault();event.stopPropagation();store.close();return;}
          if(event.key==='Tab'){
            const nodes=focusables(), first=nodes[0], last=nodes.at(-1);
            if(event.shiftKey && (document.activeElement===first || !node.contains(document.activeElement))){event.preventDefault();last?.focus();}
            else if(!event.shiftKey && (document.activeElement===last || !node.contains(document.activeElement))){event.preventDefault();first?.focus();}
          }
        };
        document.addEventListener('keydown',key,true);
        return()=>{document.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus();};
      },[store]);
      return h('div',{className:'dna-milestone-backdrop',onPointerDown:event=>{if(event.target===event.currentTarget)store.close();}},
        h('div',{ref:root,className:'dna-milestone-dialog',role:'dialog','aria-modal':true,'aria-labelledby':labelId},
          h('h2',{id:labelId},t(dialog.existing?'milestoneRename':'milestoneSet')),
          h('form',{onSubmit:event=>{event.preventDefault();void store.mutate(dialog.item,name);}},
            h('label',{htmlFor:labelId+'-name'},t('milestoneName')),
            h('input',{id:labelId+'-name',type:'text',maxLength:80,value:name,disabled:dialog.busy,onChange:event=>setName(event.target.value),autoComplete:'off'}),
            h('small',null,t('milestoneHint')),
            h('div',{className:'dna-actions'},h('button',{type:'button',onClick:store.close},t('cancel')),h('button',{type:'submit',className:'dna-primary',disabled:dialog.busy||!name.trim()},t(dialog.busy?'saving':'save')))),
          (dialog.error||state.error) && h('p',{role:'alert',className:'dna-error'},dialog.error||state.error)));
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
      const t = ctx.locale.bind(NS), form = ctx.configForms.get(NS), unread = unreadStore(ctx), viewerError = trackViewer(ctx,unread);
      viewerError.sessionId = () => ctx.uiSession.current.getSnapshot().key;
      trackActivation(ctx,viewerError);
      const feedback = feedbackStore(ctx), actions = menuActions(ctx,viewerError,feedback,t,unread);
      const milestones = milestoneStore(ctx,form,t);
      milestoneRailAdapter(ctx,milestones,t);
      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name:'shell.overlay',id:'dsh-notify-all-milestone-dialog',order:851,locale:NS,inject:()=>({store:milestones,t}),
      },MilestoneDialog)));
      ctx.effect(() => ctx.slots.inject('sidebar.session.row.leading', () => ctx.slots.register({
        name:'sidebar.session.row.leading',id:'dsh-notify-all-unread',order:450,locale:NS,inject:()=>({store:unread,t}),
      },UnreadMarker)));
      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name:'shell.overlay',id:'dsh-notify-all-feedback',order:850,locale:NS,inject:()=>({store:feedback,t}),
      },Feedback)));
      const menu = 'sidebar.workspaces.session.menu.item';
      ctx.effect(() => ctx.slots.inject(menu, () => ctx.slots.register({
        name:menu,id:'dsh-notify-all-session-actions',order:450,locale:NS,inject:()=>({actions,t,store:unread}),
      },SessionMenuActions)));
      ctx.effect(() => ctx.slots.inject('settings.action', () => ctx.slots.register({
        name:'settings.action', id:'dsh-notify-all-viewer', order:100,
        inject:()=>({setCovered:viewerError.setCovered}),
      }, ViewerCover)));
      ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name:'settings.section', id:NS, order:40, label:()=>t('title'), locale:NS, inject:()=>({form,t,viewerError}),
      }, Page))));
    }
    return { apply, inject:['slots','locale','configForms','uiSession','sessions','layout','uiWorkspace','remote','remote.session'], FIELDS, trackViewer, trackActivation, ViewerCover, Page, SessionMenuActions, menuActions, sessionLink, unreadStore, UnreadMarker, request, milestoneTurns, milestoneMatches, milestoneStore, milestoneRailAdapter, MilestoneDialog };
  },
});
