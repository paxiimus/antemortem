from django.db import connection
from django.http import JsonResponse
from redis import Redis
from django.conf import settings


def live(_):
    return JsonResponse({"status": "ok", "version": settings.APP_VERSION})


def ready(_):
    checks = {}
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"fail: {e}"
    try:
        Redis.from_url(settings.CELERY_BROKER_URL, socket_timeout=2).ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"fail: {e}"
    ok = all(v == "ok" for v in checks.values())
    return JsonResponse({"status": "ok" if ok else "degraded", "version": settings.APP_VERSION, **checks},
                        status=200 if ok else 503)
