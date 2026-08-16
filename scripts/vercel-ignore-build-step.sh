#!/usr/bin/env bash
# Vercel "Ignored Build Step" — skips the build when every changed file is
# documentation, so a PROGRESS.md/README.md/CLAUDE.md-only commit doesn't
# spend a full Next.js build for a change no runtime code path reads.
#
# Vercel's exit-code contract is the opposite of normal shell success/failure:
#   exit 0  -> skip this build
#   exit 1  -> proceed with the build
#
# Deliberately fails open: if the diff can't be determined for any reason
# (shallow clone missing history, first-ever deploy), it builds anyway. A
# build that runs unnecessarily costs a few minutes; a build that gets
# silently skipped when it shouldn't have is a much worse failure mode — the
# site would keep serving stale code with no error anywhere.

set -u

PREV_SHA="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$PREV_SHA" ]; then
  echo "No previous deployed commit to diff against (first deploy, or a new branch) — building."
  exit 1
fi

if ! git cat-file -e "$PREV_SHA" 2>/dev/null; then
  echo "Previous commit $PREV_SHA isn't available locally (shallow clone) — building."
  exit 1
fi

# --quiet exits 0 when the given pathspec has NO differences. Excluding
# markdown means "no differences outside markdown" is exactly Vercel's own
# skip signal, so this doubles as the whole check with no inversion needed.
if git diff --quiet "$PREV_SHA" HEAD -- . ':(exclude)*.md' ':(exclude)**/*.md'; then
  echo "Only Markdown changed since $PREV_SHA — skipping the build."
  exit 0
else
  echo "Non-Markdown files changed since $PREV_SHA — building."
  exit 1
fi
