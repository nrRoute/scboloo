#!/usr/bin/env bash
set -euo pipefail

source_dir="dist/firefox"
manifest_path="${source_dir}/manifest.json"
artifacts_dir="packages"

if [ ! -f "${manifest_path}" ]; then
  echo "manifest not found: ${manifest_path}" >&2
  exit 1
fi

version="$(node -p "require('./${manifest_path}').version")"
artifact_path="${artifacts_dir}/scboloo-${version}.zip"

mkdir -p "${artifacts_dir}"
rm -f "${artifact_path}"

(
  cd "${source_dir}"
  zip -qr "../../${artifact_path}" .
)

echo "Created ${artifact_path}"
