---
name: open-computer-use-agent
description: Use when an agent needs to operate the Open Computer Use HTTP MCP toolset reliably for local desktop control, app navigation, visual inspection, element interaction, or filesystem fallback. This skill teaches the agent how to choose between observation tools, accessibility tools, viewport-relative clicks, and direct desktop actions.
---

# Open Computer Use Agent

Use this skill when the active toolset is the Open Computer Use MCP server.

## Goals

- Keep desktop tasks moving instead of narrating intent.
- Choose the narrowest reliable observation before clicking.
- Prefer structured element actions when they are available.
- Fall back to screenshot-based operation quickly when accessibility data is weak.

## Tool Groups

App setup:

- `list_apps`
- `frontmost_app`
- `launch_app`
- `activate_app`

Visual observation:

- `observe`
- `observe_display`
- `observe_region`
- `observe_frontmost_window`
- `preview_target`

Accessibility and element actions:

- `accessibility_snapshot`
- `click_element`
- `press_element`
- `perform_element_action`
- `focus_element`
- `type_into_element`
- `set_value`
- `preview_element`

Direct input:

- `click_at`
- `click_in_viewport`
- `type_text`
- `press_key`
- `hotkey`
- `scroll`
- `click_debug`

Filesystem fallback:

- `find_paths`
- `list_directory`

Diagnostics:

- `doctor`
- `pointer_state`
- `finish`

## Working Rules

- Do not stop after saying what you plan to do. Call tools now.
- Do not emit plain text only while a desktop task is still in progress.
- Use `finish` only for completion, a real blocker, or a short clarification request.
- Do not pre-emptively say that text reading is unstable before trying focused observation.
- If one approach fails, switch strategy instead of repeating the same weak action.

## Preferred Workflows

### 1. Open or switch to an app

1. Use `frontmost_app` if current context matters.
2. Use `activate_app` if the app is running.
3. Use `launch_app` if it is not running.
4. For app-local work, use `observe_frontmost_window` next.

### 2. Read or inspect content inside an app

1. Prefer `observe_frontmost_window`.
2. If the window is still too dense, use `observe_region`.
3. If structure may help, use `accessibility_snapshot`.
4. If the user asked what text says, inspect screenshot output directly before relying on OCR alone.

### 3. Click something precisely

1. Prefer `observe_frontmost_window` or `observe_region` first.
2. If you are acting inside a cropped observation, use `click_in_viewport`.
3. Use `preview_target` before risky `click_at` attempts.
4. Use `click_at` only when absolute screen coordinates are truly the best tool.
5. Use `click_debug` if repeated coordinate actions need investigation artifacts.

### 4. Interact with a known UI element

1. Use `accessibility_snapshot` to find the right `element_id`.
2. Prefer:
   - `press_element` for invoke-like controls
   - `click_element` for direct click
   - `perform_element_action` for named accessibility actions
   - `focus_element` before text entry when needed
   - `type_into_element` for realistic text input
   - `set_value` when direct value assignment is better
3. Use `preview_element` if you need visual confirmation of the target.

### 5. Keyboard and scroll operations

1. First ensure the correct app is focused with `activate_app`.
2. Then use:
   - `type_text`
   - `press_key`
   - `hotkey`
   - `scroll`

### 6. Multi-display tasks

1. Do not guess from a giant all-screen view.
2. Use `observe_display` for the likely display.
3. Then use `observe_region` or `observe_frontmost_window`.
4. Prefer `click_in_viewport` once you have a narrowed screenshot.

### 7. Filesystem fallback

1. If the user asks about local folders or paths, use `find_paths`.
2. Then use `list_directory`.
3. Do not ask for a full path first unless the previous attempts failed.

## Anti-Patterns

- Saying “I will open Finder now” without calling a tool.
- Saying text is unreliable before trying window-level observation.
- Guessing absolute click coordinates from a full-screen image when a narrower observation is available.
- Repeating failed clicks with no new observation.
- Asking the user for obvious path hints before using filesystem tools.

## Recommended Agent Prompt Add-On

If you can inject a system prompt, use the version in:

- `/Users/lilei/project/learn/open-computer-use/prompts/computer_use_agent_system_prompt.md`

That prompt is aligned with the current real tool names in this project.
