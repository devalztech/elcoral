"""
Sends transactional email (currently just verification links) via SMTP.

Deliberately NOT using an async SMTP library — smtplib's blocking calls
are run in a thread via asyncio.to_thread so they don't block the event
loop, without adding another dependency. Send failures are caught and
logged, never raised past this module — a broken SMTP config should
degrade gracefully, not crash a request or (worse) leave someone stuck
mid-signup because Gmail was briefly unreachable.

See app.core.config.settings.smtp_configured for the bypass: if SMTP
isn't set up, callers should skip sending entirely (see
app/routers/auth.py's signup flow) rather than call send_verification_email
and let it silently no-op — the bypass is a deliberate branch, not just a
side effect of missing config, so it's obvious at the call site.
"""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


def _send_sync(to_email: str, subject: str, html_body: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
        return True
    except (smtplib.SMTPException, OSError):
        logger.exception(f"Failed to send email to {to_email}")
        return False


async def send_verification_email(to_email: str, full_name: str, verify_url: str) -> bool:
    """Returns True if sent successfully, False otherwise. Never raises."""
    subject = "Verify your Elcoral account"
    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Welcome to Elcoral, {full_name}</h2>
      <p>Confirm your email address to finish setting up your account.</p>
      <p>
        <a href="{verify_url}"
           style="display: inline-block; padding: 12px 24px; background: #1a1a2e;
                  color: #fff; text-decoration: none; border-radius: 6px;">
          Verify email
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">
        If the button doesn't work, copy this link into your browser:<br>
        <a href="{verify_url}">{verify_url}</a>
      </p>
      <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
    </div>
    """
    return await asyncio.to_thread(_send_sync, to_email, subject, html_body)
