# Pokémon Roulette Android (Android Studio + SDK 35)

Este projeto já está configurado para **Android SDK 35**:
- `compileSdk = 35`
- `targetSdk = 35`

## Abrir e desenvolver no Android Studio

1. Instale o Android Studio: https://developer.android.com/studio
2. Abra a pasta `android-pokemon-roulette` (menu **Open**).
3. No SDK Manager, confirme que a plataforma **Android 15 (API 35)** está instalada.
4. Configure o SDK local:
   - copie `local.properties.example` para `local.properties`
   - ajuste `sdk.dir` para a pasta do seu Android SDK
5. Aguarde o Gradle Sync concluir.

## Gerar APK de debug no Android Studio

Menu **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

Saída esperada:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Gerar APK por terminal

```bash
cd android-pokemon-roulette
./build-debug-apk.sh
```

> O script tenta usar Java 17 automaticamente quando detecta Java 25+ (compatibilidade de Kotlin/AGP).

## O que o app já faz

- Girar roleta com desafios aleatórios
- Mostrar desafio atual
- Exibir histórico de giros
- Reiniciar rodada
