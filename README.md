# Open Computer Use

This repository now contains a fresh implementation of a local-first `computer-use` prototype.

## What is included

- A small FastAPI orchestrator
- A local desktop executor
- A remote executor WebSocket protocol
- A minimal agent run loop
- Shared action and observation schemas
- A minimal CLI for manual control

## Phase 1 scope

The current implementation focuses on the first closed loop:

- capture a screenshot
- expose display metadata
- execute mouse clicks
- type text
- press keys and hotkeys
- scroll
- register remote executors
- run sequential action plans

## Project layout

```text
docs/
executor/
server/
shared/
tests/
```

## Install

### Option A: conda (recommended)

```bash
bash install.sh
```

This will:

- create a project-local conda environment at `.conda-env`
- install all Python dependencies
- run a smoke test for imports and integration tests

Manual setup is also available:

```bash
bash scripts/setup_conda_env.sh
conda activate /Users/lilei/project/learn/open-computer-use/.conda-env
bash scripts/smoke_test.sh
```

### Option B: venv

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run the API

```bash
bash start.sh
```

This is the recommended entrypoint. It will:

- start the FastAPI app
- wait for `/health`
- optionally request missing desktop permissions where the platform supports it
- optionally open the browser UI automatically
- write server logs to `server_debug.log`
- write model and desktop traces to `chat_debug.log`
- write SSE/event timeline records to `chat_events.log`

Useful environment variables:

- `CUA_HOST` and `CUA_PORT`
- `CUA_RELOAD=1` for auto-reload during development
- `CUA_OPEN_BROWSER=0` to keep the browser closed
- `CUA_AUTO_REQUEST_PERMISSIONS=0` to skip startup permission requests
- `CUA_HEALTH_TIMEOUT_SECONDS=90` to wait longer for startup
- `OPEN_COMPUTER_USE_SERVER_LOG=/path/to/server.log`
- `OPEN_COMPUTER_USE_CHAT_LOG=/path/to/chat.log`
- `OPEN_COMPUTER_USE_CHAT_EVENT_LOG=/path/to/chat-events.log`
- `OPEN_COMPUTER_USE_SERVER_CONFIG=/path/to/server_config.json`

Runtime configuration is now stored on the server instead of in browser local storage.
By default the UI reads and writes:

- `server_config.json`

You can copy the included example file to bootstrap a config manually:

```bash
cp server_config.example.json server_config.json
```

If you only want the raw API process without the startup helper:

```bash
bash scripts/run_api.sh
```

Open or call:

- `GET /`
- `GET /health`
- `GET /api/v1/executors`
- `GET /api/v1/config`
- `GET /api/v1/observe`
- `GET /api/v1/pointer`
- `GET /api/v1/apps`
- `GET /api/v1/apps/frontmost`
- `GET /api/v1/permissions`
- `POST /api/v1/permissions/request`
- `POST /api/v1/apps/launch`
- `POST /api/v1/apps/activate`
- `POST /api/v1/apps/accessibility`
- `POST /api/v1/apps/click-element`
- `POST /api/v1/apps/press-element`
- `POST /api/v1/apps/perform-action`
- `POST /api/v1/apps/type-into-element`
- `POST /api/v1/apps/set-value`
- `POST /api/v1/apps/focus-element`
- `POST /api/v1/apps/preview-element`
- `PUT /api/v1/config`
- `POST /api/v1/chat`
- `POST /api/v1/targets/preview`
- `POST /api/v1/actions/execute`
- `POST /api/v1/agent/runs`
- `WS /api/v1/ws/executors/connect`

The root page now hosts a browser UI where you can:

- manage runtime settings from a dedicated `Run Config` tab
- persist `model`, `base_url`, `api_key`, `api_mode`, `thinking_mode`, `reasoning_effort`, `max_steps`, and `enable_ocr` on the server
- persist `model_compat_mode` on the server so model-specific compatibility handling is shared across sessions
- persist image-budget controls on the server:
- `max_images_per_tool_result`
- `model_image_max_edge`
- `model_image_max_bytes`
- switch between `Run Config`, `Console`, `Apps`, and `Permissions`
- inspect desktop permission status in one place
- request missing desktop permissions from the `Permissions` tab when the platform supports it
- distinguish OS-level permissions from read-only runtime capability checks
- read per-permission status hints and manual enablement steps directly in the UI
- choose `api_mode` as `auto`, `responses`, or `chat_completions`
- choose `model_compat_mode` as:
- `auto`: enable Kimi-oriented history trimming automatically for Moonshot/Kimi endpoints
- `standard`: disable model-specific aggressive compatibility behavior
- `aggressive_kimi`: always use the strongest chat-completions trimming path before sending
- tune image payload pressure directly from the UI:
- `Images Per Tool`: how many screenshots a single tool result may contribute
- `Image Max Edge`: maximum resized width/height before sending to the model
- `Image Max Bytes`: target byte budget per compressed image
- list installed apps, inspect the frontmost app, launch apps, and activate apps
- inspect a lightweight accessibility tree for the frontmost app or a specific app
- click a UI element by `element_id` from the accessibility snapshot
- press a UI element by `element_id` using accessibility action first, then click fallback
- inspect which native accessibility actions a selected element exposes, then run one directly
- type text into a UI element by `element_id`
- set the value of a text-like UI element by `element_id` using accessibility APIs first
- focus a UI element by `element_id`
- preview a UI element with a marked screenshot crop
- edit the system prompt
- chat with the local computer-use agent
- inspect tool traces returned by the model
- inspect inline diagnostics for each reply, including API mode, content-filter retries, history trimming, serialized message counts, reasoning-message counts, and image-part counts
- inspect inline screenshot previews for tool steps directly in the chat timeline

If your gateway supports the OpenAI `responses` API but does not expose `chat/completions`, set:

- `Base URL`: for example `http://127.0.0.1:8089/v1`
- `API Mode`: `responses` or `auto`

The UI now shows which API mode was actually used for the reply, and model endpoint errors include the target URL and response body when available.

## Run the local CLI

Capture a screenshot:

```bash
python -m executor.client.main observe
```

Run a local permission and GUI access check:

```bash
python -m executor.client.main doctor
```

Read the current pointer position:

```bash
python -m executor.client.main pointer-state
```

Click a point:

```bash
python -m executor.client.main click --x 300 --y 200
```

Open a URL in Safari:

```bash
python -m executor.client.main open-url --url https://news.ycombinator.com
```

Search the web in Safari:

```bash
python -m executor.client.main search-web --query "今天的新闻"
```

Run the full click debug workflow:

```bash
python -m executor.client.main click-debug \
  --x 300 --y 200 \
  --debug-output-dir /tmp/open-computer-use-debug
```

Preview how a logical point maps before clicking:

```bash
python -m executor.client.main preview-target --x 300 --y 200 --crop-size 160
```

If you also want the cropped PNG preview in the response:

```bash
python -m executor.client.main preview-target --x 300 --y 200 --crop-size 160 --include-image
```

If you want to write the marked preview image to disk:

```bash
python -m executor.client.main preview-target \
  --x 300 --y 200 \
  --crop-size 160 \
  --include-image \
  --output /tmp/open-computer-use-target.png
```

Run as a remote executor:

```bash
python -m executor.client.main serve \
  --server-url ws://127.0.0.1:8000/api/v1/ws/executors/connect \
  --executor-id mac-local-1
```

## MCP server

Run the stdio MCP server:

```bash
python -m server.mcp_server
```

Run the HTTP MCP endpoint through the FastAPI app:

```bash
bash start.sh
```

Then use:

- discovery: `GET /mcp`
- JSON-RPC endpoint: `POST /mcp`

Example initialize call:

```bash
curl -X POST http://127.0.0.1:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

Example tools list call:

```bash
curl -X POST http://127.0.0.1:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Example tool call:

```bash
curl -X POST http://127.0.0.1:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "doctor",
      "arguments": {}
    }
  }'
```

Both stdio and HTTP MCP transports expose the same local tool set:

- `doctor`
- `pointer_state`
- `list_apps`
- `frontmost_app`
- `accessibility_snapshot`
- `click_element`
- `press_element`
- `perform_element_action`
- `type_into_element`
- `set_value`
- `focus_element`
- `preview_element`
- `launch_app`
- `activate_app`
- `open_url`
- `search_web`

## Permission Center

The browser UI now includes a dedicated permission panel.

It can:

- list every known desktop permission or runtime capability
- show whether each item is granted, missing, unsupported, or unknown
- refresh status at any time
- request missing permissions from the UI when the platform supports it

Behavior notes:

- on macOS, Accessibility can usually be prompted or opened from the panel
- on macOS, Screen Recording still requires manual approval in System Settings
- on Linux, the panel reports capability readiness such as AT-SPI and GUI session availability, but it cannot silently grant them for you

## Generic app control

The project now includes a first general-purpose app-control layer for macOS and Linux:

- list installed and running applications
- inspect the current frontmost application
- launch an app by `app_name` or `bundle_id`
- bring an app to the foreground before using keyboard and mouse actions

Linux support is best-effort today. The most mature path is:

- screenshots and multi-display capture
- clicks, typing, hotkeys, and scroll
- app discovery, launch, and foreground activation
- AT-SPI accessibility snapshots and element actions when `pyatspi` is available

Linux desktop integration still depends on your session type and installed tools. X11 sessions are currently the easiest to support consistently. Wayland may work for screenshots and clipboard, but active-window detection and focusing can vary by compositor.

CLI examples:

```bash
python -m executor.client.main list-apps --query Safari
python -m executor.client.main frontmost-app
python -m executor.client.main launch-app --app-name Safari
python -m executor.client.main activate-app --app-name Finder
python -m executor.client.main accessibility-snapshot --app-name Safari --max-depth 2
python -m executor.client.main click-element --app-name Safari --element-id window-1/child-1
python -m executor.client.main press-element --app-name Safari --element-id window-1/child-1
python -m executor.client.main perform-element-action --app-name Safari --element-id window-1/child-1 --action-name AXShowMenu
python -m executor.client.main type-into-element --app-name Safari --element-id window-1/child-1 --text "hello"
python -m executor.client.main set-value --app-name Safari --element-id window-1/child-1 --text "hello"
python -m executor.client.main focus-element --app-name Safari --element-id window-1/child-1
python -m executor.client.main preview-element --app-name Safari --element-id window-1/child-1
```

API examples:

```bash
curl http://127.0.0.1:8000/api/v1/apps?query=Safari
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/activate \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Finder"
  }'
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/accessibility \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Safari",
    "max_depth": 2,
    "max_children": 20
  }'
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/click-element \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Safari",
    "element_id": "window-1/child-1"
  }'
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/press-element \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Safari",
    "element_id": "window-1/child-1"
  }'
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/perform-action \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Safari",
    "element_id": "window-1/child-1",
    "action_name": "AXShowMenu"
  }'
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/type-into-element \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Safari",
    "element_id": "window-1/child-1",
    "text": "hello"
  }'
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/set-value \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Safari",
    "element_id": "window-1/child-1",
    "text": "hello"
  }'
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/focus-element \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Safari",
    "element_id": "window-1/child-1"
  }'
```

```bash
curl -X POST http://127.0.0.1:8000/api/v1/apps/preview-element \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Safari",
    "element_id": "window-1/child-1"
  }'
```

## Recommended validation flow

To test real desktop apps from the browser UI:

1. Start the API:

```bash
bash start.sh
```

2. Open `http://127.0.0.1:8000/`
3. Bring the target app to the foreground, or enter its name in `Target App`
4. Capture a snapshot
5. Select an element from the tree
6. Prefer testing in this order:
   - `Preview Element`
   - `Press Element`
   - `Run Action`
   - `Set Value`
   - `Click Element`
   - `Type Into Element`

`Press Element` is usually better than raw clicking for buttons, links, and menu-like controls.

If the selected element shows native actions such as `AXShowMenu`, `AXPress`, or other entries in the new element metadata panel, prefer `Run Action` and select that exact action first.

`Set Value` is usually better than raw typing for text fields and text areas because it tries a native accessibility value assignment before falling back to keyboard typing.

## Example API request

```bash
curl http://127.0.0.1:8000/api/v1/pointer
```

Then preview a target:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/targets/preview \
  -H "Content-Type: application/json" \
  -d '{
    "target": {
      "x": 300,
      "y": 200,
      "display_id": "main"
    },
    "crop_size": 160,
    "include_preview_image": false
  }'
```

Then execute the click:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/actions/execute \
  -H "Content-Type: application/json" \
  -d '{
    "action": {
      "action": "click",
      "target": {
        "x": 300,
        "y": 200,
        "display_id": "main"
      }
    },
    "capture_after": true,
    "debug_output_dir": "/tmp/open-computer-use-debug"
  }'
```

When `debug_output_dir` is set for pointer actions, the executor writes:

- `before.png`
- `after.png`
- `preview.png`
- `metadata.json`
- `report.html`

into that directory so you can inspect the click attempt afterward. `report.html` is the easiest entry point because it lays out the images and verification data in one page.

## Example agent run

```bash
curl -X POST http://127.0.0.1:8000/api/v1/agent/runs \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Demo movement plan",
    "executor_id": "local",
    "actions": [
      {
        "action": "move",
        "target": {
          "x": 200,
          "y": 120,
          "display_id": "main"
        }
      },
      {
        "action": "scroll",
        "direction": "down",
        "amount": 300
      }
    ]
  }'
```

## Current architecture

- `executor/client/desktop/controller.py`
  Performs screenshots and device-level mouse and keyboard operations.
- `executor/client/desktop/action_executor.py`
  Converts structured actions into desktop operations and returns structured results.
- `server/app/services/executor_registry_core.py`
  Routes work to the local executor or a connected remote executor.
- `server/app/services/agent_runner.py`
  Runs sequential action plans and collects trajectory results.
- `shared/schemas/runtime.py`
  Defines the WebSocket transport messages for remote executors.

## Display scaling

The executor uses logical coordinates and maps them to physical coordinates before clicking.

For pointer actions, the executor now verifies two things:

- whether the pointer actually landed near the physical target
- whether a local image region around the target changed after the action

This makes click validation more precise than comparing the entire screenshot buffer.

For difficult coordinates, use `preview-target` first. It lets you inspect:

- logical target
- mapped physical target
- current pointer position
- distance from pointer to target
- the preview marker position inside the cropped area
- a cropped PNG around the target area with a visible crosshair marker

For fast calibration, use `pointer-state` or `/api/v1/pointer` first, then call the preview API with `include_preview_image: false`. That avoids returning a large base64 payload unless you really need the image crop.

For hard-to-debug clicks, set `debug_output_dir` on the execute request. That gives you a compact artifact bundle with before/after/preview images plus verification metadata.

If you prefer a single CLI step, use `click-debug`. It captures a preview before the click, writes a marked preview image, executes the click, and exports the full debug artifact bundle in one go.

You can override scaling manually when needed:

```bash
export CUA_DISPLAY_SCALE_X=2
export CUA_DISPLAY_SCALE_Y=2
```

Optional offsets for multi-monitor setups:

```bash
export CUA_DISPLAY_OFFSET_X=0
export CUA_DISPLAY_OFFSET_Y=0
```

## Linux notes

For Linux desktop control, install the platform helpers that match your environment:

- `python3-pyatspi` or distro-equivalent package for AT-SPI accessibility
- `xdotool` for active-window lookup and activation on X11
- `wmctrl` as an additional window activation fallback
- one clipboard helper: `wl-copy`, `xclip`, or `xsel`

Example packages:

```bash
# Ubuntu / Debian
sudo apt install python3-pyatspi xdotool wmctrl xclip

# Fedora
sudo dnf install python3-pyatspi xdotool wmctrl xclip
```

Notes:

- run the executor inside a real desktop session, not a headless shell
- if you use Wayland, some window-management features may be limited by the compositor
- if accessibility snapshots return errors, verify that AT-SPI is enabled for the session

## macOS note

On macOS you will likely need to grant:

- Accessibility permission
- Screen Recording permission

to the terminal or Python runtime that launches the executor.

If commands appear to succeed but nothing happens, run `python -m executor.client.main doctor` first. It will tell you whether Accessibility, Screen Recording, display geometry, and screenshot capture are actually available.
