import { MathUtils, OrthographicCamera, Vector3 } from 'three';

/** True isometric angles: 45° azimuth, ~35.264° elevation. */
const AZIMUTH = Math.PI / 4;
const ELEVATION = Math.atan(1 / Math.SQRT2);

const TAP_MAX_MOVE = 8; // px
const TAP_MAX_MS = 500;

interface PointerState {
  x: number;
  y: number;
}

export interface IsoCameraOptions {
  /** Max distance the camera target may stray from the origin, in world units. */
  panLimit: number;
  /** World units visible vertically at zoom 1. */
  viewHeight?: number;
  minZoom?: number;
  maxZoom?: number;
}

/**
 * Orthographic isometric camera with pan and zoom.
 * Mouse: drag to pan, wheel to zoom. Touch: one finger pans, two fingers pinch-zoom.
 * Emits tap (click without drag) and hover (mouse only) in client coordinates.
 */
export class IsoCameraController {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 300);

  onTap: (clientX: number, clientY: number) => void = () => {};
  onHover: (clientX: number, clientY: number) => void = () => {};
  onHoverEnd: () => void = () => {};

  private readonly target = new Vector3();
  private readonly viewHeight: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly panLimit: number;

  private zoom = 1;
  private desiredZoom = 1;

  private readonly pointers = new Map<number, PointerState>();
  private gestureMoved = false;
  private downAt = 0;
  private downButton = 0;
  private downX = 0;
  private downY = 0;
  private lastPinchDistance = 0;

  private readonly forward = new Vector3(-Math.sin(AZIMUTH), 0, -Math.cos(AZIMUTH));
  private readonly right = new Vector3(Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH));

  constructor(
    private readonly dom: HTMLElement,
    options: IsoCameraOptions,
  ) {
    this.panLimit = options.panLimit;
    this.viewHeight = options.viewHeight ?? 18;
    this.minZoom = options.minZoom ?? 0.55;
    this.maxZoom = options.maxZoom ?? 2.6;

    this.dom.style.touchAction = 'none';
    this.dom.addEventListener('pointerdown', this.handleDown);
    this.dom.addEventListener('pointermove', this.handleMove);
    this.dom.addEventListener('pointerup', this.handleUp);
    this.dom.addEventListener('pointercancel', this.handleUp);
    this.dom.addEventListener('pointerleave', this.handleLeave);
    this.dom.addEventListener('wheel', this.handleWheel, { passive: false });
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());

    this.applyCameraTransform();
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(height, 1);
    const halfH = this.viewHeight / 2;
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  }

  /** Jump straight to a view (used by `?view=x,z,zoom` for previews and screenshots). */
  setView(x: number, z: number, zoom: number): void {
    this.target.set(
      MathUtils.clamp(x, -this.panLimit, this.panLimit),
      0,
      MathUtils.clamp(z, -this.panLimit, this.panLimit),
    );
    this.zoom = this.desiredZoom = MathUtils.clamp(zoom, this.minZoom, this.maxZoom);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
    this.applyCameraTransform();
  }

  /** Smoothly eases zoom toward its target; call once per frame. */
  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 12);
    const next = MathUtils.lerp(this.zoom, this.desiredZoom, k);
    if (Math.abs(next - this.zoom) > 1e-4) {
      this.zoom = next;
      this.camera.zoom = this.zoom;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.handleDown);
    this.dom.removeEventListener('pointermove', this.handleMove);
    this.dom.removeEventListener('pointerup', this.handleUp);
    this.dom.removeEventListener('pointercancel', this.handleUp);
    this.dom.removeEventListener('pointerleave', this.handleLeave);
    this.dom.removeEventListener('wheel', this.handleWheel);
  }

  private get unitsPerPixel(): number {
    return this.viewHeight / this.camera.zoom / Math.max(this.dom.clientHeight, 1);
  }

  /** Drag by screen pixels: the world follows the finger. */
  private panByPixels(dx: number, dy: number): void {
    const upp = this.unitsPerPixel;
    this.target.addScaledVector(this.right, -dx * upp);
    // Ground is foreshortened vertically by sin(elevation).
    this.target.addScaledVector(this.forward, (dy * upp) / Math.sin(ELEVATION));
    const lim = this.panLimit;
    this.target.x = MathUtils.clamp(this.target.x, -lim, lim);
    this.target.z = MathUtils.clamp(this.target.z, -lim, lim);
    this.applyCameraTransform();
  }

  private zoomBy(factor: number): void {
    this.desiredZoom = MathUtils.clamp(this.desiredZoom * factor, this.minZoom, this.maxZoom);
  }

  private applyCameraTransform(): void {
    const distance = 80;
    const horizontal = Math.cos(ELEVATION) * distance;
    this.camera.position.set(
      this.target.x + Math.sin(AZIMUTH) * horizontal,
      this.target.y + Math.sin(ELEVATION) * distance,
      this.target.z + Math.cos(AZIMUTH) * horizontal,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private readonly handleDown = (e: PointerEvent): void => {
    this.dom.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 1) {
      this.gestureMoved = false;
      this.downAt = performance.now();
      this.downButton = e.button;
      this.downX = e.clientX;
      this.downY = e.clientY;
    } else {
      this.gestureMoved = true; // multi-touch is never a tap
      this.lastPinchDistance = this.pinchDistance();
    }
  };

  private readonly handleMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') this.onHover(e.clientX, e.clientY);
      return;
    }

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;

    if (this.pointers.size === 1) {
      if (!this.gestureMoved) {
        const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
        if (moved > TAP_MAX_MOVE) {
          this.gestureMoved = true;
          this.onHoverEnd();
        } else {
          return;
        }
      }
      this.panByPixels(dx, dy);
    } else if (this.pointers.size === 2) {
      const distance = this.pinchDistance();
      if (this.lastPinchDistance > 0 && distance > 0) {
        const factor = distance / this.lastPinchDistance;
        // Pinch snaps directly (no easing) so it tracks the fingers.
        this.desiredZoom = MathUtils.clamp(this.desiredZoom * factor, this.minZoom, this.maxZoom);
        this.zoom = this.desiredZoom;
        this.camera.zoom = this.zoom;
        this.camera.updateProjectionMatrix();
      }
      this.lastPinchDistance = distance;
      // Two-finger drag also pans: use half the movement of the moving finger.
      this.panByPixels(dx / 2, dy / 2);
    }
  };

  private readonly handleUp = (e: PointerEvent): void => {
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(e.pointerId);
    if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);

    if (this.pointers.size === 1) {
      this.lastPinchDistance = 0;
    }

    const elapsed = performance.now() - this.downAt;
    if (
      e.type === 'pointerup' &&
      wasSingle &&
      !this.gestureMoved &&
      this.downButton === 0 &&
      elapsed < TAP_MAX_MS
    ) {
      this.onTap(e.clientX, e.clientY);
    }
    if (e.pointerType !== 'mouse') this.onHoverEnd();
  };

  private readonly handleLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') this.onHoverEnd();
  };

  private readonly handleWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.zoomBy(Math.exp(-delta * 0.0015));
  };
}
