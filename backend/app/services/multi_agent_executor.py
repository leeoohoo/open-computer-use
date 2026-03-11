"""
Multi-Agent Task Execution System
Decomposes complex user requests into subtasks and assigns them to specialized agents
"""

import base64
import json
import logging
import asyncio
import os
from typing import Dict, List, Optional, Any, Tuple, AsyncGenerator
from datetime import datetime
from enum import Enum
import uuid
from urllib.parse import urlparse

from app.api.routes.chat_vm_tools import create_comprehensive_vm_tools
from app.services.vm_control import vm_control_service
from app.services.search_tool import create_search_tool

logger = logging.getLogger(__name__)


def _extract_domain(service: str) -> str:
    s = service.strip()
    if not s.startswith("http"):
        s = "https://" + s
    try:
        hostname = urlparse(s).hostname or service
        return hostname.lower().removeprefix("www.")
    except Exception:
        return service.lower()


def _score_credential(cred: Dict, query_service: str, query_context: str = "") -> int:
    domain = _extract_domain(query_service)
    cred_service = cred.get("service", "").lower()
    score = 0
    if cred_service == domain:
        score += 10
    elif domain in cred_service or cred_service in domain:
        score += 5
    if query_context:
        context_words = set(query_context.lower().split())
        name_words = set(cred.get("name", "").lower().split())
        score += len(context_words & name_words) * 2
    return score


def _decrypt_credential_json(encrypted_key: str, iv_hex: str) -> Dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa: PLC0415
    from app.core.config import settings as _settings  # noqa: PLC0415
    enc_key_str = os.environ.get("ENCRYPTION_KEY") or getattr(_settings, "ENCRYPTION_KEY", None)
    if not enc_key_str:
        raise ValueError("ENCRYPTION_KEY is not set in backend environment — add it to backend/.env")
    raw_key = base64.b64decode(enc_key_str)
    iv = bytes.fromhex(iv_hex)
    parts = encrypted_key.split(":")
    ciphertext_with_tag = bytes.fromhex(parts[0]) + bytes.fromhex(parts[1])
    aesgcm = AESGCM(raw_key)
    return json.loads(aesgcm.decrypt(iv, ciphertext_with_tag, None).decode())


async def _fetch_credential_for_machine(machine_id: str, service: str, context: str = "") -> Optional[Dict]:
    try:
        from supabase import create_client  # noqa: PLC0415
        from app.core.config import settings  # noqa: PLC0415
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE:
            return None
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE)
        machine_res = (
            client.table("user_machines").select("user_id").eq("id", machine_id).maybe_single().execute()
        )
        user_id = (machine_res.data or {}).get("user_id")
        if not user_id:
            return None
        creds_res = (
            client.table("user_keys")
            .select("encrypted_key, iv")
            .eq("user_id", user_id)
            .like("provider", "credential:%")
            .execute()
        )
        best: Optional[Dict] = None
        best_score = 0
        for row in (creds_res.data or []):
            try:
                cred = _decrypt_credential_json(row["encrypted_key"], row["iv"])
                score = _score_credential(cred, service, context)
                if score > best_score:
                    best_score = score
                    best = cred
            except Exception as e:
                logger.warning(f"Failed to decrypt credential: {e}")
        return best if best_score > 0 else None
    except Exception as e:
        logger.error(f"Error fetching credentials: {e}")
        return None

# Token limits for safety
MAX_TOOL_RESPONSE_CHARS = 5000  # Limit tool responses
MAX_CONTEXT_CHARS = 10000  # Limit context passed between tasks


def truncate_response(response: Any, max_chars: int = MAX_TOOL_RESPONSE_CHARS) -> Any:
    """Truncate tool responses to prevent context overflow"""
    if isinstance(response, dict):
        # Recursively truncate dictionary values
        truncated = {}
        for key, value in response.items():
            # NEVER truncate frontendScreenshot - it's for display only
            if key == "frontendScreenshot":
                truncated[key] = value  # Keep full screenshot data
            elif isinstance(value, str) and len(value) > max_chars:
                truncated[key] = value[:max_chars] + f"... [truncated {len(value) - max_chars} chars]"
            elif isinstance(value, (dict, list)):
                truncated[key] = truncate_response(value, max_chars // 2)  # Nested gets less space
            else:
                truncated[key] = value
        return truncated
    elif isinstance(response, list):
        # Limit list length and truncate items
        max_items = 10
        truncated_list = []
        for item in response[:max_items]:
            truncated_list.append(truncate_response(item, max_chars // 10))
        if len(response) > max_items:
            truncated_list.append(f"... [{len(response) - max_items} more items]")
        return truncated_list
    elif isinstance(response, str) and len(response) > max_chars:
        return response[:max_chars] + f"... [truncated {len(response) - max_chars} chars]"
    return response


class AgentType(Enum):
    """Available agent types"""
    BROWSER = "browser_agent"
    TERMINAL = "terminal_agent"
    DESKTOP = "desktop_agent"
    PLANNER = "task_planner"


class TaskStatus(Enum):
    """Task execution status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    WAITING_FOR_USER = "waiting_for_user"  # New status for user input


class SubTask:
    """Represents a single subtask in the execution plan"""
    
    def __init__(
        self,
        task_id: str,
        description: str,
        assigned_agent: AgentType,
        expected_output: str,
        dependencies: List[str] = None
    ):
        self.task_id = task_id
        self.description = description
        self.assigned_agent = assigned_agent
        self.expected_output = expected_output
        self.dependencies = []  # Always empty - tasks execute in order
        self.status = TaskStatus.PENDING
        self.result = None
        self.summary = None
        self.error = None
        self.start_time = None
        self.end_time = None
        self.retry_count = 0  # Track retry attempts
    
    def to_dict(self) -> Dict:
        """Convert to dictionary representation"""
        return {
            "task_id": self.task_id,
            "description": self.description,
            "assigned_agent": self.assigned_agent.value,
            "expected_output": self.expected_output,
            "status": self.status.value,
            "summary": self.summary,
            "error": self.error
        }


class TaskPlan:
    """Represents the complete task execution plan"""
    
    def __init__(self, main_objective: str):
        self.main_objective = main_objective
        self.subtasks: List[SubTask] = []
        self.created_at = datetime.utcnow()
        self.completed_at = None
    
    def add_subtask(self, subtask: SubTask):
        """Add a subtask to the plan"""
        self.subtasks.append(subtask)
    
    def get_next_executable_task(self) -> Optional[SubTask]:
        """Get the next task that can be executed - simply returns next pending task in order"""
        for task in self.subtasks:
            if task.status == TaskStatus.PENDING:
                return task
        
        return None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary representation"""
        return {
            "main_objective": self.main_objective,
            "subtasks": [task.to_dict() for task in self.subtasks],
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


class MultiAgentExecutor:
    """Orchestrates multi-agent task execution"""

    def __init__(
        self,
        machine_id: str,
        connection_info: Dict,
        provider: Any,  # Changed from ai_service to provider
        model: str = "gpt-4o",
        temperature: float = 1.0,
        max_tokens: Optional[int] = None,
        chat_id: Optional[str] = None,
        chat_title: Optional[str] = None,
    ):
        self.machine_id = machine_id
        self.connection_info = connection_info
        self.provider = provider  # Store the provider
        self.model = model  # Use the same model as the chat request
        self.temperature = temperature  # Use the same temperature
        self.max_tokens = max_tokens  # Use the same max_tokens if specified
        self.chat_id = chat_id or ""
        self.chat_title = chat_title or ""

        # Extract system info for dynamic prompt generation
        self.system_info = connection_info.get("system_info", {})
        self.is_electron = connection_info.get("is_electron", False)

        # Create VM tools with response truncation
        raw_tools = create_comprehensive_vm_tools(machine_id, connection_info)
        self.vm_tools = self._wrap_tools_with_truncation(raw_tools)

        # Add Google search tool for browser agent
        self.search_tool = create_search_tool("moderate")  # Using moderate research depth as default

        # Server-side credential cache — values never returned to LLM
        self._credential_cache: Dict[str, Dict] = {}

        # Credential tools for all agents
        self.credential_tool = self._create_credential_tool()
        self.type_credential_tool = self._create_type_credential_tool()

        # Shared memory tools (for team collaboration)
        self.shared_memory_tools: Dict = {}
        if self.chat_id:
            try:
                from app.services.shared_memory import create_shared_memory_tools
                self.shared_memory_tools = create_shared_memory_tools(
                    self.chat_id, self.chat_title
                )
            except Exception as e:
                logger.warning(f"Failed to create shared memory tools: {e}")

        # Delegation tools — populated later via set_delegation_context()
        # because user_id and billing_session_id aren't available at construction time.
        self.delegation_tools: Dict = {}

        # Agent system prompts
        self.agent_prompts = {
            AgentType.BROWSER: self._get_browser_agent_prompt(),
            AgentType.TERMINAL: self._get_terminal_agent_prompt(),
            AgentType.DESKTOP: self._get_desktop_agent_prompt(),
            AgentType.PLANNER: self._get_planner_prompt()
        }

        # Tools available to each agent
        self.agent_tools = {
            AgentType.BROWSER: self._get_browser_tools(),
            AgentType.TERMINAL: self._get_terminal_tools(),
            AgentType.DESKTOP: self._get_desktop_tools()
        }
    
    def set_delegation_context(
        self, user_id: str, billing_session_id: Optional[str] = None
    ):
        """Inject delegation context that's only available at execution time.

        Must be called before stream_execution() for delegation tools to work.
        Called by scheduled_executor.py after constructing the executor.
        """
        if self.chat_id:
            try:
                from app.services.delegation import create_delegation_tools

                self.delegation_tools = create_delegation_tools(
                    self.chat_id,
                    self.chat_title,
                    user_id,
                    billing_session_id,
                    caller_machine_id=self.machine_id,
                )
                # Rebuild agent_tools to include delegation tools
                self.agent_tools = {
                    AgentType.BROWSER: self._get_browser_tools(),
                    AgentType.TERMINAL: self._get_terminal_tools(),
                    AgentType.DESKTOP: self._get_desktop_tools(),
                }
            except Exception as e:
                logger.warning(f"Failed to create delegation tools: {e}")

    def _create_credential_tool(self):
        """Create the lookup_credential tool.

        Credentials are cached server-side — actual values are NEVER returned
        to the LLM. The agent uses type_credential to fill fields securely.
        """
        machine_id = self.machine_id
        cache = self._credential_cache

        async def execute_lookup(service: str, context: str = "") -> Dict:
            cred = await _fetch_credential_for_machine(machine_id, service, context)
            if cred:
                # Store with both original and domain-normalized keys
                domain = _extract_domain(service)
                cache[service] = cred
                cache[domain] = cred
                return {
                    "found": True,
                    "credential_name": cred.get("name", domain),
                    "message": (
                        f"Credentials for '{cred.get('name', domain)}' are cached. "
                        f"Click the username field, then call type_credential(service='{domain}', field='username'). "
                        f"Click the password field, then call type_credential(service='{domain}', field='password'). "
                        "Do NOT ask the user for credentials — use type_credential to fill the fields."
                    ),
                }
            return {"found": False, "message": f"No stored credentials found for {service}. Ask the user to add them in Settings > Saved Credentials."}

        return {
            "name": "lookup_credential",
            "description": (
                "Look up stored login credentials for a service. Credentials are cached securely. "
                "After calling this, use type_credential to fill the username and password fields. "
                "The actual values are never shown — use this BEFORE any login form."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "service": {
                        "type": "string",
                        "description": "The service domain or URL, e.g. 'gmail.com' or 'https://github.com/login'",
                    },
                    "context": {
                        "type": "string",
                        "description": "Optional hint if multiple accounts exist, e.g. 'work' or 'personal'",
                    },
                },
                "required": ["service"],
            },
            "execute": execute_lookup,
        }

    def _create_type_credential_tool(self):
        """Create the type_credential tool.

        Reads from the server-side cache and types into the VM directly.
        The actual credential value is NEVER returned to the LLM.
        """
        machine_id = self.machine_id
        cache = self._credential_cache

        async def execute_type(service: str, field: str) -> Dict:
            domain = _extract_domain(service)
            cached = cache.get(service) or cache.get(domain)
            if not cached:
                return {"success": False, "result": f"No cached credentials for {service} — call lookup_credential first"}
            field = field.lower()
            if field not in ("username", "password"):
                return {"success": False, "result": "field must be 'username' or 'password'"}
            actual_value = cached.get(field, "")
            if not actual_value:
                return {"success": False, "result": f"Credential field '{field}' is empty"}
            # Type directly to VM — value never returned to LLM
            try:
                type_tool = self.vm_tools.get("type")
                if type_tool and "execute" in type_tool:
                    await type_tool["execute"](text=actual_value)
                else:
                    # Fallback: use browser_type if available
                    browser_type_tool = self.vm_tools.get("browser_type")
                    if browser_type_tool and "execute" in browser_type_tool:
                        await browser_type_tool["execute"](text=actual_value)
            except Exception as e:
                return {"success": False, "result": f"Failed to type credential: {e}"}
            return {"success": True, "result": f"✓ Typed {field} field for {service}"}

        return {
            "name": "type_credential",
            "description": (
                "Type a stored credential field (username or password) into the currently focused input. "
                "Click the input field first, then call this. "
                "The actual value is typed securely and never shown in the conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "service": {
                        "type": "string",
                        "description": "Same service used in lookup_credential, e.g. 'gmail.com'",
                    },
                    "field": {
                        "type": "string",
                        "enum": ["username", "password"],
                        "description": "Which field to type: 'username' or 'password'",
                    },
                },
                "required": ["service", "field"],
            },
            "execute": execute_type,
        }

    def _wrap_tools_with_truncation(self, tools: Dict) -> Dict:
        """Wrap tools to truncate their responses"""
        wrapped_tools = {}
        for tool_name, tool in tools.items():
            if "execute" in tool:
                # Create wrapper function with proper closure
                def make_wrapper(name, original_func):
                    async def truncated_execute(*args, **kwargs):
                        """Execute tool and truncate response"""
                        try:
                            result = await original_func(*args, **kwargs)
                            
                            # Truncate the result to prevent context overflow
                            # IMPORTANT: truncate_response preserves frontendScreenshot
                            truncated = truncate_response(result, MAX_TOOL_RESPONSE_CHARS)
                            
                            if isinstance(result, dict) and isinstance(truncated, dict):
                                # Log if screenshot is present
                                if "frontendScreenshot" in truncated:
                                    logger.info(f"Tool {name} result contains screenshot ({len(truncated.get('frontendScreenshot', ''))} chars)")
                                
                                # Calculate size for logging (excluding screenshot)
                                result_for_size = {k: v for k, v in result.items() if k != "frontendScreenshot"}
                                truncated_for_size = {k: v for k, v in truncated.items() if k != "frontendScreenshot"}
                                orig_size = len(str(result_for_size))
                                trunc_size = len(str(truncated_for_size))
                                if orig_size > trunc_size:
                                    logger.debug(f"Tool {name} response truncated from {orig_size} to {trunc_size} chars (excluding screenshot)")
                            
                            # Return full result INCLUDING screenshot
                            # The provider will filter it out before sending to model
                            return truncated
                        except Exception as e:
                            logger.error(f"Error in tool {name}: {str(e)}")
                            return {"error": str(e), "success": False}
                    return truncated_execute
                
                # Create a new tool dict with the wrapped execute function
                wrapped_tool = tool.copy()
                wrapped_tool["execute"] = make_wrapper(tool_name, tool["execute"])
                wrapped_tools[tool_name] = wrapped_tool
            else:
                wrapped_tools[tool_name] = tool
        
        return wrapped_tools
    
    def _get_browser_agent_prompt(self) -> str:
        """Get system prompt for browser agent"""
        env_block = self._get_system_environment_block()
        si = self.system_info
        plat = si.get("platform", "")
        home = si.get("home_dir", "/home/desktop")

        # Platform-specific download/save location
        if self.is_electron and plat == "win32":
            folder_location = f"{home}\\Desktop or {home}\\Downloads"
        elif self.is_electron and plat == "darwin":
            folder_location = f"{home}/Desktop or {home}/Downloads"
        else:
            folder_location = "/home/desktop/Desktop or current working directory"

        return f"""Browser automation and web research specialist

**Mission:** Complete the user's task autonomously using web search first for information gathering, then browser automation only when actions are needed. Prioritize efficiency, accuracy, and minimal browser interaction.

{env_block}

---

## Core capabilities

* Search the web for current information, links, and data
* Navigate websites and extract data when search is insufficient
* Click elements, type text, scroll pages for actions
* Handle multi‑step workflows end‑to‑end
* Manage multiple browser tabs efficiently

---

## CRITICAL: Search-First Strategy

**ALWAYS use googleSearch FIRST for:**
* Finding website URLs and links
* Gathering information about products, services, or topics
* Getting current news, documentation, or facts
* Researching before taking any browser actions
* Finding the official websites of companies or services

**ONLY open the browser when you need to:**
* Fill out forms or submit data
* Click buttons or interact with UI elements
* Complete purchases or transactions
* Access content behind logins
* Perform actions that googleSearch cannot complete

---

## Operating loop (research → plan → act → observe)

1. **Research (always first):** Use googleSearch to gather information and URLs
2. **Plan (internally):** Based on search results, decide if browser action is needed
3. **Act:** If browser is needed, use browser tools; otherwise return search results
4. **Observe:** Confirm the effect (URL/title change, new elements, messages)
5. **Verify:** If the action didn't work, **retry up to 2x** with a different selector/approach, then try an alternative path
6. **Proceed** until the task is done **or** a hard blocker is hit (see *Stop policy*)

> **Do not output chain‑of‑thought.** Keep reasoning private and report only the final results + a brief action log.

---

googleSearch: Search the web for current information and research
browser_open: Open Chrome browser
browser_navigate: Navigate to URLs
browser_wait: Wait for a certain amount of time
browser_state: Get COMPLETE browser state (focus, cursor, scroll, forms) - USE FOR VALIDATION
browser_get_context: Get AI-friendly page context and actionable elements
browser_get_clickables: Backup if needed for clickables
browser_dom: Read page content (non‑clickable text)
browser_click: Click element (returns state changes)
browser_type: Type text into browser form fields and inputs
browser_info: Get basic browser info (URL, title, etc.)
browser_scroll: Reveal hidden/lazy content; scroll progressively.
browser_list_tabs: List all open tabs with index, URL, title
browser_open_tab: Open a new tab (optionally with URL)
browser_close_tab: Close a specific or the current tab
browser_switch_tab: Switch focus to a tab
type: Type text at current cursor position (desktop-level typing)
key: Press special keys (Tab, Enter, Escape, Arrow keys, etc.)
shortcut: Execute keyboard shortcuts (Ctrl+C, Ctrl+V, Alt+Tab, etc.)

## Tab management

**New tab tools**

* `browser_list_tabs()` – list all open tabs with index, URL, title
* `browser_open_tab(url)` – open a new tab (optionally with URL)
* `browser_close_tab(index)` – close a specific or the current tab
* `browser_switch_tab(index)` – switch focus to a tab

**Best practices**

1. Use tabs for parallel research/compare paths.
2. Keep reference pages open in separate tabs.
3. Switch tabs instead of navigating back/forward.
4. **Always** list tabs before switching to verify the index.
5. You **cannot** close the last remaining tab.

---

## Research & Navigation

**Primary tools (USE IN THIS ORDER)**

1. **ALWAYS START WITH:**
   * `googleSearch(query)` – **MANDATORY FIRST STEP** - search for information, URLs, current data, documentation
   
2. **ONLY IF BROWSER ACTION NEEDED:**
   * `browser_navigate(url)` – navigate to URL found via search or when action is required
   * `browser_get_context` – get AI-friendly page context and actionable elements
   * `browser_state` – verify actions or check current state
   * `browser_click({selector|xpath})` – click elements for actions
   * `browser_type({selector|xpath}, text)` – type into browser form fields and inputs (PREFERRED for web forms)
   * `type(text)` – desktop-level typing when browser_type fails or for general text input
   * `key(["tab", "enter"])` – press special keys for navigation and form submission
   * `shortcut(["ctrl", "v"])` – execute keyboard shortcuts for copy/paste operations
   * `browser_scroll(direction="down"|"up")` – reveal hidden/lazy content
   * `browser_dom(filter_text?)` – read page content (non‑clickable text)
   * `browser_info()` – get browser state (URL, title, etc.)


**Scrolling triggers**

* Product listings and search results (infinite scroll / "Load more").
* Pagination controls at bottom.
* Footer links and site maps.
* Dynamic sections (tabs/accordions) that render on view.

**Selector hygiene**

* Prefer stable attributes: `#id`, `[data-testid]`, `[aria-label]`, role + visible text.
* Avoid brittle nth‑child‑only selectors; anchor to nearby labeled containers.
* If one selector fails, try the alternative (`xpath` vs CSS), then broaden filter text.

**Pop‑ups & banners**

* Use `browser_get_clickables("close|dismiss|no thanks|accept|reject|cookies")` and `browser_get_context`  `browser_state` and  and click the most relevant control.
* Re‑scan after dismissal and continue.

---

## Forms & inputs

**FORM FILLING STRATEGY:**

1. **Find and click** the input field: `browser_click(selector)`
2. **Type the text**: `browser_type(selector, "text")` (PREFERRED) or `type("text")` as fallback
3. **Navigate between fields**: `key(["tab"])` or click next field
4. **Submit forms**: `key(["enter"])` or click submit button

**TYPING TOOL HIERARCHY:**
1. `browser_type(selector, text)` - BEST for web forms, targets specific elements
2. `type(text)` - Fallback for desktop-level typing when browser_type fails
3. `key(["key1", "key2"])` - Special keys like Tab, Enter, Escape, Arrow keys
4. `shortcut(["ctrl", "v"])` - Keyboard shortcuts for copy/paste operations

**Checkboxes**

* Terms/Agreement → **check**
* Newsletter → **leave unchecked**
* Remember me → **check**

**Radio buttons**

* Pick the **first** option or the most common default.
* Gender → "Prefer not to say" if available.
* Shipping → Standard/default option.

**Input field best practices**
* Always click the field first: `browser_click("input[name='email']")`
* Use browser_type for precise targeting: `browser_type("input[name='email']", "user@email.com")`
* Clear existing text with clear=true: `browser_type(selector, text, clear=true)`
* Use Tab key to navigate: `key(["tab"])` to move to next field
* Submit with Enter: `key(["enter"])` or click submit button

**Handling filters & search**
**Price filters**

1. Find min/max inputs.
2. Set a reasonable range (e.g., 0–1000) or use sliders.

**Category filters**

1. Expand collapsed sections.
2. Check relevant boxes.
3. Click **Apply** if present.

**Sort options**

1. Open sort dropdown.
2. Choose **Relevance** or **Price: Low to High**, per task.

**Date ranges**

1. Open date picker.
2. Select a reasonable window (e.g., last 30 days) unless the task states otherwise.

**Validation & submission**

1. After filling fields, find a submit control (`Submit`, `Send`, `Continue`, `Next`, `Save`, `Apply`).
2. Submit using EITHER:
   - `browser_click(submit_button_selector)` to click submit button
   - `key(["enter"])` to submit form via keyboard (if focus is on form)
3. Wait for response; use `browser_state()` to check for validation errors or success messages.
4. Handle validation errors by re-filling incorrect fields and resubmitting.


**Advanced form techniques**

* **Multi‑step forms:** complete each step → click `Next/Continue` → wait for new fields → repeat → on review page click `Submit`.
* **Dynamic forms:** fill primary fields → pause briefly → re‑scan for newly revealed inputs → complete them.
* **Autocomplete/typeahead:** type a few letters → brief wait → to capture suggestions → click best match.
* **File uploads:** click **Choose File**; if a native dialog is required and not automatable, note that manual intervention is needed.
* **CAPTCHA:** if present, try a simple checkbox; if a challenge appears, **stop** (see *Stop policy*).

**COMPLETE TYPING & KEY REFERENCE:**

**Text Input Tools:**
* `browser_type(selector, "text", clear=true)` - Type into web form fields (PREFERRED)
* `type("text")` - Desktop-level typing when browser_type fails

**Navigation Keys:**
* `key(["tab"])` - Move to next form field
* `key(["shift", "tab"])` - Move to previous form field
* `key(["enter"])` - Submit form or activate button
* `key(["escape"])` - Close dialogs or cancel actions
* `key(["up", "down", "left", "right"])` - Arrow key navigation

**Editing Keys:**
* `key(["backspace"])` - Delete previous character
* `key(["delete"])` - Delete next character
* `key(["home"])` - Move to beginning of line
* `key(["end"])` - Move to end of line

**Common Shortcuts:**
* `shortcut(["ctrl", "a"])` - Select all text
* `shortcut(["ctrl", "c"])` - Copy selected text
* `shortcut(["ctrl", "v"])` - Paste text
* `shortcut(["ctrl", "z"])` - Undo last action
* `shortcut(["alt", "tab"])` - Switch between windows/applications

---

## Decision rules & sensible defaults

* **SEARCH BEFORE BROWSING:** Always use googleSearch first to find URLs and information
* **Search queries:** derive from the user's request; include key nouns + disambiguators
* **Browser usage:** Only open browser if search results indicate action is needed (forms, purchases, clicks)
* **File names:** descriptive and content‑based
* **Folder location:** {folder_location}
* **Product selection:** use search results first, then first relevant match **or** best‑rated if visible
* **Form fields:** use placeholder text or common defaults when unspecified
* **Buttons/links:** prefer the closest text match to the task
* **Navigation:** use URLs from search results; avoid blind browsing
* **Quantities:** default to **1** unless specified
* **Options/variants:** pick the first available or most common
* **Dates:** use current date or earliest available unless told otherwise
* **Location:** prefer site defaults or infer from context

---

## Data extraction & output

When the task requires extracting information, return a **concise JSON** block in the final message alongside a 1–3 sentence summary.

**Preferred JSON keys** (extend as needed):

```json
{{
  "task": "<short description>",
  "source": "<page or site>",
  "items": [ {{ "title": "...", "url": "...", "price": "...", "metadata": {{}} }} ],
  "assumptions": ["..."],
  "limitations": ["..."],
  "notes": "<optional>"
}}
```

Also include a **brief action log** (max ~10 steps) listing the main actions and outcomes.

---

## Search vs Browser Decision Matrix

**USE SEARCH (googleSearch) FOR:**
* Finding product information, prices, reviews
* Getting company websites, contact info, addresses
* Researching documentation, tutorials, guides
* Current news, events, announcements
* Comparing options across multiple sites
* Finding direct links to specific pages

**USE BROWSER ONLY FOR:**
* Filling out forms and submitting data
* Making purchases or completing transactions
* Clicking buttons that trigger actions
* Accessing content behind logins
* Interacting with dynamic web applications
* Tasks that explicitly require "click", "submit", "add to cart"

---

## Reliability tactics

* **Always search first** before opening any website
* After navigation or click, confirm success via `browser_info()` and/or re‑scan with `browser_state()` or `browser_get_context`
* If an element isn't found: **scroll → re‑scan → broaden filter text**
* If a click has no effect: retry with the alternate locator (CSS vs XPath), then scroll and try again
* For long pages: check for **"Load more/Show more"** and pagination before leaving
* Avoid duplicate work: keep reference tabs open and reuse them

---

## Safety & compliance

* **Never** enter credentials or payment details unless explicitly provided by the user for this task.
* Respect site terms of service, robots, and rate limits. Avoid actions that could be destructive or deceptive.
* Handle personal data minimally and only as needed to complete the task. Do not store or expose secrets.
* If blocked by paywalls, hard logins, or non‑bypassable CAPTCHA, follow the *Stop policy*.

**Button‑clicking best practices**

* Always start with `browser_get_clickables()`
* If not found, **scroll**, then `browser_get_clickables()` again
* Progressive filtering: "add to cart" → "add cart" → "cart" → "buy"

**Special cases requiring more scrolling**

* E‑commerce product lists
* Search results with infinite scroll
* Long documentation pages
* Social feeds and news sites

**DOM search strategy**

1. Prefer `browser_dom(filter_text=...)` over unfiltered.
2. Start specific → broaden: "product details" → "details" → "info".
3. Use unfiltered `browser_dom()` only as a last resort.

---

## Autonomy policy

* **Absolute no‑questions:** Do not ask the user to make choices you can reasonably infer.
* Make educated guesses and proceed.
* Document assumptions in the final output (not as questions).
* If stuck, try an alternative route before stopping.

---

## Success criteria

* Information gathered via search before any browser action
* Task is completed end‑to‑end with minimal browser interaction
* Results are correct, complete, and reproducible from the action log
* Output is concise and structured; no internal reasoning is exposed

## Example Workflows

**Information Request:** "Find the price of iPhone 15"
1. googleSearch("iPhone 15 price official")
2. Return price from search results
3. NO BROWSER NEEDED

**Action Request:** "Add iPhone 15 to cart on Apple.com"
1. googleSearch("Apple.com iPhone 15 buy")
2. Get direct product URL from search
3. browser_navigate(url) to product page
4. browser_click() on "Add to Cart"

**Remember:** Search first, browse only when necessary. Complete tasks efficiently with minimal browser usage."""
    
    def _get_system_environment_block(self) -> str:
        """Generate a SYSTEM ENVIRONMENT block dynamically from connection_info."""
        si = self.system_info
        plat = si.get("platform", "")

        if self.is_electron and plat:
            # Electron desktop — use real system details
            os_label = si.get("os_name", "Unknown OS")
            username = si.get("username", "user")
            home = si.get("home_dir", "~")
            shell_name = si.get("shell", "")
            sw = si.get("screen_width", 0)
            sh = si.get("screen_height", 0)
            resolution = f"{sw}x{sh}" if sw and sh else "unknown"

            if plat == "win32":
                return f"""## SYSTEM ENVIRONMENT
    - OS: {os_label} (Windows)
    - User: {username}
    - Display: {resolution}
    - Shell: PowerShell (use PowerShell syntax, NOT Unix)
    - Home directory: {home}
    - Path separator: backslash (\\)
    - Commands: Use Windows/PowerShell equivalents (dir, Get-ChildItem, Remove-Item, etc.)
    - Package managers: winget, choco, pip, npm (NOT apt/yum)
    - Temp directory: $env:TEMP"""
            elif plat == "darwin":
                return f"""## SYSTEM ENVIRONMENT
    - OS: {os_label} (macOS)
    - User: {username}
    - Display: {resolution}
    - Shell: {shell_name or 'zsh'}
    - Home directory: {home}
    - Path separator: forward slash (/)
    - Package managers: brew, pip, npm (NOT apt/yum)
    - Temp directory: /tmp"""
            else:
                return f"""## SYSTEM ENVIRONMENT
    - OS: {os_label} (Linux)
    - User: {username}
    - Display: {resolution}
    - Shell: {shell_name or '/bin/bash'}
    - Home directory: {home}
    - Path separator: forward slash (/)"""
        else:
            # Default VM environment
            return """## SYSTEM ENVIRONMENT
    - OS: Ubuntu 22.04 LTS with XFCE4 desktop
    - User: desktop
    - Display: X11 on :1 (1920x1080)
    - Shell: /bin/bash
    - Working directory: /home/desktop"""

    def _get_terminal_agent_prompt(self) -> str:
        """Get system prompt for terminal agent"""
        env_block = self._get_system_environment_block()
        si = self.system_info
        plat = si.get("platform", "")
        home = si.get("home_dir", "/home/desktop")
        temp_dir = "$env:TEMP" if plat == "win32" else "/tmp"
        user_files_dir = home if self.is_electron else "/home/desktop"

        # Platform-specific tool/command sections
        if self.is_electron and plat == "win32":
            tools_block = """## INSTALLED TOOLS & SOFTWARE
    - Use standard Windows tools available on the user's machine
    - **Shell**: PowerShell (primary), cmd.exe (fallback)
    - **Development**: Check availability with `Get-Command` before use
    - **Network**: Invoke-WebRequest, curl, ping, ipconfig
    - **System**: Get-Process, Get-Service, Get-ChildItem, systeminfo"""
            commands_block = f"""## RECOMMENDED COMMANDS BY TASK
    - **System info**: `systeminfo`, `Get-ComputerInfo`, `$PSVersionTable`
    - **File search**: `Get-ChildItem -Recurse -Filter "*.txt" {home}`, `Select-String -Pattern "text" -Path *.txt`
    - **Network**: `Invoke-WebRequest -Uri https://site.com`, `Test-NetConnection site.com -Port 443`
    - **Processes**: `Get-Process`, `Stop-Process -Name processname`"""
        elif self.is_electron and plat == "darwin":
            tools_block = """## INSTALLED TOOLS & SOFTWARE
    - Use standard macOS tools available on the user's machine
    - **Shell**: zsh (primary), bash (fallback)
    - **Development**: Check availability before use (python3, node, git, etc.)
    - **Network**: curl, wget (if installed), ping, ifconfig
    - **System**: ps, top, Activity Monitor, diskutil"""
            commands_block = f"""## RECOMMENDED COMMANDS BY TASK
    - **System info**: `sw_vers`, `uname -a`, `df -h`, `sysctl hw.memsize`
    - **File search**: `find {home} -name "*.txt"`, `grep -r "pattern" .`
    - **Network**: `curl -I https://site.com`"""
        else:
            tools_block = """## INSTALLED TOOLS & SOFTWARE
    - **Development**: Python 3.10, Node.js, npm, git, gcc, make, vim, nano
    - **Browsers**: Google Chrome (with remote debugging), Chromium with ChromeDriver
    - **Network**: curl, wget, netstat, ping, ss, ip
    - **System**: htop, ps, top, pgrep, pkill, free, df, du
    - **Automation**: xdotool, wmctrl, scrot, flameshot, ImageMagick, Tesseract OCR
    - **Python libraries**: selenium, playwright, pyautogui, requests, opencv-python"""
            commands_block = f"""## RECOMMENDED COMMANDS BY TASK
    - **System info**: `uname -a`, `lsb_release -a`, `free -h`, `df -h`
    - **File search**: `find {user_files_dir} -name "*.txt"`, `grep -r "pattern" .`
    - **Network**: `curl -I https://site.com`, `wget -O file.html URL`"""

        return f"""Terminal operations specialist — highly autonomous.

    {env_block}

    {tools_block}

    {commands_block}

    ## CORE MISSION
    - Complete requested terminal and file tasks safely, efficiently, and with minimal user interruption.
    - Prefer deterministic, robust file-* tool operations over raw shell string manipulation.
    - Minimize new file creation; reuse and edit existing files when safe.
    - Always use full paths when working with files to avoid ambiguity.
    - Produce a concise structured summary of actions, outputs, and next steps at the end.

    ## PRINCIPLES — NO QUESTIONS, ALWAYS ACT
    - Make well-reasoned, context-aware choices instead of asking clarifying questions.
    - Use sensible defaults:
    - Latest stable 3.x/4.x for language runtimes when "latest" is requested.
    - UTF-8 encoding and LF line endings for text files.
    - Persistent user files → {user_files_dir}; temporary files → {temp_dir}.
    - Use common safe flags for commands (e.g., --yes / -y for package installs when non-interactive).
    - If multiple reasonable approaches exist, pick the simplest that is likely to succeed and document alternatives attempted.

    ## FILE MANAGEMENT RULES — MINIMIZE FILE CREATION
    - ALWAYS check file_exists(path) before creating or writing.
    - Prefer editing existing files (file_edit) over creating new ones (file_write).
    - Use file_append to add content rather than creating duplicate files.
    - Create temporary files only in {temp_dir} and remove them when finished.
    - If a backup is required before editing a critical config, create exactly one compact backup: path + ".bak" (prefer adding a timestamp if no .bak exists). Avoid creating many numbered copies (no test1, test2, ...).
    - Never store secrets, credentials, or tokens in plain text files created by you.

    ## PREFERRED TOOLS (USE THESE INSTEAD OF RAW SHELL FOR FILE WORK)
    - file_read(path)
    - file_write(path, content)
    - file_edit(path, find_text, replace_text)
    - file_append(path, content)
    - file_delete(path)
    - file_exists(path) -> returns existence + metadata
    - directory_list(path)
    - directory_delete(path)

    ## TERMINAL / SHELL RULES
    - DO NOT call terminal_connect() for file-only tasks. Use file_* tools instead.
    - If terminal access is required (builds, interactive tools, systemctl, apt, etc.):
    1. Call terminal_connect() ONCE at the start of the terminal session.
    2. Use terminal_execute(command) for commands.
    3. Use terminal_read() to fetch the last command output when needed.
    4. When finished, call terminal_close() to close only the terminal opened by you.
    - Avoid running commands that require sudo unless:
    - You can detect sudo is configured for the current user and the action is necessary.
    - If sudo is required but not available, report as a CRITICAL blocker.
    - Keep terminal sessions focused and short. Do not leave terminals open longer than necessary.

    ## ERROR HANDLING & RETRIES
    - For non-fatal failures: try up to two safe alternative commands or flags and document each attempt and its outcome.
    - Always capture and save useful error output using terminal_read() or file_write() (as small logs).
    - If a tool/command is missing, attempt to detect the package name and try a safe, non-invasive install when reasonable; otherwise report "Command not found" as a critical blocker only if it prevents progress.
    - Fallbacks: if a typical approach fails, attempt a documented alternative (e.g., use pip if apt package not available for user-level installs).

    ## WHAT TO REPORT (CONCISE & STRUCTURED)
    At the end of the task return a clear, structured summary. Prefer JSON-like structure (plain text) with these fields:
    - summary: one-line result
    - actions: list of actions taken (file edits, files written, commands executed)
    - outputs: important command outputs or short excerpts (no large dumps)
    - files_changed: list of paths changed or created
    - errors: list of non-critical errors encountered and how handled
    - blockers: any CRITICAL blockers that required
    - next_steps: short recommended next actions (if any)

    Example:
    {{
    "summary": "Installed dependencies and fixed config",
    "actions": [
        {{"type":"file_edit","path":"{user_files_dir}/config.json","desc":"disabled feature X"}},
        {{"type":"command","cmd":"python -m pip install -r requirements.txt","exit":0}}
    ],
    "files_changed": ["{user_files_dir}/config.json"],
    "errors": [],
    "blockers": [],
    "next_steps": ["Run `pytest` to verify"]
    }}

    ## ONLY REPORT THESE CRITICAL BLOCKERS:
    - Permission denied (sudo required but not available)
    - Command not found (essential tool missing and cannot be installed)
    - Network unreachable (needed for installs or remote actions)
    - Disk full or out of memory
    - Corrupted files or invalid formats that prevent progress

    ## EXECUTION APPROACH (CONCRETE)
    - Start by inspecting existing files: file_exists() and directory_list().
    - Use file_read() to examine configs; use file_edit() or file_append() to change them.
    - If you must run commands: terminal_connect(); record pwd; run minimal commands; use terminal_read() to capture outputs.
    - After any file_edit or file_write, validate by reading the file back with file_read().
    - Clean up {temp_dir} artifacts at the end.

    ## EXAMPLES OF MAKING EDUCATED GUESSES
    - "Install Python" → install latest stable Python 3.x available to user (non-root if possible).
    - "Create script" → create a descriptively named script in {user_files_dir} executable by user.
    - "Run tests" → discover and run standard tests (pytest, npm test, go test) across repo.
    - "Setup project" → create standard structure (README, src/, tests/) only if missing.

    ## SAFETY & PRIVACY
    - Do not print or return any secrets, keys, or credentials found.
    - Do not attempt to exfiltrate files or run network scans.
    - Avoid changing unrelated system-wide settings unless explicitly required for the task.

    ## AVAILABLE TOOLS (DO NOT RENAME)
    - terminal_connect: Opens a visible terminal window on screen (ONLY call if you need terminal for non-file operations)
    - terminal_execute: Execute commands in the visible terminal and capture output
    - terminal_read: Read the last command's output from history
    - terminal_clear: Clear the terminal screen
    - terminal_close: Close ONLY the terminal opened by this agent

    FILE OPERATIONS (PREFERRED - USE THESE INSTEAD OF SHELL COMMANDS):
    - file_read: Read file contents reliably (better than cat/more/less)
    - file_write: Create/overwrite files with content (better than echo/printf)
    - file_edit: Find and replace text in files (better than sed/awk)
    - file_append: Append content to files (better than >> redirection)
    - file_delete: Delete files safely
    - file_exists: Check if file exists and get info
    - directory_list: List directory contents with details (better than ls)
    - directory_delete: Delete directories and all contents (better than rm -rf)

    ## FINAL NOTE
    - Be proactive: prefer making safe, documented progress over stopping for clarification.
    - Keep user interruptions to the absolute minimum.
    - Return the structured summary described above when the task completes.

    Remember: Complete your assigned task autonomously, but DO NOT exceed your task boundaries."""

    
    def _get_desktop_agent_prompt(self) -> str:
        """Get system prompt for desktop agent"""
        env_block = self._get_system_environment_block()
        si = self.system_info
        plat = si.get("platform", "")
        home = si.get("home_dir", "/home/desktop")

        # Platform-specific save location
        if self.is_electron and plat == "win32":
            save_location = f"{home}\\Desktop or {home}\\Documents"
        elif self.is_electron and plat == "darwin":
            save_location = f"{home}/Desktop or {home}/Documents"
        else:
            save_location = "/home/desktop/Desktop or /home/desktop/Documents"

        return f"""Desktop automation specialist.

{env_block}

## CORE CAPABILITIES
- Control desktop applications
- Click, type, take screenshots
- Handle windows and UI elements
- Complete desktop workflows autonomously

## EXECUTION PROTOCOL
**NO QUESTIONS - USE VISUAL CONTEXT:**
- Make decisions from screenshots
- Click most relevant buttons by text/position
- Dialogs: OK/Yes/Continue (unless destructive)
- Files: Save to {save_location}
- Forms: Use defaults or common values
- Windows: Focus on task-relevant ones
- Errors: Acknowledge and try alternatives

EXAMPLES OF MAKING EDUCATED GUESSES:
- Multiple buttons → Click the primary/highlighted one
- Save dialog → Use descriptive filename in {save_location}
- Settings window → Use recommended/default options
- Installation wizard → Choose typical/standard installation
- Confirmation dialog → Proceed unless clearly destructive
- Multiple windows → Focus on the one matching task context
- Menu items → Choose based on standard UI patterns

ONLY REPORT THESE CRITICAL BLOCKERS:
- Application not installed or won't open
- Critical dialog requiring user decision
- System-level authentication required
- Application crash or freeze

HANDLE THESE SITUATIONS AUTONOMOUSLY:
- Choose from similar UI elements (pick most likely)
- Navigate through menus and dialogs
- Handle notifications (dismiss if not critical)
- Deal with multiple windows (focus on relevant one)
- Retry clicks if first attempt fails

FILE MANAGEMENT (when working with file dialogs):
- Check for existing files before saving new ones
- Prefer "Save" over "Save As" when updating files
- Use existing filenames when appropriate
- Avoid creating duplicate files with numbers (file1, file2, etc.)

CRITICAL RULE: EXECUTE ONLY ONE COMMAND AT A TIME
- NEVER call multiple desktop commands simultaneously
- ALWAYS wait for each action to complete before running the next
- Multiple concurrent commands will cause conflicts and failures
- Follow a sequential workflow: one action → wait for result → next action

Available tools:
- screenshot: Take desktop screenshots
- detect_elements: Detect UI elements
- click: Click at coordinates
- type: Type text
- key: Press keys
- shortcut: Execute shortcuts
- window operations: Manage windows

EXECUTION APPROACH:
- Be decisive in UI interactions
- Try alternative click locations if needed
- Complete workflows even if UI differs slightly
- Adapt to unexpected but non-critical changes

Focus on completing your assigned task accurately. Return a clear summary of what you accomplished."""
    
    def _get_planner_prompt(self) -> str:
        """Get system prompt for task planner"""
        si = self.system_info
        plat = si.get("platform", "")

        # Platform context for planner
        if self.is_electron and plat == "win32":
            platform_note = "TARGET: Windows machine (PowerShell, Windows commands)."
        elif self.is_electron and plat == "darwin":
            platform_note = "TARGET: macOS machine (zsh/bash, Unix commands, brew)."
        elif self.is_electron:
            platform_note = "TARGET: Linux machine (bash, Unix commands, apt)."
        else:
            platform_note = "TARGET: Ubuntu 22.04 VM with XFCE desktop."

        return f"""Task planner. OUTPUT ONLY VALID JSON.

{platform_note}

## REQUIRED FORMAT
```json
{{
    "task_plan": {{
        "main_objective": "goal description",
        "subtasks": [
            {{
                "task_id": "T1",
                "description": "WHAT to do",
                "assigned_agent": "browser_agent|terminal_agent",
                "expected_output": "specific measurable result",
                "dependencies": []
            }}
        ]
    }}
}}
```
RULES

- Use the FEWEST possible subtasks (avoid breaking down obvious/simple actions).
- Maximum 5 subtasks total.
- ONE clear action per subtask.
- Do NOT add redundant steps like "open Chrome" if searching is the real goal as it is already included in the browser_agent (bundle simple context actions).
- Even for opening terminal, do not add a subtask for it as it is already included in the terminal_agent.
- Avoid over-explaining. Keep each description short and action-focused.
- Only create subtasks that are necessary to achieve the main objective.

AGENT SELECTION

- browser_agent: Web navigation, searching, form filling, scraping.
- terminal_agent: Commands, scripts, file operations.

CRITICAL: Return ONLY JSON. No text before/after."""
    
    def _get_browser_tools(self) -> Dict:
        """Get tools available to browser agent"""
        browser_tool_names = [
            "browser_open", "browser_navigate","browser_wait",
            "browser_state",  # NEW: Get comprehensive browser state
            "browser_get_context",  # NEW: Get AI-friendly page context
            "browser_get_clickables",  # CRITICAL: Primary tool for finding buttons/links
            "browser_dom", "browser_click", "browser_type",  # Added browser_type for typing
            "browser_info", "browser_scroll",
            "browser_list_tabs",  # Tab management: List all open tabs
            "browser_open_tab",  # Tab management: Open new tab
            "browser_close_tab",  # Tab management: Close tab
            "browser_switch_tab",  # Tab management: Switch between tabs
            "type",  # Desktop typing tool for general text input
            "key",   # Key press tool for navigation keys
            "shortcut"  # Key combinations for shortcuts
        ]
        tools = {name: self.vm_tools[name] for name in browser_tool_names if name in self.vm_tools}

        # Add Google search tool for web research
        # tools["googleSearch"] = self.search_tool

        # Add credential tools — lookup caches, type_credential fills without exposing values
        tools["lookup_credential"] = self.credential_tool
        tools["type_credential"] = self.type_credential_tool

        # Add shared memory tools for team collaboration
        tools.update(self.shared_memory_tools)

        # Add delegation tools for employee-to-employee invocation
        tools.update(self.delegation_tools)

        return tools

    def _get_terminal_tools(self) -> Dict:
        """Get tools available to terminal agent"""
        terminal_tool_names = [
            "terminal_connect", "terminal_execute",
            "terminal_read", "terminal_clear", "terminal_close",
            "file_read", "file_write", "file_edit",
            "file_append", "file_delete", "file_exists",
            "directory_list", "directory_delete",
            "shortcut", "screenshot",
        ]
        tools = {name: self.vm_tools[name] for name in terminal_tool_names if name in self.vm_tools}
        tools["lookup_credential"] = self.credential_tool
        tools["type_credential"] = self.type_credential_tool
        tools.update(self.shared_memory_tools)
        tools.update(self.delegation_tools)
        return tools

    def _get_desktop_tools(self) -> Dict:
        """Get tools available to desktop agent"""
        desktop_tool_names = [
            "screenshot", "detect_elements", "click", "type",
            "key", "shortcut", "list_windows",
            "switch_window", "arrange_windows", "window_operation",
            "move_window",
        ]
        tools = {name: self.vm_tools[name] for name in desktop_tool_names if name in self.vm_tools}
        tools["lookup_credential"] = self.credential_tool
        tools["type_credential"] = self.type_credential_tool
        tools.update(self.shared_memory_tools)
        tools.update(self.delegation_tools)
        return tools

    async def plan_tasks(self, user_request: str, context: Optional[str] = None) -> TaskPlan:
        """Create a task plan from user request with retry mechanism"""
        logger.info(f"Planning tasks for request: {user_request[:100]}...")
        
        # Prepare planning prompt - emphasize JSON format
        planning_prompt = f"""RESPOND WITH ONLY VALID JSON. No text before or after the JSON.

{self.agent_prompts[AgentType.PLANNER]}

Create a task plan for this request:
{user_request}

IMPORTANT: When creating task descriptions, include ALL specific details from the user request:
- Include exact URLs, links, or file paths mentioned
- Include specific product names, search terms, or identifiers
- Include any numerical values, dates, or specific criteria
- Preserve proper names, brand names, or specific terminology
- Include any login credentials, account details, or access information provided

CRITICAL: Output ONLY the JSON structure, nothing else. Example:
{{
    "task_plan": {{
        "main_objective": "description with specific details from user request",
        "subtasks": [
            {{
                "task_id": "T1",
                "description": "detailed task description including all URLs, files, names, and specifics from user request",
                "assigned_agent": "browser_agent",
                "expected_output": "what to achieve with specific criteria"
            }}
        ]
    }}
}}"""
        
        planning_messages = [
            {"role": "system", "content": "You are a task planner. Always respond with valid JSON only."},
            {"role": "user", "content": planning_prompt}
        ]
        
        if context:
            planning_messages[1]["content"] += f"\n\nAdditional context:\n{context}"
        
        # Try up to 3 times to get a valid plan
        for attempt in range(3):
            try:
                # Get plan from AI using provider's stream_chat
                full_response = ""
                async for chunk in self.provider.stream_chat(
                    messages=planning_messages,
                    model=self.model,
                    tools=None,
                    max_steps=1,
                    temperature=1  # Lower temperature for more consistent JSON
                ):
                    if chunk.get("type") == "text":
                        full_response += chunk.get("content", "")
                
                response = full_response.strip()
                
                # If response is empty, retry
                if not response:
                    logger.warning(f"Empty response on attempt {attempt + 1}, retrying...")
                    continue
                
                # Try to extract JSON from the response
                # Sometimes models add text before/after JSON
                json_start = response.find('{')
                json_end = response.rfind('}') + 1
                
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                else:
                    json_str = response
                
                # Parse the plan
                try:
                    plan_data = json.loads(json_str)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON on attempt {attempt + 1}: {json_str[:500]}")
                    # Try to fix common JSON errors
                    json_str = json_str.replace("'", '"')  # Replace single quotes
                    json_str = json_str.replace('True', 'true').replace('False', 'false')  # Python booleans
                    json_str = json_str.replace('\n', ' ')  # Remove newlines in JSON
                    json_str = json_str.replace(',}', '}').replace(',]', ']')  # Remove trailing commas
                    try:
                        plan_data = json.loads(json_str)
                    except:
                        if attempt < 2:
                            continue  # Retry
                        raise ValueError(f"Invalid JSON after {attempt + 1} attempts: {str(e)}")
                
                task_plan_data = plan_data.get("task_plan", {})
                
                # Create TaskPlan object
                plan = TaskPlan(task_plan_data.get("main_objective", user_request))
                
                # Create SubTask objects
                subtasks = task_plan_data.get("subtasks", [])
                if not subtasks:
                    logger.warning("No subtasks in plan, creating default")
                    raise ValueError("Empty subtasks")
                
                for idx, task_data in enumerate(subtasks):
                    # Map agent string to enum
                    agent_str = task_data.get("assigned_agent", "terminal_agent")
                    agent_type = {
                        "browser_agent": AgentType.BROWSER,
                        "terminal_agent": AgentType.TERMINAL,
                    }.get(agent_str, AgentType.TERMINAL)
                    
                    subtask = SubTask(
                        task_id=task_data.get("task_id", f"T{idx+1}"),
                        description=task_data.get("description", ""),
                        assigned_agent=agent_type,
                        expected_output=task_data.get("expected_output", ""),
                        dependencies=[]  # No dependencies - tasks execute in order
                    )
                    plan.add_subtask(subtask)
                
                logger.info(f"Created plan with {len(plan.subtasks)} subtasks")
                return plan
                
            except Exception as e:
                logger.error(f"Error creating task plan (attempt {attempt + 1}): {str(e)}")
                if attempt < 2:
                    continue  # Retry
        
        # After all retries failed, create smart fallback plan
        logger.warning("All plan generation attempts failed, creating smart fallback plan")
        return self._create_smart_fallback_plan(user_request)
    
    def _create_smart_fallback_plan(self, user_request: str) -> TaskPlan:
        """Create an intelligent fallback plan based on request keywords"""
        request_lower = user_request.lower()
        plan = TaskPlan(user_request)
        
        # Detect task type from keywords
        if any(word in request_lower for word in ["amazon", "shop", "buy", "add to cart", "purchase", "product", "price"]):
            # Shopping task - be specific about boundaries
            if "add to cart" in request_lower or "buy" in request_lower or "purchase" in request_lower:
                plan.add_subtask(SubTask(
                    task_id="T1",
                    description=f"Navigate to shopping site, search for products, and add to cart as requested: {user_request} - Complete the full shopping flow",
                    assigned_agent=AgentType.BROWSER,
                    expected_output="Complete the shopping action as requested"
                ))
            else:
                plan.add_subtask(SubTask(
                    task_id="T1",
                    description=f"Navigate to shopping site and search for products: {user_request} - ONLY search and report findings, DO NOT add to cart or purchase",
                    assigned_agent=AgentType.BROWSER,
                    expected_output="List of products found with prices"
                ))
        elif any(word in request_lower for word in ["install", "setup", "configure", "run", "execute", "terminal", "command"]):
            # Terminal task with boundaries
            plan.add_subtask(SubTask(
                task_id="T1",
                description=f"Execute ONLY the requested terminal operation: {user_request} - DO NOT perform additional system changes",
                assigned_agent=AgentType.TERMINAL,
                expected_output="Result of the specific terminal operation"
            ))
        elif any(word in request_lower for word in ["browse", "search", "google", "web", "website", "navigate", "click", "form"]):
            # Web browsing task with boundaries
            plan.add_subtask(SubTask(
                task_id="T1",
                description=f"Browse web for the specific request: {user_request} - ONLY navigate and extract information as requested, DO NOT perform unrelated actions",
                assigned_agent=AgentType.BROWSER,
                expected_output="Information extracted from web pages"
            ))
        elif any(word in request_lower for word in ["open", "launch", "application", "app", "window", "desktop", "screenshot", "terminal"]):
            # Desktop task with boundaries
            plan.add_subtask(SubTask(
                task_id="T1",
                description=f"Perform ONLY the requested desktop action: {user_request} - DO NOT interact with other applications",
                assigned_agent=AgentType.TERMINAL,
                expected_output="Result of the specific desktop action"
            ))
        else:
            # Default with clear boundaries
            plan.add_subtask(SubTask(
                task_id="T1",
                description=f"Complete ONLY this specific task: {user_request} - DO NOT perform additional actions beyond what was requested",
                assigned_agent=AgentType.BROWSER,
                expected_output="Completion of the requested task"
            ))
        
        logger.info(f"Created smart fallback plan with bounded task")
        return plan
    
    
    async def _generate_task_summary(
        self,
        task_description: str,
        task_result: str,
        expected_output: str
    ) -> str:
        """Generate a concise summary of task execution"""
        # Truncate the result to prevent context overflow
        truncated_result = task_result[:2000] if len(task_result) > 2000 else task_result
        
        summary_prompt = f"""Summarize this task execution in 2-3 sentences:

Task: {task_description}
Expected: {expected_output}

Result: {truncated_result}

Provide a brief summary focusing on:
1. What was accomplished
2. Key data or outcomes
3. Any issues encountered

Keep it under 200 words."""
        
        try:
            messages = [
                {"role": "system", "content": "You are a technical summarizer. Provide concise, factual summaries."},
                {"role": "user", "content": summary_prompt}
            ]
            
            # Stream and collect the summary
            summary = ""
            async for chunk in self.provider.stream_chat(
                messages=messages,
                model=self.model,
                tools=None,
                max_steps=1,
                temperature=self.temperature
            ):
                if chunk.get("type") == "text":
                    summary += chunk.get("content", "")
            
            return summary.strip()
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            # Fallback to truncated result
            return task_result[:500] if task_result else "Task completed"
    
    async def stream_execution(self, user_request: str, context: Optional[str] = None, continuation_context: Optional[Dict] = None):
        """Stream multi-agent task execution with proper tool calls"""
        try:
            # Check if this is a continuation after user input
            if continuation_context:
                logger.info("Continuing execution after user input")
                # The user's response is the user_request
                user_response = user_request
                
                # Reconstruct the plan from continuation context
                plan = continuation_context.get("plan")
                task_summaries = continuation_context.get("task_summaries", {})
                all_tool_invocations = continuation_context.get("tool_invocations", [])
                all_tool_results = continuation_context.get("tool_results", [])
                all_content = continuation_context.get("content", "")
                waiting_task_id = continuation_context.get("task_id")
                
                # Add user's response to content
                all_content += f"\n\n**Your response:** {user_response}\n\n"
                yield {
                    "type": "text",
                    "content": f"\n\n**Your response:** {user_response}\n\nContinuing with your instructions...\n\n"
                }
                
                # Find the waiting task and update it with user's response
                for task in plan.subtasks:
                    if task.task_id == waiting_task_id:
                        task.status = TaskStatus.PENDING  # Reset to pending to continue
                        # Add user response to the task context
                        if not hasattr(task, 'user_responses'):
                            task.user_responses = []
                        task.user_responses.append(user_response)
                        break
                
            else:
                logger.info(f"Starting multi-agent execution for: {user_request[:100]}...")
                
                # Step 1: Create task plan
                plan = await self.plan_tasks(user_request, context)
                logger.info(f"Created plan with {len(plan.subtasks)} tasks")
                task_summaries = {}
                all_tool_invocations = []
                all_tool_results = []
                all_content = ""
                
                # Stream the task plan in a format the frontend can parse
                task_plan_data = {
                    "main_objective": plan.main_objective,
                    "subtasks": [
                        {
                            "task_id": task.task_id,
                            "description": task.description,
                            "assigned_agent": task.assigned_agent.value,
                            "expected_output": task.expected_output,
                            "status": task.status.value
                        }
                        for task in plan.subtasks
                    ],
                    "created_at": plan.created_at.isoformat() if plan.created_at else None
                }
                
                # Send task plan in parseable format
                task_plan_content = f"[TASK_PLAN_START]{json.dumps(task_plan_data)}[TASK_PLAN_END]\n\n"
                all_content += task_plan_content
                yield {
                    "type": "text",
                    "content": task_plan_content
                }
            
            # Don't stream task list text - it's already in the task plan formatter
            # The frontend will display this nicely from the TASK_PLAN markers
            
            # Execute tasks
            # NOTE: Do NOT reset all_content here - it already has the task plan!
            # Only reset if this is a continuation (which is handled in the if block above)
            waiting_for_user_input = False  # Track if we're waiting for user input
            
            while True:
                # Get next executable task
                next_task = plan.get_next_executable_task()
                
                if not next_task:
                    # Check if we have tasks waiting for user input
                    waiting_tasks = [t for t in plan.subtasks if t.status == TaskStatus.WAITING_FOR_USER]
                    if waiting_tasks:
                        # We're waiting for user input, don't skip other tasks yet
                        waiting_for_user_input = True
                        break
                    
                    # All tasks must be done if there's no next task
                    break
                
                # Prepare context from all previously completed tasks
                # Since tasks now run strictly in order (no dependencies), we pass
                # summaries from ALL previous tasks to provide full context
                previous_summary = None
                completed_summaries = []
                
                # Get summaries from all completed tasks before this one
                for task in plan.subtasks:
                    if task == next_task:
                        break  # Stop at current task
                    if task.task_id in task_summaries:
                        completed_summaries.append(task_summaries[task.task_id])
                
                if completed_summaries:
                    combined = "\n---\n".join(completed_summaries)
                    if len(combined) > MAX_CONTEXT_CHARS:
                        combined = combined[:MAX_CONTEXT_CHARS] + "..."
                    previous_summary = combined
                
                # Update task status to in_progress
                next_task.status = TaskStatus.IN_PROGRESS
                next_task.start_time = datetime.utcnow()
                
                # Stream task status update
                status_update = f"[TASK_STATUS:{next_task.task_id}:in_progress]"
                all_content += status_update
                yield {
                    "type": "text",
                    "content": status_update
                }
                
                # Don't show step headers - the task plan formatter handles this
                # The status updates are sufficient for tracking progress
                
                # Execute task and stream all chunks directly
                logger.info(f"Executing task {next_task.task_id}: {next_task.description}")
                
                async for chunk in self.stream_task_execution(
                    next_task,
                    previous_summary,
                    plan.main_objective
                ):
                    chunk_type = chunk.get("type")
                    
                    # Check if user input is required
                    if chunk_type == "user_input_required":
                        waiting_for_user_input = True
                        # Pass through the user input request
                        yield chunk
                        # Add content about waiting for input
                        all_content += "\n\n[Waiting for your response...]"
                        # Send a special finish event to indicate we're waiting
                        yield {
                            "type": "finish",
                            "content": all_content,
                            "tool_invocations": all_tool_invocations,
                            "metadata": {
                                "status": "waiting_for_user_input",
                                "task_id": next_task.task_id,
                                "question": chunk.get("question"),
                                "tasks_completed": len([t for t in plan.subtasks if t.status == TaskStatus.COMPLETED]),
                                "tasks_pending": len([t for t in plan.subtasks if t.status == TaskStatus.PENDING])
                            }
                        }
                        return  # Stop execution and wait for user response
                    
                    # Only pass through non-text chunks (tool calls, results, etc.)
                    # Text chunks with task status/summary markers are exceptions
                    if chunk_type == "text":
                        content = chunk.get("content", "")
                        # Only yield text that contains task markers (status/summary updates)
                        if "[TASK_STATUS:" in content or "[TASK_SUMMARY:" in content:
                            yield chunk
                            all_content += content
                    else:
                        # Pass through tool calls, results, and other non-text chunks
                        yield chunk
                    
                    # Accumulate tool invocations
                    if chunk_type == "tool_call":
                        # Accumulate tool calls exactly like googleSearch does
                        tool_call_id = chunk.get("toolCallId", chunk.get("id", str(uuid.uuid4())))
                        tool_name = chunk.get("toolName", chunk.get("tool", chunk.get("name", "")))
                        tool_args = chunk.get("args", {})
                        
                        tool_call = {
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                            "args": tool_args
                        }
                        all_tool_invocations.append(tool_call)
                    elif chunk_type == "tool_result":
                        # Accumulate tool results like googleSearch does
                        tool_call_id = chunk.get("toolCallId", chunk.get("id", ""))
                        tool_result = {
                            "toolCallId": tool_call_id,
                            "toolName": chunk.get("toolName", chunk.get("tool", chunk.get("name", ""))),
                            "result": chunk.get("result")
                        }
                        all_tool_results.append(tool_result)
                
                # Store summary after task completes
                task_summaries[next_task.task_id] = next_task.summary or "Task completed"
                
                # Only report failures
                if next_task.status == TaskStatus.FAILED:
                    error_text = f"\n⚠️ Error: {next_task.error}\n"
                    all_content += error_text
                    yield {
                        "type": "text",
                        "content": error_text
                    }
            
            # Complete execution
            plan.completed_at = datetime.utcnow()
            
            # Generate Coasty report with structured data
            report_data = self._generate_report_data(plan, task_summaries)
            if report_data:
                report_content = f"[Coasty_REPORT_START]{json.dumps(report_data)}[Coasty_REPORT_END]\n"
                all_content += report_content
                yield {
                    "type": "text",
                    "content": report_content
                }
            
            # Only generate summary for multiple tasks
            if len(plan.subtasks) > 1:
                # Stream the detailed report as it's generated
                yield {
                    "type": "text",
                    "content": "\n\n## Detailed Report\n\n"
                }
                all_content += "\n\n## Detailed Report\n\n"

                async for report_chunk in self._stream_final_report(plan, task_summaries):
                    if report_chunk:
                        yield {
                            "type": "text",
                            "content": report_chunk
                        }
                        all_content += report_chunk
            
            # Merge tool results into tool calls for complete invocations
            merged_tool_invocations = []
            for tool_call in all_tool_invocations:
                merged_invocation = tool_call.copy()
                # Find matching result by toolCallId
                for tool_result in all_tool_results:
                    if tool_result.get("toolCallId") == tool_call.get("toolCallId"):
                        merged_invocation["result"] = tool_result.get("result")
                        break
                merged_tool_invocations.append(merged_invocation)
            
            # Send finish signal with all accumulated content and merged tool invocations
            # Match the exact format used by googleSearch implementation
            logger.info(f"Multi-agent execution complete - content: {len(all_content)} chars, "
                       f"tool invocations: {len(merged_tool_invocations)} (merged from {len(all_tool_invocations)} calls and {len(all_tool_results)} results)")
            
            # Debug logging to verify content
            has_task_plan = "[TASK_PLAN_START]" in all_content
            has_status = "[TASK_STATUS:" in all_content
            logger.info(f"Final content check - has task plan: {has_task_plan}, has status: {has_status}")
            logger.info(f"Final content preview (first 500 chars): {all_content[:500]}...")
            
            yield {
                "type": "finish",
                "content": all_content,
                "tool_invocations": merged_tool_invocations if merged_tool_invocations else [],
                "metadata": {
                    "tasks_completed": len([t for t in plan.subtasks if t.status == TaskStatus.COMPLETED]),
                    "tasks_failed": len([t for t in plan.subtasks if t.status == TaskStatus.FAILED]),
                    "total_duration": (plan.completed_at - plan.created_at).total_seconds() if plan.completed_at else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error in stream_execution: {str(e)}", exc_info=True)
            yield {
                "type": "error",
                "content": str(e)
            }
    
    async def stream_task_execution(
        self,
        task: SubTask,
        previous_summary: Optional[str] = None,
        main_objective: str = None
    ):
        """Stream execution of a single task with tool calls"""
        task.status = TaskStatus.IN_PROGRESS
        task.start_time = datetime.utcnow()
        
        try:
            # Prepare agent context
            agent_prompt = self.agent_prompts[task.assigned_agent]
            agent_tools = self.agent_tools.get(task.assigned_agent, {})
            
            # Build task context
            task_context = f"Your Task: {task.description}\n"
            task_context += f"Expected Output: {task.expected_output}\n"
            task_context += "\n🛑 STOP IMMEDIATELY when you have completed the above task."
            task_context += "\nDO NOT continue with additional actions beyond what is specified above."
            
            if previous_summary:
                task_context += f"\nContext from previous tasks:\n{previous_summary}\n"
            
            # Include any user responses if this task requested input
            if hasattr(task, 'user_responses') and task.user_responses:
                task_context += f"\nUser provided the following input:\n"
                for response in task.user_responses:
                    task_context += f"- {response}\n"
            
            messages = [
                {"role": "system", "content": agent_prompt},
                {"role": "user", "content": task_context}
            ]
            
            logger.info(f"Streaming task {task.task_id} with {len(agent_tools)} tools")
            
            # Stream execution with tools
            full_response = ""
            tool_calls_made = []
            
            async for chunk in self.provider.stream_chat(
                messages=messages,
                model=self.model,
                tools=agent_tools,
                max_steps=1000,
                temperature=self.temperature
            ):
                chunk_type = chunk.get("type")
                logger.debug(f"Received chunk type: {chunk_type}")
                
                if chunk_type == "text":
                    content = chunk.get("content", "")
                    full_response += content
                    
                    # Check if the agent is requesting user input
                    if "[NEED_USER_INPUT]" in full_response and "[/NEED_USER_INPUT]" in full_response:
                        # Extract the user input request
                        start_idx = full_response.rfind("[NEED_USER_INPUT]")
                        end_idx = full_response.rfind("[/NEED_USER_INPUT]") + len("[/NEED_USER_INPUT]")
                        user_input_request = full_response[start_idx:end_idx]
                        
                        # Parse the request
                        import re
                        question_match = re.search(r'Question: (.+?)\n', user_input_request)
                        context_match = re.search(r'Context: (.+?)\n', user_input_request)
                        options_match = re.search(r'Options: (.+?)\n', user_input_request)
                        
                        question = question_match.group(1) if question_match else "Please provide clarification"
                        context = context_match.group(1) if context_match else ""
                        options = options_match.group(1) if options_match else ""
                        
                        # Update task status
                        task.status = TaskStatus.WAITING_FOR_USER
                        task.summary = f"Waiting for user input: {question}"
                        
                        # Stream the clarification request to the user - keep it simple
                        clarification_text = f"\n\n🤔 **{question}**"
                        
                        # Only add options if they exist and are meaningful
                        if options and options.strip() and options.lower() != "none":
                            clarification_text += f"\n\nOptions: {options}"
                        
                        # Only add context if it's very brief and essential
                        if context and len(context) <= 30:
                            clarification_text += f"\n_{context}_"
                        
                        clarification_text += "\n"
                        
                        yield {
                            "type": "text",
                            "content": clarification_text
                        }
                        
                        # Signal that we need user input
                        yield {
                            "type": "user_input_required",
                            "question": question,
                            "context": context,
                            "options": options,
                            "task_id": task.task_id
                        }
                        
                        # Stop execution here - don't continue processing
                        logger.info(f"Task {task.task_id} requesting user input: {question}")
                        return
                    
                    # Don't stream individual task text content - it will be shown in summaries
                    # This prevents duplicate text like "What I did", "Verification", etc.
                    # The task summary will capture the important results
                    pass  # Suppress text streaming for cleaner output
                    
                elif chunk_type == "tool_call":
                    # Stream tool call to client immediately
                    # Provider sends toolCallId, not id - must check toolCallId first!
                    tool_call_id = chunk.get("toolCallId") or chunk.get("id", str(uuid.uuid4()))
                    tool_name = chunk.get("toolName") or chunk.get("tool") or chunk.get("name", "")
                    tool_args = chunk.get("args") or {}
                    
                    # Store for accumulation
                    tool_calls_made.append({
                        "toolCallId": tool_call_id,
                        "toolName": tool_name,
                        "args": tool_args
                    })
                    
                    logger.debug(f"Tool call with ID: {tool_call_id}, name: {tool_name}")
                    
                    # Yield with type for routing
                    yield {
                        "type": "tool_call",
                        "toolCallId": tool_call_id,
                        "toolName": tool_name,
                        "args": tool_args
                    }
                    
                elif chunk_type == "tool_result":
                    # Stream tool result to client immediately with correct format
                    result = chunk.get("result", {})
                    # Don't truncate here - already handled in tool wrapper
                    # The wrapper preserves frontendScreenshot
                    
                    # Provider sends toolCallId, not id - must use same field as tool_call!
                    tool_call_id = chunk.get("toolCallId") or chunk.get("id", "")
                    
                    logger.debug(f"Tool result with ID: {tool_call_id}")
                    
                    yield {
                        "type": "tool_result",
                        "toolCallId": tool_call_id,
                        "result": result
                    }
                
                elif chunk_type == "reasoning":
                    # Stream reasoning if present
                    yield {
                        "type": "reasoning",
                        "content": chunk.get("content", "")
                    }
                
                elif chunk_type == "finish":
                    # Handle finish from provider - don't yield it here
                    logger.debug("Provider sent finish signal")
                    pass
            
            # Generate summary after streaming completes
            task.result = full_response
            task.summary = await self._generate_task_summary(
                task.description,
                full_response,
                task.expected_output
            )
            task.status = TaskStatus.COMPLETED
            task.end_time = datetime.utcnow()
            
            # Stream task completion status
            completion_status = f"[TASK_STATUS:{task.task_id}:completed]"
            yield {
                "type": "text",
                "content": completion_status
            }
            
            # Stream task summary if available
            if task.summary:
                summary_update = f"[TASK_SUMMARY:{task.task_id}:{task.summary[:200]}]"
                yield {
                    "type": "text", 
                    "content": summary_update
                }
            
            logger.info(f"Task {task.task_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Error executing task {task.task_id}: {str(e)}", exc_info=True)
            task.error = str(e)
            task.status = TaskStatus.FAILED
            task.end_time = datetime.utcnow()
            task.summary = f"Task failed: {str(e)}"
            
            # Stream task failure status
            failure_status = f"[TASK_STATUS:{task.task_id}:failed]"
            yield {
                "type": "text",
                "content": failure_status
            }
            
            # Stream error summary
            error_summary = f"[TASK_SUMMARY:{task.task_id}:Failed - {str(e)[:100]}]"
            yield {
                "type": "text",
                "content": error_summary
            }
    
    def _generate_report_data(self, plan: TaskPlan, summaries: Dict[str, str]) -> Dict:
        """Generate structured Coasty report data"""
        completed_tasks = [t for t in plan.subtasks if t.status == TaskStatus.COMPLETED]
        failed_tasks = [t for t in plan.subtasks if t.status == TaskStatus.FAILED]
        skipped_tasks = [t for t in plan.subtasks if t.status == TaskStatus.SKIPPED]
        
        # Calculate execution time
        execution_time = 0
        if plan.completed_at and plan.created_at:
            execution_time = (plan.completed_at - plan.created_at).total_seconds()
        
        # Build task details with outcomes
        task_outcomes = []
        for task in plan.subtasks:
            outcome = {
                "task_id": task.task_id,
                "description": task.description,
                "agent": task.assigned_agent.value if isinstance(task.assigned_agent, AgentType) else task.assigned_agent,
                "status": task.status.value if hasattr(task.status, 'value') else task.status,
                "summary": summaries.get(task.task_id, task.summary),
                "error": task.error if task.status == TaskStatus.FAILED else None,
                "execution_time": None
            }
            
            # Calculate task execution time if available
            if hasattr(task, 'start_time') and hasattr(task, 'end_time'):
                if task.start_time and task.end_time:
                    task_time = (task.end_time - task.start_time).total_seconds()
                    outcome["execution_time"] = round(task_time, 2)
            
            task_outcomes.append(outcome)
        
        # Generate success metrics
        total_tasks = len(plan.subtasks)
        success_rate = (len(completed_tasks) / total_tasks * 100) if total_tasks > 0 else 0
        
        # Build the report structure
        report = {
            "title": "Task Execution Report",
            "timestamp": datetime.utcnow().isoformat(),
            "objective": plan.main_objective,
            "summary": {
                "total_tasks": total_tasks,
                "completed": len(completed_tasks),
                "failed": len(failed_tasks),
                "skipped": len(skipped_tasks),
                "success_rate": round(success_rate, 1),
                "execution_time": round(execution_time, 2)
            },
            "tasks": task_outcomes,
            "key_achievements": [
                task.description for task in completed_tasks
            ],
            "issues_encountered": [
                {"task": task.description, "error": task.error} 
                for task in failed_tasks
            ] if failed_tasks else [],
            "metadata": {
                "started_at": plan.created_at.isoformat() if plan.created_at else None,
                "completed_at": plan.completed_at.isoformat() if plan.completed_at else None,
                "report_version": "1.0"
            }
        }
        
        return report
    
    async def _stream_final_report(self, plan: TaskPlan, summaries: Dict[str, str]):
        """Stream a comprehensive final report as it's generated"""
        completed_tasks = [t for t in plan.subtasks if t.status == TaskStatus.COMPLETED]
        failed_tasks = [t for t in plan.subtasks if t.status == TaskStatus.FAILED]

        report_context = f"""Generate a comprehensive report for this task execution:

Main Objective: {plan.main_objective}

Completed Tasks ({len(completed_tasks)}):
"""
        for task in completed_tasks:
            if task.task_id in summaries:
                report_context += f"\n- {task.description}\n  Summary: {summaries[task.task_id]}\n"

        if failed_tasks:
            report_context += f"\nFailed Tasks ({len(failed_tasks)}):\n"
            for task in failed_tasks:
                report_context += f"- {task.description}\n  Error: {task.error}\n"

        report_context += """

Please provide a comprehensive and well-structured report following these guidelines:
- Use clear markdown formatting with headers (##, ###), bold (**text**), and bullet points
- Organize the report into logical sections
- Include key achievements, challenges overcome, and recommendations
- Make it visually appealing and easy to scan
- Use professional language while keeping it concise and informative"""

        try:
            messages = [
                {"role": "system", "content": """You are a professional technical report writer who creates beautifully formatted markdown reports.

Your reports should:
1. Use proper markdown formatting:
   - Headers (## for main sections, ### for subsections)
   - **Bold** for emphasis on key points
   - Bullet points (-) for lists
   - Numbered lists (1., 2., etc.) for sequential items
   - `Inline code` for technical terms or commands
   - > Blockquotes for important notes or quotes

2. Be well-structured with clear sections such as:
   - ## Executive Summary
   - ## Key Achievements
   - ## Technical Details
   - ## Challenges & Solutions
   - ## Recommendations
   - ## Conclusion

3. Be visually appealing with:
   - Proper spacing between sections
   - Clear hierarchy of information
   - Concise but informative paragraphs
   - Strategic use of formatting for readability

4. Maintain professional tone while being engaging and easy to read."""},
                {"role": "user", "content": report_context}
            ]

            # Stream the report as it's generated
            async for chunk in self.provider.stream_chat(
                messages=messages,
                model=self.model,
                tools=None,
                max_steps=1,
                temperature=self.temperature
            ):
                if chunk.get("type") == "text":
                    yield chunk.get("content", "")

        except Exception as e:
            logger.error(f"Error generating final report: {str(e)}")
            # Fallback to summary compilation
            fallback = "\n\n".join([
                f"Task {tid}: {summary}"
                for tid, summary in summaries.items()
            ])
            yield fallback

    async def _generate_final_report(self, plan: TaskPlan, summaries: Dict[str, str]) -> str:
        """Generate a comprehensive final report (non-streaming version for backwards compatibility)"""
        report = ""
        async for chunk in self._stream_final_report(plan, summaries):
            report += chunk
        return report.strip()