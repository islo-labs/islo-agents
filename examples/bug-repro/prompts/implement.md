# Fix the reproduced bug

Make the failing test pass by fixing the cause of the bug.

The invoking message gives you the repository checkout, the working branch, the base branch, a review findings path, a verification log path, and the report text. Work in the checkout given above. The working branch given above is already checked out, and it already carries a test that fails because of this bug.

## Read the feedback before you change anything

Either of the two scratch paths given above may already exist. Check both.

- **Review findings.** If the file exists, a review stage has judged an earlier attempt. Read it and address every point in it. A point you believe is wrong still needs an answer, with a reason, in the commit message.
- **Verification log.** If the file exists, a verification run has already been spent on this branch. Read what still failed and fix that too.

If neither exists, this is the first attempt at the fix.

## Find the cause

Run the failing test and read the failure. Then read the code the test exercises until you can say why it behaves the way it does. Fix that.

A change that turns the test green without explaining the reported behaviour is not a fix. If you cannot name the cause, keep reading rather than trying edits.

## Guardrails

These are absolute.

- Do not change the test to accommodate the bug. The test is the specification of the correct behaviour.
- Do not skip, delete, loosen or mark as expected-failure any other test.
- Do not widen the change beyond the cause. No drive-by refactors, no reformatting, no unrelated cleanup, no dependency or version bumps.
- Match the surrounding code's existing patterns and style.

If the correct fix genuinely reaches further than one place, for instance because the same defect exists at two call sites, fix both and say why in the commit message. That is not the same as widening scope.

## Confirm before you commit

1. The previously failing test now passes.
2. The tests around it still pass, and the suite the CI configuration runs for the code you touched still passes.
3. Read the whole branch diff against the base branch given above, line by line. That is the diff a reviewer sees, and it includes every earlier iteration on this branch, not just your last edit. Nothing in it should be there for a reason you cannot state.

## Commit

Commit on the working branch given above. Write a message that names the cause, not the symptom. Do not push and do not open a pull request. Later stages do both.
