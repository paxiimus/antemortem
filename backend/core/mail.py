from django.conf import settings
from postmarker.core import PostmarkClient


def send(to: str, subject: str, body: str):
    if not settings.POSTMARK_TOKEN:
        print(f"[mail] to={to} subject={subject}\n{body}")
        return
    PostmarkClient(server_token=settings.POSTMARK_TOKEN).emails.send(
        From=settings.DEFAULT_FROM_EMAIL, To=to, Subject=subject, TextBody=body,
        MessageStream=settings.POSTMARK_STREAM)
