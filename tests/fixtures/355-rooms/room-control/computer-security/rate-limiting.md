---
framework: 12 Leverage Points
---

# Rate limiting to protect the login service

After a credential-stuffing incident last year, the team added a rate limiter in front of the login endpoint: no single account or source address is allowed more than a fixed number of login attempts inside a rolling window, and anything past that cap gets delayed or rejected outright rather than processed immediately. The login service itself did not get any faster or more secure at handling an individual request; what changed is the maximum volume of requests allowed to reach it per unit time from any one source.

The security lead framed the fix, after the fact, less as "stopping bad login attempts" and more as "capping throughput so that whatever is downstream, whether it is a database under load or a human reviewing alerts, never receives more than it can actually absorb in a given window." The cap does not distinguish a malicious flood from a legitimate surge, an intentional trade the team accepted, since protecting the downstream capacity mattered more than letting every legitimate edge case through uninspected.
