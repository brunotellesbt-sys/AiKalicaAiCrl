#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[1/2] Gerando APK debug..."
gradle assembleDebug

echo "[2/2] APK pronto em: app/build/outputs/apk/debug/app-debug.apk"
