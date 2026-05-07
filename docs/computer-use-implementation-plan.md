# Computer Use 实施方案

## 1. 目标

在当前目录下实现我们自己的 `computer-use` 系统，支持模型理解屏幕内容，并稳定地执行如下操作：

- 截图
- 鼠标移动
- 精准点击
- 双击 / 右键
- 键盘输入
- 热键
- 滚动
- OCR
- 元素定位
- 浏览器控制

这个系统的核心目标不是“能点一下”，而是：

1. 模型能看懂当前屏幕。
2. 动作执行链路可控、可回放、可调试。
3. 点击坐标足够精准，能处理缩放、多屏、窗口偏移等问题。
4. 后续可以平滑扩展到本地桌面、远程桌面、容器桌面三种环境。

---

## 2. 设计原则

### 2.1 先做闭环，再做复杂度

第一版优先做最小闭环：

- 截图
- 让模型返回动作
- 执行动作
- 回传执行结果和新截图

先证明链路跑通，再引入 OCR、DOM、视觉 grounding、远程连接、多代理等能力。

### 2.2 执行层和推理层分离

必须把系统拆成两层：

- `执行层`：真正和电脑交互，负责截图、点击、输入、滚动
- `推理层`：决定下一步做什么，负责看图、理解任务、生成动作

这样做的好处：

- 后续可以替换模型，不影响执行器
- 后续可以替换执行环境，不影响上层 Agent
- 更容易调试“是模型判断错了，还是点击坐标错了”

### 2.3 坐标系统必须标准化

精准点击的关键不是 `click(x, y)` 本身，而是：

1. 截图时使用的坐标系是什么
2. 模型看到的图片尺寸是什么
3. 返回的坐标属于哪个坐标系
4. 执行时如何映射回真实屏幕

如果这一步不统一，后面会一直出现“看起来点对了，实际上点偏了”的问题。

---

## 3. 推荐总体架构

推荐采用 `3 层架构`：

### 3.1 Client 执行器

运行在本机，或者运行在远程桌面容器里。

职责：

- 截图
- 获取屏幕尺寸、缩放比例、显示器信息
- 执行鼠标 / 键盘动作
- 可选执行 OCR / 本地元素检测
- 维护浏览器自动化会话
- 返回动作执行结果

技术建议：

- Python
- 桌面控制：`pyautogui` 或 `pynput`
- 截图：`mss`
- OCR：`pytesseract`，后续可替换 PaddleOCR
- 浏览器：`playwright`

### 3.2 Orchestrator 服务

这是我们自己的中控层。

职责：

- 接收用户任务
- 获取当前截图 / OCR / DOM
- 组织 prompt
- 调用模型
- 解析模型动作
- 下发动作给执行器
- 保存轨迹、日志、截图、错误信息

技术建议：

- Python `FastAPI`
- WebSocket 用于和执行器保持长连接
- REST API 用于外部调用和调试

### 3.3 Agent / Planner

这是大脑层。

职责：

- 根据任务和上下文决定下一步动作
- 产生结构化 action
- 判断失败重试策略
- 决定何时先 OCR、何时先找元素、何时直接点击

建议一开始不要把这个层做得太“智能体框架化”，先用一个简单循环：

1. 获取观察结果
2. 调模型
3. 执行动作
4. 判断是否完成

---

## 4. 精准点击怎么实现

这是整个系统最重要的部分。

### 4.1 坐标来源分三类

我们自己的系统建议支持 3 种点击来源：

#### A. 绝对坐标点击

模型直接返回：

```json
{ "action": "click", "x": 812, "y": 436 }
```

优点：

- 简单
- 闭环快

缺点：

- 对截图尺寸变化敏感
- 对缩放和多屏容易出错

适合第一版。

#### B. 基于 OCR / 检测框点击

先 OCR 或视觉检测，得到文本框或按钮框：

```json
{
  "text": "Submit",
  "bbox": { "x": 760, "y": 410, "width": 120, "height": 40 }
}
```

然后点击中心点：

```text
click_x = x + width / 2
click_y = y + height / 2
```

优点：

- 比模型瞎猜坐标稳定
- 好调试

适合第二版。

#### C. 浏览器 DOM / Selector 点击

如果目标在浏览器里，不走屏幕坐标，直接用：

- selector
- text locator
- role locator

优点：

- 最精准
- 最稳定
- 不受 DPI 和图片缩放影响

所以浏览器场景必须单独实现一套 `browser tools`，不要和桌面点击混为一谈。

### 4.2 必须统一的坐标模型

建议在系统内部统一使用 `logical screen coordinates`。

也就是：

- 截图时记录逻辑宽高
- 模型看到的也是这个逻辑尺寸
- 模型返回的坐标也基于逻辑尺寸
- 执行前统一映射到真实物理坐标

需要维护以下元数据：

```json
{
  "display_id": "main",
  "logical_width": 1440,
  "logical_height": 900,
  "physical_width": 2880,
  "physical_height": 1800,
  "scale_factor": 2.0,
  "offset_x": 0,
  "offset_y": 0
}
```

执行点击时：

```text
physical_x = offset_x + logical_x * scale_factor
physical_y = offset_y + logical_y * scale_factor
```

### 4.3 多显示器支持

多屏下必须记录每个显示器：

- 原点偏移
- 逻辑尺寸
- 物理尺寸
- 缩放比例

点击流程建议：

1. 截图时注明来自哪个 display
2. 模型动作里带 `display_id`
3. 执行器按对应 display 做偏移和缩放换算

### 4.4 点击前校验

为了提高成功率，点击前应做轻量校验：

1. 坐标是否超出屏幕范围
2. 是否命中可点击区域
3. 点击前是否需要先聚焦窗口
4. 是否需要先滚动使元素可见

后续还可以加：

- 点击前截取局部 patch
- 点击后再次截图比对变化

### 4.5 点击后验证

点击是否成功不能靠“代码没报错”判断。

建议点击后至少做一项验证：

- 屏幕有变化
- OCR 文本变化
- 窗口焦点变化
- DOM 状态变化
- URL 变化

如果没有变化，可以自动重试：

- 小幅偏移重试
- 改用双击
- 改用 OCR 框中心点击

---

## 5. 推荐分阶段实现

## 阶段 1：最小可用版本

目标：

- 本机截图
- 本机鼠标键盘控制
- FastAPI 服务
- WebSocket 执行器
- 基于截图 + 模型返回绝对坐标点击

需要完成：

- 执行器进程
- `screenshot`
- `click`
- `type`
- `scroll`
- `keypress`
- Orchestrator API
- action schema
- 简单任务循环

交付结果：

- 能在本机完成简单桌面点击和输入任务

## 阶段 2：精准点击增强

目标：

- 加入 OCR
- 加入 UI 元素检测
- 点击前后验证
- 支持 display metadata
- 支持 DPI / Retina 映射

需要完成：

- OCR service
- bbox 点击策略
- 坐标映射模块
- 多屏元数据采集
- retry policy

交付结果：

- 普通桌面应用点击稳定性明显提高

## 阶段 3：浏览器专用通道

目标：

- 浏览器操作不再依赖屏幕坐标
- 通过 Playwright 直接操作 DOM

需要完成：

- `browser_open`
- `browser_navigate`
- `browser_click`
- `browser_type`
- `browser_dom`
- `browser_screenshot`

交付结果：

- 网页场景下稳定性接近测试自动化工具

## 阶段 4：远程执行环境

目标：

- 执行器可部署到 Docker 桌面或远程机器

需要完成：

- agent 注册与鉴权
- 远程心跳
- 会话管理
- 日志与截图存储

交付结果：

- 一套真正可远程控制的 computer-use 系统

---

## 6. 推荐目录结构

建议从零开始采用下面的结构：

```text
open-computer-use/
  docs/
    computer-use-implementation-plan.md
  server/
    app/
      main.py
      api/
      core/
      models/
      services/
      agents/
  executor/
    client/
      main.py
      desktop/
      browser/
      ocr/
  shared/
    schemas/
    utils/
  tests/
    integration/
    e2e/
  scripts/
  README.md
```

说明：

- `server/` 放中控服务
- `executor/` 放本地或远程执行器
- `shared/` 放 action schema 和公共模型
- `tests/` 放端到端验证

---

## 7. 核心数据结构建议

### 7.1 Observation

```json
{
  "screenshot_base64": "...",
  "display": {
    "display_id": "main",
    "logical_width": 1440,
    "logical_height": 900,
    "physical_width": 2880,
    "physical_height": 1800,
    "scale_factor": 2.0,
    "offset_x": 0,
    "offset_y": 0
  },
  "ocr_blocks": [],
  "detected_elements": [],
  "browser_context": null
}
```

### 7.2 Action

```json
{
  "action": "click",
  "target": {
    "type": "coordinates",
    "x": 812,
    "y": 436,
    "display_id": "main"
  },
  "confidence": 0.87,
  "reason": "Click the blue submit button"
}
```

### 7.3 Action Result

```json
{
  "success": true,
  "executed_action": {
    "action": "click",
    "x": 812,
    "y": 436
  },
  "verification": {
    "screen_changed": true
  },
  "timestamp": 1710000000
}
```

---

## 8. 技术选型建议

### 服务端

- Python 3.11+
- FastAPI
- Pydantic
- Uvicorn
- websockets

### 执行器

- Python 3.11+
- mss
- pyautogui
- pynput
- pillow
- pytesseract
- opencv-python

### 浏览器

- Playwright

### 测试

- pytest
- pytest-asyncio

---

## 9. 风险点

### 9.1 DPI / Retina 偏移

这是桌面点击最常见问题，必须第一时间做坐标映射层，不要把 `pyautogui` 的屏幕坐标和模型返回坐标直接混用。

### 9.2 模型输出不稳定

模型有时会返回模糊动作，例如：

- “点击右上角按钮”
- “点那个蓝色的”

所以 action schema 必须强制结构化，不接受模糊自然语言直接进入执行层。

### 9.3 OCR 误识别

OCR 只能作为增强，不应作为唯一依据。

### 9.4 浏览器和桌面混用

浏览器内元素应优先用 DOM/selector 控制，桌面应用才走坐标点击。否则精度和稳定性都会下降。

### 9.5 安全风险

computer-use 天然具备高权限能力，必须规划：

- 命令白名单 / 黑名单
- 危险动作确认
- 会话隔离
- 日志审计

---

## 10. 我建议的起步路线

如果由我现在开始亲手搭这个项目，我会按下面顺序推进：

1. 先做 Python 单机版执行器
2. 再做 FastAPI 中控服务
3. 定义统一的 action / observation schema
4. 跑通截图 -> 模型 -> 点击 -> 新截图 的闭环
5. 加 OCR 和点击验证
6. 再单独做 Playwright 浏览器通道
7. 最后才做远程桌面 / Docker agent

原因很简单：

- 这是最快能做出结果的路径
- 最容易调试精准点击问题
- 后续扩展时不会推倒重来

---

## 11. 下一步建议

建议紧接着做下面 3 件事：

1. 初始化项目骨架
2. 定义 action / observation 的 Pydantic schema
3. 实现本地执行器的 `screenshot` 和 `click`

这 3 步完成后，我们就有真正的第一版基础了。

