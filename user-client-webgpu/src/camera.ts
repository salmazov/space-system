import type { Vec2 } from "./types.js";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export class StrategyCamera {
  readonly state: CameraState = { x: 1.5, y: 0, zoom: 8 };
  private readonly pointer = { x: 0, y: 0, inside: false };
  private dragStart: { cameraX: number; cameraY: number; x: number; y: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bindEvents();
  }

  update(deltaSeconds: number): void {
    if (!this.pointer.inside || this.dragStart) {
      return;
    }

    const edge = 28;
    const speed = this.state.zoom * 0.95 * deltaSeconds;
    const rect = this.canvas.getBoundingClientRect();

    if (this.pointer.x < edge) this.state.x -= speed;
    if (this.pointer.x > rect.width - edge) this.state.x += speed;
    if (this.pointer.y < edge) this.state.y += speed;
    if (this.pointer.y > rect.height - edge) this.state.y -= speed;
  }

  screenToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const normalizedX = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const normalizedY = 1 - ((clientY - rect.top) / Math.max(1, rect.height)) * 2;

    return {
      x: this.state.x + normalizedX * aspect * this.state.zoom,
      y: this.state.y + normalizedY * this.state.zoom
    };
  }

  worldToScreen(world: Vec2): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const clipX = (world.x - this.state.x) / (this.state.zoom * aspect);
    const clipY = (world.y - this.state.y) / this.state.zoom;

    return {
      x: (clipX * 0.5 + 0.5) * rect.width,
      y: (0.5 - clipY * 0.5) * rect.height
    };
  }

  private bindEvents(): void {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("pointerenter", () => {
      this.pointer.inside = true;
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.pointer.inside = false;
      this.dragStart = null;
    });
    this.canvas.addEventListener("pointermove", (event) => this.onPointerMove(event));
    this.canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.canvas.addEventListener("pointerup", (event) => {
      this.dragStart = null;
      this.canvas.releasePointerCapture?.(event.pointerId);
    });
    this.canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
  }

  private onPointerMove(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;

    if (!this.dragStart) {
      return;
    }

    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    const worldPerPixel = (this.state.zoom * 2) / Math.max(1, rect.height);

    this.state.x = this.dragStart.cameraX - dx * worldPerPixel;
    this.state.y = this.dragStart.cameraY + dy * worldPerPixel;
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 1 && event.button !== 2) {
      return;
    }

    this.dragStart = {
      cameraX: this.state.x,
      cameraY: this.state.y,
      x: event.clientX,
      y: event.clientY
    };
    this.canvas.setPointerCapture(event.pointerId);
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomDelta = event.deltaY > 0 ? 1.08 : 0.92;
    this.state.zoom = Math.min(18, Math.max(4, this.state.zoom * zoomDelta));
  }
}