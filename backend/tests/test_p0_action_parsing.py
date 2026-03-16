"""Tests for P0 action code string parsing in cua_action_bridge."""

import pytest

from app.services.cua_action_bridge import parse_pyautogui_code


class TestP0ActionParsing:
    """Verify that P0 action code strings are correctly parsed by parse_pyautogui_code."""

    def test_request_help_parsed(self):
        """request_help('desc') should parse to action_type='request_help'."""
        actions = parse_pyautogui_code('request_help("I am stuck on the CAPTCHA")')
        assert len(actions) == 1
        assert actions[0].action_type == "request_help"
        assert actions[0].params["description"] == "I am stuck on the CAPTCHA"

    def test_request_help_single_quotes(self):
        actions = parse_pyautogui_code("request_help('need help with login')")
        assert len(actions) == 1
        assert actions[0].action_type == "request_help"
        assert actions[0].params["description"] == "need help with login"

    def test_wait_for_dependency_with_description(self):
        actions = parse_pyautogui_code('wait_for_dependency("product_urls", "Need URLs to compare")')
        assert len(actions) == 1
        assert actions[0].action_type == "wait_for_dependency"
        assert actions[0].params["key"] == "product_urls"
        assert actions[0].params["description"] == "Need URLs to compare"

    def test_wait_for_dependency_without_description(self):
        actions = parse_pyautogui_code('wait_for_dependency("auth_token")')
        assert len(actions) == 1
        assert actions[0].action_type == "wait_for_dependency"
        assert actions[0].params["key"] == "auth_token"
        assert actions[0].params["description"] == ""

    def test_claim_expertise(self):
        actions = parse_pyautogui_code('claim_expertise("spreadsheets")')
        assert len(actions) == 1
        assert actions[0].action_type == "claim_expertise"
        assert actions[0].params["domain"] == "spreadsheets"

    def test_propose_decision(self):
        actions = parse_pyautogui_code('propose_decision("Which format?", "CSV, Excel, Google Sheets")')
        assert len(actions) == 1
        assert actions[0].action_type == "propose_decision"
        assert actions[0].params["question"] == "Which format?"
        assert actions[0].params["options"] == "CSV, Excel, Google Sheets"

    def test_resume_own_task(self):
        actions = parse_pyautogui_code("resume_own_task()")
        assert len(actions) == 1
        assert actions[0].action_type == "resume_own_task"
        assert actions[0].params == {}

    def test_p0_action_not_parsed_as_raw(self):
        """P0 actions should NOT fall back to raw execution."""
        for code in [
            'request_help("help")',
            'wait_for_dependency("key")',
            'claim_expertise("domain")',
            'propose_decision("q", "opts")',
            "resume_own_task()",
        ]:
            actions = parse_pyautogui_code(code)
            assert actions[0].action_type != "raw", f"{code} was parsed as raw"

    def test_p0_action_mixed_with_desktop(self):
        """P0 action alongside desktop action should both parse."""
        code = 'pyautogui.click(100, 200)\nrequest_help("stuck after clicking")'
        actions = parse_pyautogui_code(code)
        types = [a.action_type for a in actions]
        assert "click" in types
        assert "request_help" in types
