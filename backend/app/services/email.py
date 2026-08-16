import logging
import uuid
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
import resend
from app.core.config import settings

logger = logging.getLogger(__name__)

def _get_base_template(content_html: str, preview_text: str = "") -> str:
    """Executive enterprise-grade HTML email layout matching GreenXchange identity."""
    preheader_html = f"""
    <!--[if !mso]><!-- -->
    <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
      {preview_text}
    </div>
    <!--<![endif]-->
    """ if preview_text else ""

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="format-detection" content="telephone=no" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
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
    }}
    .email-header {{
      background-color: #1C3021;
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
      padding: 32px 32px 28px 32px;
      color: #1E3323;
      font-size: 15px;
      line-height: 1.6;
    }}
    .email-heading {{
      font-size: 20px;
      font-weight: 700;
      color: #1C3021;
      margin: 0 0 16px 0;
      letter-spacing: -0.3px;
    }}
    .btn {{
      display: inline-block;
      background-color: #2D5A34;
      color: #FFFFFF !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 28px;
      border-radius: 8px;
      text-align: center;
      letter-spacing: 0.2px;
    }}
    .callout {{
      background-color: #F6F8F6;
      border-left: 4px solid #3E7345;
      padding: 16px 20px;
      margin: 20px 0;
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
      padding: 12px 18px;
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
  </style>
</head>
<body>
  {preheader_html}
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <h1 class="brand-name">Green<span>Xchange</span></h1>
        <p class="brand-tagline">Environmental Intelligence &amp; Climate Rewards</p>
      </div>
      <div class="email-body">
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

def _send_smtp_sync(to_email: str, subject: str, html_content: str, text_content: str = "") -> dict:
    """Delivers email via SMTP with RFC-compliant anti-spam headers and multipart alternative structure."""
    try:
        domain = settings.SMTP_USER.split("@")[-1] if "@" in settings.SMTP_USER else "greenxchange.org"
        
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["Date"] = formatdate(localtime=True)
        msg["Message-ID"] = make_msgid(domain=domain)
        msg["Reply-To"] = settings.SMTP_USER
        msg["X-Mailer"] = "GreenXchange-Security-Mailer/1.0"
        msg["Auto-Submitted"] = "auto-generated"
        msg["X-Auto-Response-Suppress"] = "All"
        
        # 1. Plain text version (Crucial for Spam Filter Inbox placement)
        if not text_content:
            text_content = html_content.replace("<br>", "\n").replace("</p>", "\n\n").replace("</h2>", "\n\n")
            import re
            text_content = re.sub("<[^<]+?>", "", text_content)

        part_text = MIMEText(text_content.strip(), "plain", "utf-8")
        msg.attach(part_text)
        
        # 2. HTML version
        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_html)
        
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        server.starttls()
        clean_pass = settings.SMTP_PASSWORD.replace(" ", "").strip()
        server.login(settings.SMTP_USER, clean_pass)
        server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
        server.quit()
        logger.info(f"✅ Email successfully delivered to '{to_email}' via SMTP ({settings.SMTP_HOST})")
        return {"status": "sent", "provider": "smtp"}
    except Exception as e:
        logger.error(f"❌ Failed to dispatch email to '{to_email}' via SMTP: {e}")
        return {"error": str(e), "status": "failed"}

async def send_email(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """Core sending function with SMTP and Resend integration."""
    if settings.EMAIL_PROVIDER == "smtp" and settings.SMTP_USER and settings.SMTP_PASSWORD:
        return await asyncio.to_thread(_send_smtp_sync, to_email, subject, html_content, text_content)

    if settings.RESEND_API_KEY:
        resend.api_key = settings.RESEND_API_KEY
        target_to = to_email
        if "@example.com" in to_email or "@test.com" in to_email:
            target_to = "delivered@resend.dev"

        try:
            params = {
                "from": settings.EMAIL_FROM,
                "to": [target_to],
                "subject": subject,
                "html": html_content,
                "text": text_content if text_content else None,
            }
            res = resend.Emails.send(params)
            logger.info(f"✅ Email successfully sent to '{to_email}' via Resend")
            return res if res is not None else {"status": "sent"}
        except Exception as e:
            logger.error(f"❌ Failed to dispatch email to '{to_email}' via Resend: {e}")
            return {"error": str(e), "status": "failed"}

    logger.warning(
        f"⚠️ [Email Mock/Dev] No email credentials configured. Email to '{to_email}' not dispatched."
    )
    return {"id": "mock_id", "status": "mock_dispatched"}

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

    html = _get_base_template(content_html, preview_text="Please verify your email to activate your GreenXchange account.")
    return await send_email(to_email, "Verify your GreenXchange account", html, plain_text)

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

    html = _get_base_template(content_html, preview_text="Reset instructions for your GreenXchange password.")
    return await send_email(to_email, "Reset your GreenXchange password", html, plain_text)

async def send_org_payment_request_email(to_email: str, citizen_name: str, org_name: str, amount_gxc: float, description: str, base_url: str = None):
    """Notifies citizen of incoming payment request issued by an authorized Organization."""
    root_url = (base_url or settings.FRONTEND_URL).rstrip("/")
    rewards_url = f"{root_url}/rewards"

    content_html = f"""
      <h2 class="email-heading">Service Payment Authorization Request</h2>
      <p>Hello {citizen_name},</p>
      <p>An authorized partner organization, <strong>{org_name}</strong>, has issued a GXC service payment request to your account wallet.</p>
      
      <div class="callout">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #58705E; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Requested Amount</p>
        <p style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #1C3021;">{amount_gxc:.1f} GXC</p>
        <p style="margin: 0 0 4px 0; font-size: 13px; color: #58705E; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Service Description</p>
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

    html = _get_base_template(content_html, preview_text=f"Payment request of {amount_gxc:.1f} GXC from {org_name}.")
    return await send_email(to_email, f"Action Required: Payment request from {org_name}", html, plain_text)

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
          <td class="stat-label">Active Plants Monitored</td>
          <td class="stat-value">{plants_count}</td>
        </tr>
        <tr>
          <td class="stat-label">Estimated Carbon Sequestered</td>
          <td class="stat-value">{carbon_offset_kg:.1f} kg CO2</td>
        </tr>
        <tr>
          <td class="stat-label" style="border-bottom: none;">Available GXC Token Balance</td>
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

    html = _get_base_template(content_html, preview_text=f"Weekly Eco Digest: {plants_count} active plants, {carbon_offset_kg:.1f} kg CO2 sequestered.")
    return await send_email(to_email, "Your GreenXchange Weekly Environmental Digest", html, plain_text)
