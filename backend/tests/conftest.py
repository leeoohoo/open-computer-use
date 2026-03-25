"""
Shared fixtures for scheduling, locking, and cancellation tests.
"""
import os
import sys

# Ensure app/ is on sys.path so that `computer_use_agent` is importable
# alongside `app.services.*` (which uses `app/` as a package).
_app_dir = os.path.join(os.path.dirname(__file__), os.pardir, "app")
if _app_dir not in sys.path:
    sys.path.insert(0, os.path.abspath(_app_dir))
