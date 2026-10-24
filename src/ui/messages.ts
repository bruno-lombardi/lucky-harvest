import { getCrop } from '../core/crops';
import { FailReason, Farm } from '../core/farm';

export function reasonMessage(reason: FailReason): string {
  switch (reason) {
    case 'locked-land':
      return 'Esse terreno ainda está bloqueado';
    case 'not-grass':
      return 'Essa terra já foi arada';
    case 'not-soil':
      return 'Ara a terra primeiro com a enxada';
    case 'occupied':
      return 'Já tem uma planta aqui';
    case 'no-crop':
      return 'Não há planta aqui';
    case 'crop-locked':
      return 'Semente bloqueada: suba de nível!';
    case 'no-coins':
      return 'Moedas insuficientes';
    case 'already-watered':
      return 'Já foi regada';
    case 'not-ripe':
      return 'Ainda não está madura';
    case 'withered':
      return 'Está murcha: limpe com a vassoura';
    case 'nothing-to-clear':
      return 'Nada para limpar aqui';
    case 'no-seeds':
      return 'Sem sementes: compre na loja';
    case 'no-pest':
      return 'Nada para cuidar aqui';
    case 'level-too-low':
      return 'Nível insuficiente';
    case 'max-land':
      return 'Seu terreno já está no máximo';
    case 'nothing-to-sell':
      return 'Nada para vender';
  }
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** One-line description of a tile for the HUD. */
export function describeTile(farm: Farm, i: number, j: number, now: number): string {
  const label = `(${i + 1}, ${j + 1})`;
  if (!farm.isUnlocked(i, j)) return `Terreno bloqueado ${label}`;

  const tile = farm.tile(i, j);
  if (tile.kind === 'grass') return `Grama ${label}`;

  const status = farm.status(i, j, now);
  if (!status) return `Terra arada ${label}`;

  const name = getCrop(status.cropId).name;
  if (status.withered) return `${name} murcha`;
  if (status.pest) return `${name}: ${status.pest === 'weed' ? 'cheia de ervas daninhas' : 'com insetos'}!`;
  if (status.ripe) return `${name}: pronta para colher!`;
  if (status.thirsty) return `${name} com sede`;

  const stageName = ['Semente', 'Brotando', 'Crescendo'][status.stage] ?? 'Crescendo';
  const percent = Math.round(status.progress * 100);
  const left = status.msToRipe !== null ? ` · ${formatDuration(status.msToRipe)}` : '';
  return `${name}: ${stageName} ${percent}%${left}`;
}
