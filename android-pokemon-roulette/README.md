# Pokémon Roulette Android (separado do projeto original)

Esta pasta (`android-pokemon-roulette/`) é uma versão Android **independente** do jogo.

Se você é leigo, siga o **Caminho 1 (Android Studio)**, que é o mais fácil.

---

## Caminho 1 (RECOMENDADO): gerar APK pelo Android Studio

### 1) Instalar o Android Studio
1. Baixe: https://developer.android.com/studio
2. Instale normalmente (avançar/next).
3. Abra o Android Studio e deixe ele instalar os componentes padrão (Android SDK, Platform Tools, etc.).

### 2) Abrir este projeto Android
1. No Android Studio, clique em **Open**.
2. Selecione a pasta:
   - `android-pokemon-roulette`
3. Aguarde a sincronização do Gradle terminar (ele vai baixar dependências).

### 3) Gerar APK de debug (mais simples)
1. Menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Espere finalizar.
3. Clique na notificação **locate** (ou abra manualmente a pasta abaixo).

APK gerado em:

```text
android-pokemon-roulette/app/build/outputs/apk/debug/app-debug.apk
```

### 4) Instalar no celular Android
1. Copie o `app-debug.apk` para o celular.
2. No celular, permita instalação de fontes desconhecidas (quando solicitado).
3. Toque no arquivo APK para instalar.

> Dica: para testes pessoais, APK debug já resolve.

---

## Caminho 2: gerar APK por linha de comando

> Use este caminho só se você já tiver Java + Android SDK configurados.

### Linux/macOS
```bash
cd android-pokemon-roulette
gradle assembleDebug
```

### Windows (PowerShell)
```powershell
cd android-pokemon-roulette
gradle assembleDebug
```

APK esperado:

```text
app/build/outputs/apk/debug/app-debug.apk
```

---

## Erros comuns (e solução)

### "SDK location not found"
- Abra Android Studio e instale/configure o Android SDK.
- Ou crie `local.properties` dentro de `android-pokemon-roulette/` com o caminho do SDK.

Exemplo (Windows):
```properties
sdk.dir=C:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk
```

Exemplo (Linux):
```properties
sdk.dir=/home/seu_usuario/Android/Sdk
```

### "Could not resolve dependencies" / erro de download
- Normalmente é internet, proxy corporativo ou bloqueio de rede.
- Teste em outra rede e sincronize novamente.

### "Gradle sync failed"
- Clique em **Try Again**.
- Se persistir: **File > Invalidate Caches / Restart**.

---

## O que já está implementado no app

- Botão **Girar roleta** com desafios aleatórios.
- Histórico dos últimos giros.
- Botão **Reiniciar** para nova run.

---

## Estrutura

- `app/`: módulo do aplicativo Android
- Este projeto não depende do código Angular original para rodar.
