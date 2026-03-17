"""
Agent Email Service — IMAP/SMTP access for swarm agent mailboxes.

Each swarm agent gets an ephemeral AWS WorkMail mailbox.  This module
provides async helpers to:
  - read inbox messages
  - wait for a verification / confirmation email
  - extract verification codes and links from email bodies
  - send emails from the agent's mailbox

All functions are designed to be called from the CUA executor's action
interception layer — the agent never sees raw credentials.
"""

import asyncio
import email as email_lib
import email.mime.multipart
import email.mime.text
import logging
import os
import re
from email.header import decode_header
from typing import Any, Dict, List, Optional

import aiosmtplib

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (from backend .env)
# ---------------------------------------------------------------------------

WORKMAIL_IMAP_HOST = os.getenv("WORKMAIL_IMAP_HOST", "imap.mail.us-east-1.awsapps.com")
WORKMAIL_SMTP_HOST = os.getenv("WORKMAIL_SMTP_HOST", "smtp.mail.us-east-1.awsapps.com")
WORKMAIL_IMAP_PORT = int(os.getenv("WORKMAIL_IMAP_PORT", "993"))
WORKMAIL_SMTP_PORT = int(os.getenv("WORKMAIL_SMTP_PORT", "465"))
WORKMAIL_DOMAIN = os.getenv("WORKMAIL_DOMAIN", "agents.coasty.ai")


# ---------------------------------------------------------------------------
# IMAP helpers (using aioimaplib)
# ---------------------------------------------------------------------------

async def _connect_imap(email_address: str, password: str):
    """Connect and login to IMAP server. Returns the IMAP client."""
    import aioimaplib

    client = aioimaplib.IMAP4_SSL(
        host=WORKMAIL_IMAP_HOST,
        port=WORKMAIL_IMAP_PORT,
    )
    await client.wait_hello_from_server()
    await client.login(email_address, password)
    return client


def _decode_header_value(raw: str) -> str:
    """Decode RFC 2047 encoded header value."""
    if not raw:
        return ""
    parts = decode_header(raw)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(str(part))
    return " ".join(decoded)


def _extract_text_from_message(msg: email_lib.message.Message) -> str:
    """Extract plain text body from an email message."""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace")
            elif content_type == "text/html":
                # Fallback to HTML if no plain text
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    html = payload.decode(charset, errors="replace")
                    # Strip HTML tags for basic text extraction
                    text = re.sub(r"<[^>]+>", " ", html)
                    text = re.sub(r"\s+", " ", text).strip()
                    return text
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace")
    return ""


# ---------------------------------------------------------------------------
# Verification code / link extraction
# ---------------------------------------------------------------------------

# Common verification code patterns (4-8 digit numeric, or 6-char alphanumeric)
_CODE_PATTERNS = [
    # "Your code is 123456" / "verification code: 123456" / "code is: 123456"
    r"(?:code|pin|otp|token)\s*(?:is\s*:?\s*|:\s*)(\d{4,8})",
    # "Enter 123456 to verify"
    r"(?:enter|use|type)\s+(\d{4,8})\s+(?:to|for)",
    # Standalone 6-digit code on its own line
    r"^\s*(\d{6})\s*$",
    # Alphanumeric codes like "ABC123"
    r"(?:code|pin|otp|token)\s*(?:is\s*:?\s*|:\s*)([A-Z0-9]{5,8})",
]

# Verification link patterns
_LINK_PATTERNS = [
    r"(https?://[^\s<>\"]+(?:verify|confirm|activate|validate|token|code|auth)[^\s<>\"]*)",
    r"(https?://[^\s<>\"]+(?:\?|&)(?:token|code|key|confirm)=[^\s<>\"]+)",
]


def extract_verification_code(text: str) -> Optional[str]:
    """Extract a verification code from email body text."""
    for pattern in _CODE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1)
    return None


def extract_verification_link(text: str) -> Optional[str]:
    """Extract a verification/confirmation link from email body text."""
    for pattern in _LINK_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def read_inbox(
    email_address: str,
    password: str,
    limit: int = 10,
) -> List[Dict[str, str]]:
    """Read recent emails from the agent's inbox.

    Returns a list of dicts with keys: from, subject, snippet, date.
    """
    messages: List[Dict[str, str]] = []

    try:
        client = await _connect_imap(email_address, password)

        try:
            await client.select("INBOX")
            # Search for all messages
            _, data = await client.search("ALL")
            msg_ids = data[0].split() if data and data[0] else []

            # Get the most recent N messages
            recent_ids = msg_ids[-limit:] if len(msg_ids) > limit else msg_ids

            for msg_id in reversed(recent_ids):
                try:
                    _, msg_data = await client.fetch(msg_id.decode() if isinstance(msg_id, bytes) else str(msg_id), "(RFC822)")
                    # aioimaplib returns data differently - extract the email bytes
                    raw_email = None
                    if msg_data and len(msg_data) >= 2:
                        raw_email = msg_data[1]
                    if not raw_email:
                        continue

                    if isinstance(raw_email, str):
                        raw_email = raw_email.encode("utf-8")

                    msg = email_lib.message_from_bytes(raw_email)
                    body = _extract_text_from_message(msg)

                    messages.append({
                        "from": _decode_header_value(msg.get("From", "")),
                        "subject": _decode_header_value(msg.get("Subject", "")),
                        "date": msg.get("Date", ""),
                        "snippet": body[:500] if body else "",
                    })
                except Exception as e:
                    logger.warning(f"Failed to parse email {msg_id}: {e}")
                    continue

        finally:
            try:
                await client.logout()
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Failed to read inbox for {email_address}: {e}")

    return messages


async def wait_for_email(
    email_address: str,
    password: str,
    from_filter: str = "",
    subject_filter: str = "",
    timeout_seconds: int = 120,
    poll_interval: int = 5,
) -> Optional[Dict[str, Any]]:
    """Poll inbox until a matching email arrives or timeout.

    Returns dict with: from, subject, body, code (if found), link (if found).
    """
    deadline = asyncio.get_event_loop().time() + timeout_seconds

    while asyncio.get_event_loop().time() < deadline:
        try:
            emails = await read_inbox(email_address, password, limit=5)

            for em in emails:
                # Check filters
                if from_filter and from_filter.lower() not in em.get("from", "").lower():
                    continue
                if subject_filter and subject_filter.lower() not in em.get("subject", "").lower():
                    continue

                # Match found
                body = em.get("snippet", "")
                code = extract_verification_code(body)
                link = extract_verification_link(body)

                return {
                    "from": em.get("from", ""),
                    "subject": em.get("subject", ""),
                    "body": body,
                    "code": code,
                    "link": link,
                }
        except Exception as e:
            logger.warning(f"Email poll error for {email_address}: {e}")

        await asyncio.sleep(poll_interval)

    return None


def _build_branded_html(body: str, from_address: str) -> str:
    """Wrap the agent's plain-text body in a branded HTML email with signature."""
    import datetime
    import html as _html
    escaped_body = _html.escape(body).replace("\n", "<br>")
    year = datetime.datetime.now().year

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Body -->
        <tr><td style="padding:32px 36px;font-size:15px;line-height:1.7;color:#1a1a1a;">
          {escaped_body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0 36px;">
          <div style="border-top:1px solid #e5e5e5;"></div>
        </td></tr>
        <tr><td style="padding:20px 36px 24px;">
          <div style="font-size:12px;color:#6b7280;line-height:1.6;">
            Sent by an AI agent on <a href="https://coasty.ai" style="color:#6366f1;text-decoration:none;font-weight:500;">coasty.ai</a>
            &mdash; a self-improving autonomous computer that learns and gets better with every task.
            No human wrote or reviewed this email.
          </div>
          <div style="margin-top:14px;font-size:11px;color:#9ca3af;">
            &copy; {year} Coasty AI &nbsp;&middot;&nbsp;
            <a href="https://coasty.ai/support" style="color:#9ca3af;text-decoration:none;">Report</a> &nbsp;&middot;&nbsp;
            <a href="https://coasty.ai/terms" style="color:#9ca3af;text-decoration:none;">Terms</a> &nbsp;&middot;&nbsp;
            <a href="https://coasty.ai/privacy" style="color:#9ca3af;text-decoration:none;">Privacy</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_email(
    from_address: str,
    password: str,
    to_address: str,
    subject: str,
    body: str,
) -> Dict[str, Any]:
    """Send a branded email from the agent's mailbox via SMTP.

    Every outgoing email includes:
    - The agent's message body
    - A branded signature identifying the sender as a Coasty autonomous agent
    - A footer disclaimer (security / transparency)

    Returns dict with success status and message.
    """
    try:
        # Build multipart message with both plain text and branded HTML
        message = email_lib.mime.multipart.MIMEMultipart("alternative")
        message["From"] = from_address
        message["To"] = to_address
        message["Subject"] = subject

        # Plain-text fallback with simple text signature
        plain_footer = (
            "\n\n---\n"
            "Sent by a self-improving AI agent on Coasty.\n"
            "I operate a full computer on my own, teach myself new skills with every task, "
            "and get better each time I work. No human wrote this email.\n"
            f"Agent: {from_address}\n"
            "https://coasty.ai | Report: https://coasty.ai/support"
        )
        part_plain = email_lib.mime.text.MIMEText(body + plain_footer, "plain", "utf-8")

        # Branded HTML version
        part_html = email_lib.mime.text.MIMEText(
            _build_branded_html(body, from_address), "html", "utf-8"
        )

        # Attach plain first, HTML second (clients prefer the last alternative)
        message.attach(part_plain)
        message.attach(part_html)

        await aiosmtplib.send(
            message,
            hostname=WORKMAIL_SMTP_HOST,
            port=WORKMAIL_SMTP_PORT,
            username=from_address,
            password=password,
            use_tls=True,
        )

        logger.info(f"Email sent from {from_address} to {to_address}: {subject}")
        return {"success": True, "result": f"Email sent to {to_address}"}

    except Exception as e:
        logger.error(f"Failed to send email from {from_address} to {to_address}: {e}")
        return {"success": False, "result": f"Failed to send email: {e}"}


async def get_my_email_address(email_address: str) -> Dict[str, Any]:
    """Return the agent's email address.

    Simple helper so the agent can discover its own identity.
    """
    return {
        "success": True,
        "result": email_address,
        "email": email_address,
    }
