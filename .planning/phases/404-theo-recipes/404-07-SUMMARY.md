# Run 5

## Run 6

## OR-47

1. A senior engineer would mark only errors from the connection calls as connection failures. Script validation errors must return exit 1.
2. Start from the probe script, the plan, and the review finding from run 5.
3. Wrap `client.connect` and each `client.callTool` call. Set a connection flag only when that call throws and `connectionFailure(error)` returns true.
4. Verify syntax and run the probe test with temporary home paths and the closed loopback address. The reviewer-proven result is evidence, but the sandbox may block the test server.

## Finding

- Review finding: `main()` applied `connectionFailure()` to every probe error. Script errors without HTTP status therefore returned exit 2. The fix marks connection errors at the source and makes `main()` return exit 2 only when `error.connection === true`. Other probe errors return exit 1.

## OR-47

1. A senior engineer would preserve all 4 probe requests and classify failures from the full error chain. The brief does not yet state these repairs.
2. Start from the probe script, its test, and the 2 reviewer findings. These are the raw code and observed results.
3. Read the error chain for HTTP status and network codes. Run the probe test with temporary home paths and a closed loopback address.
4. The test result provides evidence. It must show 4 requests for PR11, exit 2 for PR6, and no output file on either failure.

## Findings

- PR6: the fetch error for port 9 has no HTTP status and no network code. Treat a failure without an HTTP status anywhere in its cause chain as a connection failure. Keep the network code list.
- PR11: the probe stops on the first non-refusal. Send all 4 fixed inputs in order, then decide. Write only when every result is the required refusal with 0 upstream calls. A connection failure returns exit 2.

STATUS: PARTIAL
CHANGED: tools/404/probe-theo-context.cjs; this summary. No commit was made.
VERIFIED: `node --check tools/404/probe-theo-context.cjs` passes. The probe test starts but fails before cases because loopback listen returns EPERM.
UNVERIFIED: PR2, PR3, PR4, PR5, PR6 and PR11 end-to-end cases. The sandbox blocks loopback listen. No deployed server was used.
RISKS: The reviewer must run the probe test outside the sandbox. No contract file was written.
NEXT: Reviewer runs `node tests/test-404-probe.cjs` outside the sandbox.

## Commit list

- NONE. The linked worktree does not allow commits.

## Reviewer record (outside the sandbox)

- Commit: cd5bd9c14 (Task 1, 2 files). PROVEN.
- Red: `node tests/test-404-probe.cjs` 4 passed, 7 failed with the script absent (red/probe.txt). PROVEN.
- Green: 11 passed, 0 failed. data/theo-context-contract.json does not exist. package.json and npm-shrinkwrap.json unchanged. PROVEN.
- Defects found in review and fixed through runs 3 to 6: spawnSync blocked the in-process stub; the client package wraps the HTTP 400 refusal body as text; port 9 fails as a fetch "bad port" with no network code; the probe stopped before the 4th input; the exit code 2 was given for non-connection errors. PROVEN.
- The script was not run against the deployed server. UNVERIFIED by design.
