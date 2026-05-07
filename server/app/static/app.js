const LANGUAGE_STORAGE_KEY = "open-computer-use-console-language";

const I18N = {
  en: {
    documentTitle: "Open Computer Use Console",
    appEyebrow: "Desktop Agent Studio",
    appTitle: "Open Computer Use",
    appSubtitle:
      "Configure your model, operate desktop tools, and manage permissions from dedicated tabs.",
    primarySectionsAria: "Primary sections",
    tabRunConfig: "Run Config",
    tabConsole: "Console",
    tabApps: "Apps",
    tabPermissions: "Permissions",
    labelLanguage: "Language",
    languageOptionEnglish: "English",
    languageOptionChinese: "Chinese",
    labelModel: "Model",
    labelBaseUrl: "Base URL",
    labelApiMode: "API Mode",
    labelThinkingMode: "Thinking Mode",
    optionThinkingAuto: "auto",
    optionThinkingEnabled: "enabled",
    optionThinkingDisabled: "disabled",
    labelReasoningEffort: "Reasoning Effort",
    labelModelCompatMode: "Compatibility Mode",
    optionCompatAuto: "auto",
    optionCompatStandard: "standard",
    optionCompatAggressiveKimi: "aggressive_kimi",
    labelApiKey: "API Key",
    placeholderApiKey: "sk-...",
    labelSystemPrompt: "System Prompt",
    labelMaxSteps: "Max Steps",
    labelEnableOcr: "Enable OCR",
    labelMaxImagesPerToolResult: "Images Per Tool",
    labelModelImageMaxEdge: "Image Max Edge",
    labelModelImageMaxBytes: "Image Max Bytes",
    buttonSaveConfig: "Save To Server",
    headingRunSetup: "Run Setup",
    hintConfig:
      "Configuration is stored on the server so every browser session that connects here can reuse the same runtime settings. OCR is optional; the agent will prefer inspecting screenshots directly when the model supports vision.",
    headingAppStudio: "Desktop Control Studio",
    hintApps:
      "Search the local app catalog, identify the current frontmost app, capture the accessibility tree, and trigger precise actions from one workspace.",
    metricCatalog: "Catalog",
    metricCatalogValue: "Launch and focus apps",
    metricSnapshot: "Snapshot",
    metricSnapshotValue: "Inspect live UI state",
    metricActions: "Actions",
    metricActionsValue: "Click, type, preview",
    headingAppControl: "App Control",
    hintAppControl:
      "Use app-level controls first to make sure the correct window is in front before you capture or click anything.",
    labelFindApps: "Find Apps",
    placeholderAppQuery: "Safari / Finder / WeChat / Xcode...",
    buttonListApps: "List Apps",
    buttonFrontmost: "Frontmost",
    labelLaunchOrActivate: "Launch Or Activate",
    placeholderAppTarget: "App name, e.g. Safari",
    buttonLaunch: "Launch",
    buttonActivate: "Activate",
    emptyAppOutput: "No app actions yet.",
    headingUiSnapshot: "UI Snapshot",
    hintSnapshotStudio:
      "Capture the accessibility tree, inspect the selected element, and run precise follow-up actions from one place.",
    labelTargetAppOptional: "Target App (Optional)",
    placeholderSnapshotTarget: "Leave blank to inspect the frontmost app",
    labelTreeDepth: "Tree Depth",
    labelChildrenPerNode: "Children Per Node",
    labelShowOnlyInteractable: "Show Only Interactable",
    optionAll: "all",
    optionInteractableOnly: "interactable only",
    labelRoleFilter: "Role Filter",
    placeholderRoleFilter: "AXButton / AXTextField / AXLink...",
    labelReuseLastSnapshot: "Reuse Last Snapshot",
    buttonCaptureSnapshot: "Capture Snapshot",
    labelElementIdToClick: "Element ID To Click",
    placeholderElementId: "window-1/child-2/child-1",
    labelTextForSelectedElement: "Text For Selected Element",
    placeholderElementText: "Type into a selected input field...",
    labelClearBeforeTyping: "Clear Before Typing",
    labelAccessibilityAction: "Accessibility Action",
    optionSelectAction: "Select action from snapshot...",
    optionNoAccessibilityActions: "No accessibility actions exposed",
    buttonClickElement: "Click Element",
    buttonPressElement: "Press Element",
    buttonFocusElement: "Focus Element",
    buttonTypeIntoElement: "Type Into Element",
    buttonSetValue: "Set Value",
    buttonRunAction: "Run Action",
    buttonPreviewElement: "Preview Element",
    altElementPreview: "Element preview",
    emptyElementMeta: "No element selected yet.",
    emptySnapshotTree: "No parsed elements yet.",
    emptySnapshotOutput: "No UI snapshots yet.",
    headingConversation: "Conversation",
    hintConversation:
      "Talk to the agent here, then move to the Apps tab when you want direct desktop control.",
    headingObservationContextEyebrow: "Live Context",
    headingObservationContext: "Current Observation",
    emptyObservationContext: "No active observation yet.",
    altObservationContext: "Current observation preview",
    buttonRefreshObservation: "Refresh View",
    buttonRefreshPointer: "Locate Pointer",
    buttonJumpApps: "Open Apps Tab",
    buttonUseFrontmost: "Use Frontmost App",
    labelObservationDisplay: "Display",
    labelObservationRefreshMode: "Refresh Mode",
    optionObservationDisplay: "Display",
    optionObservationRegion: "Current Region",
    statusObservationDisplaySynced: "Observation display selection updated.",
    statusRefreshingObservation: "Refreshing current observation...",
    statusObservationRefreshed: "Current observation refreshed.",
    statusObservationRefreshFailed: "Refreshing observation failed.",
    statusRefreshingPointer: "Refreshing pointer state...",
    statusPointerRefreshed: "Pointer state refreshed.",
    statusPointerRefreshFailed: "Refreshing pointer state failed.",
    buttonClear: "Clear",
    statusReady: "Ready.",
    placeholderUserInput:
      "Ask it to inspect, preview, open Safari, or click with debug output...",
    buttonSend: "Send",
    buttonThinking: "Thinking...",
    headingToolTrace: "Tool Trace",
    hintTrace:
      "Use the raw trace to verify whether the model actually requested tools and what each step returned.",
    emptyTraceOutput: "No tool calls yet.",
    toolTraceInlineSummary: "Used {count} tools",
    toolTraceArguments: "Arguments",
    toolTraceResult: "Result",
    toolTracePreview: "Preview",
    toolTraceRaw: "Raw Data",
    toolTraceStatusSuccess: "OK",
    toolTraceStatusError: "Error",
    toolTraceStatusPending: "Running",
    toolTraceStatusQueued: "Queued",
    toolTraceNoResult: "No structured result returned.",
    toolTraceApiMode: "{mode}",
    toolTraceStep: "Step {step}",
    toolTraceDisplays: "{count} displays",
    toolTraceDuration: "{ms} ms",
    toolTraceObservation: "View",
    toolTraceCoordinates: "Coordinates",
    toolTraceVerification: "Verification",
    toolTracePreviewRegion: "Preview Region",
    toolTracePreviewMarker: "Marker",
    toolTraceBeforeView: "Before View",
    toolTraceAfterView: "After View",
    toolTraceVerificationPassed: "Verified",
    toolTraceVerificationUncertain: "Check needed",
    toolTraceVerificationFailed: "Failed",
    toolTraceStageReasoning: "Thinking",
    toolTraceStageTooling: "Running tools",
    toolTraceStageFinished: "Finished",
    diagnosticsContentFilter: "Content filter triggered",
    diagnosticsDegradedRetry: "Degraded retry used",
    diagnosticsHistoryTrimmed: "History trimmed",
    diagnosticsAggressiveTrim: "Aggressive trim used",
    diagnosticsRequestId: "Request {id}",
    diagnosticsSerializedSummary:
      "Sent {messages} msgs · sys {system} · user {user} · assistant {assistant} · tool {tool}",
    diagnosticsSerializedDetail:
      "Reasoning {reasoning} · image parts {images}",
    headingPermissions: "Permissions",
    hintPermissions:
      "The app checks desktop permissions on load. On macOS, some items can open System Settings but still require manual approval.",
    buttonRefresh: "Refresh",
    buttonRequestMissing: "Request Missing",
    emptyPermissionSummary: "Permission status not loaded yet.",
    emptyPermissionList: "No permissions loaded yet.",
    emptyPermissionOutput: "No permission actions yet.",
    roleUser: "User",
    roleAssistant: "Assistant",
    roleSystem: "System",
    permissionStatusGranted: "Granted",
    permissionStatusMissing: "Missing",
    permissionStatusUnsupported: "Unsupported",
    permissionStatusUnknown: "Unknown",
    permissionGroupSystem: "System Permission",
    permissionGroupRuntime: "Runtime Capability",
    permissionGroupSystemTitle: "System Permissions",
    permissionGroupSystemDescription:
      "OS-level access that may require explicit approval in System Settings.",
    permissionGroupRuntimeTitle: "Runtime Capabilities",
    permissionGroupRuntimeDescription:
      "Local libraries and session features that the agent depends on at runtime.",
    permissionReadOnly: "Read-only check",
    permissionBlocking: "Blocking",
    permissionOptional: "Optional",
    permissionManualSteps: "Manual Steps",
    buttonRequestAccess: "Request Access",
    permissionSummaryReady: "Desktop automation is ready on {platform}.",
    permissionSummaryNotReady:
      "Desktop automation is not ready yet on {platform}. Missing blocking items: {count}.",
    permissionUnknownRequirement: "The current state could not be determined precisely.",
    permissionRequirementReady: "This requirement looks ready.",
    permissionRequirementMissing: "This requirement is currently missing.",
    permissionRequirementUnsupported: "This check is not supported on the current platform.",
    treeWindowPrefix: "[window]",
    treeUntitledWindow: "Untitled window",
    treeUnknown: "unknown",
    requestFailedPrefix: "Request failed",
    statusConfigSaved: "Configuration saved on server.",
    statusConfigLoaded: "Configuration loaded from server.",
    statusConfigLoadFailed: "Configuration load failed.",
    statusConfigSaving: "Saving configuration to server...",
    statusConfigSaveFailed: "Configuration save failed.",
    statusSelectedElement: "Selected element {id}.",
    statusRunningAction: "Running {action}...",
    statusPerformActionFailed: "Perform action failed.",
    statusCheckingPermissions: "Checking desktop permissions...",
    statusPermissionLoaded: "Permission status loaded.",
    statusPermissionCheckFailed: "Permission check failed.",
    statusRequestingPermissions: "Requesting desktop permissions...",
    statusPermissionRequestFinished: "Permission request finished.",
    statusPermissionRequestFailed: "Permission request failed.",
    statusCallingModel: "Calling model via {mode} mode...",
    statusReplyReceivedVia: "Reply received via {mode} mode.",
    statusReplyReceived: "Reply received.",
    statusRequestFailed: "Request failed.",
    statusStreamFallback: "Streaming is unavailable, retrying with standard mode...",
    statusStreamInterrupted: "Streaming was interrupted after execution started. The run may still be active on the server.",
    statusConversationCleared: "Conversation cleared.",
    statusLoadingAppList: "Loading app list...",
    statusLoadedApps: "Loaded {count} apps.",
    statusAppListingFailed: "App listing failed.",
    statusReadingFrontmostApp: "Reading frontmost app...",
    statusFrontmostLoaded: "Frontmost app loaded.",
    statusFrontmostFailed: "Frontmost app lookup failed.",
    actionLaunching: "Launching",
    actionActivating: "Activating",
    statusAppActionRunning: "{action} app...",
    statusAppActionFinished: "App action finished.",
    statusAppActionFailed: "App action failed.",
    statusCapturingSnapshot: "Capturing accessibility snapshot...",
    statusSnapshotCaptured: "Accessibility snapshot captured.",
    statusSnapshotFailed: "Accessibility snapshot failed.",
    statusClickingElement: "Clicking element...",
    statusElementClicked: "Element clicked.",
    statusElementClickFailed: "Element click failed.",
    statusFocusingElement: "Focusing element...",
    statusElementFocused: "Element focused.",
    statusFocusElementFailed: "Focus element failed.",
    statusPressingElement: "Pressing element...",
    statusElementPressed: "Element pressed.",
    statusPressElementFailed: "Press element failed.",
    statusTypingIntoElement: "Typing into element...",
    statusTypedIntoElement: "Typed into element.",
    statusTypeIntoElementFailed: "Type into element failed.",
    statusSettingElementValue: "Setting element value...",
    statusElementValueSet: "Element value set.",
    statusSetValueFailed: "Set value failed.",
    statusPreviewingElement: "Previewing element...",
    statusPreviewCaptured: "Element preview captured.",
    statusPreviewFailed: "Preview element failed.",
    alertModelBaseRequired: "Please fill in model and base URL first.",
    alertElementIdRequired: "Please enter an element_id first.",
    alertAccessibilityActionRequired: "Please select an accessibility action first.",
    alertTextRequired: "Please enter text first.",
    alertAppNameRequired: "Please enter an app name first.",
    assistantRequestFailed: "Request failed: {message}",
    outputRequestFailed: "Request failed: {message}",
    selectedElementMissing: "Selected element is not present in the current snapshot.",
  },
  zh: {
    documentTitle: "Open Computer Use 控制台",
    appEyebrow: "桌面代理工作台",
    appTitle: "Open Computer Use",
    appSubtitle: "配置模型，操作桌面工具，并通过独立标签页管理不同工作流。",
    primarySectionsAria: "主要分区",
    tabRunConfig: "运行配置",
    tabConsole: "控制台",
    tabApps: "应用",
    tabPermissions: "权限",
    labelLanguage: "语言",
    languageOptionEnglish: "English",
    languageOptionChinese: "中文",
    labelModel: "模型",
    labelBaseUrl: "Base URL",
    labelApiMode: "API 模式",
    labelThinkingMode: "思考模式",
    optionThinkingAuto: "自动",
    optionThinkingEnabled: "开启",
    optionThinkingDisabled: "关闭",
    labelReasoningEffort: "推理强度",
    labelModelCompatMode: "兼容模式",
    optionCompatAuto: "自动",
    optionCompatStandard: "标准",
    optionCompatAggressiveKimi: "强兼容 Kimi",
    labelApiKey: "API Key",
    placeholderApiKey: "sk-...",
    labelSystemPrompt: "系统提示词",
    labelMaxSteps: "最大步数",
    labelEnableOcr: "启用 OCR",
    labelMaxImagesPerToolResult: "每步图片数",
    labelModelImageMaxEdge: "图片最大边长",
    labelModelImageMaxBytes: "图片最大字节数",
    buttonSaveConfig: "保存到服务端",
    headingRunSetup: "运行配置",
    hintConfig: "配置会保存到服务端，因此连接到这个实例的不同浏览器会共享同一份运行设置。OCR 是可选的；当模型支持视觉时，代理会优先直接看截图。",
    headingAppStudio: "桌面控制工作台",
    hintApps: "在一个工作台里完成应用查找、前台确认、辅助功能树抓取，以及后续的精确操作。",
    metricCatalog: "应用目录",
    metricCatalogValue: "启动并切换应用",
    metricSnapshot: "快照",
    metricSnapshotValue: "检查当前界面状态",
    metricActions: "动作",
    metricActionsValue: "点击、输入、预览",
    headingAppControl: "应用控制",
    hintAppControl: "先用应用级控制把正确窗口切到前台，再去抓快照和做精确点击，会稳定很多。",
    labelFindApps: "查找应用",
    placeholderAppQuery: "Safari / Finder / 微信 / Xcode...",
    buttonListApps: "列出应用",
    buttonFrontmost: "前台应用",
    labelLaunchOrActivate: "启动或激活",
    placeholderAppTarget: "应用名称，例如 Safari",
    buttonLaunch: "启动",
    buttonActivate: "激活",
    emptyAppOutput: "暂无应用操作结果。",
    headingUiSnapshot: "界面快照",
    hintSnapshotStudio: "抓取辅助功能树，检查选中的元素，并在同一个工作区里继续执行精确动作。",
    labelTargetAppOptional: "目标应用（可选）",
    placeholderSnapshotTarget: "留空则检查当前前台应用",
    labelTreeDepth: "树深度",
    labelChildrenPerNode: "每个节点的子项数量",
    labelShowOnlyInteractable: "仅显示可交互项",
    optionAll: "全部",
    optionInteractableOnly: "仅可交互",
    labelRoleFilter: "角色过滤",
    placeholderRoleFilter: "AXButton / AXTextField / AXLink...",
    labelReuseLastSnapshot: "复用上次快照",
    buttonCaptureSnapshot: "抓取快照",
    labelElementIdToClick: "要点击的 Element ID",
    placeholderElementId: "window-1/child-2/child-1",
    labelTextForSelectedElement: "选中元素的文本",
    placeholderElementText: "向选中的输入框输入文本...",
    labelClearBeforeTyping: "输入前先清空",
    labelAccessibilityAction: "辅助功能动作",
    optionSelectAction: "从快照中选择动作...",
    optionNoAccessibilityActions: "没有可用的辅助功能动作",
    buttonClickElement: "点击元素",
    buttonPressElement: "按下元素",
    buttonFocusElement: "聚焦元素",
    buttonTypeIntoElement: "向元素输入",
    buttonSetValue: "设置值",
    buttonRunAction: "执行动作",
    buttonPreviewElement: "预览元素",
    altElementPreview: "元素预览图",
    emptyElementMeta: "当前没有选中元素。",
    emptySnapshotTree: "暂无解析出的元素。",
    emptySnapshotOutput: "暂无界面快照结果。",
    headingConversation: "对话",
    hintConversation: "这里负责和代理对话；当你要直接操作桌面时，再切到“应用”标签页。",
    headingObservationContextEyebrow: "实时上下文",
    headingObservationContext: "当前观察",
    emptyObservationContext: "当前还没有可用的 observation。",
    altObservationContext: "当前观察预览",
    buttonRefreshObservation: "刷新观察",
    buttonRefreshPointer: "定位鼠标",
    buttonJumpApps: "打开应用页",
    buttonUseFrontmost: "使用前台应用",
    labelObservationDisplay: "屏幕",
    labelObservationRefreshMode: "刷新方式",
    optionObservationDisplay: "整块屏幕",
    optionObservationRegion: "当前区域",
    statusObservationDisplaySynced: "Observation 屏幕选择已更新。",
    statusRefreshingObservation: "正在刷新当前 observation...",
    statusObservationRefreshed: "当前 observation 已刷新。",
    statusObservationRefreshFailed: "刷新 observation 失败。",
    statusRefreshingPointer: "正在刷新鼠标位置...",
    statusPointerRefreshed: "鼠标位置已刷新。",
    statusPointerRefreshFailed: "刷新鼠标位置失败。",
    buttonClear: "清空",
    statusReady: "就绪。",
    placeholderUserInput: "让它检查界面、预览、打开 Safari，或者带调试信息地点击某个位置...",
    buttonSend: "发送",
    buttonThinking: "思考中...",
    headingToolTrace: "工具调用轨迹",
    hintTrace: "这里保留原始工具轨迹，方便确认模型有没有真的发起工具调用，以及每一步返回了什么。",
    emptyTraceOutput: "暂无工具调用。",
    toolTraceInlineSummary: "调用了 {count} 个工具",
    toolTraceArguments: "参数",
    toolTraceResult: "结果",
    toolTracePreview: "预览",
    toolTraceRaw: "原始数据",
    toolTraceStatusSuccess: "成功",
    toolTraceStatusError: "错误",
    toolTraceStatusPending: "执行中",
    toolTraceStatusQueued: "已排队",
    toolTraceNoResult: "没有返回可展示的结果。",
    toolTraceApiMode: "{mode}",
    toolTraceStep: "第 {step} 步",
    toolTraceDisplays: "共 {count} 屏",
    toolTraceDuration: "{ms} ms",
    toolTraceObservation: "观察来源",
    toolTraceCoordinates: "坐标",
    toolTraceVerification: "验证",
    toolTracePreviewRegion: "预览区域",
    toolTracePreviewMarker: "标记点",
    toolTraceBeforeView: "点击前画面",
    toolTraceAfterView: "点击后画面",
    toolTraceVerificationPassed: "已验证",
    toolTraceVerificationUncertain: "需确认",
    toolTraceVerificationFailed: "失败",
    toolTraceStageReasoning: "思考中",
    toolTraceStageTooling: "执行工具中",
    toolTraceStageFinished: "已完成",
    diagnosticsContentFilter: "命中过内容风控",
    diagnosticsDegradedRetry: "已启用降级重试",
    diagnosticsHistoryTrimmed: "已裁剪上下文",
    diagnosticsAggressiveTrim: "已启用强裁剪",
    diagnosticsRequestId: "请求 {id}",
    diagnosticsSerializedSummary:
      "实际发送 {messages} 条消息 · system {system} · user {user} · assistant {assistant} · tool {tool}",
    diagnosticsSerializedDetail:
      "推理消息 {reasoning} · 图片片段 {images}",
    headingPermissions: "权限",
    hintPermissions: "页面加载时会自动检查桌面权限。在 macOS 上，有些项目可以打开系统设置，但仍然需要你手动批准。",
    buttonRefresh: "刷新",
    buttonRequestMissing: "请求缺失项",
    emptyPermissionSummary: "尚未加载权限状态。",
    emptyPermissionList: "暂无权限数据。",
    emptyPermissionOutput: "暂无权限操作结果。",
    roleUser: "用户",
    roleAssistant: "助手",
    roleSystem: "系统",
    permissionStatusGranted: "已授予",
    permissionStatusMissing: "缺失",
    permissionStatusUnsupported: "不支持",
    permissionStatusUnknown: "未知",
    permissionGroupSystem: "系统权限",
    permissionGroupRuntime: "运行时能力",
    permissionGroupSystemTitle: "系统权限",
    permissionGroupSystemDescription: "需要在系统设置中显式批准的系统级访问能力。",
    permissionGroupRuntimeTitle: "运行时能力",
    permissionGroupRuntimeDescription: "代理在运行时依赖的本地库和桌面会话能力。",
    permissionReadOnly: "只读检查",
    permissionBlocking: "阻塞项",
    permissionOptional: "可选项",
    permissionManualSteps: "手动开启步骤",
    buttonRequestAccess: "请求访问",
    permissionSummaryReady: "{platform} 上的桌面自动化已就绪。",
    permissionSummaryNotReady: "{platform} 上的桌面自动化尚未就绪。缺失的阻塞项数量：{count}。",
    permissionUnknownRequirement: "当前状态还不能被精确判断。",
    permissionRequirementReady: "这项要求目前已经就绪。",
    permissionRequirementMissing: "这项要求目前缺失。",
    permissionRequirementUnsupported: "当前平台不支持这项检查。",
    treeWindowPrefix: "[窗口]",
    treeUntitledWindow: "未命名窗口",
    treeUnknown: "未知",
    requestFailedPrefix: "请求失败",
    statusConfigSaved: "配置已保存到服务端。",
    statusConfigLoaded: "已从服务端加载配置。",
    statusConfigLoadFailed: "加载配置失败。",
    statusConfigSaving: "正在保存配置到服务端...",
    statusConfigSaveFailed: "保存配置失败。",
    statusSelectedElement: "已选中元素 {id}。",
    statusRunningAction: "正在执行 {action}...",
    statusPerformActionFailed: "执行动作失败。",
    statusCheckingPermissions: "正在检查桌面权限...",
    statusPermissionLoaded: "权限状态已加载。",
    statusPermissionCheckFailed: "权限检查失败。",
    statusRequestingPermissions: "正在请求桌面权限...",
    statusPermissionRequestFinished: "权限请求流程已完成。",
    statusPermissionRequestFailed: "权限请求失败。",
    statusCallingModel: "正在通过 {mode} 模式调用模型...",
    statusReplyReceivedVia: "已通过 {mode} 模式收到回复。",
    statusReplyReceived: "已收到回复。",
    statusRequestFailed: "请求失败。",
    statusStreamFallback: "流式通道不可用，正在自动回退到普通模式...",
    statusStreamInterrupted: "流式通道在执行开始后中断了。这轮任务可能仍在服务端继续运行。",
    statusConversationCleared: "对话已清空。",
    statusLoadingAppList: "正在加载应用列表...",
    statusLoadedApps: "已加载 {count} 个应用。",
    statusAppListingFailed: "应用列表加载失败。",
    statusReadingFrontmostApp: "正在读取前台应用...",
    statusFrontmostLoaded: "前台应用已加载。",
    statusFrontmostFailed: "前台应用查询失败。",
    actionLaunching: "启动",
    actionActivating: "激活",
    statusAppActionRunning: "正在{action}应用...",
    statusAppActionFinished: "应用操作已完成。",
    statusAppActionFailed: "应用操作失败。",
    statusCapturingSnapshot: "正在抓取辅助功能快照...",
    statusSnapshotCaptured: "辅助功能快照已抓取。",
    statusSnapshotFailed: "辅助功能快照失败。",
    statusClickingElement: "正在点击元素...",
    statusElementClicked: "元素已点击。",
    statusElementClickFailed: "元素点击失败。",
    statusFocusingElement: "正在聚焦元素...",
    statusElementFocused: "元素已聚焦。",
    statusFocusElementFailed: "聚焦元素失败。",
    statusPressingElement: "正在按下元素...",
    statusElementPressed: "元素已按下。",
    statusPressElementFailed: "按下元素失败。",
    statusTypingIntoElement: "正在向元素输入...",
    statusTypedIntoElement: "已向元素输入文本。",
    statusTypeIntoElementFailed: "向元素输入失败。",
    statusSettingElementValue: "正在设置元素值...",
    statusElementValueSet: "元素值已设置。",
    statusSetValueFailed: "设置元素值失败。",
    statusPreviewingElement: "正在预览元素...",
    statusPreviewCaptured: "元素预览已生成。",
    statusPreviewFailed: "元素预览失败。",
    alertModelBaseRequired: "请先填写模型和 Base URL。",
    alertElementIdRequired: "请先输入 element_id。",
    alertAccessibilityActionRequired: "请先选择一个辅助功能动作。",
    alertTextRequired: "请先输入文本。",
    alertAppNameRequired: "请先输入应用名称。",
    assistantRequestFailed: "请求失败：{message}",
    outputRequestFailed: "请求失败：{message}",
    selectedElementMissing: "当前快照中不存在已选中的元素。",
  },
};

const PERMISSION_COPY = {
  en: {
    accessibility: {
      label: "Accessibility",
      message: "Required for keyboard, mouse, and accessibility tree control.",
      actionLabel: "Open Accessibility Settings",
      statusHints: {
        granted: "Accessibility access is available, so input control and accessibility snapshots can use the preferred path.",
        not_granted:
          "Without this, direct app control, element discovery, keyboard, and mouse actions may fail.",
        unknown: "macOS did not report a definitive Accessibility state for this process.",
        unsupported: "This Accessibility check is not supported on the current platform.",
      },
      manualSteps: [
        "Open System Settings > Privacy & Security > Accessibility.",
        "Enable access for the app or terminal session that is running Open Computer Use.",
        "If the toggle was added just now, retry the action in this app.",
      ],
    },
    screen_recording: {
      label: "Screen Recording",
      message: "Required for screenshots and visual inspection.",
      actionLabel: "Open Screen Recording Settings",
      statusHints: {
        granted: "Screen capture is available.",
        not_granted:
          "Without this, screenshots, visual inspection, and screenshot-based clicking will fail.",
        unknown: "macOS did not report a definitive Screen Recording state for this process.",
        unsupported: "This Screen Recording check is not supported on the current platform.",
      },
      manualSteps: [
        "Open System Settings > Privacy & Security > Screen Recording.",
        "Enable access for the app or terminal session that is running Open Computer Use.",
        "After enabling it, close and reopen the affected app if macOS asks you to.",
      ],
    },
    apple_events: {
      label: "Automation / Apple Events",
      message: "Used when controlling apps through osascript and System Events on macOS.",
      actionLabel: "Open Automation Settings",
      statusHints: {
        granted: "Automation access looks available for System Events.",
        not_granted:
          "This is used for some osascript-driven app control paths. Missing access may affect activation or scripted UI flows.",
        unknown: "macOS did not report a definitive Automation / Apple Events state for this process.",
        unsupported: "This Automation / Apple Events check is not supported on the current platform.",
      },
      manualSteps: [
        "Open System Settings > Privacy & Security > Automation.",
        "Find the app or terminal session that is running Open Computer Use.",
        "Enable control for System Events or the target app when macOS asks.",
      ],
    },
    at_spi: {
      label: "AT-SPI Accessibility",
      message: "Needed for accessibility snapshots and direct element actions on Linux.",
      statusHints: {
        granted: "AT-SPI is available.",
        not_granted:
          "Install or enable the AT-SPI stack if you want accessibility snapshots and direct element actions on Linux.",
        unknown: "The Linux accessibility stack could not be checked precisely.",
        unsupported: "AT-SPI is not available on this platform.",
      },
      manualSteps: [
        "Make sure the desktop session exposes accessibility support.",
        "Install the AT-SPI Python bindings and related desktop packages if needed.",
        "Retry from a normal GUI session, not a headless shell.",
      ],
    },
    display_session: {
      label: "GUI Desktop Session",
      message: "Needed for screenshot capture and desktop automation.",
      statusHints: {
        granted: "A GUI desktop session is available.",
        not_granted:
          "No DISPLAY or WAYLAND_DISPLAY was detected, so desktop automation cannot talk to a live GUI session.",
        unknown: "The current desktop session could not be determined precisely.",
        unsupported: "GUI session detection is not supported on this platform.",
      },
      manualSteps: [
        "Run the app from a logged-in desktop session.",
        "Confirm DISPLAY or WAYLAND_DISPLAY is exported for the process.",
        "Retry after launching from the same user session as the desktop.",
      ],
    },
    screenshot_tooling: {
      label: "Screenshot Tooling",
      message: "Provided by mss or pyautogui screenshot support.",
      statusHints: {
        granted: "Screenshot libraries are available.",
        not_granted:
          "Install screenshot support such as mss, or provide a working pyautogui screenshot backend.",
        unknown: "The screenshot tooling state could not be determined precisely.",
        unsupported: "Screenshot tooling is not supported on this platform.",
      },
      manualSteps: [
        "Install the Python dependencies from this project.",
        "Verify screenshot libraries can access the desktop session.",
        "Retry after confirming desktop permissions are also granted.",
      ],
    },
    input_tooling: {
      label: "Mouse And Keyboard Tooling",
      message: "Provided by pyautogui for click, move, type, and hotkey control.",
      statusHints: {
        granted: "pyautogui input control is available.",
        not_granted:
          "Mouse and keyboard automation depends on pyautogui being installed and usable in this environment.",
        unknown: "The input tooling state could not be determined precisely.",
        unsupported: "Input tooling is not supported on this platform.",
      },
      manualSteps: [
        "Install the Python dependencies from this project.",
        "Verify pyautogui can talk to the current desktop session.",
        "Retry after fixing any GUI-session or permission issues.",
      ],
    },
  },
  zh: {
    accessibility: {
      label: "辅助功能",
      message: "用于键盘、鼠标和辅助功能树控制。",
      actionLabel: "打开辅助功能设置",
      statusHints: {
        granted: "辅助功能访问已经可用，因此输入控制和辅助功能快照可以走首选路径。",
        not_granted: "缺少这项权限时，直接控制应用、发现元素、键盘和鼠标操作都可能失败。",
        unknown: "macOS 没有为当前进程返回明确的辅助功能状态。",
        unsupported: "当前平台不支持这项辅助功能检查。",
      },
      manualSteps: [
        "打开“系统设置” > “隐私与安全性” > “辅助功能”。",
        "为运行 Open Computer Use 的应用或终端会话打开访问权限。",
        "如果你刚刚添加了开关，请回到本页面重新执行操作。",
      ],
    },
    screen_recording: {
      label: "屏幕录制",
      message: "用于截图和视觉检查。",
      actionLabel: "打开屏幕录制设置",
      statusHints: {
        granted: "屏幕捕获已经可用。",
        not_granted: "缺少这项权限时，截图、视觉检查和基于截图的点击都会失败。",
        unknown: "macOS 没有为当前进程返回明确的屏幕录制状态。",
        unsupported: "当前平台不支持这项屏幕录制检查。",
      },
      manualSteps: [
        "打开“系统设置” > “隐私与安全性” > “屏幕录制”。",
        "为运行 Open Computer Use 的应用或终端会话打开访问权限。",
        "如果 macOS 提示需要，请在开启后关闭并重新打开相关应用。",
      ],
    },
    apple_events: {
      label: "自动化 / Apple Events",
      message: "用于通过 osascript 和 System Events 控制 macOS 应用。",
      actionLabel: "打开自动化设置",
      statusHints: {
        granted: "System Events 的自动化访问看起来已经可用。",
        not_granted: "有些依赖 osascript 的应用控制路径会用到它，缺失时可能影响激活或脚本化流程。",
        unknown: "macOS 没有为当前进程返回明确的自动化状态。",
        unsupported: "当前平台不支持这项自动化检查。",
      },
      manualSteps: [
        "打开“系统设置” > “隐私与安全性” > “自动化”。",
        "找到运行 Open Computer Use 的应用或终端会话。",
        "当 macOS 弹出提示时，为 System Events 或目标应用打开控制权限。",
      ],
    },
    at_spi: {
      label: "AT-SPI 辅助功能",
      message: "用于 Linux 上的辅助功能快照和直接元素操作。",
      statusHints: {
        granted: "AT-SPI 已可用。",
        not_granted: "如果你想在 Linux 上使用辅助功能快照和直接元素操作，请安装或启用 AT-SPI 栈。",
        unknown: "当前无法精确判断 Linux 辅助功能栈状态。",
        unsupported: "当前平台不支持这项 AT-SPI 检查。",
      },
      manualSteps: [
        "确认当前桌面会话暴露了辅助功能支持。",
        "如有需要，安装 AT-SPI 的 Python 绑定和相关桌面软件包。",
        "请在正常的图形界面会话里重试，而不是无头 shell。",
      ],
    },
    display_session: {
      label: "图形桌面会话",
      message: "用于截图和桌面自动化。",
      statusHints: {
        granted: "图形桌面会话已经可用。",
        not_granted: "没有检测到 DISPLAY 或 WAYLAND_DISPLAY，因此桌面自动化无法连接到真实 GUI 会话。",
        unknown: "当前无法精确判断桌面会话状态。",
        unsupported: "当前平台不支持这项桌面会话检查。",
      },
      manualSteps: [
        "请在已登录的图形桌面会话中运行本应用。",
        "确认当前进程导出了 DISPLAY 或 WAYLAND_DISPLAY。",
        "尝试从和桌面相同的用户会话中重新启动本应用。",
      ],
    },
    screenshot_tooling: {
      label: "截图工具链",
      message: "由 mss 或 pyautogui 的截图支持提供。",
      statusHints: {
        granted: "截图相关库已经可用。",
        not_granted: "请安装 mss 等截图支持，或者确保 pyautogui 的截图后端可用。",
        unknown: "当前无法精确判断截图工具链状态。",
        unsupported: "当前平台不支持这项截图工具链检查。",
      },
      manualSteps: [
        "安装本项目的 Python 依赖。",
        "确认截图相关库能够访问当前桌面会话。",
        "同时确认桌面权限也已经授予后再重试。",
      ],
    },
    input_tooling: {
      label: "鼠标和键盘工具链",
      message: "由 pyautogui 提供点击、移动、输入和快捷键控制。",
      statusHints: {
        granted: "pyautogui 的输入控制已经可用。",
        not_granted: "鼠标和键盘自动化依赖 pyautogui 已安装，并且在当前环境中可正常工作。",
        unknown: "当前无法精确判断输入工具链状态。",
        unsupported: "当前平台不支持这项输入工具链检查。",
      },
      manualSteps: [
        "安装本项目的 Python 依赖。",
        "确认 pyautogui 能够连接当前桌面会话。",
        "修复 GUI 会话或权限问题后重新重试。",
      ],
    },
  },
};

const elements = {
  tabRunConfig: document.getElementById("tabRunConfig"),
  tabConsole: document.getElementById("tabConsole"),
  tabApps: document.getElementById("tabApps"),
  tabPermissions: document.getElementById("tabPermissions"),
  runConfigTabPanel: document.getElementById("runConfigTabPanel"),
  consoleTabPanel: document.getElementById("consoleTabPanel"),
  appsTabPanel: document.getElementById("appsTabPanel"),
  permissionsTabPanel: document.getElementById("permissionsTabPanel"),
  languagePicker: document.getElementById("languagePicker"),
  model: document.getElementById("model"),
  baseUrl: document.getElementById("baseUrl"),
  apiMode: document.getElementById("apiMode"),
  thinkingMode: document.getElementById("thinkingMode"),
  reasoningEffort: document.getElementById("reasoningEffort"),
  modelCompatMode: document.getElementById("modelCompatMode"),
  apiKey: document.getElementById("apiKey"),
  systemPrompt: document.getElementById("systemPrompt"),
  maxSteps: document.getElementById("maxSteps"),
  enableOcr: document.getElementById("enableOcr"),
  maxImagesPerToolResult: document.getElementById("maxImagesPerToolResult"),
  modelImageMaxEdge: document.getElementById("modelImageMaxEdge"),
  modelImageMaxBytes: document.getElementById("modelImageMaxBytes"),
  saveConfig: document.getElementById("saveConfig"),
  refreshPermissionsButton: document.getElementById("refreshPermissionsButton"),
  requestAllPermissionsButton: document.getElementById("requestAllPermissionsButton"),
  permissionSummary: document.getElementById("permissionSummary"),
  permissionList: document.getElementById("permissionList"),
  permissionOutput: document.getElementById("permissionOutput"),
  clearChat: document.getElementById("clearChat"),
  statusLine: document.getElementById("statusLine"),
  observationContextPanel: document.getElementById("observationContextPanel"),
  observationContextBadges: document.getElementById("observationContextBadges"),
  observationContextMeta: document.getElementById("observationContextMeta"),
  observationContextImage: document.getElementById("observationContextImage"),
  observationDisplaySelect: document.getElementById("observationDisplaySelect"),
  observationRefreshModeSelect: document.getElementById("observationRefreshModeSelect"),
  refreshObservationButton: document.getElementById("refreshObservationButton"),
  refreshPointerButton: document.getElementById("refreshPointerButton"),
  focusAppsTabButton: document.getElementById("focusAppsTabButton"),
  syncFrontmostButton: document.getElementById("syncFrontmostButton"),
  appQuery: document.getElementById("appQuery"),
  appTarget: document.getElementById("appTarget"),
  listAppsButton: document.getElementById("listAppsButton"),
  frontmostAppButton: document.getElementById("frontmostAppButton"),
  launchAppButton: document.getElementById("launchAppButton"),
  activateAppButton: document.getElementById("activateAppButton"),
  appOutput: document.getElementById("appOutput"),
  snapshotTarget: document.getElementById("snapshotTarget"),
  snapshotDepth: document.getElementById("snapshotDepth"),
  snapshotChildren: document.getElementById("snapshotChildren"),
  interactableFilter: document.getElementById("interactableFilter"),
  roleFilter: document.getElementById("roleFilter"),
  useCachedSnapshot: document.getElementById("useCachedSnapshot"),
  snapshotButton: document.getElementById("snapshotButton"),
  elementIdInput: document.getElementById("elementIdInput"),
  elementTextInput: document.getElementById("elementTextInput"),
  clearFirstSelect: document.getElementById("clearFirstSelect"),
  elementActionSelect: document.getElementById("elementActionSelect"),
  clickElementButton: document.getElementById("clickElementButton"),
  pressElementButton: document.getElementById("pressElementButton"),
  focusElementButton: document.getElementById("focusElementButton"),
  typeElementButton: document.getElementById("typeElementButton"),
  setValueButton: document.getElementById("setValueButton"),
  performElementActionButton: document.getElementById("performElementActionButton"),
  previewElementButton: document.getElementById("previewElementButton"),
  elementPreviewPane: document.getElementById("elementPreviewPane"),
  elementPreviewImage: document.getElementById("elementPreviewImage"),
  elementMetaOutput: document.getElementById("elementMetaOutput"),
  snapshotTree: document.getElementById("snapshotTree"),
  snapshotOutput: document.getElementById("snapshotOutput"),
  messages: document.getElementById("messages"),
  chatForm: document.getElementById("chatForm"),
  userInput: document.getElementById("userInput"),
  sendButton: document.getElementById("sendButton"),
};

const defaultSystemPrompt = elements.systemPrompt.value;

const state = {
  conversation: [],
  chatEntries: [],
  activeStreamMessageIndex: -1,
  latestSnapshot: null,
  selectedElementId: "",
  latestPermissionOverview: null,
  activeTab: "console",
  currentLanguage: "en",
  latestElementActions: [],
  latestObservationContext: null,
  latestPointerState: null,
  statusEntry: i18nEntry("statusReady"),
  appOutputEntry: i18nEntry("emptyAppOutput"),
  permissionOutputEntry: i18nEntry("emptyPermissionOutput"),
  snapshotOutputEntry: i18nEntry("emptySnapshotOutput"),
  elementMetaEntry: i18nEntry("emptyElementMeta"),
  sendButtonState: "idle",
};

function i18nEntry(key, vars = {}) {
  return { __i18n: true, key, vars };
}

function getDictionary() {
  return I18N[state.currentLanguage] || I18N.en;
}

function t(key, vars = {}) {
  const dictionary = getDictionary();
  const template = dictionary[key] ?? I18N.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

function formatPlatform(platform) {
  if (platform === "darwin") return state.currentLanguage === "zh" ? "macOS" : "macOS";
  if (platform && platform.startsWith("linux")) return state.currentLanguage === "zh" ? "Linux" : "Linux";
  return platform || "";
}

function chooseInitialLanguage() {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "en" || saved === "zh") {
    return saved;
  }
  const browserLanguage = (navigator.language || "en").toLowerCase();
  return browserLanguage.startsWith("zh") ? "zh" : "en";
}

function applyStaticTranslations() {
  document.documentElement.lang = state.currentLanguage === "zh" ? "zh-CN" : "en";
  document.title = t("documentTitle");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (key) {
      node.textContent = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (key && "placeholder" in node) {
      node.placeholder = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((node) => {
    const key = node.getAttribute("data-i18n-alt");
    if (key) {
      node.setAttribute("alt", t(key));
    }
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria-label");
    if (key) {
      node.setAttribute("aria-label", t(key));
    }
  });

  if (elements.languagePicker) {
    elements.languagePicker.value = state.currentLanguage;
  }
}

function renderStoredEntry(entry) {
  if (entry && typeof entry === "object" && entry.__i18n) {
    return t(entry.key, entry.vars || {});
  }
  if (typeof entry === "string") {
    return entry;
  }
  return JSON.stringify(entry, null, 2);
}

function renderStatus() {
  elements.statusLine.textContent = renderStoredEntry(state.statusEntry);
}

function setStatusEntry(entry) {
  state.statusEntry = entry;
  renderStatus();
}

function setStatusKey(key, vars = {}) {
  setStatusEntry(i18nEntry(key, vars));
}

function setStatusText(text) {
  setStatusEntry(text);
}

function renderSendButton() {
  elements.sendButton.textContent =
    state.sendButtonState === "thinking" ? t("buttonThinking") : t("buttonSend");
}

function formatToolData(value, { limit = 1600, pretty = false } = {}) {
  if (value == null) {
    return "";
  }

  let raw = "";
  try {
    raw =
      typeof value === "string"
        ? value
        : JSON.stringify(value, null, pretty ? 2 : 0);
  } catch {
    raw = String(value);
  }

  if (raw.length <= limit) {
    return raw;
  }
  return `${raw.slice(0, Math.max(0, limit - 3))}...`;
}

function summarizeToolResult(result) {
  if (result && typeof result === "object" && !Array.isArray(result) && Object.keys(result).length === 0) {
    return "";
  }

  if (!result || typeof result !== "object") {
    return formatToolData(result, { limit: 220 });
  }

  if (typeof result.error === "string" && result.error.trim()) {
    return result.error.trim();
  }

  if (typeof result.message === "string" && result.message.trim()) {
    return result.message.trim();
  }

  if (result.raw_result && typeof result.raw_result === "object") {
    return formatToolData(result.raw_result, { limit: 220 });
  }

  return formatToolData(result, { limit: 220 });
}

function summarizeToolNames(toolTrace) {
  const names = toolTrace
    .map((item) => item?.name)
    .filter((name) => typeof name === "string" && name.trim());
  if (!names.length) {
    return "";
  }

  const visible = names.slice(0, 4).join(" · ");
  if (names.length <= 4) {
    return visible;
  }
  return `${visible} +${names.length - 4}`;
}

function extractTracePreviewImages(item) {
  if (!item || !Array.isArray(item.preview_images)) {
    return [];
  }
  return item.preview_images.filter((value) => typeof value === "string" && value.startsWith("data:image/"));
}

function toImageDataUrl(value, mimeType = "image/png") {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("<base64:")) {
    return null;
  }
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }
  return `data:${mimeType || "image/png"};base64,${trimmed}`;
}

function normalizeToolTraceItem(item = {}) {
  const result = item?.result ?? {};
  let status = item?.status;
  if (status !== "pending" && status !== "success" && status !== "error") {
    status =
      result && typeof result === "object" && typeof result.error === "string" && result.error.trim()
        ? "error"
        : "success";
  }
  return {
    id: item?.id || null,
    name: item?.name || "tool",
    step_index: Number.isFinite(item?.step_index) ? item.step_index : null,
    arguments: item?.arguments ?? {},
    result,
    preview_images: extractTracePreviewImages(item),
    status,
    started_at: typeof item?.started_at === "number" ? item.started_at : null,
    finished_at: typeof item?.finished_at === "number" ? item.finished_at : null,
    duration_ms: Number.isFinite(item?.duration_ms) ? item.duration_ms : null,
  };
}

function mergeToolTraceItem(trace = [], item) {
  const normalized = normalizeToolTraceItem(item);
  if (!normalized.id) {
    return [...trace, normalized];
  }

  const nextTrace = [...trace];
  const existingIndex = nextTrace.findIndex((entry) => entry?.id && entry.id === normalized.id);
  if (existingIndex >= 0) {
    nextTrace[existingIndex] = {
      ...nextTrace[existingIndex],
      ...normalized,
      arguments: normalized.arguments ?? nextTrace[existingIndex].arguments ?? {},
      result: normalized.result ?? nextTrace[existingIndex].result ?? {},
      preview_images:
        normalized.preview_images?.length > 0
          ? normalized.preview_images
          : nextTrace[existingIndex].preview_images ?? [],
    };
    return nextTrace;
  }
  nextTrace.push(normalized);
  return nextTrace;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms == null) {
    return "";
  }
  if (ms < 1000) {
    return t("toolTraceDuration", { ms });
  }
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s`;
}

function summarizeObservationSource(result = {}) {
  if (!result || typeof result !== "object") {
    return "";
  }

  const parts = [];
  const scope = result.capture_scope;
  const displayId = result.captured_display_id || result.display?.display_id;
  const appName = result.frontmost_app?.name;
  const region = result.region;

  if (typeof scope === "string" && scope) {
    parts.push(scope);
  }
  if (typeof displayId === "string" && displayId) {
    parts.push(`display:${displayId}`);
  }
  if (typeof appName === "string" && appName) {
    parts.push(appName);
  }
  if (region && typeof region === "object") {
    const left = region.left ?? "?";
    const top = region.top ?? "?";
    const width = region.width ?? "?";
    const height = region.height ?? "?";
    parts.push(`${left},${top} ${width}x${height}`);
  }

  return parts.join(" · ");
}

function summarizeDisplayMetadata(display) {
  if (!display || typeof display !== "object") {
    return "";
  }
  const displayId = typeof display.display_id === "string" ? display.display_id : "";
  const logicalWidth = Number.isFinite(display.logical_width) ? display.logical_width : null;
  const logicalHeight = Number.isFinite(display.logical_height) ? display.logical_height : null;
  const physicalWidth = Number.isFinite(display.physical_width) ? display.physical_width : null;
  const physicalHeight = Number.isFinite(display.physical_height) ? display.physical_height : null;
  const offsetX = Number.isFinite(display.offset_x) ? display.offset_x : 0;
  const offsetY = Number.isFinite(display.offset_y) ? display.offset_y : 0;
  const scaleX = Number.isFinite(display.scale_x) ? display.scale_x : null;
  const scaleY = Number.isFinite(display.scale_y) ? display.scale_y : null;

  const parts = [];
  if (displayId) {
    parts.push(`display:${displayId}`);
  }
  if (logicalWidth != null && logicalHeight != null) {
    parts.push(`L ${logicalWidth}x${logicalHeight}`);
  }
  if (physicalWidth != null && physicalHeight != null) {
    parts.push(`P ${physicalWidth}x${physicalHeight}`);
  }
  if (offsetX || offsetY) {
    parts.push(`offset ${offsetX},${offsetY}`);
  }
  if (scaleX != null && scaleY != null && (scaleX !== 1 || scaleY !== 1)) {
    parts.push(`scale ${scaleX}x${scaleY}`);
  }
  return parts.join(" · ");
}

function summarizeCoordinateTarget(target) {
  if (!target || typeof target !== "object") {
    return "";
  }
  const x = typeof target.x === "number" ? target.x : null;
  const y = typeof target.y === "number" ? target.y : null;
  if (x == null || y == null) {
    return "";
  }
  const displayId = typeof target.display_id === "string" && target.display_id ? `@${target.display_id}` : "";
  return `${Math.round(x)}, ${Math.round(y)}${displayId}`;
}

function summarizeCoordinateSource(result = {}) {
  if (!result || typeof result !== "object") {
    return "";
  }
  const logical = summarizeCoordinateTarget(result.logical_target);
  const physical = summarizeCoordinateTarget(result.physical_target);
  if (logical && physical && logical !== physical) {
    return `L ${logical} · P ${physical}`;
  }
  return logical || physical || "";
}

function summarizePointerState(pointer = {}) {
  if (!pointer || typeof pointer !== "object") {
    return "";
  }
  const logical = summarizeCoordinateTarget(pointer.logical_position);
  const physical = summarizeCoordinateTarget(pointer.physical_position);
  if (logical && physical && logical !== physical) {
    return `pointer L ${logical} · P ${physical}`;
  }
  if (logical) {
    return `pointer ${logical}`;
  }
  if (physical) {
    return `pointer ${physical}`;
  }
  return "";
}

function summarizeVerification(result = {}) {
  const verification = result?.verification;
  if (!verification || typeof verification !== "object") {
    return "";
  }

  const status = verification.verification_status;
  const details = typeof verification.details === "string" ? verification.details.trim() : "";
  let label = "";
  if (status === "passed") {
    label = t("toolTraceVerificationPassed");
  } else if (status === "failed") {
    label = t("toolTraceVerificationFailed");
  } else if (status === "uncertain") {
    label = t("toolTraceVerificationUncertain");
  }
  return [label, details].filter(Boolean).join(" · ");
}

function extractObservationContextFromResult(result = {}, options = {}) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const directObservation =
    result.display && (
      "screenshot_base64" in result
      || "captured_display_id" in result
      || "capture_scope" in result
      || "available_displays" in result
      || "timestamp" in result
    )
      ? result
      : result.observation && typeof result.observation === "object"
        ? result.observation
        : null;

  if (!directObservation || typeof directObservation !== "object") {
    return null;
  }

  const previewImages = Array.isArray(options.previewImages)
    ? options.previewImages.filter((value) => typeof value === "string" && value.startsWith("data:image/"))
    : [];
  const imageUrl =
    previewImages[0]
    || toImageDataUrl(directObservation.screenshot_base64, directObservation.screenshot_mime_type)
    || toImageDataUrl(result.preview_image_base64, result.preview_image_mime_type)
    || null;

  return {
    capture_scope: directObservation.capture_scope || null,
    captured_display_id: directObservation.captured_display_id || directObservation.display?.display_id || null,
    display: directObservation.display || null,
    available_displays: Array.isArray(directObservation.available_displays) ? directObservation.available_displays : [],
    region: directObservation.region || null,
    frontmost_app: directObservation.frontmost_app || null,
    image_url: imageUrl,
    image_width: Number.isFinite(directObservation.image_width) ? directObservation.image_width : null,
    image_height: Number.isFinite(directObservation.image_height) ? directObservation.image_height : null,
    timestamp: typeof directObservation.timestamp === "number" ? directObservation.timestamp : null,
  };
}

function updateLatestObservationContextFromToolTrace(toolTrace = []) {
  const normalizedTrace = Array.isArray(toolTrace)
    ? toolTrace.map((item) => normalizeToolTraceItem(item))
    : [];
  for (let index = normalizedTrace.length - 1; index >= 0; index -= 1) {
    const item = normalizedTrace[index];
    const observationContext = extractObservationContextFromResult(item.result || {}, {
      previewImages: item.preview_images,
    });
    if (observationContext) {
      state.latestObservationContext = observationContext;
      return true;
    }
  }
  return false;
}

function buildObservationContextWithPointer(context, pointerState = null) {
  if (!context) {
    return null;
  }
  return {
    ...context,
    pointer_state: pointerState || context.pointer_state || null,
  };
}

function renderObservationContext() {
  const context = buildObservationContextWithPointer(
    state.latestObservationContext,
    state.latestPointerState,
  );
  if (!elements.observationContextPanel || !elements.observationContextMeta || !elements.observationContextBadges) {
    return;
  }

  if (!context) {
    elements.observationContextPanel.hidden = true;
    elements.observationContextMeta.textContent = t("emptyObservationContext");
    elements.observationContextBadges.innerHTML = "";
    if (elements.observationDisplaySelect) {
      elements.observationDisplaySelect.innerHTML = "";
    }
    if (elements.observationRefreshModeSelect) {
      elements.observationRefreshModeSelect.value = "display";
    }
    if (elements.observationContextImage) {
      elements.observationContextImage.hidden = true;
      elements.observationContextImage.removeAttribute("src");
    }
    return;
  }

  elements.observationContextPanel.hidden = false;
  elements.observationContextBadges.innerHTML = "";

  const observationSummary = summarizeObservationSource(context);
  const displaySummary = summarizeDisplayMetadata(context.display);
  const displaysCount = Array.isArray(context.available_displays) ? context.available_displays.length : 0;
  const pointerSummary = summarizePointerState(context.pointer_state);

  [observationSummary, displaySummary, pointerSummary].filter(Boolean).forEach((text) => {
    const badge = document.createElement("span");
    badge.className = "message-badge subtle";
    badge.textContent = text;
    elements.observationContextBadges.appendChild(badge);
  });

  if (displaysCount > 1) {
    const displaysBadge = document.createElement("span");
    displaysBadge.className = "message-badge subtle";
    displaysBadge.textContent = t("toolTraceDisplays", { count: displaysCount });
    elements.observationContextBadges.appendChild(displaysBadge);
  }

  if (elements.observationDisplaySelect) {
    const available = context.available_displays?.length ? context.available_displays : (context.display ? [context.display] : []);
    elements.observationDisplaySelect.innerHTML = "";
    available.forEach((display) => {
      const option = document.createElement("option");
      option.value = display.display_id || "main";
      option.textContent = summarizeDisplayMetadata(display) || display.display_id || "main";
      option.selected = option.value === (context.captured_display_id || context.display?.display_id || "main");
      elements.observationDisplaySelect.appendChild(option);
    });
  }

  if (elements.observationRefreshModeSelect) {
    const hasRegion =
      context.region
      && Number.isFinite(context.region.left)
      && Number.isFinite(context.region.top)
      && Number.isFinite(context.region.width)
      && Number.isFinite(context.region.height);
    const regionOption = Array.from(elements.observationRefreshModeSelect.options).find((option) => option.value === "region");
    if (regionOption) {
      regionOption.disabled = !hasRegion;
    }
    if (!hasRegion && elements.observationRefreshModeSelect.value === "region") {
      elements.observationRefreshModeSelect.value = "display";
    }
  }

  const meta = {
    capture_scope: context.capture_scope || null,
    captured_display_id: context.captured_display_id || null,
    frontmost_app: context.frontmost_app?.name || null,
    pointer_state: context.pointer_state
      ? {
          logical_position: context.pointer_state.logical_position || null,
          physical_position: context.pointer_state.physical_position || null,
          display: context.pointer_state.display || null,
        }
      : null,
    region: context.region || null,
    display: context.display || null,
    image_size:
      context.image_width != null && context.image_height != null
        ? `${context.image_width}x${context.image_height}`
        : null,
    timestamp: context.timestamp || null,
  };
  elements.observationContextMeta.textContent = JSON.stringify(meta, null, 2);

  if (elements.observationContextImage) {
    if (context.image_url) {
      elements.observationContextImage.src = context.image_url;
      elements.observationContextImage.hidden = false;
    } else {
      elements.observationContextImage.hidden = true;
      elements.observationContextImage.removeAttribute("src");
    }
  }
}

async function refreshObservationContext() {
  try {
    setStatusKey("statusRefreshingObservation");
    const selectedDisplayId = elements.observationDisplaySelect?.value || state.latestObservationContext?.captured_display_id || "main";
    const refreshMode = elements.observationRefreshModeSelect?.value || "display";
    let data;
    let statusMessage = t("statusObservationRefreshed");
    if (
      refreshMode === "region"
      && state.latestObservationContext?.region
      && Number.isFinite(state.latestObservationContext.region.left)
      && Number.isFinite(state.latestObservationContext.region.top)
      && Number.isFinite(state.latestObservationContext.region.width)
      && Number.isFinite(state.latestObservationContext.region.height)
    ) {
      data = await apiRequest("/api/v1/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: {
            action: "observe_region",
            region: {
              left: state.latestObservationContext.region.left,
              top: state.latestObservationContext.region.top,
              width: state.latestObservationContext.region.width,
              height: state.latestObservationContext.region.height,
            },
            display_id: selectedDisplayId,
          },
          capture_after: false,
          verify_action: false,
        }),
      });
      statusMessage = data?.message || statusMessage;
      data = data?.observation || data;
    } else {
      const suffix = selectedDisplayId ? `?executor_id=local&display_id=${encodeURIComponent(selectedDisplayId)}` : "";
      data = await apiRequest(`/api/v1/observe${suffix}`);
      statusMessage = data?.message || statusMessage;
    }
    const nextContext = extractObservationContextFromResult(data);
    if (nextContext) {
      state.latestObservationContext = nextContext;
      renderObservationContext();
      setStatusText(statusMessage);
    } else {
      setStatusKey("statusObservationRefreshFailed");
    }
  } catch (error) {
    console.warn("Failed to refresh observation context", error);
    setStatusKey("statusObservationRefreshFailed");
  }
}

async function refreshPointerState() {
  try {
    setStatusKey("statusRefreshingPointer");
    const data = await apiRequest("/api/v1/pointer?executor_id=local");
    state.latestPointerState = data;
    if (!state.latestObservationContext) {
      state.latestObservationContext = {
        capture_scope: null,
        captured_display_id: data?.display?.display_id || data?.logical_position?.display_id || null,
        display: data?.display || null,
        available_displays: data?.display ? [data.display] : [],
        region: null,
        frontmost_app: null,
        image_url: null,
        image_width: null,
        image_height: null,
        timestamp: null,
      };
    }
    renderObservationContext();
    setStatusText(data?.message || t("statusPointerRefreshed"));
  } catch (error) {
    console.warn("Failed to refresh pointer state", error);
    setStatusKey("statusPointerRefreshFailed");
  }
}

function jumpToAppsTab() {
  switchTab("apps");
}

async function syncFrontmostAppIntoAppsTab() {
  try {
    setStatusKey("statusReadingFrontmostApp");
    const data = await apiRequest("/api/v1/apps/frontmost");
    const appName = data?.app?.name || "";
    if (appName) {
      elements.appTarget.value = appName;
      elements.snapshotTarget.value = appName;
    }
    setAppOutput(data);
    setStatusText(data.message || t("statusFrontmostLoaded"));
    switchTab("apps");
  } catch (error) {
    console.warn("Failed to sync frontmost app", error);
    setStatusKey("statusFrontmostFailed");
  }
}

function syncObservationDisplaySelection() {
  if (!elements.observationDisplaySelect) {
    return;
  }
  const selectedDisplayId = elements.observationDisplaySelect.value;
  if (!state.latestObservationContext || !selectedDisplayId) {
    return;
  }
  state.latestObservationContext = {
    ...state.latestObservationContext,
    captured_display_id: selectedDisplayId,
  };
  renderObservationContext();
  setStatusKey("statusObservationDisplaySynced");
}

function formatRegion(region) {
  if (!region || typeof region !== "object") {
    return "";
  }
  const left = Number.isFinite(region.left) ? region.left : null;
  const top = Number.isFinite(region.top) ? region.top : null;
  const width = Number.isFinite(region.width) ? region.width : null;
  const height = Number.isFinite(region.height) ? region.height : null;
  if (left == null || top == null || width == null || height == null) {
    return "";
  }
  return `${left},${top} · ${width}x${height}`;
}

function formatMarker(marker) {
  if (!marker || typeof marker !== "object") {
    return "";
  }
  const x = Number.isFinite(marker.x) ? marker.x : null;
  const y = Number.isFinite(marker.y) ? marker.y : null;
  if (x == null || y == null) {
    return "";
  }
  return `${x},${y}${marker.color ? ` · ${marker.color}` : ""}`;
}

function extractBeforeAfterImages(result, previewImages) {
  const beforeImage =
    result?.before_observation?.screenshot_base64 && previewImages.length > 1 ? previewImages[previewImages.length - 1] : null;
  const afterImage = previewImages.length ? previewImages[0] : null;
  return { beforeImage, afterImage };
}

function buildToolTraceNode(entry) {
  const trace = Array.isArray(entry.toolTrace) ? entry.toolTrace : [];
  const diagnostics = entry.diagnostics || null;
  if (!trace.length && !diagnostics) {
    return null;
  }

  const details = document.createElement("details");
  details.className = "tool-trace-block";
  details.open = true;

  const summary = document.createElement("summary");
  summary.className = "tool-trace-summary";

  const summaryCopy = document.createElement("div");
  summaryCopy.className = "tool-trace-summary-copy";

  const summaryTitle = document.createElement("strong");
  summaryTitle.textContent = trace.length
    ? t("toolTraceInlineSummary", { count: trace.length })
    : t("toolTraceInlineSummary", { count: 0 });
  summaryCopy.appendChild(summaryTitle);

  const names = summarizeToolNames(trace);
  if (names) {
    const summaryNames = document.createElement("span");
    summaryNames.className = "tool-trace-summary-subtle";
    summaryNames.textContent = names;
    summaryCopy.appendChild(summaryNames);
  }

  summary.appendChild(summaryCopy);

  const summaryMeta = document.createElement("div");
  summaryMeta.className = "tool-trace-summary-meta";
  if (entry.apiModeUsed) {
    const modeBadge = document.createElement("span");
    modeBadge.className = "message-badge subtle";
    modeBadge.textContent = t("toolTraceApiMode", { mode: entry.apiModeUsed });
    summaryMeta.appendChild(modeBadge);
  }
  summary.appendChild(summaryMeta);
  details.appendChild(summary);

  const list = document.createElement("div");
  list.className = "tool-trace-list";

  if (diagnostics) {
    const diagCard = document.createElement("article");
    diagCard.className = "tool-call-card diagnostics";

    const diagHead = document.createElement("div");
    diagHead.className = "tool-call-head";

    const diagTitle = document.createElement("div");
    diagTitle.className = "tool-call-title";
    const diagStrong = document.createElement("strong");
    diagStrong.textContent = diagnostics.request_id
      ? t("diagnosticsRequestId", { id: diagnostics.request_id })
      : "Diagnostics";
    diagTitle.appendChild(diagStrong);
    diagHead.appendChild(diagTitle);
    diagCard.appendChild(diagHead);

    const badges = document.createElement("div");
    badges.className = "diagnostic-badges";

    if (diagnostics.api_mode_used) {
      const modeBadge = document.createElement("span");
      modeBadge.className = "message-badge subtle";
      modeBadge.textContent = t("toolTraceApiMode", { mode: diagnostics.api_mode_used });
      badges.appendChild(modeBadge);
    }
    if (diagnostics.content_filter_triggered) {
      const badge = document.createElement("span");
      badge.className = "message-badge warning";
      badge.textContent = t("diagnosticsContentFilter");
      badges.appendChild(badge);
    }
    if (diagnostics.degraded_retry_used) {
      const badge = document.createElement("span");
      badge.className = "message-badge warning";
      badge.textContent = t("diagnosticsDegradedRetry");
      badges.appendChild(badge);
    }
    if (diagnostics.history_trimmed_for_model) {
      const badge = document.createElement("span");
      badge.className = "message-badge subtle";
      badge.textContent = t("diagnosticsHistoryTrimmed");
      badges.appendChild(badge);
    }
    if (diagnostics.aggressive_trim_used) {
      const badge = document.createElement("span");
      badge.className = "message-badge warning";
      badge.textContent = t("diagnosticsAggressiveTrim");
      badges.appendChild(badge);
    }

    if (badges.childNodes.length) {
      diagCard.appendChild(badges);
    }

    const serializedSummaryParts = [
      diagnostics.serialized_message_count,
      diagnostics.serialized_system_message_count,
      diagnostics.serialized_user_message_count,
      diagnostics.serialized_assistant_message_count,
      diagnostics.serialized_tool_message_count,
    ];
    if (serializedSummaryParts.some((value) => Number.isFinite(value) && value > 0)) {
      const statsBlock = document.createElement("section");
      statsBlock.className = "tool-call-block";

      const statsLabel = document.createElement("div");
      statsLabel.className = "tool-call-label";
      statsLabel.textContent = t("toolTraceArguments");

      const statsText = document.createElement("div");
      statsText.className = "diagnostic-text";
      statsText.textContent = t("diagnosticsSerializedSummary", {
        messages: diagnostics.serialized_message_count ?? 0,
        system: diagnostics.serialized_system_message_count ?? 0,
        user: diagnostics.serialized_user_message_count ?? 0,
        assistant: diagnostics.serialized_assistant_message_count ?? 0,
        tool: diagnostics.serialized_tool_message_count ?? 0,
      });

      const statsTextDetail = document.createElement("div");
      statsTextDetail.className = "diagnostic-text subtle";
      statsTextDetail.textContent = t("diagnosticsSerializedDetail", {
        reasoning: diagnostics.serialized_reasoning_message_count ?? 0,
        images: diagnostics.serialized_image_part_count ?? 0,
      });

      statsBlock.appendChild(statsLabel);
      statsBlock.appendChild(statsText);
      statsBlock.appendChild(statsTextDetail);
      diagCard.appendChild(statsBlock);
    }

    if (diagnostics.last_error_message) {
      const errorBlock = document.createElement("section");
      errorBlock.className = "tool-call-block";
      const errorLabel = document.createElement("div");
      errorLabel.className = "tool-call-label";
      errorLabel.textContent = t("toolTraceResult");
      const errorPre = document.createElement("pre");
      errorPre.className = "tool-json";
      errorPre.textContent = formatToolData(diagnostics.last_error_message, {
        limit: 1200,
        pretty: false,
      });
      errorBlock.appendChild(errorLabel);
      errorBlock.appendChild(errorPre);
      diagCard.appendChild(errorBlock);
    }

    list.appendChild(diagCard);
  }

  trace.forEach((item, index) => {
    const normalizedItem = normalizeToolTraceItem(item);
    const result = normalizedItem.result;
    const isPending = normalizedItem.status === "pending";
    const hasError = normalizedItem.status === "error";
    const previewImages = normalizedItem.preview_images;
    const observationSummary = summarizeObservationSource(result);
    const coordinateSummary = summarizeCoordinateSource(result);
    const displaySummary = summarizeDisplayMetadata(result.display);
    const availableDisplaysCount = Array.isArray(result.available_displays) ? result.available_displays.length : 0;
    const verificationSummary = summarizeVerification(result);
    const durationText = formatDuration(normalizedItem.duration_ms);
    const previewRegionText = formatRegion(result.preview_region || result.verification?.compared_region);
    const previewMarkerText = formatMarker(result.preview_marker);
    const { beforeImage, afterImage } = extractBeforeAfterImages(result, previewImages);

    const card = document.createElement("article");
    card.className = `tool-call-card${hasError ? " error" : ""}${isPending ? " pending" : ""}`;

    const head = document.createElement("div");
    head.className = "tool-call-head";

    const title = document.createElement("div");
    title.className = "tool-call-title";

    const toolName = document.createElement("strong");
    toolName.textContent = `${index + 1}. ${normalizedItem.name || "tool"}`;
    title.appendChild(toolName);

    const preview = summarizeToolResult(result);
    if (preview) {
      const previewNode = document.createElement("span");
      previewNode.className = "tool-call-preview";
      previewNode.textContent = preview;
      title.appendChild(previewNode);
    }

    const status = document.createElement("span");
    status.className = `tool-call-status${hasError ? " error" : ""}${isPending ? " pending" : ""}`;
    status.textContent = isPending
      ? t("toolTraceStatusPending")
      : hasError
        ? t("toolTraceStatusError")
        : t("toolTraceStatusSuccess");

    head.appendChild(title);
    head.appendChild(status);
    card.appendChild(head);

    const metaBadges = document.createElement("div");
    metaBadges.className = "tool-call-meta";

    const stepBadge = document.createElement("span");
    stepBadge.className = "message-badge subtle";
    stepBadge.textContent = t("toolTraceStep", {
      step: (normalizedItem.step_index ?? index) + 1,
    });
    metaBadges.appendChild(stepBadge);

    if (durationText) {
      const durationBadge = document.createElement("span");
      durationBadge.className = "message-badge subtle";
      durationBadge.textContent = durationText;
      metaBadges.appendChild(durationBadge);
    }

    if (observationSummary) {
      const observationBadge = document.createElement("span");
      observationBadge.className = "message-badge subtle";
      observationBadge.textContent = `${t("toolTraceObservation")} · ${observationSummary}`;
      metaBadges.appendChild(observationBadge);
    }

    if (displaySummary) {
      const displayBadge = document.createElement("span");
      displayBadge.className = "message-badge subtle";
      displayBadge.textContent = displaySummary;
      metaBadges.appendChild(displayBadge);
    }

    if (availableDisplaysCount > 1) {
      const displaysBadge = document.createElement("span");
      displaysBadge.className = "message-badge subtle";
      displaysBadge.textContent = t("toolTraceDisplays", { count: availableDisplaysCount });
      metaBadges.appendChild(displaysBadge);
    }

    if (coordinateSummary) {
      const coordinateBadge = document.createElement("span");
      coordinateBadge.className = "message-badge subtle";
      coordinateBadge.textContent = `${t("toolTraceCoordinates")} · ${coordinateSummary}`;
      metaBadges.appendChild(coordinateBadge);
    }

    if (verificationSummary) {
      const verificationBadge = document.createElement("span");
      verificationBadge.className = "message-badge subtle";
      verificationBadge.textContent = `${t("toolTraceVerification")} · ${verificationSummary}`;
      metaBadges.appendChild(verificationBadge);
    }

    if (metaBadges.childNodes.length) {
      card.appendChild(metaBadges);
    }

    if (verificationSummary || previewRegionText || previewMarkerText || beforeImage || afterImage) {
      const verificationBlock = document.createElement("section");
      verificationBlock.className = "tool-call-block verification-block";

      const verificationLabel = document.createElement("div");
      verificationLabel.className = "tool-call-label";
      verificationLabel.textContent = t("toolTraceVerification");
      verificationBlock.appendChild(verificationLabel);

      const verificationMeta = document.createElement("div");
      verificationMeta.className = "tool-call-meta";

      if (verificationSummary) {
        const verificationBadge = document.createElement("span");
        verificationBadge.className = "message-badge subtle";
        verificationBadge.textContent = verificationSummary;
        verificationMeta.appendChild(verificationBadge);
      }

      if (previewRegionText) {
        const regionBadge = document.createElement("span");
        regionBadge.className = "message-badge subtle";
        regionBadge.textContent = `${t("toolTracePreviewRegion")} · ${previewRegionText}`;
        verificationMeta.appendChild(regionBadge);
      }

      if (previewMarkerText) {
        const markerBadge = document.createElement("span");
        markerBadge.className = "message-badge subtle";
        markerBadge.textContent = `${t("toolTracePreviewMarker")} · ${previewMarkerText}`;
        verificationMeta.appendChild(markerBadge);
      }

      if (verificationMeta.childNodes.length) {
        verificationBlock.appendChild(verificationMeta);
      }

      if (beforeImage || afterImage) {
        const verifyGallery = document.createElement("div");
        verifyGallery.className = "verification-gallery";

        if (beforeImage) {
          const beforeCard = document.createElement("div");
          beforeCard.className = "verification-frame";
          const beforeLabel = document.createElement("div");
          beforeLabel.className = "tool-call-label";
          beforeLabel.textContent = t("toolTraceBeforeView");
          const beforeImg = document.createElement("img");
          beforeImg.className = "tool-preview-image";
          beforeImg.src = beforeImage;
          beforeImg.alt = t("toolTraceBeforeView");
          beforeCard.appendChild(beforeLabel);
          beforeCard.appendChild(beforeImg);
          verifyGallery.appendChild(beforeCard);
        }

        if (afterImage) {
          const afterCard = document.createElement("div");
          afterCard.className = "verification-frame";
          const afterLabel = document.createElement("div");
          afterLabel.className = "tool-call-label";
          afterLabel.textContent = t("toolTraceAfterView");
          const afterImg = document.createElement("img");
          afterImg.className = "tool-preview-image";
          afterImg.src = afterImage;
          afterImg.alt = t("toolTraceAfterView");
          afterCard.appendChild(afterLabel);
          afterCard.appendChild(afterImg);
          verifyGallery.appendChild(afterCard);
        }

        verificationBlock.appendChild(verifyGallery);
      }

      card.appendChild(verificationBlock);
    }

    if (previewImages.length) {
      const previewBlock = document.createElement("section");
      previewBlock.className = "tool-call-block";
      const previewLabel = document.createElement("div");
      previewLabel.className = "tool-call-label";
      previewLabel.textContent = t("toolTracePreview");
      const previewGallery = document.createElement("div");
      previewGallery.className = "tool-preview-gallery";
      previewImages.forEach((imageUrl, imageIndex) => {
        const previewLink = document.createElement("a");
        previewLink.className = "tool-preview-link";
        previewLink.href = imageUrl;
        previewLink.target = "_blank";
        previewLink.rel = "noreferrer";

        const previewImage = document.createElement("img");
        previewImage.className = "tool-preview-image";
        previewImage.src = imageUrl;
        previewImage.alt = `${normalizedItem.name || "tool"} preview ${imageIndex + 1}`;

        previewLink.appendChild(previewImage);
        previewGallery.appendChild(previewLink);
      });
      previewBlock.appendChild(previewLabel);
      previewBlock.appendChild(previewGallery);
      card.appendChild(previewBlock);
    }

    const pair = document.createElement("div");
    pair.className = "tool-call-pair";

    const argsBlock = document.createElement("details");
    argsBlock.className = "tool-call-detail";
    const argsSummary = document.createElement("summary");
    argsSummary.className = "tool-call-detail-summary";
    argsSummary.textContent = t("toolTraceArguments");
    const argsPre = document.createElement("pre");
    argsPre.className = "tool-json";
    argsPre.textContent = formatToolData(normalizedItem.arguments ?? {}, {
      limit: 1200,
      pretty: true,
    });
    argsBlock.appendChild(argsSummary);
    argsBlock.appendChild(argsPre);

    const resultBlock = document.createElement("details");
    resultBlock.className = "tool-call-detail";
    const resultSummary = document.createElement("summary");
    resultSummary.className = "tool-call-detail-summary";
    resultSummary.textContent = t("toolTraceRaw");
    const resultPre = document.createElement("pre");
    resultPre.className = "tool-json";
    resultPre.textContent =
      formatToolData(result, { limit: 1800, pretty: true }) || t("toolTraceNoResult");
    resultBlock.appendChild(resultSummary);
    resultBlock.appendChild(resultPre);

    pair.appendChild(argsBlock);
    pair.appendChild(resultBlock);
    card.appendChild(pair);
    list.appendChild(card);
  });

  details.appendChild(list);
  return details;
}

function renderMessages() {
  elements.messages.innerHTML = "";
  for (const message of state.chatEntries) {
    const node = document.createElement("article");
    node.className = `message ${message.role}${message.isError ? " error" : ""}`;

    const head = document.createElement("div");
    head.className = "message-head";

    const role = document.createElement("div");
    role.className = "role";
    const roleKey =
      message.role === "user"
        ? "roleUser"
        : message.role === "assistant"
          ? "roleAssistant"
          : "roleSystem";
    role.textContent = t(roleKey);
    head.appendChild(role);

    if (message.apiModeUsed) {
      const badge = document.createElement("span");
      badge.className = "message-badge";
      badge.textContent = message.apiModeUsed;
      head.appendChild(badge);
    }

    if (message.streamStage) {
      const stageBadge = document.createElement("span");
      stageBadge.className = `message-badge subtle stream-stage ${message.streamStage}`;
      const stageKey =
        message.streamStage === "reasoning"
          ? "toolTraceStageReasoning"
          : message.streamStage === "tooling"
            ? "toolTraceStageTooling"
            : "toolTraceStageFinished";
      stageBadge.textContent = t(stageKey);
      head.appendChild(stageBadge);
    }

    const content = document.createElement("div");
    content.className = "content";
    content.textContent = message.content;

    node.appendChild(head);
    node.appendChild(content);

    const toolTraceNode = buildToolTraceNode(message);
    if (toolTraceNode) {
      node.appendChild(toolTraceNode);
    }

    elements.messages.appendChild(node);
  }
  elements.messages.scrollTop = elements.messages.scrollHeight;
  renderObservationContext();
}

function appendMessage(role, content, options = {}) {
  const entry = {
    role,
    content,
    toolTrace: Array.isArray(options.toolTrace) ? options.toolTrace : [],
    apiModeUsed: options.apiModeUsed || null,
    diagnostics: options.diagnostics || null,
    isError: Boolean(options.isError),
  };
  state.chatEntries.push(entry);
  if (options.persist !== false) {
    state.conversation.push({ role, content });
  }
  renderMessages();
}

function createStreamingAssistantMessage() {
  const entry = {
    role: "assistant",
    content: "",
    toolTrace: [],
    apiModeUsed: null,
    diagnostics: null,
    isError: false,
    streamStage: "reasoning",
  };
  state.chatEntries.push(entry);
  state.activeStreamMessageIndex = state.chatEntries.length - 1;
  renderMessages();
}

function updateStreamingAssistantMessage(patch = {}) {
  const index = state.activeStreamMessageIndex;
  if (index < 0 || !state.chatEntries[index]) {
    return;
  }
  const current = state.chatEntries[index];
  if (typeof patch.content === "string") {
    current.content = patch.content;
  }
  if (Array.isArray(patch.toolTrace)) {
    current.toolTrace = patch.toolTrace.map((item) => normalizeToolTraceItem(item));
    updateLatestObservationContextFromToolTrace(current.toolTrace);
  }
  if (patch.tool) {
    current.toolTrace = mergeToolTraceItem(current.toolTrace || [], patch.tool);
    const observationContext = extractObservationContextFromResult(patch.tool.result || {}, {
      previewImages: extractTracePreviewImages(patch.tool),
    });
    if (observationContext) {
      state.latestObservationContext = observationContext;
    }
  }
  if (patch.apiModeUsed) {
    current.apiModeUsed = patch.apiModeUsed;
  }
  if (patch.diagnostics) {
    current.diagnostics = patch.diagnostics;
  }
  if (typeof patch.isError === "boolean") {
    current.isError = patch.isError;
  }
  if (typeof patch.streamStage === "string") {
    current.streamStage = patch.streamStage;
  }
  renderMessages();
  renderObservationContext();
}

function finalizeStreamingAssistantMessage({
  content,
  toolTrace,
  apiModeUsed,
  diagnostics,
  isError = false,
  streamStage = "finished",
}) {
  updateStreamingAssistantMessage({
    content,
    toolTrace,
    apiModeUsed,
    diagnostics,
    isError,
    streamStage,
  });
  if (typeof content === "string" && content) {
    state.conversation.push({ role: "assistant", content });
  }
  state.activeStreamMessageIndex = -1;
}

function buildChatRequestBody(config) {
  return {
    config: {
      model: config.model,
      base_url: config.baseUrl,
      api_key: config.apiKey,
      api_mode: config.apiMode,
      thinking_mode: config.thinkingMode,
      reasoning_effort: config.reasoningEffort,
      model_compat_mode: config.modelCompatMode,
      system_prompt: config.systemPrompt,
      max_images_per_tool_result: config.maxImagesPerToolResult,
      model_image_max_edge: config.modelImageMaxEdge,
      model_image_max_bytes: config.modelImageMaxBytes,
    },
    messages: state.conversation,
    max_steps: config.maxSteps,
    enable_ocr: config.enableOcr,
  };
}

async function sendChatStandard(body) {
  const data = await apiRequest("/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  finalizeStreamingAssistantMessage({
    content: data.reply || "",
    toolTrace: data.tool_trace || data.toolTrace || [],
    apiModeUsed: data.api_mode_used || data.apiModeUsed || null,
    diagnostics: data.diagnostics || null,
    isError: false,
    streamStage: "finished",
  });

  if (data.api_mode_used || data.apiModeUsed) {
    setStatusKey("statusReplyReceivedVia", {
      mode: data.api_mode_used || data.apiModeUsed,
    });
  } else {
    setStatusKey("statusReplyReceived");
  }
}

async function sendChatStream(body) {
  const response = await fetch("/api/v1/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming response body is unavailable.");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let sawAnyEvent = false;
  let sawRunFinished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    sawAnyEvent = true;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const line = chunk.split("\n").find((item) => item.startsWith("data: "));
      if (!line) {
        continue;
      }
      const data = JSON.parse(line.slice(6));

      if (data.type === "step_started") {
        updateStreamingAssistantMessage({ streamStage: "reasoning" });
        continue;
      }

      if (data.type === "model_response") {
        if (data.api_mode_used) {
          updateStreamingAssistantMessage({ apiModeUsed: data.api_mode_used, streamStage: "reasoning" });
        }
        continue;
      }

      if (data.type === "tool_started") {
        if (data.tool) {
          updateStreamingAssistantMessage({ tool: data.tool, streamStage: "tooling" });
        }
        continue;
      }

      if (data.type === "tool_completed") {
        if (data.tool) {
          updateStreamingAssistantMessage({ tool: data.tool, streamStage: "tooling" });
        }
        continue;
      }

      if (data.type === "run_finished") {
        sawRunFinished = true;
        finalizeStreamingAssistantMessage({
          content: data.reply || "",
          toolTrace: data.tool_trace || data.toolTrace || [],
          apiModeUsed: data.api_mode_used || data.apiModeUsed || null,
          diagnostics: data.diagnostics || null,
          isError: false,
          streamStage: "finished",
        });

        if (data.api_mode_used || data.apiModeUsed) {
          setStatusKey("statusReplyReceivedVia", {
            mode: data.api_mode_used || data.apiModeUsed,
          });
        } else {
          setStatusKey("statusReplyReceived");
        }
      }
    }
  }

  return { sawAnyEvent, sawRunFinished };
}

function setOutput(target, entry) {
  state[target] = entry;
  renderOutputs();
}

function renderOutputs() {
  elements.appOutput.textContent = renderStoredEntry(state.appOutputEntry);
  elements.permissionOutput.textContent = renderStoredEntry(state.permissionOutputEntry);
  elements.snapshotOutput.textContent = renderStoredEntry(state.snapshotOutputEntry);
  elements.elementMetaOutput.textContent = renderStoredEntry(state.elementMetaEntry);
}

function setAppOutput(payload) {
  state.appOutputEntry = payload;
  elements.appOutput.textContent = renderStoredEntry(payload);
}

function setPermissionOutput(payload) {
  state.permissionOutputEntry = payload;
  elements.permissionOutput.textContent = renderStoredEntry(payload);
}

function setSnapshotOutput(payload) {
  state.snapshotOutputEntry = payload;
  elements.snapshotOutput.textContent = renderStoredEntry(payload);
}

function setElementMeta(payload) {
  state.elementMetaEntry = payload;
  elements.elementMetaOutput.textContent = renderStoredEntry(payload);
}

function switchTab(tabName) {
  const nextTab = ["run-config", "console", "apps", "permissions"].includes(tabName) ? tabName : "run-config";
  state.activeTab = nextTab;

  const isRunConfig = nextTab === "run-config";
  const isConsole = nextTab === "console";
  const isApps = nextTab === "apps";
  const isPermissions = nextTab === "permissions";

  elements.tabRunConfig.classList.toggle("active", isRunConfig);
  elements.tabConsole.classList.toggle("active", isConsole);
  elements.tabApps.classList.toggle("active", isApps);
  elements.tabPermissions.classList.toggle("active", isPermissions);

  elements.runConfigTabPanel.classList.toggle("active", isRunConfig);
  elements.runConfigTabPanel.hidden = !isRunConfig;

  elements.consoleTabPanel.classList.toggle("active", isConsole);
  elements.consoleTabPanel.hidden = !isConsole;

  elements.appsTabPanel.classList.toggle("active", isApps);
  elements.appsTabPanel.hidden = !isApps;

  elements.permissionsTabPanel.classList.toggle("active", isPermissions);
  elements.permissionsTabPanel.hidden = !isPermissions;
}

function applyConfig(config) {
  elements.model.value = config.model || elements.model.value;
  elements.baseUrl.value = config.baseUrl || elements.baseUrl.value;
  elements.apiMode.value = config.apiMode || "auto";
  elements.thinkingMode.value = config.thinkingMode || "auto";
  elements.reasoningEffort.value = config.reasoningEffort || "medium";
  elements.modelCompatMode.value = config.modelCompatMode || "auto";
  elements.apiKey.value = config.apiKey || "";
  elements.systemPrompt.value = config.systemPrompt || defaultSystemPrompt;
  elements.maxSteps.value = String(config.maxSteps || elements.maxSteps.value || 100);
  elements.enableOcr.value = String(Boolean(config.enableOcr));
  elements.maxImagesPerToolResult.value = String(
    config.maxImagesPerToolResult ?? elements.maxImagesPerToolResult.value ?? 1,
  );
  elements.modelImageMaxEdge.value = String(
    config.modelImageMaxEdge ?? elements.modelImageMaxEdge.value ?? 1600,
  );
  elements.modelImageMaxBytes.value = String(
    config.modelImageMaxBytes ?? elements.modelImageMaxBytes.value ?? 350000,
  );
}

async function loadConfig({ silent = false } = {}) {
  try {
    const config = await apiRequest("/api/v1/config");
    applyConfig({
      model: config.model,
      baseUrl: config.base_url || config.baseUrl,
      apiMode: config.api_mode || config.apiMode,
      thinkingMode: config.thinking_mode || config.thinkingMode,
      reasoningEffort: config.reasoning_effort || config.reasoningEffort,
      modelCompatMode: config.model_compat_mode || config.modelCompatMode || "auto",
      apiKey: config.api_key || config.apiKey,
      systemPrompt: config.system_prompt || config.systemPrompt,
      maxSteps: config.max_steps ?? config.maxSteps ?? 100,
      enableOcr: config.enable_ocr ?? config.enableOcr ?? false,
      maxImagesPerToolResult:
        config.max_images_per_tool_result ?? config.maxImagesPerToolResult ?? 1,
      modelImageMaxEdge: config.model_image_max_edge ?? config.modelImageMaxEdge ?? 1600,
      modelImageMaxBytes: config.model_image_max_bytes ?? config.modelImageMaxBytes ?? 350000,
    });
    if (!silent) {
      setStatusKey("statusConfigLoaded");
    }
  } catch (error) {
    console.warn("Failed to load saved config", error);
    if (!silent) {
      setStatusKey("statusConfigLoadFailed");
    }
  }
}

function readConfig() {
  const parsedMaxSteps = Number.parseInt(elements.maxSteps.value, 10);
  const parsedMaxImagesPerToolResult = Number.parseInt(elements.maxImagesPerToolResult.value, 10);
  const parsedModelImageMaxEdge = Number.parseInt(elements.modelImageMaxEdge.value, 10);
  const parsedModelImageMaxBytes = Number.parseInt(elements.modelImageMaxBytes.value, 10);
  return {
    model: elements.model.value.trim(),
    baseUrl: elements.baseUrl.value.trim(),
    apiMode: elements.apiMode.value,
    thinkingMode: elements.thinkingMode.value || "auto",
    reasoningEffort: elements.reasoningEffort.value || "medium",
    modelCompatMode: elements.modelCompatMode.value || "auto",
    apiKey: elements.apiKey.value.trim(),
    systemPrompt: elements.systemPrompt.value.trim(),
    maxSteps: Number.isFinite(parsedMaxSteps)
      ? Math.max(1, Math.min(500, parsedMaxSteps))
      : 100,
    enableOcr: elements.enableOcr.value === "true",
    maxImagesPerToolResult: Number.isFinite(parsedMaxImagesPerToolResult)
      ? Math.max(0, Math.min(5, parsedMaxImagesPerToolResult))
      : 1,
    modelImageMaxEdge: Number.isFinite(parsedModelImageMaxEdge)
      ? Math.max(256, Math.min(4096, parsedModelImageMaxEdge))
      : 1600,
    modelImageMaxBytes: Number.isFinite(parsedModelImageMaxBytes)
      ? Math.max(32768, Math.min(4000000, parsedModelImageMaxBytes))
      : 350000,
  };
}

async function saveConfig() {
  const config = readConfig();
  try {
    setStatusKey("statusConfigSaving");
    await apiRequest("/api/v1/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        base_url: config.baseUrl,
        api_key: config.apiKey,
        api_mode: config.apiMode,
        thinking_mode: config.thinkingMode,
        reasoning_effort: config.reasoningEffort,
        model_compat_mode: config.modelCompatMode,
        system_prompt: config.systemPrompt,
        max_steps: config.maxSteps,
        enable_ocr: config.enableOcr,
        max_images_per_tool_result: config.maxImagesPerToolResult,
        model_image_max_edge: config.modelImageMaxEdge,
        model_image_max_bytes: config.modelImageMaxBytes,
      }),
    });
    setStatusKey("statusConfigSaved");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Failed to save server config", error);
    setStatusText(`${t("statusConfigSaveFailed")} ${message}`);
    throw error;
  }
}

function getPermissionCopy(item) {
  const localized = PERMISSION_COPY[state.currentLanguage]?.[item.id];
  const fallback = PERMISSION_COPY.en[item.id];
  const copy = localized || fallback || {};
  return {
    label: copy.label || item.label,
    message: copy.message || item.message || "",
    actionLabel: copy.actionLabel || item.action_label || t("buttonRequestAccess"),
    statusHint:
      copy.statusHints?.[item.status] ||
      item.status_hint ||
      defaultPermissionHint(item.status),
    manualSteps: copy.manualSteps || item.manual_steps || [],
  };
}

function defaultPermissionHint(status) {
  if (status === "granted") return t("permissionRequirementReady");
  if (status === "not_granted") return t("permissionRequirementMissing");
  if (status === "unsupported") return t("permissionRequirementUnsupported");
  return t("permissionUnknownRequirement");
}

function describePermissionStatus(item) {
  if (item.status === "granted") return t("permissionStatusGranted");
  if (item.status === "not_granted") return t("permissionStatusMissing");
  if (item.status === "unsupported") return t("permissionStatusUnsupported");
  return t("permissionStatusUnknown");
}

function describePermissionGroup(item) {
  return item.group === "runtime_capability"
    ? t("permissionGroupRuntime")
    : t("permissionGroupSystem");
}

function groupPermissions(items) {
  return [
    {
      key: "system_permission",
      title: t("permissionGroupSystemTitle"),
      description: t("permissionGroupSystemDescription"),
      items: items.filter((item) => item.group === "system_permission"),
    },
    {
      key: "runtime_capability",
      title: t("permissionGroupRuntimeTitle"),
      description: t("permissionGroupRuntimeDescription"),
      items: items.filter((item) => item.group === "runtime_capability"),
    },
  ].filter((group) => group.items.length > 0);
}

function renderManualSteps(item) {
  const copy = getPermissionCopy(item);
  const steps = Array.isArray(copy.manualSteps) ? copy.manualSteps : [];
  if (!steps.length) {
    return "";
  }
  const entries = steps.map((step) => `<li>${step}</li>`).join("");
  return `
    <div class="permission-steps">
      <div class="permission-steps-title">${t("permissionManualSteps")}</div>
      <ol>${entries}</ol>
    </div>
  `;
}

function renderPermissionOverview(overview) {
  state.latestPermissionOverview = overview;
  if (!overview) {
    elements.permissionSummary.textContent = t("emptyPermissionSummary");
    elements.permissionList.textContent = t("emptyPermissionList");
    return;
  }

  const missingBlocking = overview.missing_blocking_ids?.length || 0;
  const platform = formatPlatform(overview.platform);
  elements.permissionSummary.textContent = overview.ready_for_desktop_use
    ? t("permissionSummaryReady", { platform })
    : t("permissionSummaryNotReady", { platform, count: missingBlocking });

  const items = overview.items || [];
  if (!items.length) {
    elements.permissionList.textContent = t("emptyPermissionList");
    return;
  }

  elements.permissionList.innerHTML = "";
  for (const group of groupPermissions(items)) {
    const section = document.createElement("section");
    section.className = "permission-group";

    const header = document.createElement("div");
    header.className = "permission-group-header";
    header.innerHTML = `
      <h3>${group.title}</h3>
      <p>${group.description}</p>
    `;
    section.appendChild(header);

    const list = document.createElement("div");
    list.className = "permission-list";

    for (const item of group.items) {
      const copy = getPermissionCopy(item);
      const row = document.createElement("article");
      row.className = `permission-item status-${item.status}`;

      const actionHtml = item.can_request
        ? `<button type="button" class="permission-action" data-permission-id="${item.id}">${copy.actionLabel}</button>`
        : `<span class="permission-readonly">${t("permissionReadOnly")}</span>`;

      row.innerHTML = `
        <div class="permission-meta">
          <div class="permission-topline">
            <div class="permission-title-block">
              <strong>${copy.label}</strong>
              <span class="permission-kind">${describePermissionGroup(item)}</span>
            </div>
            <span class="permission-badge">${describePermissionStatus(item)}</span>
          </div>
          <div class="permission-message">${copy.message}</div>
          <div class="permission-hint">${copy.statusHint}</div>
          ${renderManualSteps(item)}
          <div class="permission-footer">
            <span class="permission-blocking">${item.blocking ? t("permissionBlocking") : t("permissionOptional")}</span>
            ${actionHtml}
          </div>
        </div>
      `;

      const button = row.querySelector(".permission-action");
      if (button) {
        button.addEventListener("click", async () => {
          await requestSpecificPermission(item.id);
        });
      }

      list.appendChild(row);
    }

    section.appendChild(list);
    elements.permissionList.appendChild(section);
  }
}

function setElementActionOptions(actions) {
  state.latestElementActions = Array.isArray(actions) ? actions : [];
  elements.elementActionSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.latestElementActions.length
    ? t("optionSelectAction")
    : t("optionNoAccessibilityActions");
  elements.elementActionSelect.appendChild(placeholder);

  for (const action of state.latestElementActions) {
    const option = document.createElement("option");
    option.value = action;
    option.textContent = action;
    elements.elementActionSelect.appendChild(option);
  }
}

function flattenSnapshotNodes(snapshot) {
  const rows = [];
  const windows = snapshot?.windows || [];

  for (const windowNode of windows) {
    rows.push({
      id: windowNode.window_id,
      label: `${t("treeWindowPrefix")} ${windowNode.title || windowNode.role || t("treeUntitledWindow")}`,
      depth: 1,
      clickable: false,
    });
    walkChildren(windowNode.children || [], 2, rows);
  }

  return rows;
}

function walkChildren(children, depth, rows) {
  for (const child of children) {
    const bits = [child.role || t("treeUnknown")];
    if (child.title) bits.push(child.title);
    else if (child.description) bits.push(child.description);
    else if (child.value) bits.push(String(child.value).slice(0, 50));

    rows.push({
      id: child.element_id,
      label: bits.join(" · "),
      depth,
      clickable: Boolean(child.element_id),
      interactable: Boolean(child.interactable),
      role: child.role || "",
      subrole: child.subrole || "",
      selected: typeof child.selected === "boolean" ? child.selected : null,
      availableActions: Array.isArray(child.available_actions) ? child.available_actions : [],
      value: child.value || "",
      description: child.description || "",
    });
    if (child.children?.length) {
      walkChildren(child.children, Math.min(depth + 1, 8), rows);
    }
  }
}

function findSnapshotNodeById(children, elementId) {
  for (const child of children || []) {
    if (child.element_id === elementId) {
      return child;
    }
    const nested = findSnapshotNodeById(child.children || [], elementId);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function findElementInSnapshot(snapshot, elementId) {
  for (const windowNode of snapshot?.windows || []) {
    const found = findSnapshotNodeById(windowNode.children || [], elementId);
    if (found) {
      return {
        window_id: windowNode.window_id,
        window_title: windowNode.title,
        ...found,
      };
    }
  }
  return null;
}

function updateSelectedElementMeta() {
  if (!state.latestSnapshot || !state.selectedElementId) {
    setElementMeta(i18nEntry("emptyElementMeta"));
    setElementActionOptions([]);
    return;
  }
  const element = findElementInSnapshot(state.latestSnapshot, state.selectedElementId);
  if (!element) {
    setElementMeta(i18nEntry("selectedElementMissing"));
    setElementActionOptions([]);
    return;
  }
  setElementActionOptions(Array.isArray(element.available_actions) ? element.available_actions : []);
  setElementMeta({
    element_id: element.element_id,
    role: element.role,
    subrole: element.subrole || null,
    title: element.title || null,
    description: element.description || null,
    value: element.value || null,
    enabled: element.enabled ?? null,
    focused: element.focused ?? null,
    selected: element.selected ?? null,
    available_actions: element.available_actions || [],
    bounds: element.bounds || null,
    window_id: element.window_id || null,
    window_title: element.window_title || null,
  });
}

function renderSnapshotTree(snapshot) {
  state.latestSnapshot = snapshot;
  const filterMode = elements.interactableFilter.value;
  const roleFilter = elements.roleFilter.value.trim().toLowerCase();
  let rows = flattenSnapshotNodes(snapshot);
  if (filterMode === "interactable") {
    rows = rows.filter((row) => !row.clickable || row.interactable);
  }
  if (roleFilter) {
    rows = rows.filter((row) => !row.clickable || row.role.toLowerCase().includes(roleFilter));
  }
  if (!rows.length) {
    elements.snapshotTree.textContent = t("emptySnapshotTree");
    return;
  }

  elements.snapshotTree.innerHTML = "";
  for (const row of rows) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tree-item tree-depth-${row.depth}${row.interactable ? " interactable" : ""}${state.selectedElementId === row.id ? " selected" : ""}`;
    button.textContent = row.id ? `${row.label} (${row.id})` : row.label;
    button.disabled = !row.clickable;
    if (row.clickable && row.id) {
      button.addEventListener("click", () => {
        state.selectedElementId = row.id;
        elements.elementIdInput.value = row.id;
        renderSnapshotTree(state.latestSnapshot);
        updateSelectedElementMeta();
        setStatusKey("statusSelectedElement", { id: row.id });
      });
    }
    elements.snapshotTree.appendChild(button);
  }
}

async function parseError(response) {
  const text = await response.text();
  if (!text) {
    return `HTTP ${response.status} ${response.statusText}`;
  }

  try {
    const data = JSON.parse(text);
    if (typeof data.detail === "string") {
      return `HTTP ${response.status} ${data.detail}`;
    }
    return `HTTP ${response.status} ${JSON.stringify(data)}`;
  } catch {
    return `HTTP ${response.status} ${text}`;
  }
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

function alertI18n(key) {
  alert(t(key));
}

async function performElementAction() {
  const elementId = elements.elementIdInput.value.trim();
  const actionName = elements.elementActionSelect.value.trim();
  if (!elementId) {
    alertI18n("alertElementIdRequired");
    return;
  }
  if (!actionName) {
    alertI18n("alertAccessibilityActionRequired");
    return;
  }

  try {
    setStatusKey("statusRunningAction", { action: actionName });
    const appName = elements.snapshotTarget.value.trim();
    const maxDepth = Number.parseInt(elements.snapshotDepth.value, 10) || 4;
    const maxChildren = Number.parseInt(elements.snapshotChildren.value, 10) || 40;
    const useCached = elements.useCachedSnapshot.value === "true";
    const data = await apiRequest("/api/v1/apps/perform-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: appName || null,
        element_id: elementId,
        action_name: actionName,
        snapshot_max_depth: maxDepth,
        snapshot_max_children: maxChildren,
        use_cached_snapshot: useCached,
        fallback_to_click: actionName === "AXPress",
      }),
    });
    setSnapshotOutput(data);
    setStatusText(data.message || t("statusRunningAction", { action: actionName }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshotOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusPerformActionFailed");
  }
}

async function loadPermissions({ silent = false } = {}) {
  try {
    if (!silent) {
      setStatusKey("statusCheckingPermissions");
    }
    const data = await apiRequest("/api/v1/permissions");
    renderPermissionOverview(data);
    setPermissionOutput(data);
    if (!silent) {
      setStatusKey("statusPermissionLoaded");
    }
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setPermissionOutput(i18nEntry("outputRequestFailed", { message }));
    if (!silent) {
      setStatusKey("statusPermissionCheckFailed");
    }
    throw error;
  }
}

async function requestPermissions(permissionIds = null) {
  try {
    setStatusKey("statusRequestingPermissions");
    const body = {
      permission_ids: Array.isArray(permissionIds) ? permissionIds : [],
      request_missing_only: !Array.isArray(permissionIds) || permissionIds.length === 0,
      open_settings_on_failure: true,
    };
    const data = await apiRequest("/api/v1/permissions/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    renderPermissionOverview(data.overview);
    setPermissionOutput(data);
    setStatusKey("statusPermissionRequestFinished");
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setPermissionOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusPermissionRequestFailed");
    throw error;
  }
}

async function requestSpecificPermission(permissionId) {
  if (!permissionId) return;
  await requestPermissions([permissionId]);
}

async function sendChat(event) {
  event.preventDefault();
  const content = elements.userInput.value.trim();
  if (!content) return;

  const config = readConfig();
  if (!config.model || !config.baseUrl) {
    alertI18n("alertModelBaseRequired");
    return;
  }

  await saveConfig();
  appendMessage("user", content);
  elements.userInput.value = "";
  state.sendButtonState = "thinking";
  elements.sendButton.disabled = true;
  renderSendButton();
  setStatusKey("statusCallingModel", { mode: config.apiMode });
  createStreamingAssistantMessage();
  const requestBody = buildChatRequestBody(config);

  try {
    try {
      const { sawAnyEvent, sawRunFinished } = await sendChatStream(requestBody);
      if (!sawAnyEvent && state.activeStreamMessageIndex >= 0) {
        setStatusKey("statusStreamFallback");
        await sendChatStandard(requestBody);
      } else if (!sawRunFinished && state.activeStreamMessageIndex >= 0) {
        updateStreamingAssistantMessage({
          content: t("assistantRequestFailed", { message: t("statusStreamInterrupted") }),
          isError: true,
        });
        setStatusKey("statusStreamInterrupted");
        state.activeStreamMessageIndex = -1;
      }
    } catch (streamError) {
      const startedExecution = state.activeStreamMessageIndex >= 0
        && Boolean(state.chatEntries[state.activeStreamMessageIndex]?.toolTrace?.length);
      if (startedExecution) {
        const message = streamError instanceof Error ? streamError.message : String(streamError);
        updateStreamingAssistantMessage({
          content: t("assistantRequestFailed", { message }),
          isError: true,
        });
        setStatusKey("statusStreamInterrupted");
        return;
      }

      setStatusKey("statusStreamFallback");
      await sendChatStandard(requestBody);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finalizeStreamingAssistantMessage({
      content: t("assistantRequestFailed", { message }),
      toolTrace: [],
      apiModeUsed: null,
      diagnostics: null,
      isError: true,
    });
    setStatusKey("statusRequestFailed");
  } finally {
    state.sendButtonState = "idle";
    elements.sendButton.disabled = false;
    renderSendButton();
  }
}

function clearConversation() {
  state.conversation = [];
  state.chatEntries = [];
  state.activeStreamMessageIndex = -1;
  state.latestObservationContext = null;
  state.latestPointerState = null;
  renderMessages();
  renderObservationContext();
  setStatusKey("statusConversationCleared");
}

async function listApps() {
  try {
    setStatusKey("statusLoadingAppList");
    const query = elements.appQuery.value.trim();
    const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
    const data = await apiRequest(`/api/v1/apps${suffix}`);
    setAppOutput(data);
    setStatusKey("statusLoadedApps", { count: data.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setAppOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusAppListingFailed");
  }
}

async function readFrontmostApp() {
  try {
    setStatusKey("statusReadingFrontmostApp");
    const data = await apiRequest("/api/v1/apps/frontmost");
    setAppOutput(data);
    setStatusKey("statusFrontmostLoaded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setAppOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusFrontmostFailed");
  }
}

async function controlApp(action) {
  const appName = elements.appTarget.value.trim();
  if (!appName) {
    alertI18n("alertAppNameRequired");
    return;
  }

  try {
    setStatusKey("statusAppActionRunning", {
      action: action === "launch" ? t("actionLaunching") : t("actionActivating"),
    });
    const endpoint = action === "launch" ? "/api/v1/apps/launch" : "/api/v1/apps/activate";
    const data = await apiRequest(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_name: appName }),
    });
    setAppOutput(data);
    setStatusText(data.message || t("statusAppActionFinished"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setAppOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusAppActionFailed");
  }
}

async function captureSnapshot() {
  try {
    setStatusKey("statusCapturingSnapshot");
    const appName = elements.snapshotTarget.value.trim();
    const maxDepth = Number.parseInt(elements.snapshotDepth.value, 10) || 3;
    const maxChildren = Number.parseInt(elements.snapshotChildren.value, 10) || 25;
    const useCached = elements.useCachedSnapshot.value === "true";
    const data = await apiRequest("/api/v1/apps/accessibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: appName || null,
        max_depth: maxDepth,
        max_children: maxChildren,
        use_cached: useCached,
      }),
    });
    setSnapshotOutput(data);
    renderSnapshotTree(data);
    updateSelectedElementMeta();
    setStatusText(data.message || t("statusSnapshotCaptured"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshotOutput(i18nEntry("outputRequestFailed", { message }));
    elements.snapshotTree.textContent = t("emptySnapshotTree");
    setElementMeta(i18nEntry("emptyElementMeta"));
    setStatusKey("statusSnapshotFailed");
  }
}

async function clickElement() {
  const elementId = elements.elementIdInput.value.trim();
  if (!elementId) {
    alertI18n("alertElementIdRequired");
    return;
  }

  try {
    setStatusKey("statusClickingElement");
    const appName = elements.snapshotTarget.value.trim();
    const maxDepth = Number.parseInt(elements.snapshotDepth.value, 10) || 4;
    const maxChildren = Number.parseInt(elements.snapshotChildren.value, 10) || 40;
    const useCached = elements.useCachedSnapshot.value === "true";
    const data = await apiRequest("/api/v1/apps/click-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: appName || null,
        element_id: elementId,
        snapshot_max_depth: maxDepth,
        snapshot_max_children: maxChildren,
        use_cached_snapshot: useCached,
      }),
    });
    setSnapshotOutput(data);
    setStatusText(data.message || t("statusElementClicked"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshotOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusElementClickFailed");
  }
}

async function focusElement() {
  const elementId = elements.elementIdInput.value.trim();
  if (!elementId) {
    alertI18n("alertElementIdRequired");
    return;
  }

  try {
    setStatusKey("statusFocusingElement");
    const appName = elements.snapshotTarget.value.trim();
    const maxDepth = Number.parseInt(elements.snapshotDepth.value, 10) || 4;
    const maxChildren = Number.parseInt(elements.snapshotChildren.value, 10) || 40;
    const useCached = elements.useCachedSnapshot.value === "true";
    const data = await apiRequest("/api/v1/apps/focus-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: appName || null,
        element_id: elementId,
        snapshot_max_depth: maxDepth,
        snapshot_max_children: maxChildren,
        use_cached_snapshot: useCached,
      }),
    });
    setSnapshotOutput(data);
    setStatusText(data.message || t("statusElementFocused"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshotOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusFocusElementFailed");
  }
}

async function pressElement() {
  const elementId = elements.elementIdInput.value.trim();
  if (!elementId) {
    alertI18n("alertElementIdRequired");
    return;
  }

  try {
    setStatusKey("statusPressingElement");
    const appName = elements.snapshotTarget.value.trim();
    const maxDepth = Number.parseInt(elements.snapshotDepth.value, 10) || 4;
    const maxChildren = Number.parseInt(elements.snapshotChildren.value, 10) || 40;
    const useCached = elements.useCachedSnapshot.value === "true";
    const data = await apiRequest("/api/v1/apps/press-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: appName || null,
        element_id: elementId,
        snapshot_max_depth: maxDepth,
        snapshot_max_children: maxChildren,
        use_cached_snapshot: useCached,
        fallback_to_click: true,
      }),
    });
    setSnapshotOutput(data);
    setStatusText(data.message || t("statusElementPressed"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshotOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusPressElementFailed");
  }
}

async function typeIntoElement() {
  const elementId = elements.elementIdInput.value.trim();
  const text = elements.elementTextInput.value;
  if (!elementId) {
    alertI18n("alertElementIdRequired");
    return;
  }
  if (!text) {
    alertI18n("alertTextRequired");
    return;
  }

  try {
    setStatusKey("statusTypingIntoElement");
    const appName = elements.snapshotTarget.value.trim();
    const maxDepth = Number.parseInt(elements.snapshotDepth.value, 10) || 4;
    const maxChildren = Number.parseInt(elements.snapshotChildren.value, 10) || 40;
    const useCached = elements.useCachedSnapshot.value === "true";
    const clearFirst = elements.clearFirstSelect.value === "true";
    const data = await apiRequest("/api/v1/apps/type-into-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: appName || null,
        element_id: elementId,
        text,
        click_first: true,
        clear_first: clearFirst,
        snapshot_max_depth: maxDepth,
        snapshot_max_children: maxChildren,
        use_cached_snapshot: useCached,
      }),
    });
    setSnapshotOutput(data);
    setStatusText(data.message || t("statusTypedIntoElement"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshotOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusTypeIntoElementFailed");
  }
}

async function setValueForElement() {
  const elementId = elements.elementIdInput.value.trim();
  const text = elements.elementTextInput.value;
  if (!elementId) {
    alertI18n("alertElementIdRequired");
    return;
  }
  if (!text) {
    alertI18n("alertTextRequired");
    return;
  }

  try {
    setStatusKey("statusSettingElementValue");
    const appName = elements.snapshotTarget.value.trim();
    const maxDepth = Number.parseInt(elements.snapshotDepth.value, 10) || 4;
    const maxChildren = Number.parseInt(elements.snapshotChildren.value, 10) || 40;
    const useCached = elements.useCachedSnapshot.value === "true";
    const clearFirst = elements.clearFirstSelect.value === "true";
    const data = await apiRequest("/api/v1/apps/set-value", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: appName || null,
        element_id: elementId,
        text,
        snapshot_max_depth: maxDepth,
        snapshot_max_children: maxChildren,
        use_cached_snapshot: useCached,
        fallback_to_typing: true,
        click_first_on_fallback: true,
        clear_first_on_fallback: clearFirst,
      }),
    });
    setSnapshotOutput(data);
    setStatusText(data.message || t("statusElementValueSet"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshotOutput(i18nEntry("outputRequestFailed", { message }));
    setStatusKey("statusSetValueFailed");
  }
}

async function previewElement() {
  const elementId = elements.elementIdInput.value.trim();
  if (!elementId) {
    alertI18n("alertElementIdRequired");
    return;
  }

  try {
    setStatusKey("statusPreviewingElement");
    const appName = elements.snapshotTarget.value.trim();
    const maxDepth = Number.parseInt(elements.snapshotDepth.value, 10) || 4;
    const maxChildren = Number.parseInt(elements.snapshotChildren.value, 10) || 40;
    const useCached = elements.useCachedSnapshot.value === "true";
    const data = await apiRequest("/api/v1/apps/preview-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_name: appName || null,
        element_id: elementId,
        crop_size: 180,
        snapshot_max_depth: maxDepth,
        snapshot_max_children: maxChildren,
        use_cached_snapshot: useCached,
      }),
    });
    setSnapshotOutput(data);
    if (data.preview_image_base64) {
      elements.elementPreviewImage.src = `data:${data.preview_image_mime_type || "image/png"};base64,${data.preview_image_base64}`;
      elements.elementPreviewImage.hidden = false;
    } else {
      elements.elementPreviewImage.hidden = true;
      elements.elementPreviewImage.removeAttribute("src");
    }
    setStatusText(data.message || t("statusPreviewCaptured"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshotOutput(i18nEntry("outputRequestFailed", { message }));
    elements.elementPreviewImage.hidden = true;
    elements.elementPreviewImage.removeAttribute("src");
    setStatusKey("statusPreviewFailed");
  }
}

function applyLanguage(language) {
  state.currentLanguage = language === "zh" ? "zh" : "en";
  localStorage.setItem(LANGUAGE_STORAGE_KEY, state.currentLanguage);
  applyStaticTranslations();
  renderSendButton();
  renderMessages();
  renderObservationContext();
  renderStatus();
  renderOutputs();
  if (state.latestPermissionOverview) {
    renderPermissionOverview(state.latestPermissionOverview);
  } else {
    elements.permissionSummary.textContent = t("emptyPermissionSummary");
    elements.permissionList.textContent = t("emptyPermissionList");
  }
  if (state.latestSnapshot) {
    renderSnapshotTree(state.latestSnapshot);
    updateSelectedElementMeta();
  } else {
    elements.snapshotTree.textContent = t("emptySnapshotTree");
    setElementActionOptions([]);
  }
}

elements.saveConfig.addEventListener("click", () => {
  saveConfig().catch(() => {});
});
elements.tabRunConfig.addEventListener("click", () => switchTab("run-config"));
elements.tabConsole.addEventListener("click", () => switchTab("console"));
elements.tabApps.addEventListener("click", () => switchTab("apps"));
elements.tabPermissions.addEventListener("click", () => switchTab("permissions"));
elements.languagePicker.addEventListener("change", (event) => {
  applyLanguage(event.target.value);
});
elements.refreshPermissionsButton.addEventListener("click", () => loadPermissions());
elements.requestAllPermissionsButton.addEventListener("click", () => requestPermissions());
elements.clearChat.addEventListener("click", clearConversation);
elements.chatForm.addEventListener("submit", sendChat);
elements.observationDisplaySelect.addEventListener("change", syncObservationDisplaySelection);
elements.refreshObservationButton.addEventListener("click", refreshObservationContext);
elements.refreshPointerButton.addEventListener("click", refreshPointerState);
elements.focusAppsTabButton.addEventListener("click", jumpToAppsTab);
elements.syncFrontmostButton.addEventListener("click", syncFrontmostAppIntoAppsTab);
elements.listAppsButton.addEventListener("click", listApps);
elements.frontmostAppButton.addEventListener("click", readFrontmostApp);
elements.launchAppButton.addEventListener("click", () => controlApp("launch"));
elements.activateAppButton.addEventListener("click", () => controlApp("activate"));
elements.snapshotButton.addEventListener("click", captureSnapshot);
elements.interactableFilter.addEventListener("change", () => renderSnapshotTree(state.latestSnapshot));
elements.roleFilter.addEventListener("input", () => renderSnapshotTree(state.latestSnapshot));
elements.clickElementButton.addEventListener("click", clickElement);
elements.pressElementButton.addEventListener("click", pressElement);
elements.focusElementButton.addEventListener("click", focusElement);
elements.typeElementButton.addEventListener("click", typeIntoElement);
elements.setValueButton.addEventListener("click", setValueForElement);
elements.performElementActionButton.addEventListener("click", performElementAction);
elements.previewElementButton.addEventListener("click", previewElement);

state.currentLanguage = chooseInitialLanguage();
switchTab("run-config");
applyLanguage(state.currentLanguage);
setAppOutput(i18nEntry("emptyAppOutput"));
setPermissionOutput(i18nEntry("emptyPermissionOutput"));
setSnapshotOutput(i18nEntry("emptySnapshotOutput"));
setElementMeta(i18nEntry("emptyElementMeta"));
elements.elementPreviewImage.hidden = true;
loadConfig({ silent: false }).catch((error) => {
  console.warn("Failed to load config on startup", error);
});
loadPermissions({ silent: true }).catch((error) => {
  console.warn("Failed to load permissions on startup", error);
});
