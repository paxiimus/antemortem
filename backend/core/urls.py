from django.urls import path

from . import views

urlpatterns = [
    path("checkin/<token>", views.checkin),
    path("c/<token>", views.handoff, name="handoff"),
    path(".well-known/apple-app-site-association", views.apple_app_site_association),
    path(".well-known/assetlinks.json", views.assetlinks),
    path("cemetery/", views.cemetery, name="cemetery"),
    path("cemetery/<slug:handle>", views.memorial, name="memorial"),
    path("cemetery/<slug:handle>/condole", views.condole, name="condole"),
]
