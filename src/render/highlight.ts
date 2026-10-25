/**
 * @module render/highlight
 *
 * The hover glow and the pulsing frame around the selected tile. Pure view state.
 */

import { DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Shape, ShapeGeometry } from 'three';
import { TileCoord, tileToWorld } from '../core/grid';

const LIFT = 0.115; // clears the plowed-soil ridges

function squareFrame(outer: number, inner: number): ShapeGeometry {
  const o = outer / 2;
  const i = inner / 2;
  const shape = new Shape();
  shape.moveTo(-o, -o);
  shape.lineTo(o, -o);
  shape.lineTo(o, o);
  shape.lineTo(-o, o);
  shape.lineTo(-o, -o);
  const hole = new Shape();
  hole.moveTo(-i, -i);
  hole.lineTo(-i, i);
  hole.lineTo(i, i);
  hole.lineTo(i, -i);
  hole.lineTo(-i, -i);
  shape.holes.push(hole);
  return new ShapeGeometry(shape);
}

/** Soft hover glow plus a pulsing frame around the selected tile. */
export class TileHighlight {
  readonly group = new Group();
  private readonly hover: Mesh;
  private readonly selected: Mesh;
  private time = 0;

  constructor(private readonly gridSize: number) {
    this.hover = new Mesh(
      new PlaneGeometry(0.96, 0.96),
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.visible = false;

    this.selected = new Mesh(
      squareFrame(1.0, 0.86),
      new MeshBasicMaterial({
        color: 0xffe14d,
        transparent: true,
        opacity: 0.95,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    this.selected.rotation.x = -Math.PI / 2;
    this.selected.visible = false;

    this.group.add(this.hover, this.selected);
  }

  setHover(tile: TileCoord | null): void {
    this.place(this.hover, tile, LIFT);
  }

  setSelected(tile: TileCoord | null): void {
    this.place(this.selected, tile, LIFT + 0.005);
  }

  update(dt: number): void {
    this.time += dt;
    const pulse = 1 + Math.sin(this.time * 5) * 0.035;
    this.selected.scale.set(pulse, pulse, 1);
  }

  private place(mesh: Mesh, tile: TileCoord | null, y: number): void {
    if (!tile) {
      mesh.visible = false;
      return;
    }
    const { x, z } = tileToWorld(tile.i, tile.j, this.gridSize);
    mesh.position.set(x, y, z);
    mesh.visible = true;
  }
}
