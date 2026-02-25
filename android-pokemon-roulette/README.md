# Pokémon Roulette Android (separado do projeto original)

Esta pasta contém uma versão Android **independente** do jogo, feita em Kotlin + Jetpack Compose.

## Estrutura

- `app/`: aplicativo Android
- Não depende do código Angular original para executar.

## Como gerar o APK

> Pré-requisito: Android SDK instalado e variável `ANDROID_SDK_ROOT` configurada.

```bash
cd android-pokemon-roulette
./gradlew assembleDebug
```

APK gerado em:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Funcionalidades implementadas

- Roleta de desafios Pokémon com botão de giro.
- Histórico dos últimos resultados.
- Botão de reinício para nova run.

## Observações

- O projeto foi criado em pasta própria para manter separação total do jogo original.
