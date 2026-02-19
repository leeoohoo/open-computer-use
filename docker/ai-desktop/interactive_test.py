#!/usr/bin/env python3
"""
Interactive WebSocket Client for AI Desktop Agent
Reliable connection with auto-reconnect and heartbeat
"""

import asyncio
import json
import time
import websockets
import sys
from datetime import datetime
from typing import Optional, Dict, Any
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class InteractiveClient:
    def __init__(self, url="ws://localhost:8081"):
        self.url = url
        self.ws = None
        self.connected = False
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 1  # Start with 1 second
        self.max_reconnect_delay = 60  # Max 60 seconds between attempts
        self.heartbeat_interval = 30  # Send ping every 30 seconds
        self.heartbeat_task = None
        self.receive_timeout = 120  # 2 minutes for long operations
        self.last_ping_time = None
        self.last_pong_time = None
        
    async def connect(self, retry=True) -> bool:
        """Connect to the WebSocket server with retry logic"""
        while self.reconnect_attempts < self.max_reconnect_attempts:
            try:
                print(f"🔌 Connecting to {self.url}...")
                
                # Create connection with longer timeouts
                self.ws = await asyncio.wait_for(
                    websockets.connect(
                        self.url,
                        ping_interval=60,  # Send WebSocket ping every 60 seconds
                        ping_timeout=30,   # Wait 30 seconds for pong
                        close_timeout=10,  # Wait 10 seconds for close
                        max_size=10 * 1024 * 1024  # 10MB max message size
                    ),
                    timeout=30
                )
                
                print(f"✓ Connected to {self.url}")
                
                # Send authentication
                auth_message = {
                    "type": "auth",
                    "password": "coasty123",
                    "sessionId": "interactive_session_" + str(int(time.time())),
                    "userId": "interactive_user"
                }
                await self.ws.send(json.dumps(auth_message))
                
                # Wait for auth response
                response = await asyncio.wait_for(self.ws.recv(), timeout=10)
                auth_response = json.loads(response)
                
                if auth_response.get("type") == "auth_success":
                    print("✓ Authentication successful")
                    self.connected = True
                    self.reconnect_attempts = 0
                    self.reconnect_delay = 1
                    
                    # Start heartbeat
                    if self.heartbeat_task:
                        self.heartbeat_task.cancel()
                    self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())
                    
                    return True
                else:
                    print(f"✗ Authentication failed: {auth_response}")
                    if self.ws:
                        await self.ws.close()
                    self.ws = None
                    
            except asyncio.TimeoutError:
                print(f"⏱️ Connection timeout (attempt {self.reconnect_attempts + 1}/{self.max_reconnect_attempts})")
            except websockets.exceptions.WebSocketException as e:
                print(f"🔌 WebSocket error: {e}")
            except Exception as e:
                print(f"❌ Connection error: {e}")
            
            # If not retrying, break
            if not retry:
                return False
            
            # Increment attempts and calculate delay
            self.reconnect_attempts += 1
            if self.reconnect_attempts < self.max_reconnect_attempts:
                delay = min(self.reconnect_delay * (2 ** (self.reconnect_attempts - 1)), self.max_reconnect_delay)
                print(f"⏳ Retrying in {delay} seconds...")
                await asyncio.sleep(delay)
            else:
                print(f"❌ Max reconnection attempts reached")
                break
                
        return False
    
    async def heartbeat_loop(self):
        """Send periodic heartbeat to keep connection alive"""
        while self.connected and self.ws:
            try:
                # Send ping message (fire and forget - don't wait for pong)
                ping_message = {
                    "type": "ping",
                    "timestamp": time.time()
                }
                
                self.last_ping_time = time.time()
                await self.ws.send(json.dumps(ping_message))
                logger.debug(f"Heartbeat sent at {self.last_ping_time}")
                
                # Don't wait for pong here - it will be handled in send_command
                # This avoids the "cannot call recv while another coroutine is already waiting" error
                    
                # Wait before next heartbeat
                await asyncio.sleep(self.heartbeat_interval)
                
            except websockets.exceptions.ConnectionClosed:
                print("❌ Connection lost during heartbeat")
                self.connected = False
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                await asyncio.sleep(self.heartbeat_interval)
    
    async def ensure_connected(self) -> bool:
        """Ensure connection is established, reconnect if needed"""
        if not self.connected or not self.ws:
            print("🔄 Connection lost, attempting to reconnect...")
            return await self.connect(retry=True)
        
        # Test if connection is still alive
        try:
            # Send a ping to test connection
            await self.ws.ping()
            return True
        except:
            print("🔄 Connection test failed, reconnecting...")
            self.connected = False
            return await self.connect(retry=True)
    
    async def send_command(self, command: str, parameters: Optional[Dict[str, Any]] = None, 
                          timeout: Optional[float] = None) -> Optional[Dict[str, Any]]:
        """Send a command and wait for response with automatic reconnection"""
        
        # Ensure we're connected
        if not await self.ensure_connected():
            print("❌ Failed to establish connection")
            return None
        
        if parameters is None:
            parameters = {}
        
        # Use longer timeout for certain operations
        if timeout is None:
            if command in ["browser_get_dom", "detect_elements", "ocr", "browser_navigate"]:
                timeout = 60.0  # 1 minute for complex operations
            elif command in ["screenshot", "browser_connect"]:
                timeout = 30.0  # 30 seconds for medium operations
            else:
                timeout = 20.0  # 20 seconds default
        
        message = {
            "type": "command",
            "data": {
                "command": command,
                "parameters": parameters
            },
            "timestamp": time.time()
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Send command
                await self.ws.send(json.dumps(message))
                
                # Wait for response with timeout
                while True:
                    response = await asyncio.wait_for(self.ws.recv(), timeout=timeout)
                    response_data = json.loads(response)
                    
                    # Skip heartbeat responses
                    if response_data.get("type") == "pong":
                        self.last_pong_time = time.time()
                        continue
                    
                    # Return actual command response
                    return response_data
                    
            except asyncio.TimeoutError:
                print(f"⏱️ Command timeout ({timeout}s) - attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    # Try to reconnect
                    await self.ensure_connected()
                else:
                    print("❌ Command failed after all retries")
                    return None
                    
            except websockets.exceptions.ConnectionClosed:
                print(f"❌ Connection lost during command - attempt {attempt + 1}/{max_retries}")
                self.connected = False
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)
                    if await self.connect(retry=True):
                        continue
                return None
                
            except Exception as e:
                print(f"❌ Error sending command: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)
                    continue
                return None
        
        return None
    
    def print_help(self):
        """Print available commands"""
        print("\n" + "="*60)
        print("AVAILABLE COMMANDS")
        print("="*60)
        print("""
DESKTOP COMMANDS:
1. screenshot              - Take a screenshot
2. detect_elements [opts]  - Detect UI elements (opts: text_only, no_multi_scale)
3. click <x> <y>          - Click at coordinates
4. type <text>            - Type text
5. key_press <key>        - Press a key (e.g., enter, tab, escape)
6. key_combo <keys>       - Press key combination (e.g., ctrl+c)
7. ocr                    - Perform OCR on screen

TERMINAL MANAGEMENT (New - Browser-like):
8. terminal_connect       - Connect to terminal (creates new if needed)
9. terminal_execute <cmd> - Execute command and see output
10. terminal_type <text>  - Type text without executing
11. terminal_read         - Read current terminal output
12. terminal_clear        - Clear terminal screen
13. terminal_close        - Close terminal session

FILE OPERATIONS (Standardized - Reliable):
14. file_read <path>      - Read file contents
15. file_write <path> <content> - Write/create file
16. file_edit <path> <old> <new> - Replace text in file
17. file_append <path> <content> - Append to file
18. file_delete <path>    - Delete file
19. file_exists <path>    - Check if file exists
20. directory_list [path] - List directory contents (defaults to Desktop)
21. directory_delete <path> - Delete directory and all contents

LEGACY:
15. open_terminal         - Open terminal window (old method)
16. execute_command <cmd> - Execute shell command (old method)

WINDOW MANAGEMENT:
17. list_windows          - List all open windows with IDs and titles
18. switch_window <id/title> - Switch to window by ID (0x...) or title
19. arrange <type>        - Arrange windows (tile/cascade/minimize_all/show_desktop)
13. close_window [id/title] - Close current or specific window by ID or title
14. minimize_window [id/title] - Minimize current or specific window
15. maximize_window [id/title] - Maximize current or specific window
16. restore_window [id/title] - Restore minimized/maximized window
17. move_window <x> <y> [w] [h] [id/title] - Move/resize window

BROWSER AUTOMATION:
13. browser_open          - Open Chrome and connect for automation
14. browser_connect       - Connect to existing Chrome browser
15. browser_dom [filter]  - Get DOM elements (optional filter text)
                           Examples: browser_dom "add to cart"
                                    browser_dom "buy now"
                                    browser_dom "price"
16. browser_get_clickables [filter] - Get ALL clickable elements (buttons, links, inputs)
                           Examples: browser_get_clickables
                                    browser_get_clickables "submit"
                                    browser_get_clickables "next"
17. browser_click <sel>   - Click element by selector
18. browser_type <sel> <text> - Type in element
19. browser_execute <js>  - Execute JavaScript code
20. browser_wait [sel] [timeout] - Wait for page load and/or element
21. browser_go <url>      - Navigate to URL
22. browser_info          - Get browser information
23. browser_state         - Get comprehensive browser state (focus, cursor, scroll)
24. browser_get_context   - Get AI-friendly context about current page

BROWSER TAB MANAGEMENT:
25. browser_tabs          - List all open tabs with their URLs and titles
26. browser_new_tab [url] - Open a new tab (optionally navigate to URL)
27. browser_close_tab [index] - Close tab by index (or current if no index)
28. browser_switch_tab <index> - Switch to tab by index (0-based)

Special Commands:
- help                    - Show this help
- quit/exit              - Exit the program
- status                 - Check connection status
- clear                  - Clear screen
- reconnect              - Force reconnection

Examples:
  > browser_connect
  > browser_state           # Get full browser state with focus/cursor info
  > browser_get_context     # Get AI-friendly page context
  > browser_dom
  > browser_click #search-button    # Returns state changes after click
  > browser_type input[name="q"] "search query"
  > browser_go google.com
  
  > file_read test.txt              # Reads from /home/desktop/Desktop/test.txt
  > file_write test.txt "Hello World"   # Writes to /home/desktop/Desktop/test.txt
  > file_append test.txt "New line"
  > file_edit test.txt "Hello" "Goodbye"
  > file_exists test.txt
  > file_delete test.txt
  > directory_list                  # Lists Desktop contents
  > directory_list myproject        # Lists myproject directory
  > directory_delete old_project    # Deletes directory and all contents
  
  # Or use absolute paths:
  > file_read /home/desktop/Desktop/test.txt
  > file_write ~/Desktop/test.txt "Hello World"
  > directory_list /tmp             # List /tmp directory
""")
    
    def print_status(self):
        """Print connection status"""
        print("\n" + "="*40)
        print("CONNECTION STATUS")
        print("="*40)
        print(f"Connected: {'✓' if self.connected else '✗'}")
        print(f"URL: {self.url}")
        print(f"Reconnect attempts: {self.reconnect_attempts}/{self.max_reconnect_attempts}")
        if self.last_ping_time:
            print(f"Last ping: {datetime.fromtimestamp(self.last_ping_time).strftime('%H:%M:%S')}")
        if self.last_pong_time:
            print(f"Last pong: {datetime.fromtimestamp(self.last_pong_time).strftime('%H:%M:%S')}")
            if self.last_ping_time:
                latency = (self.last_pong_time - self.last_ping_time) * 1000
                print(f"Latency: {latency:.1f}ms")
        print("="*40)
    
    async def interactive_loop(self):
        """Main interactive loop"""
        print("\n" + "🤖" * 20)
        print("AI DESKTOP AGENT - INTERACTIVE MODE")
        print("🤖" * 20)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Server: {self.url}")
        print("\nType 'help' for available commands, 'quit' to exit")
        print("-" * 60)
        
        # Initial connection
        if not await self.connect(retry=True):
            print("\n❌ Could not connect to server. Exiting...")
            return
        
        while True:
            try:
                # Get user input
                user_input = input("\n> ").strip()
                
                if not user_input:
                    continue
                
                # Parse command
                parts = user_input.split(maxsplit=1)
                command = parts[0].lower()
                args = parts[1] if len(parts) > 1 else ""
                
                # Handle special commands
                if command in ["quit", "exit"]:
                    print("👋 Goodbye!")
                    break
                    
                elif command == "help":
                    self.print_help()
                    continue
                    
                elif command == "clear":
                    import os
                    os.system('cls' if os.name == 'nt' else 'clear')
                    continue
                    
                elif command == "status":
                    self.print_status()
                    continue
                    
                elif command == "reconnect":
                    print("🔄 Forcing reconnection...")
                    self.connected = False
                    if self.ws:
                        await self.ws.close()
                    if await self.connect(retry=True):
                        print("✓ Reconnected successfully")
                    else:
                        print("❌ Reconnection failed")
                    continue
                
                # Handle agent commands
                elif command == "screenshot":
                    print("📸 Taking screenshot...")
                    result = await self.send_command("screenshot")
                    
                elif command == "detect_elements":
                    # Parse optional parameters
                    params = {"include_text": True, "include_clickable": True, "include_ui": True, "multi_scale": True}
                    if args:
                        if "text_only" in args:
                            params = {"include_text": True, "include_clickable": False, "include_ui": False}
                        if "no_multi_scale" in args:
                            params["multi_scale"] = False
                    print(f"🔍 Detecting elements...")
                    result = await self.send_command("detect_elements", params, timeout=60)
                    
                elif command == "click":
                    coords = args.split()
                    if len(coords) >= 2:
                        x, y = int(coords[0]), int(coords[1])
                        print(f"🖱️ Clicking at ({x}, {y})...")
                        result = await self.send_command("click", {"x": x, "y": y})
                    else:
                        print("❌ Usage: click <x> <y>")
                        continue

                elif command == "double_click":
                    coords = args.split()
                    if len(coords) >= 2:
                        x, y = int(coords[0]), int(coords[1])
                        print(f"🖱️ Double clicking at ({x}, {y})...")
                        result = await self.send_command("double_click", {"x": x, "y": y})
                    else:
                        print("❌ Usage: double_click <x> <y>")
                        continue
                        
                elif command == "type":
                    if args:
                        print(f"⌨️ Typing: {args}")
                        result = await self.send_command("type", {"text": args})
                    else:
                        print("❌ Usage: type <text>")
                        continue
                        
                elif command == "key_press":
                    if args:
                        print(f"⌨️ Pressing key: {args}")
                        result = await self.send_command("key_press", {"keys": [args]})
                    else:
                        print("❌ Usage: key_press <key>")
                        continue
                        
                elif command == "key_combo":
                    if args:
                        keys = args.replace("+", " ").split()
                        print(f"⌨️ Key combo: {'+'.join(keys)}")
                        result = await self.send_command("key_combo", {"keys": keys})
                    else:
                        print("❌ Usage: key_combo <keys> (e.g., ctrl+c)")
                        continue
                        
                elif command == "open_terminal":
                    print(f"🚀 Opening terminal...")
                    result = await self.send_command("open_terminal")
                        
                # Window Management Commands
                elif command == "list_windows":
                    print("📋 Listing all windows...")
                    result = await self.send_command("list_windows")
                    
                elif command == "switch_window":
                    if args:
                        print(f"🔄 Switching to window: {args}")
                        result = await self.send_command("switch_window", {"window": args})
                    else:
                        print("❌ Usage: switch_window <window_name_or_index>")
                        continue
                        
                elif command == "arrange":
                    arrangement = args if args else "tile"
                    if arrangement not in ["tile", "cascade", "minimize_all", "show_desktop", "restore_all"]:
                        print(f"❌ Unknown arrangement: {arrangement}")
                        print("   Supported: tile, cascade, minimize_all, show_desktop, restore_all")
                        continue
                    print(f"🔲 Arranging windows: {arrangement}")
                    result = await self.send_command("arrange_windows", {"arrangement": arrangement})
                    
                elif command == "close_window":
                    if args:
                        print(f"❌ Closing window: {args}")
                        result = await self.send_command("close_window", {"window_title": args})
                    else:
                        print("❌ Closing current window...")
                        result = await self.send_command("close_window")
                    
                elif command == "minimize_window":
                    if args:
                        print(f"➖ Minimizing window: {args}")
                        result = await self.send_command("minimize_window", {"window_title": args})
                    else:
                        print("➖ Minimizing current window...")
                        result = await self.send_command("minimize_window")
                    
                elif command == "maximize_window":
                    if args:
                        print(f"⬜ Maximizing window: {args}")
                        result = await self.send_command("maximize_window", {"window_title": args})
                    else:
                        print("⬜ Maximizing current window...")
                        result = await self.send_command("maximize_window")
                        
                elif command == "restore_window":
                    if args:
                        print(f"🔄 Restoring window: {args}")
                        result = await self.send_command("restore_window", {"window_title": args})
                    else:
                        print("🔄 Restoring current window...")
                        result = await self.send_command("restore_window")
                        
                elif command == "move_window":
                    parts = args.split() if args else []
                    if len(parts) >= 2:
                        params = {
                            "x": int(parts[0]),
                            "y": int(parts[1])
                        }
                        if len(parts) >= 3:
                            params["width"] = int(parts[2])
                        if len(parts) >= 4:
                            params["height"] = int(parts[3])
                        if len(parts) >= 5:
                            params["window_title"] = " ".join(parts[4:])
                        print(f"📍 Moving window to ({params['x']}, {params['y']})...")
                        result = await self.send_command("move_window", params)
                    else:
                        print("❌ Usage: move_window <x> <y> [width] [height] [window_title]")
                        continue
                    
                elif command == "ocr":
                    print("📖 Performing OCR...")
                    result = await self.send_command("ocr", timeout=45)
                
                # New Terminal Management Commands (Browser-like)
                elif command == "terminal_connect":
                    print("🔗 Connecting to terminal...")
                    result = await self.send_command("terminal_connect")
                    
                elif command == "terminal_execute":
                    if args:
                        print(f"⚡ Executing in terminal: {args}")
                        result = await self.send_command("terminal_execute", {"command": args}, timeout=30)
                    else:
                        print("❌ Usage: terminal_execute <command>")
                        continue
                        
                elif command == "terminal_type":
                    if args:
                        print(f"⌨️ Typing in terminal: {args}")
                        result = await self.send_command("terminal_type", {"text": args})
                    else:
                        print("❌ Usage: terminal_type <text>")
                        continue
                        
                elif command == "terminal_read":
                    print("📖 Reading terminal output...")
                    result = await self.send_command("terminal_read")
                    
                elif command == "terminal_clear":
                    print("🧹 Clearing terminal screen...")
                    result = await self.send_command("terminal_clear")
                    
                elif command == "terminal_close":
                    print("❌ Closing terminal session...")
                    result = await self.send_command("terminal_close")
                    
                # File operation commands
                elif command == "file_read":
                    if args:
                        print(f"📖 Reading file: {args}")
                        result = await self.send_command("file_read", {"filepath": args})
                    else:
                        print("❌ Usage: file_read <filepath>")
                        continue
                        
                elif command == "file_write":
                    parts = args.split(maxsplit=1) if args else []
                    if len(parts) >= 2:
                        filepath, content = parts[0], parts[1]
                        print(f"📝 Writing to file: {filepath}")
                        result = await self.send_command("file_write", {"filepath": filepath, "content": content})
                    else:
                        print("❌ Usage: file_write <filepath> <content>")
                        continue
                        
                elif command == "file_edit":
                    parts = args.split(maxsplit=2) if args else []
                    if len(parts) >= 3:
                        filepath, old_text, new_text = parts[0], parts[1], parts[2]
                        print(f"✏️ Editing file: {filepath}")
                        result = await self.send_command("file_edit", {
                            "filepath": filepath,
                            "old_text": old_text,
                            "new_text": new_text
                        })
                    else:
                        print("❌ Usage: file_edit <filepath> <old_text> <new_text>")
                        continue
                        
                elif command == "file_append":
                    parts = args.split(maxsplit=1) if args else []
                    if len(parts) >= 2:
                        filepath, content = parts[0], parts[1]
                        print(f"➕ Appending to file: {filepath}")
                        result = await self.send_command("file_append", {"filepath": filepath, "content": content})
                    else:
                        print("❌ Usage: file_append <filepath> <content>")
                        continue
                        
                elif command == "file_delete":
                    if args:
                        print(f"🗑️ Deleting file: {args}")
                        result = await self.send_command("file_delete", {"filepath": args})
                    else:
                        print("❌ Usage: file_delete <filepath>")
                        continue
                        
                elif command == "file_exists":
                    if args:
                        print(f"❓ Checking if file exists: {args}")
                        result = await self.send_command("file_exists", {"filepath": args})
                    else:
                        print("❌ Usage: file_exists <filepath>")
                        continue
                
                elif command == "directory_list":
                    # Can be called with or without path
                    dirpath = args if args else ""
                    if dirpath:
                        print(f"📁 Listing directory: {dirpath}")
                    else:
                        print(f"📁 Listing Desktop directory")
                    result = await self.send_command("directory_list", {"dirpath": dirpath})
                
                elif command == "directory_delete":
                    if args:
                        print(f"🗑️ Deleting directory: {args}")
                        result = await self.send_command("directory_delete", {"dirpath": args})
                    else:
                        print("❌ Usage: directory_delete <dirpath>")
                        continue
                    
                # Legacy terminal command
                elif command == "execute_command":
                    if args:
                        print(f"💻 Executing: {args}")
                        result = await self.send_command("execute_command", {"command": args})
                    else:
                        print("❌ Usage: execute_command <cmd>")
                        continue
                
                # Browser automation commands
                elif command == "browser_open":
                    print("🌐 Opening Chrome and connecting for automation...")
                    result = await self.send_command("browser_open", timeout=30)
                    
                elif command == "browser_connect":
                    print("🌐 Connecting to existing Chrome browser...")
                    result = await self.send_command("browser_connect", timeout=30)
                    
                elif command == "browser_dom":
                    # Check if there's a filter argument
                    filter_text = args.strip() if args else None
                    if filter_text:
                        print(f"🔍 Getting DOM elements matching: '{filter_text}'...")
                    else:
                        print("🔍 Getting DOM elements...")
                    result = await self.send_command("browser_get_dom", timeout=45)
                    
                elif command == "browser_get_clickables":
                    # Check if there's a filter argument
                    filter_text = args.strip() if args else None
                    if filter_text:
                        print(f"🎯 Getting clickable elements matching: '{filter_text}'...")
                    else:
                        print("🎯 Getting ALL clickable elements (buttons, links, inputs)...")
                    result = await self.send_command("browser_get_clickables", timeout=30)
                    
                elif command == "browser_click":
                    if args:
                        print(f"🖱️ Clicking element: {args}")
                        result = await self.send_command("browser_click", {"selector": args})
                    else:
                        print("❌ Usage: browser_click <selector>")
                        continue
                        
                elif command == "browser_type":
                    parts = args.split(maxsplit=1)
                    if len(parts) >= 2:
                        selector, text = parts[0], parts[1]
                        print(f"⌨️ Typing in element {selector}: {text}")
                        result = await self.send_command("browser_type", {"selector": selector, "text": text})
                    else:
                        print("❌ Usage: browser_type <selector> <text>")
                        continue
                
                elif command == "browser_execute":
                    if args:
                        print(f"🔧 Executing JavaScript: {args[:100]}...")
                        result = await self.send_command("browser_execute", {"script": args}, timeout=30)
                    else:
                        print("❌ Usage: browser_execute <javascript_code>")
                        continue
                
                elif command == "browser_wait":
                    parts = args.split() if args else []
                    if len(parts) == 0:
                        # Just wait for page load
                        print("⏳ Waiting for page to fully load...")
                        result = await self.send_command("browser_wait", {}, timeout=35)
                    elif len(parts) == 1:
                        # Wait for specific element
                        selector = parts[0]
                        print(f"⏳ Waiting for page load and element: {selector}")
                        result = await self.send_command("browser_wait", {"selector": selector}, timeout=35)
                    else:
                        # Wait with custom timeout
                        selector = parts[0]
                        timeout_val = int(parts[1])
                        print(f"⏳ Waiting for element: {selector} (timeout: {timeout_val}s)")
                        result = await self.send_command("browser_wait", {"selector": selector, "timeout": timeout_val}, timeout=timeout_val+5)
                        
                elif command == "browser_go":
                    if args:
                        print(f"🚀 Navigating to: {args}")
                        result = await self.send_command("browser_navigate", {"url": args}, timeout=45)
                    else:
                        print("❌ Usage: browser_go <url>")
                        continue
                        
                elif command == "browser_info":
                    print("ℹ️ Getting browser information...")
                    result = await self.send_command("browser_info")
                
                elif command == "browser_state":
                    print("📊 Getting comprehensive browser state...")
                    result = await self.send_command("browser_state")
                    
                elif command == "browser_get_context":
                    print("🧠 Getting AI-friendly browser context...")
                    result = await self.send_command("browser_get_context")
                
                # Browser Tab Management Commands
                elif command == "browser_tabs":
                    print("📑 Listing browser tabs...")
                    result = await self.send_command("browser_list_tabs")
                    
                elif command == "browser_new_tab":
                    if args:
                        print(f"📑 Opening new tab with URL: {args}")
                        result = await self.send_command("browser_open_tab", {"url": args})
                    else:
                        print("📑 Opening new blank tab...")
                        result = await self.send_command("browser_open_tab")
                        
                elif command == "browser_close_tab":
                    if args:
                        try:
                            tab_index = int(args)
                            print(f"❌ Closing tab at index {tab_index}...")
                            result = await self.send_command("browser_close_tab", {"tab_index": tab_index})
                        except ValueError:
                            print("❌ Tab index must be a number")
                            continue
                    else:
                        print("❌ Closing current tab...")
                        result = await self.send_command("browser_close_tab")
                        
                elif command == "browser_switch_tab":
                    if args:
                        try:
                            tab_index = int(args)
                            print(f"🔄 Switching to tab at index {tab_index}...")
                            result = await self.send_command("browser_switch_tab", {"tab_index": tab_index})
                        except ValueError:
                            print("❌ Tab index must be a number")
                            continue
                    else:
                        print("❌ Usage: browser_switch_tab <index>")
                        continue
                        
                else:
                    print(f"❌ Unknown command: {command}")
                    print("   Type 'help' for available commands")
                    continue
                
                # Process result
                if result:
                    data = result.get("data", {})
                    
                    if data.get("success"):
                        print("✅ Command executed successfully")
                        
                        # Special handling for different commands
                        if command == "detect_elements":
                            elements = data.get("elements", [])
                            print(f"   Found {len(elements)} elements")
                            
                            # Group elements by type for summary
                            element_types = {}
                            text_elements = []
                            for elem in elements:
                                elem_type = elem.get('type', 'unknown')
                                element_types[elem_type] = element_types.get(elem_type, 0) + 1
                                if 'text' in elem and elem.get('text'):
                                    text_elements.append(elem)
                            
                            print("\n   Element Summary:")
                            for elem_type, count in sorted(element_types.items()):
                                print(f"     • {elem_type}: {count}")
                            
                            print(f"\n   Text Elements Found: {len(text_elements)}")
                            # Show first few text elements
                            for i, elem in enumerate(text_elements[:10], 1):
                                confidence = elem.get('confidence', 0)
                                text_val = elem.get('text', '')
                                text = text_val[:50] if text_val else ''
                                center = elem.get('center', {})
                                print(f"   {i}. \"{text}\" [conf: {confidence:.2f}] @ ({center.get('x')}, {center.get('y')})")
                            
                            if len(text_elements) > 10:
                                print(f"   ... and {len(text_elements) - 10} more text elements")
                                
                        elif command == "screenshot":
                            if data.get("screenshot"):
                                print(f"   Screenshot data size: {len(data.get('screenshot', ''))} bytes")
                                
                        elif command == "ocr":
                            text = data.get("text", "")
                            if text:
                                print(f"   Detected text (first 200 chars):")
                                print(f"   {text[:200]}...")
                        
                        elif command in ["browser_connect", "browser_open"]:
                            if data.get("current_url"):
                                print(f"   Current URL: {data.get('current_url')}")
                                print(f"   Title: {data.get('title')}")
                                print(f"   Tabs: {data.get('tabs')}")
                                if command == "browser_open":
                                    print(f"   Status: Chrome opened and connected successfully")
                        
                        elif command == "browser_get_clickables":
                            # Display clickable elements
                            clickables = data.get('clickables', [])
                            summary = data.get('summary', {})
                            
                            print(f"   URL: {data.get('url', 'Unknown')}")
                            print(f"   Title: {data.get('title', 'Unknown')}")
                            print(f"   Total clickables: {data.get('total', 0)}")
                            
                            if summary:
                                print("\n   Summary:")
                                print(f"     • Buttons: {summary.get('buttons', 0)}")
                                print(f"     • Links: {summary.get('links', 0)}")
                                print(f"     • Inputs: {summary.get('inputs', 0)}")
                                print(f"     • Selects: {summary.get('selects', 0)}")
                                print(f"     • Textareas: {summary.get('textareas', 0)}")
                                print(f"     • Checkboxes: {summary.get('checkboxes', 0)}")
                                print(f"     • Radios: {summary.get('radios', 0)}")
                            
                            if clickables:
                                print(f"\n   Clickable Elements (showing first 20):")
                                for i, elem in enumerate(clickables[:20], 1):
                                    elem_type = elem.get('type', 'unknown')
                                    text = elem.get('text', '')[:50]
                                    selector = elem.get('selector', '')
                                    
                                    # Format display based on type
                                    if elem_type == 'button' or elem_type == 'submit':
                                        icon = "🔘"
                                    elif elem_type == 'link':
                                        icon = "🔗"
                                    elif elem_type in ['text', 'email', 'password', 'search']:
                                        icon = "📝"
                                    elif elem_type == 'checkbox':
                                        icon = "☑️"
                                    elif elem_type == 'radio':
                                        icon = "⭕"
                                    elif elem_type == 'select':
                                        icon = "📋"
                                    else:
                                        icon = "•"
                                    
                                    print(f"   {i:2}. {icon} [{elem_type:10}] {text}")
                                    print(f"       Selector: {selector[:80]}")
                                    
                                    # Show href for links
                                    if elem_type == 'link' and elem.get('attributes', {}).get('href'):
                                        href = elem.get('attributes', {}).get('href', '')[:60]
                                        print(f"       Href: {href}")
                                
                                if len(clickables) > 20:
                                    print(f"\n   ... and {len(clickables) - 20} more clickable elements")
                                    
                        elif command == "browser_dom":
                            # Initialize variables
                            filtered_hierarchy = None
                            filtered_actionable = []
                            
                            # Apply filtering if filter_text was provided
                            if filter_text:
                                import re
                                
                                # Create regex pattern (case-insensitive, handle spaces flexibly)
                                # Replace spaces with \s* to match any whitespace
                                pattern_text = filter_text.replace(' ', r'\s*')
                                try:
                                    pattern = re.compile(pattern_text, re.IGNORECASE)
                                except re.error:
                                    # If regex fails, use simple string matching
                                    pattern = None
                                
                                # Function to filter hierarchy recursively
                                def filter_hierarchy(node, parent_matched=False):
                                    if not node:
                                        return None
                                    
                                    # Check if current node matches
                                    node_matched = False
                                    if node.get('text'):
                                        if pattern:
                                            node_matched = pattern.search(node.get('text', '')) is not None
                                        else:
                                            node_matched = filter_text.lower() in node.get('text', '').lower()
                                    
                                    # Check if any child matches
                                    children_results = []
                                    has_matching_child = False
                                    if node.get('children'):
                                        for child in node.get('children', []):
                                            filtered_child = filter_hierarchy(child, node_matched or parent_matched)
                                            if filtered_child:
                                                children_results.append(filtered_child)
                                                has_matching_child = True
                                    
                                    # Include node if it matches OR has matching children OR parent matched
                                    if node_matched or has_matching_child or parent_matched:
                                        filtered_node = node.copy()
                                        if children_results:
                                            filtered_node['children'] = children_results
                                        elif 'children' in filtered_node:
                                            # Keep all children if parent matched
                                            if parent_matched or node_matched:
                                                pass  # Keep original children
                                            else:
                                                del filtered_node['children']
                                        
                                        # Add match indicator
                                        if node_matched:
                                            filtered_node['__matched__'] = True
                                        
                                        return filtered_node
                                    
                                    return None
                                
                                # Filter actionable elements
                                filtered_actionable = []
                                for elem in data.get('actionable_elements', []):
                                    elem_text = elem.get('text', '') + ' ' + elem.get('context', '')
                                    if pattern and pattern.search(elem_text):
                                        filtered_actionable.append(elem)
                                    elif not pattern and filter_text.lower() in elem_text.lower():
                                        filtered_actionable.append(elem)
                                
                                # Filter text elements
                                filtered_text_elements = []
                                for elem in data.get('text_elements', []):
                                    elem_text = elem.get('text', '') + ' ' + elem.get('context', '')
                                    if pattern and pattern.search(elem_text):
                                        filtered_text_elements.append(elem)
                                    elif not pattern and filter_text.lower() in elem_text.lower():
                                        filtered_text_elements.append(elem)
                                
                                # Filter hierarchy
                                filtered_hierarchy = filter_hierarchy(data.get('hierarchy', {}))
                                
                                # Update data with filtered results
                                data['hierarchy'] = filtered_hierarchy
                                data['actionable_elements'] = filtered_actionable
                                data['text_elements'] = filtered_text_elements
                                data['filter_applied'] = filter_text
                                data['matches_found'] = {
                                    'actionable': len(filtered_actionable),
                                    'text': len(filtered_text_elements)
                                }
                                
                                print(f"\n   🔍 Filter: '{filter_text}'")
                                print(f"   📊 Matches: {len(filtered_actionable)} actionable, {len(filtered_text_elements)} text elements")
                            
                            # Save to file
                            file_path = "output.json"
                            with open(file_path, "w") as f:
                                json.dump(data, f, indent=4)
                            
                            print(f"\n   📄 Page: {data.get('page_info', {}).get('title', 'Unknown')}")
                            print(f"   🌐 URL: {data.get('page_info', {}).get('url', 'Unknown')}")
                            
                            # Display filtered results
                            if filter_text and filtered_actionable:
                                print(f"\n   🎯 Matching Actionable Elements:")
                                for elem in filtered_actionable[:10]:  # Show first 10
                                    elem_id = elem.get('id', '')
                                    text = elem.get('text', '')[:50]
                                    context = elem.get('context', '')[:30] if elem.get('context') else ''
                                    selector = elem.get('selector', '')
                                    
                                    print(f"\n     {elem_id}: \"{text}\"")
                                    if context:
                                        print(f"       Context: {context}")
                                    print(f"       Selector: {selector}")
                                    print(f"       Use: browser_click \"{selector}\"")
                                
                                if len(filtered_actionable) > 10:
                                    print(f"\n     ... and {len(filtered_actionable) - 10} more matches")
                            
                            # Display hierarchy summary
                            if filtered_hierarchy:
                                print(f"\n   🌳 Filtered Page Structure:")
                                
                                def print_filtered_hierarchy(node, indent=0, max_depth=3):
                                    if not node or indent > max_depth:
                                        return
                                    
                                    # Only print if node has text or is matched
                                    if node.get('text') or node.get('__matched__'):
                                        prefix = "   " + "  " * indent + "• "
                                        text = node.get('text', '')[:60] if node.get('text') else '[Container]'
                                        
                                        # Highlight matched nodes
                                        if node.get('__matched__'):
                                            print(f"{prefix}⭐ {text}")
                                        else:
                                            print(f"{prefix}{text}")
                                        
                                        # Show selector for matched interactive elements
                                        if node.get('__matched__') and node.get('interactive'):
                                            selector_prefix = "   " + "  " * (indent + 1) + "→ "
                                            print(f"{selector_prefix}Selector: {node.get('selector', '')}")
                                    
                                    # Print children
                                    for child in node.get('children', [])[:5]:
                                        print_filtered_hierarchy(child, indent + 1, max_depth)
                                
                                print_filtered_hierarchy(filtered_hierarchy)
                            elif filter_text:
                                print(f"\n   ⚠️ No matches found for '{filter_text}'")
                            else:
                                # No filter, show full hierarchy
                                hierarchy = data.get('hierarchy', {})
                                print(f"\n   Full hierarchy saved to {file_path}")
                        elif command == "browser_info":
                            print(f"   URL: {data.get('current_url')}")
                            print(f"   Title: {data.get('title')}")
                            print(f"   Windows: {data.get('window_handles')}")
                            print(f"   Ready: {data.get('ready_state')}")
                            if data.get('page_metrics'):
                                metrics = data.get('page_metrics')
                                print(f"   Page size: {metrics.get('scroll_width')}x{metrics.get('scroll_height')}")
                                print(f"   Viewport: {metrics.get('viewport_width')}x{metrics.get('viewport_height')}")
                        
                        elif command == "browser_state":
                            state = data.get('state', {})
                            print(f"\n   🌐 Page: {state.get('title', 'Unknown')}")
                            print(f"   URL: {state.get('url', 'Unknown')}")
                            print(f"   Ready: {state.get('ready_state', 'Unknown')}, Visible: {state.get('visibility', 'Unknown')}, Has Focus: {state.get('has_focus', False)}")
                            
                            # Active element (focus)
                            active = state.get('active_element', {})
                            if active:
                                print(f"\n   🎯 Focus/Cursor:")
                                print(f"     Tag: {active.get('tag', 'unknown')}")
                                if active.get('id'):
                                    print(f"     ID: {active.get('id')}")
                                if active.get('type'):
                                    print(f"     Type: {active.get('type')}")
                                if active.get('value'):
                                    print(f"     Value: {active.get('value', '')[:50]}")
                                if active.get('rect'):
                                    rect = active.get('rect')
                                    print(f"     Position: ({rect.get('x')}, {rect.get('y')}) Size: {rect.get('width')}x{rect.get('height')}")
                                print(f"     Editable: {active.get('is_editable', False)}")
                            
                            # Mouse position
                            mouse = state.get('mouse', {})
                            if mouse.get('x') is not None:
                                print(f"\n   🖱️ Mouse Position: ({mouse.get('x')}, {mouse.get('y')})")
                            
                            # Scroll position
                            scroll = state.get('scroll', {})
                            print(f"\n   📜 Scroll:")
                            print(f"     Position: ({scroll.get('x', 0)}, {scroll.get('y', 0)})")
                            print(f"     Page Size: {scroll.get('width', 0)}x{scroll.get('height', 0)}")
                            print(f"     Viewport: {scroll.get('viewport_width', 0)}x{scroll.get('viewport_height', 0)}")
                            print(f"     At Top: {scroll.get('at_top', False)}, At Bottom: {scroll.get('at_bottom', False)}")
                            
                            # Interactive elements
                            interactive = state.get('interactive', {})
                            if interactive:
                                print(f"\n   🎮 Interactive Elements:")
                                print(f"     Buttons: {interactive.get('buttons', 0)}")
                                print(f"     Links: {interactive.get('links', 0)}")
                                print(f"     Inputs: {interactive.get('inputs', 0)}")
                                print(f"     Images: {interactive.get('images', 0)}")
                            
                            # Forms
                            forms = state.get('forms', [])
                            if forms:
                                print(f"\n   📝 Forms: {len(forms)}")
                                for form in forms[:3]:
                                    print(f"     - {form.get('name', 'unnamed')} ({form.get('fields', 0)} fields)")
                            
                            # Loading indicators
                            loading = state.get('loading_indicators', {})
                            if loading.get('spinners', 0) > 0 or loading.get('progress_bars', 0) > 0:
                                print(f"\n   ⏳ Loading: {loading.get('spinners', 0)} spinners, {loading.get('progress_bars', 0)} progress bars")
                            
                            # Alerts
                            if state.get('has_alert'):
                                print(f"\n   ⚠️ Alert: {state.get('alert_text', 'Unknown')}")
                        
                        elif command == "browser_get_context":
                            context = data.get('context', {})
                            summary = data.get('summary', '')
                            
                            print(f"\n   🤖 AI Context Summary: {summary}")
                            
                            print(f"\n   🌐 Page: {context.get('title', 'Unknown')}")
                            print(f"   URL: {context.get('url', 'Unknown')}")
                            
                            # Page context
                            page_ctx = context.get('page_context', {})
                            if page_ctx:
                                print(f"\n   📚 Page Type: {page_ctx.get('type', 'unknown')}")
                                if page_ctx.get('indicators'):
                                    print(f"   Indicators: {', '.join(page_ctx.get('indicators', []))}")
                                if page_ctx.get('has_forms'):
                                    print(f"   Forms: {page_ctx.get('form_fields', 0)} fields")
                            
                            # Visible text
                            if context.get('visible_text'):
                                text = context.get('visible_text', '')
                                if len(text) > 200:
                                    text = text[:200] + '...'
                                print(f"\n   👁️ Visible Text: {text}")
                            
                            # Focused element
                            focused = context.get('focused_element')
                            if focused and focused.get('tag'):
                                print(f"\n   🎯 Focused: {focused.get('tag')}")
                                if focused.get('id'):
                                    print(f"     ID: {focused.get('id')}")
                                if focused.get('value'):
                                    print(f"     Value: {focused.get('value', '')[:50]}")
                            
                            # Actionable elements
                            actionable = context.get('actionable_elements', [])
                            if actionable:
                                print(f"\n   🎮 Actionable Elements (top 10):")
                                for i, elem in enumerate(actionable[:10], 1):
                                    label = elem.get('label', '')
                                    if not label:
                                        label = f"[{elem.get('type', 'unknown')}]"
                                    pos = elem.get('position', {})
                                    print(f"   {i:2}. {label[:40]:40} at ({pos.get('x', 0)}, {pos.get('y', 0)})")
                                    if elem.get('selector'):
                                        print(f"       Selector: {elem.get('selector')}")
                                
                                if len(actionable) > 10:
                                    print(f"   ... and {len(actionable) - 10} more")
                            
                            # Interaction status
                            if context.get('user_can_interact'):
                                print(f"\n   ✅ Page is ready for interaction")
                            else:
                                print(f"\n   ⏳ Page is not ready for interaction")
                        
                        elif command == "browser_click":
                            # Enhanced browser_click output
                            if data.get('element'):
                                elem = data.get('element', {})
                                print(f"\n   🎯 Clicked Element:")
                                print(f"     Tag: {elem.get('tag', 'unknown')}")
                                if elem.get('id'):
                                    print(f"     ID: {elem.get('id')}")
                                if elem.get('text'):
                                    print(f"     Text: {elem.get('text', '')[:50]}")
                                pos = elem.get('position', {})
                                print(f"     Position: ({pos.get('x', 0)}, {pos.get('y', 0)})")
                                print(f"     Click Method: {data.get('click_method', 'unknown')}")
                            
                            # State changes
                            changes = data.get('changes', {})
                            if changes.get('detected'):
                                print(f"\n   🔄 Changes Detected: {changes.get('summary', '')}")
                                
                                if changes.get('url_changed'):
                                    print(f"     Navigation: {changes['url_changed'].get('to', '')}")
                                
                                if changes.get('focus'):
                                    new_focus = changes['focus'].get('to', {})
                                    print(f"     Focus moved to: {new_focus.get('tag', 'unknown')}")
                                    if new_focus.get('id'):
                                        print(f"       ID: {new_focus.get('id')}")
                                
                                if changes.get('scroll'):
                                    scroll_info = changes.get('scroll', {})
                                    print(f"     Scrolled {scroll_info.get('direction', '')} to Y: {scroll_info.get('to_y', 0)}")
                                
                                if changes.get('alert'):
                                    print(f"     Alert: {changes.get('alert', '')}")
                            else:
                                print(f"\n   ✅ Click successful - {data.get('message', '')}")
                            
                            # Nearby elements
                            nearby = data.get('nearby_elements', [])
                            if nearby:
                                print(f"\n   🔍 Nearby Elements:")
                                for elem in nearby[:3]:
                                    print(f"     - {elem.get('tag', '')}: {elem.get('text', '')[:30]}")
                        
                        elif command == "browser_tabs":
                            tabs = data.get('tabs', [])
                            total = data.get('total_tabs', 0)
                            current_index = data.get('current_tab_index', 0)
                            
                            print(f"   Total tabs: {total}")
                            print(f"   Current tab: #{current_index}")
                            
                            if tabs:
                                print("\n   Open Tabs:")
                                print("   " + "-"*70)
                                for tab in tabs:
                                    index = tab.get('index', 0)
                                    url = tab.get('url', 'Unknown')[:50]
                                    title = tab.get('title', 'Untitled')[:40]
                                    is_current = tab.get('is_current', False)
                                    
                                    marker = "→" if is_current else " "
                                    print(f"   {marker} [{index}] {title}")
                                    print(f"        URL: {url}")
                                print("   " + "-"*70)
                                
                        elif command == "browser_new_tab":
                            print(f"   New tab opened")
                            print(f"   URL: {data.get('url', 'blank')}")
                            print(f"   Title: {data.get('title', 'New Tab')}")
                            print(f"   Total tabs: {data.get('total_tabs', 1)}")
                            
                        elif command == "browser_close_tab":
                            print(f"   Tab closed")
                            print(f"   Remaining tabs: {data.get('remaining_tabs', 0)}")
                            print(f"   Current URL: {data.get('current_url', 'Unknown')}")
                            print(f"   Current Title: {data.get('current_title', 'Unknown')}")
                            
                        elif command == "browser_switch_tab":
                            tab_index = data.get('tab_index', 0)
                            print(f"   Switched to tab #{tab_index}")
                            print(f"   URL: {data.get('url', 'Unknown')}")
                            print(f"   Title: {data.get('title', 'Unknown')}")
                            print(f"   Total tabs: {data.get('total_tabs', 1)}")
                                
                        # Terminal command results
                        elif command == "terminal_connect":
                            if data.get("pid"):
                                print(f"   Terminal PID: {data.get('pid')}")
                            if data.get("status"):
                                status = data.get('status')
                                if status == "connected_to_existing":
                                    print(f"   ✅ Status: Connected to existing session")
                                elif status == "created_new_session":
                                    print(f"   🆕 Status: Created new terminal session")
                                else:
                                    print(f"   Status: {status}")
                            if data.get("working_directory"):
                                print(f"   Working Directory: {data.get('working_directory')}")
                            if data.get("history_count"):
                                print(f"   Command History: {data.get('history_count')} commands")
                            if data.get("output"):
                                print("   Current output:")
                                print("   " + "-"*40)
                                output = data.get("output", "")
                                # Clean terminal escape codes
                                import re
                                clean_output = re.sub(r'\x1b\[[0-9;]*m', '', output)
                                lines = clean_output.split('\n')
                                # Show last 10 lines
                                for line in lines[-10:]:
                                    if line.strip():
                                        print(f"   {line}")
                                
                        elif command == "terminal_execute":
                            if data.get("command"):
                                print(f"   Command: {data.get('command')}")
                            if data.get("output"):
                                print("   Output:")
                                print("   " + "-"*40)
                                output = data.get("output", "")
                                # Clean up terminal escape codes for readability
                                import re
                                clean_output = re.sub(r'\x1b\[[0-9;]*m', '', output)
                                # Show all output lines
                                for line in clean_output.split('\n'):
                                    print(f"   {line}")
                                print("   " + "-"*40)
                            elif data.get("message"):
                                print(f"   {data.get('message')}")
                                
                        elif command == "terminal_read":
                            if data.get("last_command"):
                                print(f"   Last command: {data.get('last_command')}")
                            if data.get("output"):
                                print("   Output:")
                                print("   " + "-"*40)
                                output = data.get("output", "")
                                import re
                                clean_output = re.sub(r'\x1b\[[0-9;]*m', '', output)
                                # Show all output lines
                                for line in clean_output.split('\n'):
                                    print(f"   {line}")
                                print("   " + "-"*40)
                            if data.get("recent_history"):
                                print(f"\n   Recent history: {len(data.get('recent_history', []))} commands")
                                for entry in data.get("recent_history", [])[:3]:  # Show last 3 commands
                                    print(f"     > {entry.get('command')}")
                                    
                        elif command == "terminal_type":
                            if data.get("text"):
                                print(f"   Typed: {data.get('text')}")
                            if data.get("current_line"):
                                print(f"   Current line: {data.get('current_line')}")
                                
                        elif command in ["terminal_clear", "terminal_close"]:
                            if data.get("message"):
                                print(f"   {data.get('message')}")
                                
                        # File operation command results
                        elif command == "file_read":
                            if data.get("content") is not None:
                                print("   File contents:")
                                print("   " + "-"*40)
                                content = data.get("content", "")
                                for line in content.split('\n'):
                                    print(f"   {line}")
                                print("   " + "-"*40)
                                print(f"   Total: {len(content)} bytes, {len(content.split(chr(10)))} lines")
                            elif data.get("message"):
                                print(f"   {data.get('message')}")
                                
                        elif command == "file_write":
                            if data.get("filepath"):
                                print(f"   File written: {data.get('filepath')}")
                            if data.get("bytes_written"):
                                print(f"   Bytes written: {data.get('bytes_written')}")
                            if data.get("message"):
                                print(f"   {data.get('message')}")
                                
                        elif command == "file_edit":
                            if data.get("filepath"):
                                print(f"   File edited: {data.get('filepath')}")
                            if data.get("replacements"):
                                print(f"   Replacements made: {data.get('replacements')}")
                            if data.get("message"):
                                print(f"   {data.get('message')}")
                                
                        elif command == "file_append":
                            if data.get("filepath"):
                                print(f"   File appended: {data.get('filepath')}")
                            if data.get("bytes_appended"):
                                print(f"   Bytes appended: {data.get('bytes_appended')}")
                            if data.get("message"):
                                print(f"   {data.get('message')}")
                                
                        elif command == "file_delete":
                            if data.get("filepath"):
                                print(f"   File deleted: {data.get('filepath')}")
                            if data.get("message"):
                                print(f"   {data.get('message')}")
                                
                        elif command == "file_exists":
                            if data.get("filepath"):
                                print(f"   File: {data.get('filepath')}")
                            exists = data.get("exists")
                            if exists is not None:
                                print(f"   Exists: {'✅ Yes' if exists else '❌ No'}")
                                if exists and data.get("size") is not None:
                                    print(f"   Size: {data.get('size')} bytes")
                                if exists and data.get("is_directory") is not None:
                                    print(f"   Type: {'Directory' if data.get('is_directory') else 'File'}")
                            if data.get("message"):
                                print(f"   {data.get('message')}")
                        
                        elif command == "directory_list":
                            if data.get("dirpath"):
                                print(f"   Directory: {data.get('dirpath')}")
                            
                            summary = data.get("summary", {})
                            if summary:
                                print(f"   Total: {summary.get('total_items', 0)} items")
                                print(f"   Directories: {summary.get('directories', 0)}")
                                print(f"   Files: {summary.get('files', 0)}")
                                print(f"   Total size: {summary.get('total_size', 0)} bytes")
                            
                            items = data.get("items", [])
                            if items:
                                print("\n   Contents:")
                                print("   " + "-"*60)
                                # Show directories first
                                dirs = [i for i in items if i.get('type') == 'directory']
                                files = [i for i in items if i.get('type') == 'file']
                                
                                for item in dirs[:10]:  # Show first 10 directories
                                    name = item.get('name', 'Unknown')
                                    item_count = item.get('item_count', 0)
                                    modified = item.get('modified', '')
                                    print(f"   📁 {name:30} [{item_count} items] {modified}")
                                
                                if len(dirs) > 10:
                                    print(f"   ... and {len(dirs) - 10} more directories")
                                
                                for item in files[:15]:  # Show first 15 files
                                    name = item.get('name', 'Unknown')
                                    size = item.get('size', 0)
                                    modified = item.get('modified', '')
                                    # Format size nicely
                                    if size > 1024*1024:
                                        size_str = f"{size/(1024*1024):.1f}MB"
                                    elif size > 1024:
                                        size_str = f"{size/1024:.1f}KB"
                                    else:
                                        size_str = f"{size}B"
                                    print(f"   📄 {name:30} {size_str:8} {modified}")
                                
                                if len(files) > 15:
                                    print(f"   ... and {len(files) - 15} more files")
                                print("   " + "-"*60)
                        
                        elif command == "directory_delete":
                            if data.get("dirpath"):
                                print(f"   Directory: {data.get('dirpath')}")
                            if data.get("message"):
                                print(f"   {data.get('message')}")
                                
                        elif command == "list_windows":
                            windows = data.get('windows', [])
                            active = data.get('active_window', 'Unknown')
                            print(f"   Active window: {active}")
                            print(f"   Total windows: {data.get('window_count', 0)}")
                            if windows:
                                print("\n   Windows:")
                                for i, window in enumerate(windows, 1):
                                    title = window.get('title', 'Untitled')[:60]
                                    wid = window.get('id', '')
                                    desktop = window.get('desktop', '')
                                    print(f"   {i}. {title}")
                                    if wid:
                                        print(f"      ID: {wid}, Desktop: {desktop}")
                                        
                        elif command == "switch_window":
                            print(f"   Switched to: {data.get('window', 'Unknown')}")
                            
                        elif command == "arrange":
                            print(f"   Arrangement: {data.get('arrangement', 'Unknown')}")
                            print(f"   Windows arranged successfully")
                            
                        elif command in ["close_window", "minimize_window", "maximize_window", "restore_window"]:
                            window = data.get('window', 'current')
                            print(f"   Window: {window}")
                            print(f"   Action completed: {data.get('action', command)}")
                            
                        elif command == "move_window":
                            pos = data.get('position', {})
                            window = data.get('window', 'current')
                            print(f"   Window: {window}")
                            print(f"   New position: ({pos.get('x')}, {pos.get('y')})")
                            if pos.get('width') and pos.get('height'):
                                print(f"   New size: {pos.get('width')}x{pos.get('height')}")
                                
                    else:
                        error = data.get("error", "Unknown error")
                        print(f"❌ Command failed: {error}")
                else:
                    print("⚠️ No response received")
                        
            except KeyboardInterrupt:
                print("\n\n👋 Interrupted by user. Goodbye!")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
                logger.error(f"Interactive loop error: {e}", exc_info=True)
                
        # Cleanup
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
        if self.ws:
            await self.ws.close()
            print("✓ Connection closed")

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Interactive AI Desktop Agent Client")
    parser.add_argument(
        "--url",
        default="ws://localhost:8081",
        help="WebSocket URL (default: ws://localhost:8081)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )
    
    args = parser.parse_args()
    
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    client = InteractiveClient(args.url)
    await client.interactive_loop()

if __name__ == "__main__":
    if sys.platform == "win32":
        # Windows-specific event loop policy
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        logger.error(f"Fatal error: {e}", exc_info=True)