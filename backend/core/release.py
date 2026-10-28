"""Release logic. The server holds nothing that decrypts: no Shamir share, only a tlock
ciphertext whose key does not exist until the drand round is published, and whatever
shares contacts choose to submit after attesting."""
import base64
import json
import subprocess
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from . import mail, shamir
from .models import Condolence, PublicNote, ReleaseEvent, User

QUICKNET_GENESIS, QUICKNET_PERIOD = 1692803367, 3


def current_round(now=None) -> int:
    now = now or timezone.now()
    return int((now.timestamp() - QUICKNET_GENESIS) // QUICKNET_PERIOD) + 1


def open_release(user: User, trigger: str) -> ReleaseEvent:
    if user.release_events.filter(outcome="").exists():
        return user.release_events.get(outcome="")
    user.status = "pending"
    user.save(update_fields=["status"])
    ev = ReleaseEvent.objects.create(
        user=user, trigger=trigger,
        cooling_off_until=timezone.now() + timedelta(days=settings.ATTESTATION_COOLING_OFF_DAYS))
    mail.send(user.email, "Ante Mortem: a release has been started for you",
              f"Your contacts have reported your death. If this is wrong, log in before "
              f"{ev.cooling_off_until:%Y-%m-%d} to cancel: {settings.APP_URL}/checkin/{user.checkin_token}")
    return ev


def shares_submitted(note: PublicNote) -> list[bytes]:
    return [bytes(c.submitted_share) for c in note.owner.contacts.exclude(submitted_share=None)]


def try_release(user: User) -> bool:
    note = getattr(user, "public_note", None)
    if not note or note.released_at:
        return False
    plain = _decrypt_via_shamir(note) or _decrypt_via_tlock(note)
    if plain is None:
        return False
    note.body_plain, note.released_at = plain, timezone.now()
    note.save()
    user.status = "released"
    user.save(update_fields=["status"])
    user.release_events.filter(outcome="").update(outcome="released", resolved_at=timezone.now())
    for c in user.contacts.all():
        mail.send(c.email, f"{user.display_name or user.handle}'s vault is now available",
                  f"Open in Ante Mortem: {settings.APP_URL}/c/{c.access_token}\n"
                  f"Memorial: {settings.APP_URL}/cemetery/{user.handle}")
    return True


def _decrypt_via_shamir(note):
    shares = shares_submitted(note)
    if len(shares) < note.shamir_threshold:
        return None
    key = shares[0] if note.shamir_threshold == 1 else shamir.combine(shares[: note.shamir_threshold])
    return _aead_open(key, note)


def _decrypt_via_tlock(note):
    if current_round() < note.tlock_round:
        return None
    # tlock unwrap lives in the shared TS package; call it via node.
    out = subprocess.run(
        ["node", settings.TLOCK_CLI, "tlock-decrypt", note.tlock_chain,
         base64.b64encode(bytes(note.tlock_wrapped_key)).decode()],
        capture_output=True, text=True, timeout=60)
    if out.returncode:
        return None
    return _aead_open(base64.b64decode(out.stdout.strip()), note)


def _aead_open(key: bytes, note: PublicNote):
    import nacl.bindings as b  # PyNaCl: XChaCha20-Poly1305, matches libsodium client
    try:
        pt = b.crypto_aead_xchacha20poly1305_ietf_decrypt(
            bytes(note.body_ct), None, bytes(note.nonce), key)
        return pt.decode()
    except Exception:
        return None
