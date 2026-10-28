# Security

**Ante Mortem has not been independently audited.** It has been reviewed by its author only. Don't trust it with anything you can't afford to lose.

## Reporting a vulnerability

Email contact@paxiimus.com with "Ante Mortem security" in the subject. Please don't open a public issue for anything exploitable.

- Acknowledgement within 7 days.
- A fix or a clear plan within 90 days, after which you may disclose publicly.
- Good-faith research is welcome. Don't access other users' data or degrade the service.

## Scope

In scope: the crypto package, key handling in the app, the release logic (Shamir attestation, tlock sealing, cooling-off and veto), and the server's handling of ciphertext and tokens.
Out of scope: social engineering, denial of service against the hosted instance, and anything that needs a compromised device.

## Known limits

- You must trust that the app in the store matches this source. Reproducible builds are planned, not done.
- A user's vault passphrase can't be reset. Losing it loses the vault.
- The drand network is a dependency of the tlock backstop.
