import { Game } from './game';

const container = document.getElementById('game');
const tileLabel = document.getElementById('hud-tile');

if (!container) throw new Error('#game container not found');

const game = new Game(container, {
  onSelect: (tile) => {
    if (tileLabel) {
      tileLabel.textContent = tile ? `Terreno (${tile.i + 1}, ${tile.j + 1})` : '—';
    }
  },
});

game.start();
