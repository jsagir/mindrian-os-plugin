---
methodology: causal
---

# Signature-based intrusion detection

The security team's intrusion detection system does not try to understand what an attacker is doing in any general sense; it keeps a large, continuously updated library of signatures, specific byte patterns or behavior sequences pulled from previously observed attacks, and checks every incoming request against that library for a match. A match that scores above the threshold gets blocked or flagged before it can do anything.

This approach is fast and cheap to run at scale precisely because it is not doing any real-time reasoning about intent, it is doing a lookup against a stored record of things that have already happened once before. The obvious cost is that it is only as good as the library: an attack technique that has never been seen and signatured before sails through undetected, which is why the security lead keeps saying, in nearly every quarterly review, that this system catches the attacks the team has already survived once, and nothing genuinely new, by design rather than by accident.
