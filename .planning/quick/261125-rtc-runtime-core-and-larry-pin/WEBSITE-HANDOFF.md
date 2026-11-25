# Website handoff: the rooms-folder setting in the get-mindrian skill (quick 261125-rtc)

For the website session. Revised the same day. The first version of this file proposed lines that name Larry. The website owner ruling of 2026-11-18 ("Theo is the mos avatar not larry") rules those out, so they are withdrawn.

## (a) What needs no change

- The setup sentence (`AGENT_SENTENCE`, claim C-83) and `SETUP_SOURCE_URL` name the raw address of the skill. The address did not move, and the site keeps no copy of the procedure.
- The skill at that address is marketplace commit a6e71b4d165c936a713991c791a99444f44dcf04 (pushed 2026-11-25).

## (b) What was changed, on a local branch

- Worktree `/home/jsagi/dev/mw-261125-install-trust`, branch `quick/261125-install-trust-rooms-setting`, commit bf3e07af, from `book-site` HEAD. The dirty tree of `/home/jsagi/dev/mindrian-website` was not touched.
- The trust part of the install chooser gains one line: "It also asks before it changes a setting in your rooms folder. Your other folders and your own settings stay as they are." Claim C-99, register row SRC-32, which now names the commit above and holds one more needle.
- Gate IC8 of `check-site-install-chooser.mjs` learns the line, with one negative control.
- Gates run on the branch: the chooser source clauses 5/5, check-site-sources 28/28, check-claims 18 pass 0 fail, check-docs-copy 35/35, check-copy 4/4, check-site-copy-sweep 5/5, tsc clean.

## (c) What the website session still has to do

1. Review bf3e07af and merge it into `book-site`.
2. Run the rendered clauses IC2 to IC10 and the browser clauses against a served build. They were not run.
3. Deploy. Nothing was deployed.

## (d) Not verified

- What the live site serves today. Requests to mindrian-os.com got no HTTP answer from this machine, and a search-tool read of /docs/install returned a page with the `npx @mindrian_os/cli` steps and no setup sentence. `book-site` was 519 commits ahead of its remote.

## (e) A naming fact the two sessions should share

The site calls the avatar Theo. The product replies open with `Larry | MindrianOS`, the install skill speaks of "Larry's sign", and the pin value is `mos:larry-extended`. The owner asked on 2026-11-25 to rename the agent to `/m:os-Theo_Local` (open decision O-6 of this quick).
