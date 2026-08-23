# Verify the fix and commit the evidence

Two things must be true before this fix goes to a pull request. The repository's own checks pass on this branch, and a committed artifact shows a human that the reported behaviour is now correct. Produce both.

The invoking message gives you the repository checkout, the working branch, the repository-relative evidence directory, the check log path, the check status path, and the report text. Work in the checkout given above. The working branch given above is already checked out.

## Part one. Run the repository's own checks

Discover how this repository is checked rather than guessing. Read all of these that exist.

1. The CI workflow or pipeline definitions.
2. The Makefile or task runner configuration.
3. The package manager's script definitions.
4. The commit hook or pre-commit configuration.

Then run the same install, test, lint and typecheck steps CI would run on this branch, with the same commands and the same flags. Where CI runs a matrix, run the entry closest to this environment rather than all of them, and say which one you ran.

Capture the full output of every command to the check log given above. Full output, not a summary. When something fails, that file is what the next stage reads to fix it. Write a single word to the check status file given above, `passed` when every check passed and `failed` otherwise.

If a check fails for a reason that predates this branch, prove it. Run the same check on the base commit and record both results in the log.

## Part two. Commit evidence that the behaviour is fixed

A passing check proves a check ran. Evidence shows a reviewer that the behaviour the report complained about is now correct. Commit one artifact into the evidence directory given above.

Choose the artifact from what this repository can already produce. Take the most convincing option this repository supports, working down this list.

1. A recording or trace from the repository's own browser or end-to-end suite, driving the reported flow, with whatever video or trace capture that suite already supports turned on.
2. Before and after screenshots of the affected surface, captured the way this repository captures screenshots elsewhere.
3. A captured terminal session that runs the reported steps and shows the correct result.
4. A request and response transcript for the affected endpoint, showing the corrected output.
5. As the floor, the captured output of the previously failing test, run before and after the fix, showing it now passes.

Do not build new tooling to reach a higher option. If this repository has no browser suite, do not install one. Drop to the next option instead.

The artifact must stand alone. A reviewer who has not run the code, and will not run it, has to open the file and see that the reported behaviour is correct. A raw log with no indication of what was run or what to look at is not evidence. Write a short notes file beside the artifact naming the reported behaviour, how the artifact was produced, and what to look at in it.

Add the artifact and the notes file explicitly and commit them on the working branch given above. Check the repository's ignore rules before you commit. If they exclude the file type you chose, pick a format they do not exclude rather than overriding the ignore.

## Outputs

Set `recording_path` to the repository-relative path of the artifact you committed.

Set `verdict` to `approved` only when both halves hold. Every CI-equivalent check passed, and the evidence artifact is committed on the working branch. Anything else is `needs_work`, including a passing suite with no committed evidence.

Quote the relevant part of the check log in `summary`. On a failure, quote the failing command and its actual error output rather than paraphrasing it. On success, quote the check commands and their results, and name the evidence artifact and what it shows.
