from django.urls import path
from rest_framework.routers import DefaultRouter

from . import api, contact_api, health

r = DefaultRouter()
r.register("vault", api.VaultViewSet, basename="vault")
r.register("contacts", api.ContactViewSet, basename="contacts")

urlpatterns = [
    path("health/live/", health.live),
    path("health/ready/", health.ready),
    path("auth/register", api.register),
    path("auth/login", api.login),
    path("me", api.Me.as_view()),
    path("me/checkin", api.checkin),
    path("note", api.PublicNoteView.as_view()),
    path("c/<token>", contact_api.contact_view),
    path("c/<token>/attest", contact_api.contact_attest),
] + r.urls
