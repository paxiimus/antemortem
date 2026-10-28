"""Contact-facing API. Contacts are not users; the access token in the URL is the credential.
All decryption happens in the contact's app. The server only sees the plain Shamir share
*after* the contact chooses to submit it, which is the attestation itself."""
import base64

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from . import release
from .models import Contact

b64 = lambda v: base64.b64encode(bytes(v)).decode()


class ContactThrottle(AnonRateThrottle):
    rate = "20/min"


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([ContactThrottle])
def contact_view(req, token):
    c = get_object_or_404(Contact, access_token=token)
    o = c.owner
    out = {
        "owner": {"handle": o.handle, "display_name": o.display_name, "status": o.status,
                  "kdf_salt": b64(o.kdf_salt)},
        "contact": {"name": c.name, "attested_at": c.attested_at,
                    "share_ct": b64(c.share_ct), "share_nonce": b64(c.share_nonce)},
    }
    if o.status == "released":
        out["vault"] = [{"title_ct": b64(e.title_ct), "body_ct": b64(e.body_ct), "nonce": b64(e.nonce),
                         "blob_ct": b64(e.blob_ct) if e.blob_ct else None, "blob_mime": e.blob_mime}
                        for e in o.vault.all()]
    return Response(out)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ContactThrottle])
def contact_attest(req, token):
    c = get_object_or_404(Contact, access_token=token)
    o = c.owner
    if o.status == "released":
        return Response({"detail": "already released"}, 409)
    try:
        c.submitted_share = base64.b64decode(req.data["share"], validate=True)
    except Exception:
        return Response({"share": "base64 required"}, 400)
    c.attested_at = c.attested_at or timezone.now()
    c.save()
    if not o.contacts.filter(attested_at=None).exists():
        release.open_release(o, "attest")
    return Response({"attested_at": c.attested_at, "owner_status": o.status})
