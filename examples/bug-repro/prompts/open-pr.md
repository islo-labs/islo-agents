# Push the branch and open the pull request

Ship the finished fix. The bug has already been reproduced, fixed, reviewed and verified, and the evidence artifact is already committed. You write no code here.

The invoking message gives you the repository in owner/name form, the repository checkout, the working branch, the base branch, the path of the evidence artifact, and the report text. Work in the checkout given above. The working branch given above is already checked out.

## Confirm the branch is complete

1. The working tree is clean. Nothing this fix needs is uncommitted or untracked.
2. The evidence artifact given above exists at that path and is committed, not merely sitting on disk.
3. Every fix commit is on this branch, and the branch still carries the test that captures the bug.

If any of these is false, stop and report exactly what is missing. Do not commit work of your own to paper over the gap, and do not regenerate the evidence.

## Push

Push the working branch to the remote, setting upstream on the first push. If the remote branch already exists, push the new commits onto it.

Never force-push. Never rebase, squash or amend anything already pushed.

## Open or update the pull request

Use `gh`, which is already authenticated in this environment. Check whether a pull request for this branch already exists before you create one.

If none exists, open one against the base branch given above.

- **Title.** A `fix:` prefix and one line naming the cause, not the symptom. Someone scanning a list of branches should learn from the title what was actually wrong.
- **Body.** Four parts, in this order.
  1. The original report, quoted, so a reviewer sees what was asked without leaving the pull request.
  2. The cause, in a short paragraph. What was wrong, and why it produced the reported behaviour.
  3. The test that captures the bug, by file path and test name, with one line on what it asserts.
  4. The evidence artifact, linked by its path in the repository, with one line on what a reviewer will see in it.

If a pull request already exists, push the updates and add a comment on it. The comment says what changed since the last push and where the evidence artifact is. Leave the original body alone.

## Outputs

Set `pr_url` to the pull request URL, whether you opened it or found it already open.

If you stopped before a pull request existed, say plainly what was missing and which of the checks above failed. Do not report a URL you did not read back from the remote.
