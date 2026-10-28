from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from . import mail, release
from .models import User

NAG_DAYS = (0, 7, 14)       # emails to the user after due date
CONTACT_ALERT_DAY = 30      # then ask contacts


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
        if overdue in NAG_DAYS:
            mail.send(u.email, "Ante Mortem — still here?",
                      f"Tap to check in: {settings.APP_URL}/checkin/{u.checkin_token}")
        if overdue == CONTACT_ALERT_DAY:
            for c in u.contacts.all():
                mail.send(c.email, f"Has anyone heard from {u.display_name or u.handle}?",
                          f"They've missed their check-in. If they have died, attest here: "
                          f"{settings.APP_URL}/c/{c.access_token}")

        # Timelock backstop: round reached regardless of attestation.
        note = getattr(u, "public_note", None)
        if note and release.current_round() >= note.tlock_round:
            release.try_release(u)
