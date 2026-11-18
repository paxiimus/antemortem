import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from . import mail, release
from .models import User

log = logging.getLogger(__name__)

NAG_DAYS = (0, 7, 14)       # emails to the user at these days overdue
CONTACT_ALERT_DAY = 30      # then ask contacts


def _notify(u, overdue, now):
    """Send what is owed, then record it. Sent state lives on the user, so a skipped or failed
    run is caught up on the next one (one reminder, not one per missed day)."""
    owed = sum(overdue >= d for d in NAG_DAYS)
    if u.nags_sent < owed:
        mail.send(u.email, "Ante Mortem — still here?",
                  f"Tap to check in: {settings.APP_URL}/checkin/{u.checkin_token}")
        u.nags_sent = owed
        u.save(update_fields=["nags_sent"])
    if overdue >= CONTACT_ALERT_DAY and not u.contacts_alerted_at:
        for c in u.contacts.all():
            mail.send(c.email, f"Has anyone heard from {u.display_name or u.handle}?",
                      f"They've missed their check-in. If they have died, attest here: "
                      f"{settings.APP_URL}/c/{c.access_token}")
        u.contacts_alerted_at = now
        u.save(update_fields=["contacts_alerted_at"])


@shared_task
def sweep():
    now = timezone.now()
    for u in User.objects.exclude(status="released"):
        if u.status == "pending":
            ev = u.release_events.filter(outcome="").first()
            if ev and ev.cooling_off_until <= now:
                release.try_release(u)
            continue

        overdue = (now - u.checkin_due).days
        if overdue < 0:
            continue
        if u.status == "alive":
            u.status = "lapsed"
            u.save(update_fields=["status"])
        try:
            _notify(u, overdue, now)
        except Exception:   # a mail outage must not block other users or the timelock backstop
            log.exception("notify failed for user %s; will retry next sweep", u.pk)

        # Timelock backstop: round reached regardless of attestation.
        note = getattr(u, "public_note", None)
        if note and release.current_round() >= note.tlock_round:
            release.try_release(u)
