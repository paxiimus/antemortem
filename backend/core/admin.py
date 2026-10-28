from django.contrib import admin

from .models import Condolence, Contact, PublicNote, ReleaseEvent, User, VaultEntry

for m in (User, VaultEntry, PublicNote, Contact, ReleaseEvent, Condolence):
    admin.site.register(m)
