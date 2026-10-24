import { PRODUCTS, ProductId, SPECIES, SpeciesId, penCapacity } from '../core/animals';
import { CROPS, CropId, RARITIES } from '../core/crops';
import { Farm, LAND_STEPS } from '../core/farm';
import { HELPERS, HelperId, maxHelperLevel, WAGE_PERIOD_MS, helperWage, payWord } from '../core/helpers';
import { DECOR, DecorId } from '../core/decor';
import { POMAR, TREES, TreeId, coinsPerMinute } from '../core/trees';
import { TRUCK_UPGRADES, TruckUpgradeId } from '../core/delivery';
import { BARN_TIERS, barnPerk } from '../core/barn';
import { LOCK_ICON } from './icons';
import { coin } from './kit';

/** "45 s", "1 min 30 s", "3 min", "1 h 30 min". */
export function humanDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return s ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}


interface Card {
  title: string;
  tag?: string;
  lore: string;
  stats: Array<[string, string]>;
  note?: string;
}

function render(card: Card): string {
  const stats = card.stats
    .map(([k, v]) => `<li${v.replace(/<[^>]*>/g, '').length > 26 ? ' class="wide"' : ''}><span>${k}</span><b>${v}</b></li>`)
    .join('');
  return `
    <div class="ic-head"><b>${card.title}</b>${card.tag ? `<span class="ic-tag">${card.tag}</span>` : ''}</div>
    <p class="ic-lore">${card.lore}</p>
    <ul class="ic-stats">${stats}</ul>
    ${card.note ? `<p class="ic-note">${card.note}</p>` : ''}`;
}

const lockTag = (level: number, have: number): string | undefined =>
  have < level ? `<i class="ico">${LOCK_ICON}</i>Nível ${level}` : undefined;

function cropCard(id: CropId, farm: Farm): Card {
  const c = CROPS[id];
  const profit = c.sellPrice - c.seedCost;
  const perMin = profit / (c.growthMs / 60_000);
  return {
    title: c.name,
    tag: lockTag(c.unlockLevel, farm.level) ?? (c.rarity === 'comum' ? undefined : `<span class="rar rar-${c.rarity}">${RARITIES[c.rarity].name}</span>`),
    lore: c.lore,
    stats: [
      ['Raridade', RARITIES[c.rarity].name],
      ...(RARITIES[c.rarity].goldenChance > 0
        ? ([['Colheita dourada', `1 em ${Math.round(1 / RARITIES[c.rarity].goldenChance)}: rende o dobro`]] as Array<[string, string]>)
        : []),
      ['Cresce em', humanDuration(c.growthMs)],
      ['Preço da semente', coin(c.seedCost)],
      ['Vende por', coin(c.sellPrice)],
      ['Lucro por colheita', coin(profit)],
      ['Rende por minuto', `${coin(Math.round(perMin * 10) / 10)}`],
      ['Experiência', `${c.xp} XP`],
    ],
    note: `Precisa de rega: sem ela, para na metade do caminho. Passado o ponto, murcha em ${humanDuration(c.witherMs)} se for esquecida.`,
  };
}

function treeCard(id: TreeId, farm: Farm): Card {
  const t = TREES[id];
  const rarity = RARITIES[t.rarity];
  return {
    title: t.name,
    tag: lockTag(t.unlockLevel, farm.level) ?? (t.rarity === 'comum' ? undefined : `<span class="rar rar-${t.rarity}">${rarity.name}</span>`),
    lore: t.lore,
    stats: [
      ['Raridade', rarity.name],
      ...(rarity.goldenChance > 0 ? ([['Colheita dourada', `1 em ${Math.round(1 / rarity.goldenChance)}: rende o dobro`]] as Array<[string, string]>) : []),
      ['Preço da muda', coin(t.saplingCost)],
      ['Fica adulta em', humanDuration(t.growMs)],
      ['Frutos a cada', humanDuration(t.cycleMs)],
      ['Por colheita', `${t.fruits} ${t.fruitName.toLowerCase()}s`],
      [`Cada ${t.fruitName.toLowerCase()} vale`, coin(t.fruitPrice)],
      ['Rende por minuto', coin(Math.round(coinsPerMinute(id) * 10) / 10)],
      ['Experiência', `${t.xp} XP por fruta`],
    ],
    note: 'Só precisa de água uma vez, enquanto é jovem. Depois dá frutos para sempre: o Pomar guarda uma colheita esperando por você.',
  };
}

function pomarCard(farm: Farm): Card {
  return {
    title: 'Pomar',
    tag: farm.pomar ? 'Comprado' : lockTag(POMAR.level, farm.level),
    lore: 'Um cantinho cercado ao lado do moinho, só para árvores frutíferas.',
    stats: [
      ['Preço', coin(POMAR.cost)],
      ['Cabem', '18 árvores'],
    ],
    note: 'Árvores só podem ser plantadas no Pomar. Remover uma árvore com a vassoura não devolve moedas.',
  };
}

function speciesCard(id: SpeciesId, farm: Farm): Card {
  const s = SPECIES[id];
  const product = PRODUCTS[s.product];
  const perCycle = product.sellPrice - s.feedPrice;
  const pen = farm.pens[id];
  return {
    title: pen ? s.name : s.penName,
    tag: lockTag(s.unlockLevel, farm.level),
    lore: s.lore,
    stats: [
      ...(pen ? [] : ([['Construir o abrigo', coin(s.penCost)]] as Array<[string, string]>)),
      ['Cada animal custa', coin(s.animalCost)],
      ['Cabem', `${penCapacity(id, pen?.level ?? 1)} no abrigo`],
      ['Produz', `1 ${product.name.toLowerCase()} a cada ${humanDuration(s.cycleMs)}`],
      ['Come', `1 saco por ciclo (${coin(s.feedPrice)})`],
      ['Cada ' + product.name.toLowerCase() + ' vale', coin(product.sellPrice)],
      ['Lucro por ciclo', coin(perCycle)],
      ['Experiência', `${s.xp} XP por coleta`],
    ],
    note: 'Os abrigos poderão ser melhorados no futuro.',
  };
}

function productCard(id: ProductId): Card {
  const p = PRODUCTS[id];
  const from = (Object.values(SPECIES).find((s) => s.product === id))!;
  return {
    title: p.name,
    lore: p.lore,
    stats: [
      ['Vende por', coin(p.sellPrice)],
      ['Vem de', `${from.name.toLowerCase()} (${from.penName.toLowerCase()})`],
    ],
  };
}

function feedCard(id: SpeciesId, farm: Farm): Card {
  const s = SPECIES[id];
  const inputs = Object.entries(s.recipe.inputs) as [CropId, number][];
  const recipe = inputs.map(([crop, qty]) => `${qty} ${CROPS[crop].name.toLowerCase()}`).join(' + ');
  const costOfCrops = inputs.reduce((sum, [crop, qty]) => sum + CROPS[crop].seedCost * qty, 0);
  return {
    title: s.feedName,
    tag: lockTag(s.unlockLevel, farm.level),
    lore: s.feedLore,
    stats: [
      ['Na loja', `${coin(s.feedPrice)} o saco`],
      ['No celeiro', `${recipe} → ${s.recipe.yield} sacos`],
      ['Quem come', `${s.name.toLowerCase()}s: 1 saco por ciclo`],
      ['Semente por saco', `~${coin(Math.round(costOfCrops / s.recipe.yield))}`],
    ],
    note: 'Fazer no celeiro é de graça: você só gasta as colheitas.',
  };
}

function helperCard(id: HelperId, farm: Farm): Card {
  const h = HELPERS[id];
  const state = farm.helpers[id];
  const stats: Array<[string, string]> = [['Contratar', coin(h.hireCost)]];
  for (let level = 1; level <= maxHelperLevel(id); level++) {
    const gate = h.levelGate?.[level];
    const up = level === 1 ? '' : ` · melhora ${coin(h.upgradeCost[level - 2]!)}${gate ? ` (nível ${gate})` : ''}`;
    stats.push([`Nível ${level}${state?.level === level ? ' (atual)' : ''}`, `${h.perks[level - 1]} · ${payWord(id)} ${coin(helperWage(id, level, farm.barn))}${up}`]);
  }
  return {
    title: h.name,
    tag: lockTag(h.unlockLevel, farm.level),
    lore: h.lore,
    stats,
    note: `O ${payWord(id)} é cobrado a cada ${humanDuration(WAGE_PERIOD_MS)}. Sem moedas, ${h.animal ? 'o bichinho para' : 'o ajudante para'} até você pagar.`,
  };
}

function landCard(farm: Farm): Card {
  const next = farm.nextExpansion();
  const step = next ?? LAND_STEPS[LAND_STEPS.length - 1]!;
  return {
    title: `Terreno ${step.size}×${step.size}`,
    tag: next ? lockTag(next.level, farm.level) : undefined,
    lore: 'O vizinho vendeu a cerca e um pedaço de campo: mais terra, mais colheita, mais trabalho.',
    stats: [
      ['Hoje', `${farm.landSize}×${farm.landSize} (${farm.landSize * farm.landSize} lotes)`],
      ['Depois', `${step.size}×${step.size} (${step.size * step.size} lotes)`],
      ['Preço', coin(step.cost)],
    ],
  };
}

function barnCard(level: number, farm: Farm): Card {
  const t = BARN_TIERS[level - 1]!;
  return {
    title: t.name,
    tag: farm.barn >= level ? (farm.barn === level ? 'Seu celeiro' : 'Já tem') : lockTag(t.unlockLevel, farm.level),
    lore: t.text,
    stats: [
      ...(t.cost > 0 ? ([['Preço', coin(t.cost)]] as Array<[string, string]>) : []),
      ['Custo dos ajudantes', t.costMul === 1 ? 'Normal' : `${Math.round((1 - t.costMul) * 100)}% menor`],
      ['Velocidade', t.speedMul === 1 ? 'Normal' : `${Math.round((t.speedMul - 1) * 100)}% maior`],
    ],
    note: `${barnPerk(t)}. Vale para o salário, o custo dos bichos, a caminhada, o trabalho e os aspersores.`,
  };
}

function truckCard(id: TruckUpgradeId, farm: Farm): Card {
  const def = TRUCK_UPGRADES[id];
  return {
    title: def.name,
    tag: farm.truck[id] ? 'Comprado' : lockTag(def.level, farm.level),
    lore: def.text,
    stats: [
      ['Preço', coin(def.cost)],
      ['Nível', String(def.level)],
    ],
    note: 'O caminhão entrega sementes sozinho; você não precisa ficar online.',
  };
}

const TOOL_INFO: Record<string, [string, string]> = {
  olhar: ['Olhar', 'Só espiar: toque numa planta, num animal ou num prédio para saber como estão, sem mexer em nada.'],
  colher: ['Colher', 'Colhe plantas e frutas maduras (a moeda dourada brilhando). A colheita vai para o celeiro.'],
  arar: ['Arar', 'Transforma grama em terra preparada para plantar. Só dentro do terreno cercado.'],
  semear: ['Semear', 'Planta a semente escolhida na terra arada, ou a muda escolhida no Pomar. Toque de novo para trocar.'],
  regar: ['Regar', 'Planta sem água para na metade do caminho. Regue para ela terminar de crescer. Árvores só precisam de uma rega.'],
  cuidar: ['Cuidar', 'Tira ervas daninhas e espanta bichos que travam o crescimento. Plantas esquecidas murcham.'],
  limpar: ['Limpar', 'Tira plantas murchas, ou devolve a terra arada para grama.'],
};

/** The detail card for a `data-info` key such as `crop:cenoura`; null when the key is unknown. */
export function infoCard(key: string, farm: Farm): string | null {
  const [kind, id = ''] = key.split(':');
  switch (kind) {
    case 'crop':
      return id in CROPS ? render(cropCard(id as CropId, farm)) : null;
    case 'tree':
      return id in TREES ? render(treeCard(id as TreeId, farm)) : null;
    case 'pomar':
      return render(pomarCard(farm));
    case 'species':
      return id in SPECIES ? render(speciesCard(id as SpeciesId, farm)) : null;
    case 'product':
      return id in PRODUCTS ? render(productCard(id as ProductId)) : null;
    case 'feed':
      return id in SPECIES ? render(feedCard(id as SpeciesId, farm)) : null;
    case 'helper':
      return id in HELPERS ? render(helperCard(id as HelperId, farm)) : null;
    case 'land':
      return render(landCard(farm));
    case 'decor':
      return id in DECOR
        ? render({ title: DECOR[id as DecorId].name, tag: farm.decor[id as DecorId] ? 'Na fazenda' : undefined, lore: DECOR[id as DecorId].text, stats: [['Preço', coin(DECOR[id as DecorId].cost)]] })
        : null;
    case 'barn': {
      const n = Number(id);
      return n >= 1 && n <= BARN_TIERS.length ? render(barnCard(n, farm)) : null;
    }
    case 'truck':
      return id in TRUCK_UPGRADES ? render(truckCard(id as TruckUpgradeId, farm)) : null;
    case 'tool': {
      const t = TOOL_INFO[id];
      return t ? render({ title: t[0], lore: t[1], stats: [] }) : null;
    }
    default:
      return null;
  }
}

