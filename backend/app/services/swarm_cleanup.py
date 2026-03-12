"""
Swarm machine cleanup — ensures temporary swarm machines are always deleted.

Called on backend startup and can be called periodically.
Marks machines with ``is_swarm: true`` in their settings for deletion
via the Next.js machine deletion API.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Swarm machines older than this are considered orphaned and will be deleted.
SWARM_MAX_AGE_MINUTES = 30


async def cleanup_orphaned_swarm_machines(max_age_minutes: int = SWARM_MAX_AGE_MINUTES) -> int:
    """Find and delete swarm machines that outlived their expected lifetime.

    This is a safety net — normally the Next.js swarm route deletes machines
    in its finally block.  This catches cases where the process crashed or
    the network dropped before cleanup could happen.

    Returns the number of machines marked for deletion.
    """
    try:
        from supabase import create_client

        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE:
            logger.warning("Supabase not configured — skipping swarm cleanup")
            return 0

        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE)

        # Find all machines with is_swarm in settings
        # Supabase supports JSON containment queries with .contains()
        cutoff = (datetime.utcnow() - timedelta(minutes=max_age_minutes)).isoformat()

        result = client.table("user_machines").select(
            "id, user_id, settings, status, created_at"
        ).lt(
            "created_at", cutoff
        ).neq(
            "status", "deleting"
        ).execute()

        if not result.data:
            return 0

        # Filter for swarm machines (settings.is_swarm == true)
        swarm_machines = []
        for m in result.data:
            s = m.get("settings") or {}
            if isinstance(s, str):
                import json
                try:
                    s = json.loads(s)
                except Exception:
                    continue
            if s.get("is_swarm"):
                swarm_machines.append(m)

        if not swarm_machines:
            return 0

        logger.info(f"Found {len(swarm_machines)} orphaned swarm machines to clean up")

        cleaned = 0
        for machine in swarm_machines:
            machine_id = machine["id"]
            try:
                # Mark as deleting first
                client.table("user_machines").update(
                    {"status": "deleting", "status_message": "Swarm cleanup — auto-deleting temporary machine"}
                ).eq("id", machine_id).execute()

                # Terminate cloud resources if possible
                s = machine.get("settings") or {}
                if isinstance(s, str):
                    import json
                    s = json.loads(s)

                provider = s.get("provider")
                instance_id = s.get("awsInstanceId")

                if provider == "aws" and instance_id:
                    # We can terminate directly via boto3 if available
                    try:
                        import boto3
                        ec2 = boto3.client(
                            "ec2",
                            region_name=s.get("awsRegion", settings.AWS_REGION or "us-east-1"),
                            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                        )
                        ec2.terminate_instances(InstanceIds=[instance_id])
                        logger.info(f"Terminated EC2 instance {instance_id} for swarm machine {machine_id}")

                        # Clean up key pair
                        key_pair_name = s.get("awsKeyPairName")
                        if key_pair_name:
                            try:
                                ec2.delete_key_pair(KeyName=key_pair_name)
                            except Exception:
                                pass
                    except ImportError:
                        logger.warning("boto3 not available — marking machine for frontend cleanup")
                    except Exception as e:
                        logger.error(f"Failed to terminate EC2 {instance_id}: {e}")
                        # Don't delete DB record if EC2 is still running —
                        # next cleanup cycle will retry termination.
                        continue

                # Delete the DB record (only reached if termination succeeded or no EC2)
                client.table("user_machines").delete().eq("id", machine_id).execute()
                cleaned += 1
                logger.info(f"Deleted swarm machine {machine_id}")

            except Exception as e:
                logger.error(f"Failed to clean up swarm machine {machine_id}: {e}")

        return cleaned

    except Exception as e:
        logger.error(f"Swarm cleanup error: {e}", exc_info=True)
        return 0
