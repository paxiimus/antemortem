import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


def token():
    return secrets.token_urlsafe(32)


class User(AbstractUser):
    """Server never sees plaintext. These fields are all public params or ciphertext."""
    email = models.EmailField(unique=True)
    kdf_salt = models.BinaryField(max_length=32)          # Argon2id salt for vault key
    handle = models.SlugField(unique=True)                # public cemetery URL
    display_name = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=10, default="alive",
                              choices=[("alive", "alive"), ("lapsed", "lapsed"),
                                       ("pending", "pending release"), ("released", "released")])
    checkin_interval_days = models.PositiveIntegerField(default=90)
    tlock_horizon_days = models.PositiveIntegerField(default=540)
    last_checkin = models.DateTimeField(default=timezone.now)
    checkin_token = models.CharField(max_length=64, default=token)  # one-click email check-in

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    @property
    def checkin_due(self):
        return self.last_checkin + timedelta(days=self.checkin_interval_days)

    def check_in(self):
        self.last_checkin = timezone.now()
        self.checkin_token = token()
        if self.status in ("lapsed", "pending"):
            self.status = "alive"
            self.release_events.filter(outcome="").update(outcome="vetoed", resolved_at=timezone.now())
        self.save()


class VaultEntry(models.Model):
    """Private vault. Encrypted client-side under the user's vault key."""
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vault")
    title_ct = models.BinaryField()
    body_ct = models.BinaryField()
    blob_ct = models.BinaryField(null=True, blank=True)
    blob_mime = models.CharField(max_length=80, blank=True)
    nonce = models.BinaryField(max_length=24)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class PublicNote(models.Model):
    """Last words. One per user. Decryptable by tlock (drand round) OR by every contact's Shamir share.
    The server never holds any share: a disclosure order yields ciphertext and nothing else."""
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="public_note")
    owner_copy_ct = models.BinaryField()           # owner's editable copy, under the vault key
    owner_nonce = models.BinaryField(max_length=24)
    body_ct = models.BinaryField()                 # same text under a random note key K
    nonce = models.BinaryField(max_length=24)
    tlock_wrapped_key = models.BinaryField()       # note key encrypted to drand round
    tlock_round = models.BigIntegerField()
    tlock_chain = models.CharField(max_length=64)  # drand chain hash
    shamir_threshold = models.PositiveSmallIntegerField()   # == number of contacts (k-of-k). Server holds no share.
    body_plain = models.TextField(blank=True)      # filled only on release
    released_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Contact(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=120)
    email = models.EmailField()
    access_token = models.CharField(max_length=64, default=token, unique=True)
    attested_at = models.DateTimeField(null=True, blank=True)
    # Contact's Shamir share, encrypted client-side to a passphrase the owner gives them offline.
    share_ct = models.BinaryField()
    share_nonce = models.BinaryField(max_length=24)
    # Plain share, posted by the contact after death. Server only ever sees it post-attestation.
    submitted_share = models.BinaryField(null=True, blank=True)

    class Meta:
        unique_together = [("owner", "email")]


class CheckIn(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="checkins")
    at = models.DateTimeField(auto_now_add=True)
    via = models.CharField(max_length=10)  # app | email


class ReleaseEvent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="release_events")
    trigger = models.CharField(max_length=12, choices=[("attest", "attestation"), ("tlock", "timelock")])
    opened_at = models.DateTimeField(auto_now_add=True)
    cooling_off_until = models.DateTimeField()
    outcome = models.CharField(max_length=10, blank=True,
                               choices=[("released", "released"), ("vetoed", "vetoed")])
    resolved_at = models.DateTimeField(null=True, blank=True)


class Condolence(models.Model):
    note = models.ForeignKey(PublicNote, on_delete=models.CASCADE, related_name="condolences")
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    hidden = models.BooleanField(default=False)  # contacts can hide
