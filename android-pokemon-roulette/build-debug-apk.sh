#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Kotlin/AGP dessa base funciona melhor com Java 17/21.
# Se o ambiente estiver usando Java 25+, tenta automaticamente Java 17 (mise).
if java -version 2>&1 | head -n 1 | grep -q '"2[5-9]\.'; then
  JAVA17_MISE="/root/.local/share/mise/installs/java/17.0.2"
  if [ -d "$JAVA17_MISE" ]; then
    export JAVA_HOME="$JAVA17_MISE"
    export PATH="$JAVA_HOME/bin:$PATH"
    echo "[info] Java 25+ detectado. Usando JAVA_HOME=$JAVA_HOME"
  fi
fi

GRADLE_CMD="gradle"
if [ -x "./gradlew" ]; then
  GRADLE_CMD="./gradlew"
fi

echo "[1/2] Gerando APK debug..."
"$GRADLE_CMD" assembleDebug

echo "[2/2] APK pronto em: app/build/outputs/apk/debug/app-debug.apk"
