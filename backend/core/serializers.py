import base64

from django.conf import settings
from rest_framework import serializers

from .models import Contact, PublicNote, User, VaultEntry


class B64(serializers.Field):
    def to_representation(self, v):
        return base64.b64encode(bytes(v)).decode()

    def to_internal_value(self, s):
        try:
            return base64.b64decode(s, validate=True)
        except Exception:
            raise serializers.ValidationError("bad base64")


class UserSerializer(serializers.ModelSerializer):
    kdf_salt = B64()

    class Meta:
        model = User
        fields = ["id", "email", "handle", "display_name", "kdf_salt", "status",
                  "checkin_interval_days", "tlock_horizon_days", "last_checkin"]
        read_only_fields = ["status", "last_checkin", "kdf_salt"]

    def validate(self, d):
        interval = d.get("checkin_interval_days", getattr(self.instance, "checkin_interval_days", 90))
        horizon = d.get("tlock_horizon_days", getattr(self.instance, "tlock_horizon_days", 540))
        if not 30 <= interval <= 365:
            raise serializers.ValidationError("check-in interval must be 30-365 days")
        if horizon < settings.MIN_TLOCK_MULTIPLIER * interval:
            raise serializers.ValidationError("tlock horizon must be >= 2x check-in interval")
        return d


class VaultEntrySerializer(serializers.ModelSerializer):
    title_ct = B64()
    body_ct = B64()
    blob_ct = B64(required=False, allow_null=True)
    nonce = B64()

    class Meta:
        model = VaultEntry
        fields = ["id", "title_ct", "body_ct", "blob_ct", "blob_mime", "nonce", "updated_at"]

    def validate_blob_ct(self, v):
        if v and len(v) > settings.MAX_VAULT_BLOB_BYTES:
            raise serializers.ValidationError("blob too large")
        return v


class PublicNoteSerializer(serializers.ModelSerializer):
    owner_copy_ct = B64()
    owner_nonce = B64()
    body_ct = B64()
    nonce = B64()
    tlock_wrapped_key = B64()

    class Meta:
        model = PublicNote
        fields = ["owner_copy_ct", "owner_nonce", "body_ct", "nonce", "tlock_wrapped_key", "tlock_round", "tlock_chain",
                  "shamir_threshold", "updated_at"]


class ContactSerializer(serializers.ModelSerializer):
    share_ct = B64()
    share_nonce = B64()

    class Meta:
        model = Contact
        fields = ["id", "name", "email", "share_ct", "share_nonce", "attested_at"]
        read_only_fields = ["attested_at"]
