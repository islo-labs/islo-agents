# Reproduce a reported bug

Confirm the reported bug is real and capture it in a test that fails for the reported reason. You do not fix it here.

The invoking message gives you the repository checkout, the working branch, the base branch, the directory holding the Slack message and its attachments, and the report text. Work in the checkout given above. The working branch given above is already checked out.

## Read the whole report first

The report text in the invoking message is only part of the report. Read everything in the Slack directory given above before you touch code.

1. `manifest.json` lists every attachment with its name, mimetype and on-disk path.
2. `message.txt` is the full message text as posted.
3. Every file the manifest names.

Screenshots and screen recordings are usually the most informative part of a bug report. Open every image. Step through every recording. They show the exact screen, the exact input and the exact error text, which the prose almost never does. Read error strings out of the image rather than guessing what they probably said.

Before you continue, state what the reporter did, what they saw, and what they expected instead. If the report is ambiguous, take the reading the attachments support.

## Find the behaviour in the code

Locate the code that produces the reported behaviour. Read it and its callers until you can name the cause, not the symptom. A test that reproduces by coincidence is worse than no test, because the fix stage will then chase the wrong thing.

## Discover this repository's test conventions

Do not assume a test layout. Discover it.

1. Read the CI configuration to see which suites exist and how each one is invoked.
2. Read the test runner configuration for the suite you intend to use.
3. Read several existing tests of the kind you need, as close as possible to the code you are about to test.

Add your new test where a test of that kind already lives, in that repository's idiom. Reuse its fixtures, its helpers, its naming and its assertion style. Do not add a test framework, a runner or a dependency this repository does not already use. If more than one suite could express the bug, pick the cheapest one that can still fail for the reported reason.

## Make it fail for the right reason

Write the test to assert the correct behaviour, so it fails on the bug as reported. Then run it and read the failure.

The failure must be the reported one. A test that fails on a missing fixture, a mistake in your own setup, an unrelated pre-existing failure or an environment problem has reproduced nothing. Work on the test until the failure text matches what the report describes, then run it twice to confirm it is not flaky.

Run the surrounding suite once as well. If something there was already failing before your change, note that in the commit message so a later stage does not chase it.

## Do not fix the bug

This stage captures the bug. It does not repair it.

- Change no product code.
- Do not adjust the assertion to accommodate the current behaviour.
- Do not skip, delete or loosen any other test.

## Commit

Commit only the new failing test, on the working branch given above. Nothing else. Do not push and do not open a pull request.

## Outputs

Set `failing_test` to the path and name of the test you added.

Set `reproduced` to true only when the new test fails for the reason the report describes. Set it to false when the report cannot be turned into a failing check, and then use `failing_test` to say why in one or two sentences. Not reproducible is a real and useful answer. A plausible-looking test you cannot tie to the report is not.
