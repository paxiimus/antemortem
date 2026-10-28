from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env(DEBUG=(bool, False))

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])
APP_URL = env("APP_URL", default="http://localhost:8000")   # public cemetery / email links
APP_VERSION = env("APP_VERSION", default="dev")
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
if not DEBUG and not CORS_ALLOWED_ORIGINS:
    raise RuntimeError("CORS_ALLOWED_ORIGINS must be set in production")

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "rest_framework.authtoken", "corsheaders", "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "antemortem.urls"
WSGI_APPLICATION = "antemortem.wsgi.application"
AUTH_USER_MODEL = "core.User"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [], "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

if env("DB_NAME", default=""):
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"), "USER": env("DB_USER"), "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="db"), "PORT": env("DB_PORT", default="5432"),
        "CONN_MAX_AGE": env.int("DB_CONN_MAX_AGE", default=60),
    }}
else:
    DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR}/db.sqlite3")}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "60/min"},
}

CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_TIMEZONE = "UTC"

POSTMARK_TOKEN = env("POSTMARK_TOKEN", default="")
POSTMARK_STREAM = env("POSTMARK_STREAM", default="antemortem")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@localhost")

# Release policy
MAX_VAULT_BLOB_BYTES = 5 * 1024 * 1024
ATTESTATION_COOLING_OFF_DAYS = 14
MIN_TLOCK_MULTIPLIER = 2  # tlock horizon >= this x check-in interval
IOS_URL = env("IOS_URL", default="https://apps.apple.com/")
IOS_APP_ID = env("IOS_APP_ID", default="TEAMID.com.paxiimus.antemortem")          # <TeamID>.<bundle id>
ANDROID_CERT_FINGERPRINTS = env.list("ANDROID_CERT_FINGERPRINTS", default=[])  # from EAS credentials
ANDROID_URL = env("ANDROID_URL", default="https://play.google.com/")
TLOCK_CLI = env("TLOCK_CLI", default="/app/crypto/dist/cli.js")

if not DEBUG:
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)  # Caddy redirects 80→443 itself
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {"staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"}}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
TIME_ZONE = "UTC"
USE_TZ = True
