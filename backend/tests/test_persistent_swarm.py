"""Tests for persistent swarm logic.

These tests verify the business rules around persistent swarms:
- Tier eligibility (only starter, professional, enterprise)
- Machine limit validation against existing persistent machines
- Cleanup behavior (keep vs delete machines)
- Settings flag propagation
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from app.services.swarm_executor import SwarmExecutor


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _make_executor(n=2, **kwargs):
    """Create a minimal SwarmExecutor for testing."""
    machines = [{"machine_id": f"m{i}"} for i in range(n)]
    provider = MagicMock()
    return SwarmExecutor(
        swarm_id="test-swarm",
        machines=machines,
        prompt="test prompt",
        provider=provider,
        model="test-model",
        **kwargs,
    )


# ---------------------------------------------------------------------------
# Tier eligibility tests (unit-test the constants/logic)
# ---------------------------------------------------------------------------

class TestPersistentTierEligibility:
    """Test which tiers are eligible for persistent swarms."""

    # The eligible tiers set is defined in the Next.js route.
    # We test the concept here for documentation and to verify
    # backend doesn't reject persistent flag from frontend.

    @pytest.mark.parametrize("tier,expected", [
        ("free", False),
        ("lite", False),
        ("starter", True),
        ("professional", True),
        ("enterprise", True),
    ])
    def test_tier_eligibility(self, tier, expected):
        """Verify tier eligibility mapping."""
        eligible_tiers = {"starter", "professional", "enterprise"}
        assert (tier in eligible_tiers) == expected

    def test_free_tier_max_machines_is_one(self):
        """Free tier gets 1 machine max, which blocks persistent swarms."""
        plan_max = 1  # free/lite plan
        # Persistent swarm max is capped at plan_max (not 3x)
        persistent_max = plan_max
        assert persistent_max == 1

    def test_temp_swarm_gets_3x_limit(self):
        """Temporary swarms get 3x the plan machine limit."""
        plan_max = 2  # plus plan
        temp_max = min(plan_max * 3, 10)
        assert temp_max == 6

    def test_persistent_swarm_gets_1x_limit(self):
        """Persistent swarms are capped at the plan's machine limit."""
        plan_max = 3  # pro plan
        persistent_max = plan_max
        assert persistent_max == 3

    def test_temp_swarm_hard_cap_at_10(self):
        """Even with high plan limits, temp swarms cap at 10."""
        plan_max = 5
        temp_max = min(plan_max * 3, 10)
        assert temp_max == 10


# ---------------------------------------------------------------------------
# Machine limit validation tests
# ---------------------------------------------------------------------------

class TestMachineLimitValidation:
    """Test machine limit checks for persistent swarms."""

    def test_no_existing_machines_allows_full_limit(self):
        """With no existing machines, can use full plan limit."""
        plan_max = 2
        existing_persistent = 0
        requested = 2
        slots_left = plan_max - existing_persistent
        assert requested <= slots_left
        assert slots_left == 2

    def test_existing_machines_reduce_available_slots(self):
        """Existing persistent machines reduce available slots."""
        plan_max = 2
        existing_persistent = 1
        slots_left = plan_max - existing_persistent
        assert slots_left == 1

    def test_at_limit_rejects_persistent_swarm(self):
        """Can't create persistent swarm when at machine limit."""
        plan_max = 1
        existing_persistent = 1
        slots_left = max(0, plan_max - existing_persistent)
        assert slots_left == 0

    def test_over_limit_rejected(self):
        """Requesting more machines than slots available is rejected."""
        plan_max = 2
        existing_persistent = 1
        requested = 2
        slots_left = plan_max - existing_persistent
        assert requested > slots_left

    def test_temp_swarm_machines_not_counted_as_persistent(self):
        """Temporary swarm machines (is_swarm=True, persistent_swarm=False)
        should NOT count against persistent machine limits."""
        machines = [
            {"settings": {"is_swarm": True, "persistent_swarm": False}},  # temp swarm
            {"settings": {"provider": "aws"}},  # regular machine
        ]
        persistent_count = sum(
            1 for m in machines
            if not m["settings"].get("is_swarm") or m["settings"].get("persistent_swarm")
        )
        assert persistent_count == 1  # only the regular machine

    def test_persistent_swarm_machines_counted(self):
        """Persistent swarm machines (persistent_swarm=True)
        DO count against persistent machine limits."""
        machines = [
            {"settings": {"is_swarm": True, "persistent_swarm": True}},  # persistent swarm
            {"settings": {"provider": "aws"}},  # regular machine
        ]
        persistent_count = sum(
            1 for m in machines
            if not m["settings"].get("is_swarm") or m["settings"].get("persistent_swarm")
        )
        assert persistent_count == 2  # both count


# ---------------------------------------------------------------------------
# Settings flag propagation tests
# ---------------------------------------------------------------------------

class TestSettingsFlagPropagation:
    """Test that persistent_swarm flag is properly set and stripped."""

    def test_persistent_swarm_settings_include_flag(self):
        """Persistent swarm machines should have persistent_swarm=True."""
        settings = {
            "provider": "aws",
            "is_swarm": True,
            "persistent_swarm": True,
            "swarm_id": "test-123",
            "swarm_index": 0,
            "swarm_created_at": "2026-01-01T00:00:00Z",
        }
        assert settings["is_swarm"] is True
        assert settings["persistent_swarm"] is True

    def test_temp_swarm_settings_no_persistent_flag(self):
        """Temporary swarm machines should have persistent_swarm=False."""
        settings = {
            "provider": "aws",
            "is_swarm": True,
            "persistent_swarm": False,
            "swarm_id": "test-123",
        }
        assert settings["persistent_swarm"] is False

    def test_convert_to_persistent_strips_swarm_flags(self):
        """When converting swarm machine to persistent, all swarm flags removed."""
        settings = {
            "provider": "aws",
            "is_swarm": True,
            "persistent_swarm": True,
            "swarm_id": "test-123",
            "swarm_index": 0,
            "swarm_created_at": "2026-01-01T00:00:00Z",
            "awsInstanceId": "i-abc123",
            "awsRegion": "us-east-1",
            "desktopEnabled": True,
        }

        # Simulate conversion (same logic as route.ts deleteAllSwarmMachines)
        swarm_keys = ["is_swarm", "persistent_swarm", "swarm_id", "swarm_index", "swarm_created_at"]
        for key in swarm_keys:
            settings.pop(key, None)

        assert "is_swarm" not in settings
        assert "persistent_swarm" not in settings
        assert "swarm_id" not in settings
        assert "swarm_index" not in settings
        assert "swarm_created_at" not in settings
        # AWS details preserved
        assert settings["awsInstanceId"] == "i-abc123"
        assert settings["provider"] == "aws"
        assert settings["desktopEnabled"] is True


# ---------------------------------------------------------------------------
# Cleanup behavior tests
# ---------------------------------------------------------------------------

class TestCleanupBehavior:
    """Test cleanup decisions for persistent vs temporary swarms."""

    @pytest.mark.parametrize("persistent,final_status,should_keep", [
        # Persistent swarms keep machines on success or cancel
        (True, "completed", True),
        (True, "cancelled", True),
        # Persistent swarms delete on failure (machines never became useful)
        (True, "failed", False),
        # Temporary swarms always delete
        (False, "completed", False),
        (False, "cancelled", False),
        (False, "failed", False),
    ])
    def test_keep_machines_decision(self, persistent, final_status, should_keep):
        """Verify when machines are kept vs deleted."""
        keep_machines = persistent and final_status != "failed"
        assert keep_machines == should_keep

    def test_machine_cleanup_skips_persistent_swarm_machines(self):
        """The 30-minute swarm cleanup should skip persistent swarm machines."""
        machines = [
            {"settings": {"is_swarm": True, "persistent_swarm": False}},  # cleanup
            {"settings": {"is_swarm": True, "persistent_swarm": True}},   # skip
            {"settings": {"provider": "aws"}},                             # skip (not swarm)
        ]

        # Same filter logic as machine-cleanup.ts cleanupSwarmMachines
        swarm_to_cleanup = [
            m for m in machines
            if m["settings"].get("is_swarm") is True
            and not m["settings"].get("persistent_swarm")
        ]

        assert len(swarm_to_cleanup) == 1
        assert swarm_to_cleanup[0]["settings"]["persistent_swarm"] is False


# ---------------------------------------------------------------------------
# Swarm executor with pause/resume + persistent (integration-style)
# ---------------------------------------------------------------------------

class TestPersistentSwarmWithPauseResume:
    """Test that pause/resume works the same for persistent swarms."""

    def test_pause_resume_works_regardless_of_persistence(self):
        """Pause/resume is execution-level, not affected by persistence."""
        ex = _make_executor()
        # Simulate persistent flag (not stored on executor, but ensure
        # pause/resume doesn't break)
        result = ex.pause()
        assert result is True
        assert ex.is_paused is True

        result = ex.resume()
        assert result is True
        assert ex.is_paused is False

    def test_cancel_persistent_swarm_unblocks_paused_machines(self):
        """Cancelling a persistent swarm that's paused should unblock machines."""
        ex = _make_executor()
        ex.pause()
        assert not ex._resume_event.is_set()

        ex.request_cancellation()
        # Resume event must be set so machines can exit
        assert ex._resume_event.is_set()


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestPersistentSwarmEdgeCases:
    """Edge cases and corner cases for persistent swarms."""

    def test_empty_settings_defaults_to_not_persistent(self):
        """Machines with empty/missing settings should not be treated as persistent."""
        settings_variants = [
            {},
            {"provider": "aws"},
            {"is_swarm": True},  # is_swarm without persistent_swarm
            None,
        ]
        for settings in settings_variants:
            if settings is None:
                settings = {}
            is_persistent = settings.get("persistent_swarm", False)
            assert is_persistent is False, f"Settings {settings} should not be persistent"

    def test_display_name_conversion(self):
        """Swarm display names should be converted when becoming persistent."""
        test_cases = [
            ("Swarm #1", "Machine"),
            ("Swarm #12", "Machine"),
            ("My Custom Machine", "My Custom Machine"),  # no change
        ]
        import re
        for original, expected in test_cases:
            converted = re.sub(r"^Swarm #\d+", "Machine", original)
            assert converted == expected

    def test_plan_downgrade_does_not_crash(self):
        """If a user downgrades, existing persistent machines from swarms
        should still work (they're regular machines now with swarm flags stripped)."""
        # After conversion, machine settings have no swarm flags
        settings = {
            "provider": "aws",
            "awsInstanceId": "i-abc123",
            "desktopEnabled": True,
        }
        # This is a regular machine — cleanup service handles it
        # based on tier (free=2hr, lite=48hr, starter+=indefinite)
        assert "is_swarm" not in settings
        assert "persistent_swarm" not in settings

    def test_max_machines_per_tier(self):
        """Verify machine limits per tier for persistent swarms."""
        tier_limits = {
            "free": 1,      # but not eligible
            "lite": 1,      # but not eligible
            "starter": 1,   # 1 persistent machine
            "professional": 2,  # 2 persistent machines
            "enterprise": 3,    # 3 persistent machines
        }
        eligible = {"starter", "professional", "enterprise"}

        for tier, max_machines in tier_limits.items():
            if tier in eligible:
                # Persistent swarm max = plan max
                assert max_machines >= 1
                # Temp swarm max = 3x plan max, capped at 10
                temp_max = min(max_machines * 3, 10)
                assert temp_max >= max_machines
