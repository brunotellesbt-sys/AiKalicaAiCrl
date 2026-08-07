# Backups congelados

Esta pasta guarda cópias de segurança. **Nada aqui é usado pelo build ou pelo deploy.**

## `pokemon-roulette-source-9a7f9f1.zip`

Snapshot do código-fonte do jogo como ele era no commit [`9a7f9f1`](../../commit/9a7f9f1) (06/08/2026), antes de ser extraído para arquivos versionados.

- SHA-256: `26b9babd451d845cd62f62b955ab1bac146aaf7ac536a372a223cba8d092f941`
- 458 arquivos, 3,3 MB
- Confere byte a byte com o conteúdo de `pokemon-roulette/`

## Por que o nome tem o hash do commit

Para deixar explícito que é um **retrato de um momento**, e não uma cópia viva do código.

O código do jogo mora em `pokemon-roulette/`, e é de lá que o GitHub Actions builda o site. Este zip nunca é lido por nada automatizado.

Isso importa porque duas cópias do mesmo código divergem em silêncio: alguém edita os arquivos, outra pessoa sobe um zip novo, e depois não dá para saber qual dos dois é o certo. Com o hash no nome, a resposta é sempre a mesma — **o zip é histórico, `pokemon-roulette/` é o código**.

## Se precisar restaurar

```bash
unzip backup/pokemon-roulette-source-9a7f9f1.zip -d restaurado/
```

Ou direto do histórico do git, sem depender desta pasta:

```bash
git show 9a7f9f1:pokemon-roulette-source.zip > pokemon-roulette-source.zip
```

## Ao criar backups novos

Use o mesmo padrão — `<nome>-<hash-do-commit>.zip` — e anote aqui a data e o SHA-256. Um backup sem procedência é um backup em que não dá para confiar na hora do aperto.
