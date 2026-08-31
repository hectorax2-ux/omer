#!/usr/bin/env bash
set -euo pipefail

BUNDLE_PATH="${1:?Pass the generated Android App Bundle path}"
EXPECTED_SHA1="4E:ED:3A:C6:45:FD:F0:2C:E7:18:18:0F:FC:67:01:72:B4:93:B1:D5"
test -f "$BUNDLE_PATH"

# Verify signed contents as well as the certificate. Keystore preflight alone
# cannot tell whether Gradle actually used that key to sign the final bundle.
if ! VERIFICATION_OUTPUT=$(jarsigner -verify "$BUNDLE_PATH" 2>&1); then
  printf '%s\n' "$VERIFICATION_OUTPUT" >&2
  exit 1
fi
ACTUAL_SHA1=$(keytool -J-Duser.language=en -printcert -jarfile "$BUNDLE_PATH" |
  sed -n 's/^[[:space:]]*SHA1: //p' | tr -d '\r')
if [ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]; then
  echo "Android App Bundle rejected: final signer does not match the Google Play upload certificate."
  echo "Expected SHA1: $EXPECTED_SHA1"
  echo "Actual SHA1: ${ACTUAL_SHA1:-unsigned}"
  exit 1
fi
echo "Verified final Android App Bundle signer: $ACTUAL_SHA1"
