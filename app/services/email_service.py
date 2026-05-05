"""
Email Service — RankBattle UPSC
Sends transactional emails via Resend.
All functions are fire-and-forget wrapped in try/except
so email failure never breaks the auth flow.
"""
import os
import logging
from datetime import datetime

import resend

logger = logging.getLogger(__name__)

resend.api_key = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL     = os.getenv("RESEND_FROM_EMAIL", "noreply@rankbattle.in")

PLAN_LABELS  = {"sprint": "Prelims '26 Sprint", "monthly": "30-Day Booster"}
PLAN_AMOUNTS = {"sprint": "₹759",               "monthly": "₹999"}
PLAN_PERIOD  = {"sprint": "Valid until Prelims 2026", "monthly": "30-day access"}

# ── Brand colours (inline for email client compatibility) ──────────────────────
TERRA   = "#A0522D"
DARK    = "#1A1410"
PAPER   = "#F9F7F2"
INK     = "#1A1410"
SUCCESS = "#2E7D52"


def _base_template(content: str) -> str:
    """Wraps content in a clean, professional email shell."""
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:{DARK};border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">🏆</div>
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
              RankBattle UPSC
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:4px;font-style:italic;">
              Compete. Rank. Succeed.
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px;border-left:1px solid #e8e8e8;border-right:1px solid #e8e8e8;">
            {content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f7f2;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9a8070;">
              This is an automated message from RankBattle UPSC.<br>
              Please do not reply to this email.
            </p>
            <p style="margin:10px 0 0;font-size:12px;color:#b0906c;">
              Questions? Write to us at
              <a href="mailto:support@rankbattle.in" style="color:{TERRA};text-decoration:none;">support@rankbattle.in</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def _welcome_content(name: str) -> str:
    first = name.split()[0] if name else "Aspirant"
    return f"""
    <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;font-weight:700;color:{DARK};">
      Welcome, {first}. 👋
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#9a8070;font-style:italic;">
      Your preparation starts here.
    </p>

    <p style="margin:0 0 20px;font-size:15px;color:#3d2e22;line-height:1.7;">
      You've joined RankBattle UPSC — built to make your Prelims preparation sharper,
      faster, and more competitive than studying alone.
    </p>

    <!-- Free tier highlights -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:{PAPER};border:1px solid #e8ddd0;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#9a8070;text-transform:uppercase;">
          What you get for free
        </p>
        {''.join(f"""
        <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
          <span style="color:{SUCCESS};font-size:14px;margin-right:10px;margin-top:1px;">✓</span>
          <span style="font-size:14px;color:{INK};line-height:1.5;">{item}</span>
        </div>
        """ for item in [
            "1 Full Mock Test — 100 questions, UPSC marking scheme",
            "3 Subject Tests — one per subject of your choice",
            "5 AI Coach messages — Feynman method tutoring",
            "Full Analytics Dashboard — accuracy, weak areas, score trends",
        ])}
      </td></tr>
    </table>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://upsc.rankbattle.in/test/start"
         style="display:inline-block;background:{TERRA};color:#ffffff;text-decoration:none;
                font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;
                letter-spacing:0.3px;">
        Start Your First Test →
      </a>
    </div>

    <p style="margin:0;font-size:13px;color:#9a8070;line-height:1.7;border-top:1px solid #f0ebe3;padding-top:20px;">
      Every serious aspirant is one test ahead of you.<br>
      <strong style="color:{TERRA};">Don't let them stay there.</strong>
    </p>
"""


def _receipt_content(name: str, plan: str, payment_id: str) -> str:
    first       = name.split()[0] if name else "Aspirant"
    plan_label  = PLAN_LABELS.get(plan,  "Premium Plan")
    plan_amount = PLAN_AMOUNTS.get(plan, "—")
    plan_period = PLAN_PERIOD.get(plan,  "—")
    paid_on     = datetime.utcnow().strftime("%d %B %Y")

    return f"""
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#f0fdf4;border:1.5px solid #86efac;
                  border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">
        ✓
      </div>
    </div>

    <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:{DARK};text-align:center;">
      Payment Confirmed
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:#9a8070;text-align:center;">
      Thank you, {first}. Your subscription is now active.
    </p>

    <!-- Receipt box -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:{PAPER};border:1.5px solid #e8ddd0;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:1.5px;
                  color:#9a8070;text-transform:uppercase;border-bottom:1px solid #e8ddd0;padding-bottom:12px;">
          Receipt
        </p>
        {''.join(f"""
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:13px;color:#9a8070;">{label}</span>
          <span style="font-size:13px;font-weight:600;color:{INK};">{value}</span>
        </div>
        """ for label, value in [
            ("Plan",           plan_label),
            ("Amount Paid",    plan_amount),
            ("Valid For",      plan_period),
            ("Date",           paid_on),
            ("Transaction ID", payment_id[:20] + "..."),
        ])}
      </td></tr>
    </table>

    <!-- What's unlocked -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#fff8f0;border:1px solid #f5d5c0;border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:1.5px;
                  color:{TERRA};text-transform:uppercase;">
          What's Unlocked
        </p>
        {''.join(f"""
        <div style="margin-bottom:8px;">
          <span style="color:{TERRA};margin-right:8px;">✓</span>
          <span style="font-size:14px;color:{INK};">{item}</span>
        </div>
        """ for item in [
            "Unlimited Full Mock Tests",
            "All Subjects — unlimited practice",
            "Unlimited AI Coach sessions",
            "Expert explanations on every question",
            "Deep analytics + weak area tracking",
        ])}
      </td></tr>
    </table>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://upsc.rankbattle.in/dashboard"
         style="display:inline-block;background:{TERRA};color:#ffffff;text-decoration:none;
                font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;">
        Go to Dashboard →
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#9a8070;text-align:center;line-height:1.7;
              border-top:1px solid #f0ebe3;padding-top:20px;">
      Keep this email as your payment record.<br>
      For billing queries, contact
      <a href="mailto:support@rankbattle.in" style="color:{TERRA};text-decoration:none;">
        support@rankbattle.in
      </a>
    </p>
"""


# ── Public API ─────────────────────────────────────────────────────────────────

def send_welcome_email(user_email: str, user_name: str) -> None:
    """Send welcome email to a newly registered user. Fire-and-forget."""
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not set — skipping welcome email")
        return
    try:
        resend.Emails.send({
            "from":    FROM_EMAIL,
            "to":      [user_email],
            "subject": f"Welcome to RankBattle UPSC, {user_name.split()[0]}",
            "html":    _base_template(_welcome_content(user_name)),
        })
        logger.info("Welcome email sent to %s", user_email)
    except Exception as e:
        logger.error("Failed to send welcome email to %s: %s", user_email, e)


def send_receipt_email(user_email: str, user_name: str, plan: str, payment_id: str) -> None:
    """Send payment receipt after successful subscription. Fire-and-forget."""
    if not resend.api_key:
        logger.warning("RESEND_API_KEY not set — skipping receipt email")
        return
    try:
        resend.Emails.send({
            "from":    FROM_EMAIL,
            "to":      [user_email],
            "subject": "Payment Confirmed — RankBattle UPSC",
            "html":    _base_template(_receipt_content(user_name, plan, payment_id)),
        })
        logger.info("Receipt email sent to %s (plan=%s)", user_email, plan)
    except Exception as e:
        logger.error("Failed to send receipt email to %s: %s", user_email, e)