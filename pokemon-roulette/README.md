# pokemon-roulette
A game involving Pokémon and Roulettes

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.1.2.

And you may play it here: [https://zeroxm.github.io/pokemon-roulette/](https://zeroxm.github.io/pokemon-roulette/)

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.


## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Deploying

Using angular-cli-ghpages

```bash
ng deploy --base-href=/pokemon-roulette/
```

## Cries (áudio)

### Como o jogo toca os cries

- **Mega Evolution Roulette**: depois da animação de Mega Evolução (o blink), o jogo tenta tocar o *cry* do Mega. A janela fica aberta até o áudio terminar.
- O jogo tenta fontes na ordem:
  1) `public/data/custom-cries.json` (override por URL)
  2) `public/cries/**` (arquivos locais no GitHub Pages)
  3) Veekun (OGG)
  4) GitHub mirror (OGG, base species)

### Override local (recomendado para Megas novos/DLC)

Se você tiver o arquivo do cry (ex.: extraído de dumps), coloque no projeto e o jogo pega automaticamente.

**Megas**
- `public/cries/mega/<apiName>.(ogg|mp3|wav)`
- Ex.: `public/cries/mega/charizard-mega-x.wav`

**Base species**
- `public/cries/base/<apiName>.(ogg|mp3|wav)`
- Ex.: `public/cries/base/raichu.ogg`

### Dica para dumps do Legends: Z-A (The Sounds Resource)

Os nomes do pacote costumam vir no padrão:

`PLAY_PV_0006 [FORM=FORM01] [PV=ATK].wav`

- `PV_0006` costuma ser o **número da National Dex** (ex.: 0006 = Charizard)
- `FORM=FORM00` é a forma base; `FORM01`, `FORM02`... são formas adicionais (ex.: Megas)
- `PV=ATK` / `PV=INDEX` etc são variações do mesmo cry (batalha/dex/etc.)

Se o Pokémon tiver **Mega X e Mega Y**, normalmente:

- `FORM01` = Mega X
- `FORM02` = Mega Y

Depois, basta renomear para o `apiName` usado no jogo (ex.: `charizard-mega-x.wav`) e colocar em `public/cries/mega/`.

## Badges (GitHub Pages friendly)

This project serves badge images locally to avoid hotlink/CORS issues.
Before building, run:

```bash
npm run prepare:badges
```

`npm run build` will run it automatically (via `prebuild`).
