---
type: cutover-notice
version: "v2.0.0-beta.19"
status: drafted
gmail_draft_id: ""
subject: "MindrianOS is moving its methodology graph to a new home"
sent_to: []
style_deviations:
  - "This is a narrower cutover notice, not a full release announcement, so it does not
    follow docs/testers/STYLE-GUIDE.md's 8-section structure, the BCC-from-REGISTRY.md
    protocol, the gratitude block, or the De Stijl HTML build (Contract 2/3). Plan
    339-10-PLAN.md's own action spec gives this note a 6-item plain-language content list
    instead, and that spec is followed exactly. The style guide's Feynman-writing,
    no-em-dash, and website-link-in-three-places rules (Contract 1 and the 2026-05-25 HARD
    RULE) ARE followed in full."
  - "The style guide's own worked examples (around its lines 44-47) contain em-dashes. This
    repo's CLAUDE.md hard rule (no em-dashes anywhere, use hyphens) overrides those examples;
    this note carries zero em-dash characters, verified by grep."
  - "The style guide's canonical website link (mindrianos-jsagirs-projects.vercel.app, a
    minisite) is superseded by the later 2026-06-09 hard rule that mindrian-os.com is the
    single canonical web surface; this note links to mindrian-os.com in all three required
    places, not the retired minisite."
  - "No Gmail draft was created for this note (status stays drafted, sent_to stays empty,
    gmail_draft_id stays blank). Sending is the operator's, only after Theo 09-12 Task 3
    fixes a real suspend date. This deviates from the outbox protocol's usual step 6-7
    (file via Gmail MCP, capture the draft id) by design -- there is no date yet to send
    against."
---

# MindrianOS is moving its methodology graph to a new home

Website: [mindrian-os.com](https://mindrian-os.com)

## What is changing

The methodology graph Larry consults when you use MindrianOS is moving to a new home.
Think of it as the library moving buildings while the librarian (Larry) stays exactly the
same. Nothing about how you use MindrianOS changes: the same commands, the same skills, the
same conversations with Larry.

## What you need to do (this is the whole ask)

Run these two commands, in order:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

The first command refreshes the catalog. The second installs the newest version. That is
the entire fix, for everyone, no exceptions.

## Why it matters

We are being direct about this rather than softening it: the old graph service will be
suspended after a soak window once the new one has proven itself. An install that has not
run the two commands above by then will not be able to reach the graph, and Larry will
refuse honestly rather than quietly making something up. That is by design. Larry never
fakes methodology he cannot actually reach. The fix is the same two commands above, and
running them now means you never notice the switch happen.

## When does the old graph get suspended

**[SUSPEND-DATE-PLACEHOLDER -- NOT YET SET]**

We do not have this date yet. It gets fixed once the new graph clears its own
readiness check on the other side (an internal task, not yours to track). As soon as that
date is set, we will send a short reminder one week before it, with the date and the same
two commands, and nothing else. This note is being filed now so the ask is on record; no
suspend date is promised here that we cannot keep.

## What might feel a little different for a while

Two Larry commands, `/mos:leadership` and the due-diligence consults, may answer a bit
thinner than usual for a while. That is because a small slice of the graph's content (about
30 framework names, out of several hundred) is still being moved across to the new home. If
you ask one of those questions during this window, Larry will tell you honestly that
coverage is thin there rather than pretending otherwise or making something up. It is not a
bug and not an error; it closes on its own as that last slice of content finishes moving.

## If you have a Claude Desktop or Cowork connector you set up by hand

Most testers do not need to read this section. If you never manually added a `mindrian-brain`
entry to a `claude_desktop_config.json` or a Cowork connector file, skip it -- the two
commands above cover you completely.

If you DID set one up by hand: we cannot reach that file from a release, because it lives on
your own machine, not in any repository. You need to update it yourself. Change the URL to:

```
https://theo-mcp.onrender.com/mcp
```

The connector KEY stays exactly the same: `mindrian-brain`. You are not creating a new
connector, only pointing the existing one at its new address. Full setup details, including
what to do if you run into trouble, are at `docs/brain-setup.md` in the plugin repo.

## Questions

Just reply to this email. We read every one.

Thank you for testing with us. You are why this release ships sane.

Js.

---

MindrianOS -- [mindrian-os.com](https://mindrian-os.com)

<!-- corporate footer, per the 2026-05-25 website-link hard rule (place 2 of 3) -->
&nbsp;

---

**MINDRIAN**
[mindrian-os.com](https://mindrian-os.com)

<!-- logo wordmark linking back to the site, per the 2026-05-25 website-link hard rule
     (place 3 of 3). The canonical five-rectangle Mondrian mark rebuilds as an HTML table
     at send time per STYLE-GUIDE.md Contract 3; this markdown draft carries the wordmark
     text linked to the same URL as a placeholder for that table build. -->

---

# SUSPEND-MINUS-ONE-WEEK REMINDER (second note, drafted here, NOT sent from this phase)

This is the short reminder note referenced above. It is drafted now so both notes exist
together, per 339-RESEARCH.md's Open Question 4 recommendation (draft both at the flip cut,
file both, send only the first). It is sent, if at all, only after the suspend date above is
a real date and only one week before it.

**Subject:** One week left -- update MindrianOS before [SUSPEND-DATE-PLACEHOLDER -- NOT YET SET]

**Body (short, by design):**

The old MindrianOS methodology graph gets suspended on **[SUSPEND-DATE-PLACEHOLDER -- NOT
YET SET]**, one week from today. If you have not already, run these two commands:

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
```

That is the whole fix. Thank you.

Js.

Website: [mindrian-os.com](https://mindrian-os.com)

---

## Filing notes (not part of the email body)

- Filed under Phase 339, plan 339-10 (D-11). Status: `drafted`. Not sent.
- The suspend date in both notes above is an explicit, unmissable bracketed placeholder in
  BOTH the subject line and the body of each note, never a guessed date. No date is set
  before Theo's own 09-12 Task 3 fixes one.
- `version` in the frontmatter is a placeholder token, not a number, per 339-RESEARCH.md
  Pitfall 2: `release.sh` computes the real version at cut time, and this repo's plan 339-14
  is the one that fills it in after the tag lands.
- Sending either note is the operator's decision, never automatic.
