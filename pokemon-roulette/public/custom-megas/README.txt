Custom Mega Sprites

This folder is optional.

If you add custom Mega forms in:
  public/data/custom-mega-forms.json

you can reference local sprite files from here, for example:

  {
    "basePokemonId": 6,
    "apiName": "charizard-mega-x-custom",
    "displayName": "Mega Charizard X (Custom)",
    "spriteUrl": "./custom-megas/charizard-mega-x-custom.png",
    "shinySpriteUrl": "./custom-megas/charizard-mega-x-custom-shiny.png"
  }

Notes:
- Do not add copyrighted assets unless you have permission.
- If spriteUrl is provided, the game will not call PokeAPI for sprites for that Mega form.
