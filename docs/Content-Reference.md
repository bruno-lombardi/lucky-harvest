# Content reference

Where each kind of content lives, what its data looks like, and the current roster. The tables below were generated from the code when this page was written; the code is the source of truth, so if they disagree, trust `src/core`.

All content is a `Record<Id, Def>` plus an `*_ORDER` array (the order shown in the UI) in `src/core`. Ids are Portuguese (see the [Glossary](Glossary.md)). To add an entry, follow [How to add content](How-To-Add-Content.md).

## Crops (`src/core/crops.ts`)

Fields of `CropDef`: `id`, `name`, `lore`, `emoji`, `shape` (which procedural model to use), `rarity`, `unlockLevel`, `seedCost`, `sellPrice`, `xp`, `growthMs` (time to ripe once watered), `witherMs` (how long before it spoils), `colors`.

Rarity (`comum`, `incomum`, `rara`, `epica`) sets the profit premium, how often the seed truck brings the seed (`truckWeight`) and the chance of a *golden* double harvest (`goldenChance`: 1/10 for rara, 1/6 for epica).

| Crop | Rarity | Lvl | Seed | Sells | XP | Grows |
|---|---|---|---|---|---|---|
| Cenoura (`cenoura`) | comum | 1 | 10 | 20 | 2 | 45 s |
| Trigo (`trigo`) | comum | 1 | 15 | 35 | 3 | 1.5 min |
| Milho (`milho`) | comum | 2 | 30 | 75 | 5 | 3 min |
| Tomate (`tomate`) | incomum | 3 | 45 | 160 | 6 | 6 min |
| Morango (`morango`) | incomum | 5 | 80 | 345 | 8 | 12 min |
| Cana-de-açúcar (`cana`) | comum | 6 | 90 | 330 | 7 | 10 min |
| Abóbora (`abobora`) | incomum | 8 | 150 | 810 | 8 | 25 min |
| Girassol (`girassol`) | incomum | 10 | 220 | 1260 | 9 | 35 min |
| Melancia (`melancia`) | incomum | 14 | 300 | 2010 | 10 | 50 min |
| Pitaya (`pitaya`) | rara | 15 | 1100 | 3800 | 12 | 60 min |
| Uva (`uva`) | rara | 18 | 1000 | 5400 | 14 | 90 min |
| Flor-da-lua (`flor`) | epica | 25 | 2500 | 11600 | 18 | 120 min |

## Orchard trees (`src/core/trees.ts`)

The Pomar is bought once (level 10, 3,000 coins) and has 18 plots (`POMAR`). A tree is planted from a *muda* (sapling), watered once while young, then yields fruit every cycle; one harvest waits while the player is away. Trees can have pests but never wither.

| Tree | Rarity | Lvl |
|---|---|---|
| Laranjeira (`laranjeira`) | comum | 11 |
| Goiabeira (`goiabeira`) | incomum | 13 |
| Mangueira (`mangueira`) | rara | 16 |
| Jabuticabeira (`jabuticabeira`) | rara | 20 |
| Coqueiro (`coqueiro`) | epica | 26 |

## Animals (`src/core/animals.ts`)

Each species has its own pen (up to tier 3), feed (milled from crops in the barn or bought), a product and a cycle time. Animals are fed, then produce after a delay; products wait to be collected (by hand or by Rex).

| Species | Pen | Lvl | Product |
|---|---|---|---|
| Galinha (`galinha`) | Galinheiro | 2 | Ovo |
| Vaca (`vaca`) | Curral | 4 | Leite |
| Porco (`porco`) | Chiqueiro | 6 | Trufa |

## Helpers (`src/core/helpers.ts`)

Wages (people) or care costs (animals) are charged every 10 minutes. Each helper has up to 3 levels (Tonico has a 4th that adds planting). Walkers share one state machine in `Farm.walk`; sprinklers use `Farm.pulse`.

| Helper | Lvl | Hire | Job |
|---|---|---|---|
| Regador do moinho (`regador`) | 3 | 400 | rega as plantações sozinho |
| Tonico, o ajudante (`ajudante`) | 5 | 900 | colhe as plantas maduras |
| Mingau, o gato (`gato`) | 7 | 600 | espanta pragas e ervas daninhas |
| Rex, o cão (`cao`) | 12 | 3000 | recolhe os produtos dos abrigos |
| Lúcia, a tratadora (`tratador`) | 10 | 2500 | dá ração aos animais dos abrigos |

## Confeitaria (`src/core/goods.ts`)

Dona Zefa's bakery (level 8, 3 tiers) turns crops, animal products, fruit and other goods into 21 goods: base ingredients (farinha, fubá, manteiga, queijo, açúcar, óleo), breads, sweets, jams and juices. Each `GoodDef` has `inputs` (crop, product, fruit or good ingredients), `yield` per batch, `ms` (batch time at tier 1), `xp`, and `markup` over the ingredient value, from which `sellPrice` is derived so a finished good always beats its raw inputs. Tiers add ovens (2/3/4 batches at once) and speed.

## Other tables

| Table | File | Notes |
|---|---|---|
| Land steps (6×6, 8×8, 10×10, 12×12) | `farm.ts` `LAND_STEPS` | cost and player level for each expansion |
| Barn tiers (4) | `barn.ts` | repaint plus helper buffs: `costMul`, `speedMul` |
| Truck upgrades (2) | `delivery.ts` | bigger load (level 10), faster clock (level 20) |
| Decorations (6) | `decor.ts` | cosmetics only, unlock at level 14 |
| Goals (30) and achievements | `progress.ts` | 7 chapters; achievements are tiered bronze/silver/gold; some medals also carry fertilizer `gifts` |
| Fertilizers (4) | `fertilizer.ts` | 10 min / 30 min / 1 h / 2 h skipped; gifts only (level-ups and medals), never sold. See "Fertilizers" in Core-Rules-Engine |
| XP curve | `levels.ts` | `25 * (level - 1) * level`, level cap 50 |
| Autoplant settings | `autoplant.ts` | Tonico level 4: mode, allowed seeds, buying, reserve, plow, water, skip rare, humor |

## Where content shows up outside `core`

A new piece of content usually needs a matching entry in these places (the compiler finds most of them because the tables are typed):

- **Model:** `src/render/*-models.ts`, `characters.ts` or a `*-view.ts`.
- **Icon:** crops and trees get one automatically from their model (`render/icons.ts`); goods, tools and others have SVG icons in `src/ui/*icons.ts`.
- **Info card text:** `src/ui/info.ts`.
- **Shop and dialog rows:** `src/ui/shop.ts` and friends loop over the `*_ORDER` arrays, so most new entries appear on their own.
- **Goals and achievements:** `progress.ts`, if the new content should teach or reward something.
- **Demo farm:** `src/demo.ts`, so it can be seen in `?demo`.

## Farm lights (luzes da fazenda)

Defined in `src/core/lights.ts`. The lights themselves are free and on by default; only the colours are bought, as farm Enfeites in the shop's Fazenda tab (level 14, like the other decor).

| Colour | Price | Notes |
|---|---|---|
| Âmbar | free | default, always owned |
| Rosa | 300 | |
| Verde vaga-lume | 300 | |
| Azul luar | 500 | |
| Roxo | 500 | |
| Festa | 1500 | several bulb colours, handed out bulb by bulb |
