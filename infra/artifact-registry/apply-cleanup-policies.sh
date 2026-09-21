#!/usr/bin/env bash
#
# Installs Artifact Registry cleanup policies for the container images that pile
# up on every deploy.
#
# Two pipelines push an image each time they run, and nothing ever pruned them:
#   - `gcloud run deploy --source ./backend` in .github/workflows/firebase-deploy.yml
#     builds through Cloud Build into the `cloud-run-source-deploy` repository.
#   - `firebase deploy --only functions` stages its function builds in `gcf-artifacts`.
#
# Artifact Registry bills storage per GB-month on everything ever pushed, so both
# repositories grow without bound long after the images stop being useful.
#
# Cleanup policies evaluate Keep rules ahead of Delete rules, so the newest images
# survive the age rule no matter how old they are. That ordering is what stops the
# policy from collecting the image a live Cloud Run revision is pinned to —
# deleting that would leave running instances alone but break the next cold start.
#
# Runs in dry-run mode unless `--apply` is passed. A dry-run policy is installed
# and evaluated but deletes nothing, which is how to see the blast radius before
# committing to it.

set -euo pipefail

PROJECT="${PROJECT:-autotrader-b8851}"
LOCATION="${LOCATION:-europe-west1}"
# Firebase's own default is 1 day, since these images are only needed at deploy
# time. 7 leaves room to inspect a bad build before it is collected.
FUNCTIONS_RETENTION_DAYS="${FUNCTIONS_RETENTION_DAYS:-7}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="$SCRIPT_DIR/cloud-run-cleanup-policy.json"

if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN_FLAG="--no-dry-run"
  echo "MODE: APPLY — images matching the delete rule will be removed."
else
  DRY_RUN_FLAG="--dry-run"
  echo "MODE: DRY RUN — the policy is installed but deletes nothing."
  echo "      Re-run with --apply once the logged candidates look right."
fi
echo

echo "Repositories before:"
gcloud artifacts repositories list --project="$PROJECT" --format="table(name,format,sizeBytes)"
echo

echo "==> cloud-run-source-deploy ($LOCATION)"
gcloud artifacts repositories set-cleanup-policies cloud-run-source-deploy \
  --project="$PROJECT" \
  --location="$LOCATION" \
  --policy="$POLICY_FILE" \
  "$DRY_RUN_FLAG"
echo

echo "==> gcf-artifacts ($LOCATION)"
# Firebase owns this repository's layout, so its own command is used rather than a
# hand-written policy. It has no dry-run mode, so it is only touched under --apply.
if [[ "$DRY_RUN_FLAG" == "--no-dry-run" ]]; then
  firebase functions:artifacts:setpolicy \
    --project "$PROJECT" \
    --location "$LOCATION" \
    --days "$FUNCTIONS_RETENTION_DAYS" \
    --force
else
  echo "Skipped in dry run: 'firebase functions:artifacts:setpolicy' has no dry-run mode."
  echo "Under --apply it runs with --days $FUNCTIONS_RETENTION_DAYS."
fi

echo
echo "Done. Deletions are asynchronous; check the repository sizes again after a day."
