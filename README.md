# DSH 通知与角标 0.2.3

源码和问题反馈：[sodakitten/dsh-notify-all](https://github.com/sodakitten/dsh-notify-all)。

Windows 桌面端插件，针对 DeepSeek Harness 0.2.0-rc.2 的已安装接口实现。
DSH 0.2.1-alpha.1 尚未完成兼容性验证；通知点击跳转需要官方桌面端的 `dsh://open` 协议。

任务完成、失败、中止、受阻，以及提问、审批和计划确认时发送系统通知。
任务栏数字等于“未读结束事件（或手动未读）+ 尚待处理的请求”。打开某个会话只清除该会话的未读；提问、审批、计划需处理后才减少。其他会话在 DSH 前台结束仍会计数。同一个持久化结束事件只计算一次。

设置入口：账号菜单 → 设置 → 通知与角标。支持红色/黑色数字底色、声音、Windows 通知、任务栏数字和各类提醒开关；点击通知可选择唤起桌面端或打开网页端。额外插件托盘图标默认关闭。页面没有右下角浮动栏。

0.2.1 的通知拥有独立发送身份 DeepSeekHarness.NotifyAll，显示 DSH 的名称与鲸鱼图标，不更改 PowerShell 的通知身份、图标或偏好。点击单会话通知会打开对应对话；合并通知打开合并批次中的最后一个会话。

点击由源码编译的 Windows GUI 程序处理，启动链路不运行 PowerShell 控制台。它经 DSH 自带 dsh://open 唤起应用，再由客户端调用公开的 uiWorkspace.openSession。系统通知使用带随机令牌的本地点击收件箱；验证选中目标会话后才确认消费。网页目标使用插件自己的 URL 片段，通过同一个官方导航服务定位。

## 会话菜单（0.2.2）

侧边栏会话的「…」菜单保留置顶、重命名、分叉、归档等原有项目，并追加：

| 项目 | 行为 |
|---|---|
| 在资源管理器中打开 | 打开该菜单所属会话的工作目录，经官方 `remote.session.openWorkspacePath` 验证路径；没有目录或打开失败时显示错误。 |
| 标记为未读 | 至少保留一个任务栏未读数字，不发送系统通知、不播放通知声音。重复标记不累加；已有多个未读完成事件时保留原计数。 |
| 复制会话ID | 复制该会话的真实 Session ID。 |
| 复制会话链接 | 复制 `dsh-notify-all://session/session-UUID`，在本机唤起 DSH 并打开该会话。 |

当前正在看的会话也能标记未读。数字保留到切换到别的会话后重新打开，或在设置中点击「全部标记已读」；心跳、窗口焦点变化、打开和关闭设置均不清除它。「切回窗口清空全部未读」也保留手动未读。等待回答、审批、计划确认的数字仍需处理后消失。数字显示受「启用插件」和「任务栏数字角标」设置控制。

会话链接只携带会话 ID，没有点击令牌或认证参数，只允许导航。它是本机链接：目标电脑需要安装此插件，并在相应 desktop profile 中存在该会话；它不是在线分享地址，也不会上传对话。更新插件后完全退出并启动 DSH，才能注册支持此链接的新 GUI 助手。剪贴板不可用时，插件提供可手动选择复制的文本。

## 0.2.3 更新

- 四个菜单操作成功后均不显示浮动提示，包括「会话ID已复制」。操作失败仍显示错误；剪贴板写入失败时保留可手动复制的文本。
- 手动未读使用官方 `sidebar.session.row.leading` 插槽显示静止蓝点，重新打开菜单可看到「已标记为未读」。状态直接从 Host 响应更新，其他窗口或已读操作在心跳中同步；旧响应不会覆盖刚完成的标记。
- DSH 原生的进行中、待处理和完成指示优先于未读蓝点；运行中的会话仍显示原生转圈，实际结束后由 DSH 更新。插件不会把未读状态写入会话的运行状态，也不会在仍有工作时强制隐藏转圈。
- 标记运行中或已加载的会话，直接检查官方 Host `sessions` 名册，避免等待全部持久化会话的查询。未加载会话的校验最多等待 5 秒，支持请求取消和插件卸载取消，超时后不再写入迟到的结果。
- Client 请求最多等待 8 秒，即使传输没有响应，查看会话的报告队列也能恢复并发送最新选择。慢查询不阻塞其他会话的未读操作。

菜单使用 `sidebar.workspaces.session.menu.item` 官方插槽及原生菜单开关 Hook；按钮自行实现 DSH 的主题 token、间距、`role=menuitem` 和键盘焦点样式，只导入 React。没有修改 DSH 安装文件或替换原有菜单。手动未读同时提供 `dsh_notify_mark_unread` 智能体工具，与菜单调用同一 Host 操作。

## 0.2.1 更新

- 系统通知使用独立的 `DeepSeekHarness.NotifyAll` 身份、DSH 名称和鲸鱼图标。
- 点击通知直接调用 GUI 协议助手，不再通过 PowerShell 控制台唤起窗口，避免黑窗口闪现。
- 点击目标携带真实 Session ID，通过 DSH 的 `uiWorkspace.openSession` 定位对应会话。
- 导航成功后才确认点击消费；失败或尚未选中目标时保留待处理点击，避免错误清除其他会话未读。
- 通知身份注册限定在插件自己的 AppUserModelID、快捷方式和协议，不更改 PowerShell 的通知配置。

发送通知和绘制角标的后台脚本仍通过隐藏进程运行；消除黑窗口针对的是通知点击的启动链路。

## 安装与更新

可从本仓库的 **Code → Download ZIP** 下载源码，解压到固定位置；或使用 Git：

```powershell
git clone https://github.com/sodakitten/dsh-notify-all.git
```

先通过桌面端菜单的「管理 dsh 命令」安装 DSH 自带 CLI，首次安装可指定本包的绝对目录：

```powershell
dsh plugin --profile desktop add "file:C:/plugins/dsh-notify-all"
```

更新推荐使用带版本号的独立 TGZ，避免复用同一个目录依赖时仍加载缓存中的旧包：

```powershell
dsh plugin --profile desktop add "file:C:/plugins/dsh-notify-all-0.2.3.tgz"
```

路径是示例，请替换为实际位置。开发者可在仓库中运行 `npm pack` 生成 TGZ。
也可在 DSH 内使用官方插件管理能力安装绝对目录：

```json
{"action":"install_bundle","target":"C:/path/to/dsh-notify-all"}
```

目录内应包含 package.json、cordis.patch.yml、lib、scripts、locale 和 icon.svg。解压发布 ZIP 后选中内层 dsh-notify-all 目录。包依赖由插件管理器解析。已链接此开发目录的本机安装可直接更新代码，再完全退出并启动 DSH。不要手写 profile 的 package.json 或 cordis.patch.yml；不要在 profile 中运行 pnpm。

安装或更新后完全退出并重新启动 DSH，加载 Host、客户端与原生通知助手。
旧 prefs.json/config.json 的已知设置仅在首次启动时通过官方 Settings.update 迁入用户设置，已有原生设置优先。之后唯一设置来源是 DSH 原生设置；不会再写旧偏好文件。

## 默认值

| 设置 | 默认 |
|---|---|
| 启用 / 系统通知 / 声音 / 任务栏数字 | 开启 |
| 数字底色 | 红色 |
| 额外托盘图标 | 关闭 |
| 点击通知 | 唤起桌面端 |
| 切回窗口清空全部未读 | 关闭，默认按会话读取 |
| 完成 / 失败 / 受阻 / 审批 / 提问 / 计划提醒 | 开启 |
| 子智能体计入未读 | 关闭 |
| 后续完成通知合并 / 同类通知间隔 | 0 毫秒 |
| 摘要长度 | 180 字符 |

关闭某类提醒或系统通知只停止对应 Toast，数字仍反映实际待处理和未读。停用整个插件会隐藏数字并停止记录新事件。普通“全部标记已读”不会清掉仍待回答或审批的请求。

## 桌面端规范与实现

- Host 使用 Cordis session/event，并为每个设置声明 volatile Config。
- Client 是 __ModuleLoader__ 的惰性模块，只导入 React；通过注入的服务读取 UiSession、Layout 和 Sessions。
- 使用实际 Session ID 与窗口焦点，没有窗口标题匹配、最近发消息猜测或 DOM 抓取。
- 设置页注册在 settings.section，使用 ConfigForms 的快照、订阅和保存队列，以及 DSH 主题 token、Locale 服务。
- 状态与操作路由通过 Connection.fetch.register，沿用官方鉴权和浏览器来源检查。
- 订阅、路由、计时器和原生助手均随插件卸载清理；助手监测宿主进程退出。
- PowerShell 5.1 ASCII 脚本接收 Base64 UTF-8 参数；状态输出为无 BOM JSON，读取兼容历史 BOM。
- 数字通过 Windows ITaskbarList4/3.SetOverlayIcon 显示，正确使用接口 GUID、真实 HWND 并记录 HRESULT；窗口重建与 Explorer 恢复时重新应用。

## 检查与排障

设置页“测试角标”只增加一个测试未读数字，不发系统通知；检查后点“全部标记已读”。“发送一条测试通知”每次仅发一条，作为显式测试可绕过系统通知开关。

运行状态在 DSH 主目录的 dsh-notify-all 子目录，通常为 %USERPROFILE%\.dsh\dsh-notify-all：

- log.txt：宿主事件、真实查看会话 ID、通知调用与错误。
- tray.log：原生助手启动、窗口和接口调用。
- native-status.json：hwnd、hresult、count、color、via。hresult 为 0 表示接口接受调用，不等同于已肉眼验证桌面显示。
- state.json：未读、等待请求及事件去重数据；重启保留。
- badge.json：原生助手状态；settings-migrated.json：一次性设置迁移记录。
- native-identity.json、dsh.png、activate-0.2.2-*.exe：独立通知身份与无控制台入口。
- activation-key.txt、activation-inbox、activation.log：点击令牌、点击消息及错误。不要公开令牌。

没有系统通知时检查 Windows 的“DeepSeek Harness”通知权限和勿扰模式，以及 log.txt 中 native notification setup 的返回值。插件注册独立 AppUserModelID、带该 ID 的用户开始菜单快捷方式以及插件自己的协议，不修改 DSH 原有协议或 PowerShell 注册项。浏览器目标依赖 DSH WebServer 服务，不可用时回退桌面端。角标需要 Windows 的常规任务栏按钮，系统的小图标/任务栏策略可能抑制显示。

## 开发检查

安装依赖后，在仓库根目录运行：

```powershell
npm install
npm test
npm run test:native
```

`tests/regression-test.mjs` 驱动真实 Host/Client 代码，使用模拟的公开服务接口，覆盖会话切换、去重、等待请求、PTC 子调用、恢复、关闭提醒、持久化、点击校验、官方导航和清理，不发送系统通知。
`tests/unread-concurrency-test.mjs` 覆盖运行中标记、互不阻塞的操作、真实超时、取消后迟到结果、查看报告恢复、静止圆点、静默成功和卸载清理。
`tests/native-regression.ps1` 需要 Windows，禁用实际绘制和通知，检查真实 COM、状态文件和助手退出。COM 返回成功仅证明接口接受调用，不能替代通知图标、实际跳转及任务栏数字的视觉检查。

0.2.3 已通过 133 项 Host/Client 检查和 25 项 Windows 原生检查，包括会话菜单动作、当前会话静默未读、焦点和设置覆盖、切换合并、剪贴板失败、不存在的会话，以及 Host/C# 两端共同的链接校验用例。原生检查编译 GUI 助手并检查 PE 子系统，避免把控制台 EXE 当成无黑窗口入口。

点击助手的 C# 源码位于 `scripts/activate.cs`，首次启用时由 Windows 自带编译器生成 GUI 子系统 EXE，保存在 DSH 运行数据目录，不把机器生成的 EXE 或点击令牌提交到仓库。

## 许可

MIT，见 [LICENSE](./LICENSE)。
