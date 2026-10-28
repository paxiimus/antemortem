from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from . import release
from .models import CheckIn, Condolence, Contact, PublicNote, User


def checkin(req, token):
    u = get_object_or_404(User, checkin_token=token)
    u.check_in()
    CheckIn.objects.create(user=u, via="email")
    return render(req, "core/checkin.html", {"user": u})


def handoff(req, token):
    """Contact links from email land here. Nothing is decrypted in the browser: the page
    deep-links into the app, which does the crypto with store-signed code."""
    c = get_object_or_404(Contact, access_token=token)
    return render(req, "core/handoff.html", {"contact": c, "owner": c.owner, "token": token,
                                             "ios_url": settings.IOS_URL, "android_url": settings.ANDROID_URL})


def cemetery(req):
    notes = PublicNote.objects.exclude(released_at=None).select_related("owner").order_by("-released_at")
    return render(req, "core/cemetery.html", {"notes": notes[:100]})


def memorial(req, handle):
    owner = get_object_or_404(User, handle=handle)
    note = getattr(owner, "public_note", None)
    ctx = {"owner": owner, "note": note if note and note.released_at else None}
    if ctx["note"]:
        ctx["condolences"] = note.condolences.filter(hidden=False).select_related("author")
    return render(req, "core/memorial.html", ctx)


@login_required
@require_POST
def condole(req, handle):
    note = get_object_or_404(PublicNote, owner__handle=handle, released_at__isnull=False)
    body = req.POST.get("body", "").strip()[:2000]
    if body:
        Condolence.objects.create(note=note, author=req.user, body=body)
    return redirect("memorial", handle=handle)


def apple_app_site_association(_):
    """Universal links: https://<domain>/c/* opens the iOS app."""
    from django.http import JsonResponse
    return JsonResponse({"applinks": {"apps": [], "details": [{"appID": settings.IOS_APP_ID, "paths": ["/c/*"]}]}})


def assetlinks(_):
    """App Links: same for Android."""
    from django.http import JsonResponse
    return JsonResponse([{"relation": ["delegate_permission/common.handle_all_urls"],
                          "target": {"namespace": "android_app", "package_name": "com.paxiimus.antemortem",
                                     "sha256_cert_fingerprints": settings.ANDROID_CERT_FINGERPRINTS}}], safe=False)
