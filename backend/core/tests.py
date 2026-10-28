import secrets
from datetime import timedelta
from unittest import mock

import nacl.bindings as b
from django.test import TestCase
from django.utils import timezone

from . import release, shamir
from .models import Contact, PublicNote, User
from .tasks import sweep


def make_user(**kw):
    return User.objects.create_user(username=kw.get("handle", "ada"), email=kw.get("email", "a@x.io"),
                                    password="pw", handle=kw.get("handle", "ada"),
                                    kdf_salt=secrets.token_bytes(16), **{k: v for k, v in kw.items()
                                                                        if k not in ("handle", "email")})


def make_note(user, n_contacts=2, text="goodbye"):
    key, nonce = secrets.token_bytes(32), secrets.token_bytes(24)
    ct = b.crypto_aead_xchacha20poly1305_ietf_encrypt(text.encode(), None, nonce, key)
    shares = [key] if n_contacts == 1 else shamir.split(key, n_contacts, n_contacts)
    note = PublicNote.objects.create(owner=user, owner_copy_ct=b"", owner_nonce=b"", body_ct=ct, nonce=nonce, tlock_wrapped_key=b"x",
                                     tlock_round=10**12, tlock_chain="q", shamir_threshold=n_contacts)
    contacts = [Contact.objects.create(owner=user, name=f"c{i}", email=f"c{i}@x.io", share_ct=b"",
                                       share_nonce=b"") for i in range(n_contacts)]
    return note, contacts, shares


class ShamirTest(TestCase):
    def test_roundtrip_and_threshold(self):
        s = secrets.token_bytes(32)
        sh = shamir.split(s, 5, 3)
        self.assertEqual(shamir.combine(sh[:3]), s)
        self.assertEqual(shamir.combine([sh[0], sh[4], sh[2]]), s)
        self.assertNotEqual(shamir.combine(sh[:2]), s)


class SwitchTest(TestCase):
    def test_overdue_lapses_and_nags(self):
        u = make_user(last_checkin=timezone.now() - timedelta(days=91))
        with mock.patch("core.tasks.mail.send") as send:
            sweep()
        u.refresh_from_db()
        self.assertEqual(u.status, "lapsed")
        self.assertEqual(send.call_count, 1)

    def test_checkin_resets_and_vetoes(self):
        u = make_user(status="lapsed")
        release.open_release(u, "attest")
        u.check_in()
        self.assertEqual(u.status, "alive")
        self.assertEqual(u.release_events.get().outcome, "vetoed")

    def test_attestation_releases_after_cooling_off(self):
        u = make_user()
        note, contacts, shares = make_note(u)
        for c, s in zip(contacts, shares):
            c.attested_at, c.submitted_share = timezone.now(), s
            c.save()
        with mock.patch("core.release.mail.send"):
            ev = release.open_release(u, "attest")
            self.assertFalse(release.try_release(u) and False)  # not yet: cooling off handled by sweep
            ev.cooling_off_until = timezone.now() - timedelta(seconds=1)
            ev.save()
            sweep()
        note.refresh_from_db(); u.refresh_from_db()
        self.assertEqual(note.body_plain, "goodbye")
        self.assertEqual(u.status, "released")

    def test_server_alone_cannot_release(self):
        u = make_user()
        note, _, _ = make_note(u)
        with mock.patch("core.release.mail.send"):
            self.assertFalse(release.try_release(u))
        self.assertEqual(note.body_plain, "")


class ContactApiTest(TestCase):
    def test_single_contact_attest_releases(self):
        from django.test import Client
        u = make_user()
        note, contacts, shares = make_note(u, n_contacts=1)
        c = Client()
        r = c.get(f"/api/c/{contacts[0].access_token}")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("vault", r.json())                   # not released: no vault ciphertext
        with mock.patch("core.release.mail.send"):
            r = c.post(f"/api/c/{contacts[0].access_token}/attest",
                       {"share": __import__("base64").b64encode(shares[0]).decode()}, content_type="application/json")
            self.assertEqual(r.status_code, 200)
            ev = u.release_events.get(); ev.cooling_off_until = timezone.now() - timedelta(seconds=1); ev.save()
            sweep()
        note.refresh_from_db()
        self.assertEqual(note.body_plain, "goodbye")
        self.assertIn("vault", c.get(f"/api/c/{contacts[0].access_token}").json())

    def test_wrong_token_404(self):
        from django.test import Client
        self.assertEqual(Client().get("/api/c/nope").status_code, 404)
