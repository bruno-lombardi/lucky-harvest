# Glossary

The game's language is Brazilian Portuguese, and so are most ids in code. This table maps them.

## Tools (`Tool` in `src/core/actions.ts`)

| Id | Portuguese | Meaning |
|---|---|---|
| `olhar` | Olhar | Look: the neutral tool, never changes anything (UI-only; not a `Tool` in core) |
| `arar` | Arar | Plow grass into soil |
| `semear` | Semear | Sow (plant) a seed or sapling |
| `regar` | Regar | Water |
| `cuidar` | Cuidar | Care: remove weeds and bugs |
| `colher` | Colher | Harvest |
| `limpar` | Limpar | Clear a crop or soil |

## Places and things

| Term | Meaning |
|---|---|
| Loja | Shop (tabs: Sementes seeds, Ração feed, Vender sell, Animais, Fazenda land/truck/decor/barn/bakery, Ajudantes helpers, Árvores trees) |
| Celeiro | Barn: inventory screen, feed milling, barn tiers |
| Pomar | Orchard (fruit trees) |
| Muda | Tree sapling |
| Galinheiro / Curral / Chiqueiro | Chicken coop / cow pen / pig pen |
| Confeitaria | The bakery (Confeitaria da Dona Zefa) |
| Campo | The countryside around the farm |
| Caminhão / Entrega | The seed truck / delivery |
| Enfeites | Decorations |
| Livro da Fazenda | The goals and achievements book |
| Metas / Conquistas | Goals / achievements (medals: bronze, prata, ouro) |
| Terreno | A tile |
| Moeda(s) | Coin(s) |
| Nível | Level |

## Characters (`HelperId`)

| Id | Name | Role |
|---|---|---|
| `regador` | Regador do moinho | Sprinklers |
| `ajudante` | Tonico | Farmhand: harvests; at level 4 also plows, sows, waters |
| `gato` | Mingau | Cat: chases pests |
| `cao` | Rex | Dog: collects eggs, milk and truffles |
| `tratador` | Lúcia | Keeper: feeds the animals |
| (building NPC) | Dona Zefa | Baker at the Confeitaria |

Wages: people are paid a **salário**, animals a **custo** (`payWord(id)`).

## Crops, products, goods

Crops: cenoura carrot, trigo wheat, milho corn, tomate tomato, morango strawberry, cana sugar cane, abóbora pumpkin, girassol sunflower, melancia watermelon, pitaya dragon fruit, uva grape, flor-da-lua moonflower.
Animal products: ovo egg, leite milk, trufa truffle. Trees: laranjeira orange, goiabeira guava, mangueira mango, jabuticabeira jabuticaba, coqueiro coconut.
Goods: farinha flour, fubá cornmeal, manteiga butter, queijo cheese, açúcar sugar, óleo oil, pão bread, pão de queijo cheese bread, geleia jam, suco juice, bolo cake, doce de abóbora pumpkin sweet, pudim flan, goiabada guava paste, torta de manga mango pie, beijinho coconut candy.

Rarities: comum common, incomum uncommon, rara rare, épica epic. A **colheita dourada** is a golden harvest (double yield).

## Code terms

| Term | Meaning |
|---|---|
| Command | A plain-data player action, applied by `applyCommand` |
| Snapshot | A plain-JSON copy of the whole farm state (`FarmSnapshot`) |
| Baseline / outbox | The farm as a server last knew it / commands since then (in the save file) |
| Anchor | `anchorAt` and `anchorGrowth`: how growth is stored so it is a function of time |
| Slot | One scheduled seed-truck arrival (`slotOf(now)`) |
| Revision | Counter of successful mutations; feeds the deterministic random stream |
| View | A render class that reads the farm and draws it (`FarmView`, `Pens`, …) |
| Hull outline | The toon outline made by a slightly larger back-face copy of a mesh |
| Splash | The loading screen in `index.html` |
