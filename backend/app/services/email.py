import logging
import asyncio
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from app.core.config import settings

logger = logging.getLogger(__name__)

def _get_base_template(content_html: str, preview_text: str = "", icon: str = "🌿") -> str:
    """Executive enterprise-grade HTML email layout matching GreenXchange identity."""
    preheader_html = f"""
    <!--[if !mso]><!-- -->
    <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
      {preview_text}
    </div>
    <!--<![endif]-->
    """ if preview_text else ""

    icon_badge_html = f"""
        <div style="text-align: center; margin: 0 0 18px 0;">
          <div class="icon-badge">{icon}</div>
        </div>
    """ if icon else ""

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="format-detection" content="telephone=no" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>GreenXchange</title>
  <style type="text/css">
    body {{
      margin: 0;
      padding: 0;
      background-color: #F6F5F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1E3323;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }}
    table {{
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }}
    td, th {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }}
    .email-wrapper {{
      width: 100%;
      background-color: #F6F5F0;
      padding: 32px 12px;
    }}
    .email-container {{
      max-width: 580px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border: 1px solid #E2DEC9;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(28, 48, 33, 0.06);
    }}
    .email-header {{
      background-color: #1C3021;
      background-image: linear-gradient(135deg, #1C3021 0%, #234227 100%);
      padding: 28px 32px;
      text-align: left;
      border-bottom: 3px solid #3E7345;
    }}
    .brand-name {{
      font-size: 22px;
      font-weight: 700;
      color: #F8F7F2;
      letter-spacing: -0.3px;
      margin: 0;
    }}
    .brand-name span {{
      color: #5BA864;
    }}
    .brand-tagline {{
      font-size: 11px;
      font-weight: 600;
      color: #A3B8A7;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      margin: 4px 0 0 0;
    }}
    .email-body {{
      padding: 36px 32px 28px 32px;
      color: #1E3323;
      font-size: 15px;
      line-height: 1.65;
    }}
    .icon-badge {{
      display: inline-block;
      width: 56px;
      height: 56px;
      line-height: 56px;
      border-radius: 50%;
      background-color: #E8F3EA;
      border: 1px solid #D3E8D6;
      font-size: 26px;
      text-align: center;
    }}
    .email-heading {{
      font-size: 21px;
      font-weight: 700;
      color: #1C3021;
      margin: 0 0 16px 0;
      letter-spacing: -0.3px;
      text-align: center;
    }}
    .btn {{
      display: inline-block;
      background-color: #2D5A34;
      background-image: linear-gradient(135deg, #326238 0%, #21451F 100%);
      color: #FFFFFF !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 8px;
      text-align: center;
      letter-spacing: 0.2px;
      box-shadow: 0 2px 10px rgba(45, 90, 52, 0.28);
    }}
    .callout {{
      background-color: #F6F8F6;
      border-left: 4px solid #3E7345;
      padding: 18px 20px;
      margin: 22px 0;
      border-radius: 0 8px 8px 0;
    }}
    .stat-table {{
      width: 100%;
      margin: 20px 0;
      border: 1px solid #E5E9E5;
      border-radius: 8px;
      border-collapse: separate;
      border-spacing: 0;
    }}
    .stat-table td {{
      padding: 13px 18px;
      font-size: 14px;
    }}
    .stat-label {{
      color: #4A6350;
      border-bottom: 1px solid #E5E9E5;
    }}
    .stat-value {{
      font-weight: 700;
      color: #1C3021;
      text-align: right;
      border-bottom: 1px solid #E5E9E5;
    }}
    .email-footer {{
      background-color: #FAFAF8;
      padding: 24px 32px;
      border-top: 1px solid #EAE6D6;
      font-size: 12px;
      color: #728A78;
      line-height: 1.5;
      text-align: left;
    }}
    .link-fallback {{
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #EFECE0;
      font-size: 12px;
      color: #6C8271;
      word-break: break-all;
    }}
    .link-fallback a {{
      color: #2D5A34;
      text-decoration: underline;
    }}
    @media screen and (max-width: 600px) {{
      .email-wrapper {{ padding: 16px 8px !important; }}
      .email-header {{ padding: 22px 20px !important; }}
      .email-body {{ padding: 28px 20px 22px 20px !important; }}
      .email-footer {{ padding: 20px 20px !important; }}
      .email-heading {{ font-size: 19px !important; }}
      .btn {{ display: block !important; width: 100% !important; box-sizing: border-box !important; }}
      .stat-table td {{ padding: 11px 14px !important; }}
    }}
    @media (prefers-color-scheme: dark) {{
      body, .email-wrapper {{ background-color: #10160F !important; }}
      .email-container {{ background-color: #17201A !important; border-color: #26362A !important; }}
      .email-body {{ color: #E6EDE7 !important; }}
      .email-heading {{ color: #F3F7F3 !important; }}
      .icon-badge {{ background-color: #24362A !important; border-color: #34493A !important; }}
      .callout {{ background-color: #1E2A20 !important; }}
      .stat-table {{ border-color: #2A3B2E !important; }}
      .stat-label {{ color: #A9C2AD !important; border-bottom-color: #2A3B2E !important; }}
      .stat-value {{ color: #F0F5F0 !important; border-bottom-color: #2A3B2E !important; }}
      .email-footer {{ background-color: #121A13 !important; color: #8FA692 !important; border-top-color: #223226 !important; }}
      .link-fallback {{ color: #9BB89E !important; border-top-color: #223226 !important; }}
      .link-fallback a {{ color: #7FC488 !important; }}
    }}
  </style>
</head>
<body>
  {preheader_html}
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <h1 class="brand-name">🌱 Green<span>Xchange</span></h1>
        <p class="brand-tagline">Environmental Intelligence &amp; Climate Rewards</p>
      </div>
      <div class="email-body">
        {icon_badge_html}
        {content_html}
      </div>
      <div class="email-footer">
        <p style="margin: 0 0 6px 0;">This email was sent to verify or manage your account on the GreenXchange Municipal Climate Network.</p>
        <p style="margin: 0 0 6px 0;">GreenXchange Technologies, Environmental Asset Exchange System.</p>
        <p style="margin: 0;">&copy; 2026 GreenXchange. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>"""

def _build_mime_message(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = "",
    priority: str = "normal",
) -> MIMEMultipart:
    """
    Builds a RFC-compliant multipart MIME message.

    Args:
        priority: One of 'high', 'normal', or 'low'.
                  'high'   → X-Priority: 1  — shown as urgent on Android/iOS/Outlook
                  'normal' → X-Priority: 3  — default behaviour
                  'low'    → X-Priority: 5  — low-importance (newsletters, digests)
    """
    import re
    domain = settings.GMAIL_SENDER.split("@")[-1] if "@" in settings.GMAIL_SENDER else "greenxchange.org"

    msg = MIMEMultipart("alternative")
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=domain)
    msg["Reply-To"] = settings.GMAIL_SENDER
    msg["X-Mailer"] = "GreenXchange-Mailer/2.0"

    # ── Email priority headers ──────────────────────────────────────────────
    # Respected by: Outlook, Apple Mail, Thunderbird, Android Mail, iOS Mail.
    # Note: Gmail's own UI ignores these (it uses ML-based importance instead).
    _PRIORITY_MAP = {
        "high":   ("1", "high",   "High"),
        "normal": ("3", "normal", "Normal"),
        "low":    ("5", "low",    "Low"),
    }
    x_prio, importance, ms_prio = _PRIORITY_MAP.get(priority, _PRIORITY_MAP["normal"])
    msg["X-Priority"]       = x_prio      # RFC informal — widely supported
    msg["Importance"]       = importance   # RFC 2156 / IETF standard
    msg["X-MSMail-Priority"] = ms_prio    # Microsoft Outlook specific
    # ───────────────────────────────────────────────────────────────────────

    if not text_content:
        text_content = html_content.replace("<br>", "\n").replace("</p>", "\n\n").replace("</h2>", "\n\n")
        text_content = re.sub("<[^<]+?>", "", text_content)

    msg.attach(MIMEText(text_content.strip(), "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))
    return msg


def _send_via_gmail_api_sync(to_email: str, subject: str, html_content: str, text_content: str = "", priority: str = "normal") -> dict:
    """
    Sends email via Gmail API using OAuth2 refresh token.
    Uses HTTPS (port 443) — never blocked on Render or any hosting platform.
    """
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = Credentials(
            token=None,
            refresh_token=settings.GMAIL_REFRESH_TOKEN,
            client_id=settings.GMAIL_CLIENT_ID,
            client_secret=settings.GMAIL_CLIENT_SECRET,
            token_uri="https://oauth2.googleapis.com/token",
            scopes=["https://www.googleapis.com/auth/gmail.send"],
        )

        service = build("gmail", "v1", credentials=creds, cache_discovery=False)

        msg = _build_mime_message(to_email, subject, html_content, text_content, priority=priority)
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

        service.users().messages().send(
            userId="me",
            body={"raw": raw}
        ).execute()

        logger.info(f"✅ Email successfully delivered to '{to_email}' via Gmail API (priority={priority})")
        return {"status": "sent", "provider": "gmail_api"}

    except Exception as e:
        logger.error(f"❌ Gmail API send failed for '{to_email}': {e}")
        return {"error": str(e), "status": "failed"}


def _send_smtp_sync(to_email: str, subject: str, html_content: str, text_content: str = "", priority: str = "normal") -> dict:
    """Fallback SMTP delivery — only used in local/non-Render environments where port 587 is open."""
    import time, smtplib, socket
    max_retries = 2
    last_error = None

    try:
        msg = _build_mime_message(to_email, subject, html_content, text_content, priority=priority)
        clean_pass = settings.SMTP_PASSWORD.replace(" ", "").strip()

        for attempt in range(1, max_retries + 1):
            try:
                connect_host = settings.SMTP_HOST
                try:
                    connect_host = socket.getaddrinfo(settings.SMTP_HOST, None, socket.AF_INET)[0][4][0]
                except Exception as resolve_err:
                    logger.warning(f"IPv4 resolution failed, using hostname: {resolve_err}")

                server = smtplib.SMTP(timeout=20)
                server._host = settings.SMTP_HOST
                server.connect(connect_host, settings.SMTP_PORT)
                server.starttls()
                server.login(settings.SMTP_USER, clean_pass)
                server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
                try:
                    server.quit()
                except Exception:
                    pass
                logger.info(f"✅ Email delivered to '{to_email}' via SMTP")
                return {"status": "sent", "provider": "smtp"}
            except Exception as e:
                last_error = e
                logger.warning(f"SMTP attempt {attempt}/{max_retries} failed for '{to_email}': {e}")
                if attempt < max_retries:
                    time.sleep(1.0)

        logger.error(f"❌ SMTP failed for '{to_email}' after {max_retries} attempts: {last_error}")
        return {"error": str(last_error), "status": "failed"}
    except Exception as e:
        logger.error(f"❌ General SMTP error for '{to_email}': {e}")
        return {"error": str(e), "status": "failed"}


async def send_email(to_email: str, subject: str, html_content: str, text_content: str = "", priority: str = "normal"):
    """
    Core email dispatcher. Priority order:
      1. Gmail API (OAuth2 over HTTPS — primary, works on all platforms)
      2. SMTP (fallback for local dev where port 587 is open)
      3. Resend API (fallback if RESEND_API_KEY is configured)

    Args:
        priority: 'high' | 'normal' | 'low'
                  Sets X-Priority, Importance, and X-MSMail-Priority headers.
                  Affects how Android Mail, iOS Mail, and Outlook display the email.
    """
    failure_reasons = []

    # 1. Gmail API — primary provider (HTTPS/443, never blocked)
    if settings.GMAIL_CLIENT_ID and settings.GMAIL_CLIENT_SECRET and settings.GMAIL_REFRESH_TOKEN:
        res = await asyncio.to_thread(_send_via_gmail_api_sync, to_email, subject, html_content, text_content, priority)
        if res.get("status") == "sent":
            return res
        failure_reasons.append(f"Gmail API failed: {res.get('error', 'unknown')}")
        logger.warning(f"Gmail API delivery failed for '{to_email}', trying fallback...")
    else:
        failure_reasons.append("Gmail API skipped: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN not set.")

    # 2. SMTP fallback (works locally, blocked on Render free tier)
    if settings.SMTP_PASSWORD:
        res = await asyncio.to_thread(_send_smtp_sync, to_email, subject, html_content, text_content, priority)
        if res.get("status") == "sent":
            return res
        failure_reasons.append(f"SMTP failed: {res.get('error', 'unknown')}")
        logger.warning(f"SMTP delivery failed for '{to_email}', trying Resend...")
    else:
        failure_reasons.append("SMTP skipped: SMTP_PASSWORD not set.")

    # 3. Resend API fallback
    if settings.RESEND_API_KEY:
        try:
            import resend
            resend.api_key = settings.RESEND_API_KEY
            params = {
                "from": settings.EMAIL_FROM,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
                "text": text_content if text_content else None,
            }
            res = resend.Emails.send(params)
            logger.info(f"✅ Email sent to '{to_email}' via Resend")
            return res if res is not None else {"status": "sent"}
        except Exception as e:
            logger.error(f"❌ Resend failed for '{to_email}': {e}")
            failure_reasons.append(f"Resend failed: {e}")
    else:
        failure_reasons.append("Resend skipped: RESEND_API_KEY not set.")

    logger.warning(f"⚠️ [Email Mock/Dev] No active email provider succeeded. Email to '{to_email}' not delivered to inbox.")
    return {"id": "mock_id", "status": "mock_dispatched", "reasons": failure_reasons}

async def send_verification_email(to_email: str, name: str, token: str, base_url: str = None):
    """Dispatches Account Email Verification link with clean corporate styling."""
    root_url = (base_url or settings.FRONTEND_URL).rstrip("/")
    verify_url = f"{root_url}/verify-email?token={token}"

    logger.info(f"🔗 [VERIFICATION LINK FOR {to_email}]: {verify_url}")

    content_html = f"""
      <h2 class="email-heading">Verify your email address</h2>
      <p>Hello {name},</p>
      <p>Thank you for registering with GreenXchange. To activate your account and start tracking your trees and earning Green Carbon (GXC) rewards, please verify your email address below:</p>
      
      <div style="text-align: center; margin: 28px 0;">
        <a href="{verify_url}" class="btn">Verify Email Address</a>
      </div>

      <p style="font-size: 13px; color: #58705E; margin: 0;">This verification link will expire in 24 hours. If you did not create a GreenXchange account, you can safely ignore this email.</p>

      <div class="link-fallback">
        If the button above does not work, copy and paste this link into your browser:<br />
        <a href="{verify_url}">{verify_url}</a>
      </div>
    """

    plain_text = f"""Verify your GreenXchange email address

Hello {name},

Thank you for registering with GreenXchange. To activate your account and begin tracking your plants and earning GXC rewards, please verify your email address by visiting the link below:

{verify_url}

This verification link will expire in 24 hours. If you did not create a GreenXchange account, you can safely ignore this message.

---
GreenXchange Environmental Network
https://greenxchange.org
"""

    html = _get_base_template(content_html, preview_text="Please verify your email to activate your GreenXchange account.", icon="✅")
    return await send_email(to_email, "Verify your GreenXchange account", html, plain_text, priority="high")

async def send_password_reset_email(to_email: str, name: str, token: str, base_url: str = None):
    """Dispatches Password Reset link with clean corporate styling."""
    root_url = (base_url or settings.FRONTEND_URL).rstrip("/")
    reset_url = f"{root_url}/reset-password?token={token}"

    logger.info(f"🔗 [PASSWORD RESET LINK FOR {to_email}]: {reset_url}")

    content_html = f"""
      <h2 class="email-heading">Password reset request</h2>
      <p>Hello {name},</p>
      <p>We received a request to reset the password for your GreenXchange account. Click the button below to establish a new password:</p>
      
      <div style="text-align: center; margin: 28px 0;">
        <a href="{reset_url}" class="btn">Reset Password</a>
      </div>

      <p style="font-size: 13px; color: #58705E; margin: 0;">For your security, this link is valid for 1 hour. If you did not initiate this request, your account remains secure and no further action is required.</p>

      <div class="link-fallback">
        If the button above does not work, copy and paste this link into your browser:<br />
        <a href="{reset_url}">{reset_url}</a>
      </div>
    """

    plain_text = f"""GreenXchange Password Reset Request

Hello {name},

We received a request to reset the password for your GreenXchange account. Visit the link below to set a new password:

{reset_url}

For your security, this link is valid for 1 hour. If you did not request this, please disregard this email.

---
GreenXchange Environmental Network
https://greenxchange.org
"""

    html = _get_base_template(content_html, preview_text="Reset instructions for your GreenXchange password.", icon="🔑")
    return await send_email(to_email, "Reset your GreenXchange password", html, plain_text, priority="high")

async def send_org_payment_request_email(to_email: str, citizen_name: str, org_name: str, amount_gxc: float, description: str, base_url: str = None):
    """Notifies citizen of incoming payment request issued by an authorized Organization."""
    root_url = (base_url or settings.FRONTEND_URL).rstrip("/")
    rewards_url = f"{root_url}/rewards"

    content_html = f"""
      <h2 class="email-heading">Service Payment Authorization Request</h2>
      <p>Hello {citizen_name},</p>
      <p>An authorized partner organization, <strong>{org_name}</strong>, has issued a GXC service payment request to your account wallet.</p>
      
      <div class="callout">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #58705E; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">💰 Requested Amount</p>
        <p style="margin: 0 0 14px 0; font-size: 26px; font-weight: 700; color: #1C3021;">{amount_gxc:.1f} <span style="font-size: 15px; font-weight: 600; color: #4A6350;">GXC</span></p>
        <p style="margin: 0 0 4px 0; font-size: 13px; color: #58705E; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Service Description</p>
        <p style="margin: 0; font-size: 14px; color: #1E3323; font-style: italic;">"{description}"</p>
      </div>

      <p>To review, approve, or reject this transaction, please open your GreenXchange Rewards Hub:</p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="{rewards_url}" class="btn">Review and Authorize Payment</a>
      </div>

      <p style="font-size: 13px; color: #58705E; margin: 0;">Payment authorization requires your account password verification prior to token transfer.</p>

      <div class="link-fallback">
        Direct link to Rewards Hub:<br />
        <a href="{rewards_url}">{rewards_url}</a>
      </div>
    """

    plain_text = f"""GreenXchange Payment Authorization Request

Hello {citizen_name},

An authorized partner organization, {org_name}, has issued a payment request of {amount_gxc:.1f} GXC to your account wallet.

Service Description: "{description}"

To review and authorize or reject this payment, please visit your Rewards Hub:
{rewards_url}

---
GreenXchange Environmental Network
"""

    html = _get_base_template(content_html, preview_text=f"Payment request of {amount_gxc:.1f} GXC from {org_name}.", icon="💳")
    return await send_email(to_email, f"Action Required: Payment request from {org_name}", html, plain_text, priority="high")

async def send_weekly_digest_email(to_email: str, name: str, stats: dict):
    """Dispatches Weekly Eco-Activity Summary digest email."""
    dashboard_url = f"{settings.FRONTEND_URL}/"
    gxc_balance = stats.get("gxc_balance", 0)
    plants_count = stats.get("plants_count", 0)
    carbon_offset_kg = stats.get("carbon_offset_kg", 0.0)

    content_html = f"""
      <h2 class="email-heading">Weekly Environmental Summary</h2>
      <p>Hello {name},</p>
      <p>Here is your weekly summary of registered plants, estimated carbon sequestration, and accumulated GXC rewards on GreenXchange:</p>
      
      <table class="stat-table">
        <tr>
          <td class="stat-label">🌳 Active Plants Monitored</td>
          <td class="stat-value">{plants_count}</td>
        </tr>
        <tr>
          <td class="stat-label">🌍 Estimated Carbon Sequestered</td>
          <td class="stat-value">{carbon_offset_kg:.1f} kg CO2</td>
        </tr>
        <tr>
          <td class="stat-label" style="border-bottom: none;">🪙 Available GXC Token Balance</td>
          <td class="stat-value" style="border-bottom: none; color: #2D5A34;">{gxc_balance} GXC</td>
        </tr>
      </table>

      <div style="text-align: center; margin: 28px 0;">
        <a href="{dashboard_url}" class="btn">View Environmental Dashboard</a>
      </div>

      <div class="link-fallback">
        Direct link to Dashboard:<br />
        <a href="{dashboard_url}">{dashboard_url}</a>
      </div>
    """

    plain_text = f"""GreenXchange Weekly Environmental Summary

Hello {name},

Here is your weekly summary on GreenXchange:
- Active Plants Monitored: {plants_count}
- Estimated Carbon Sequestered: {carbon_offset_kg:.1f} kg CO2
- Available GXC Balance: {gxc_balance} GXC

View your full dashboard: {dashboard_url}

---
GreenXchange Environmental Network
"""

    html = _get_base_template(content_html, preview_text=f"Weekly Eco Digest: {plants_count} active plants, {carbon_offset_kg:.1f} kg CO2 sequestered.", icon="📊")
    return await send_email(to_email, "Your GreenXchange Weekly Environmental Digest", html, plain_text, priority="low")
