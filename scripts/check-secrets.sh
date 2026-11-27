#!/usr/bin/env bash
# ============================================================================
# scripts/check-secrets.sh
# Scans tracked files and .env templates for secrets or committed env files.
# ============================================================================
set -euo pipefail

echo "==> Scanning tracked repository files for accidental secrets or committed .env files..."

TRACKED_ENV=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env\.example$' || true)
if [ -n "$TRACKED_ENV" ]; then
  echo "ERROR: Forbidden .env file(s) tracked in git:"
  echo "$TRACKED_ENV"
  exit 1
fi

SECRET_REGEX='(AIza[0-9A-Za-z_-]{35}|sk-ant-[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)'

MATCHES=$(git grep -n -E "$SECRET_REGEX" -- ':!scripts/check-secrets.sh' ':!docs/' ':!tests/' || true)
if [ -n "$MATCHES" ]; then
  echo "ERROR: Potential credential or private key detected in tracked files:"
  echo "$MATCHES"
  exit 1
fi

if [ -f ".env.example" ]; then
  LIVE_EXAMPLE=$(grep -n -E "$SECRET_REGEX" .env.example || true)
  if [ -n "$LIVE_EXAMPLE" ]; then
    echo "ERROR: Real secret found in .env.example:"
    echo "$LIVE_EXAMPLE"
    exit 1
  fi
fi

echo "PASS: No tracked .env files or real secret patterns found."
