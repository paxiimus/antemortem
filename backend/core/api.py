import secrets

from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CheckIn, Contact, PublicNote, User, VaultEntry
from .serializers import (ContactSerializer, PublicNoteSerializer, UserSerializer,
                          VaultEntrySerializer)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(req):
    d = req.data
    u = User.objects.create_user(username=d["handle"], email=d["email"], password=d["password"],
                                 handle=d["handle"], kdf_salt=secrets.token_bytes(16))
    return Response({"token": Token.objects.create(user=u).key, **UserSerializer(u).data}, 201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(req):
    u = authenticate(username=req.data.get("email"), password=req.data.get("password"))
    if not u:
        return Response(status=401)
    t, _ = Token.objects.get_or_create(user=u)
    return Response({"token": t.key, **UserSerializer(u).data})


class Me(APIView):
    def get(self, req):
        return Response(UserSerializer(req.user).data)

    def patch(self, req):
        s = UserSerializer(req.user, data=req.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


@api_view(["POST"])
def checkin(req):
    req.user.check_in()
    CheckIn.objects.create(user=req.user, via="app")
    return Response(UserSerializer(req.user).data)


class OwnedViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return self.serializer_class.Meta.model.objects.filter(owner=self.request.user)

    def perform_create(self, s):
        s.save(owner=self.request.user)


class VaultViewSet(OwnedViewSet):
    serializer_class = VaultEntrySerializer


class ContactViewSet(OwnedViewSet):
    serializer_class = ContactSerializer


class PublicNoteView(APIView):
    """PUT replaces the note wholesale: client re-encrypts, re-wraps to a new drand round,
    and re-splits the key whenever contacts change or the user logs in."""
    def get(self, req):
        n = get_object_or_404(PublicNote, owner=req.user)
        return Response(PublicNoteSerializer(n).data)

    def put(self, req):
        n = PublicNote.objects.filter(owner=req.user).first()
        s = PublicNoteSerializer(n, data=req.data)
        s.is_valid(raise_exception=True)
        if s.validated_data["shamir_threshold"] != req.user.contacts.count():
            return Response({"shamir_threshold": "must equal number of contacts"}, 400)
        s.save(owner=req.user)
        return Response(s.data, status.HTTP_200_OK if n else status.HTTP_201_CREATED)
