import type { Vec2, Vec3 } from "./types.js";

export interface CameraState {
  x: number;
  z: number;
  distance: number;
}

export class StrategyCamera {
  readonly state: CameraState = { x: 1.5, z: 0, distance: 18 };
  private readonly pointer = { x: 0, y: 0, inside: false };
  private dragStart: { cameraX: number; cameraZ: number; x: number; y: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bindEvents();
  }

  update(deltaSeconds: number): void {
    if (!this.pointer.inside || this.dragStart) {
      return;
    }

    const edge = 28;
    const speed = this.state.distance * 0.62 * deltaSeconds;
    const rect = this.canvas.getBoundingClientRect();

    if (this.pointer.x < edge) this.state.x -= speed;
    if (this.pointer.x > rect.width - edge) this.state.x += speed;
    if (this.pointer.y < edge) this.state.z -= speed;
    if (this.pointer.y > rect.height - edge) this.state.z += speed;
  }

  screenToWorld(clientX: number, clientY: number): Vec3 {
    const rect = this.canvas.getBoundingClientRect();
    const normalizedX = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const normalizedY = 1 - ((clientY - rect.top) / Math.max(1, rect.height)) * 2;
    const inverse = invertMat4(this.viewProjection(rect.width / Math.max(1, rect.height)));
    const near = transformPoint(inverse, [normalizedX, normalizedY, 0]);
    const far = transformPoint(inverse, [normalizedX, normalizedY, 1]);
    const denominator = far.y - near.y;

    if (Math.abs(denominator) < 0.0001) {
      return { x: near.x, y: 0, z: near.z };
    }

    const amount = (0 - near.y) / denominator;

    return {
      x: near.x + (far.x - near.x) * amount,
      y: 0,
      z: near.z + (far.z - near.z) * amount
    };
  }

  worldToScreen(world: Vec3): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const clip = transformClip(this.viewProjection(rect.width / Math.max(1, rect.height)), [world.x, world.y, world.z]);

    return {
      x: (clip.x * 0.5 + 0.5) * rect.width,
      y: (0.5 - clip.y * 0.5) * rect.height
    };
  }

  viewProjection(aspect: number): Float32Array {
    const eye = this.eyePosition();
    const target = { x: this.state.x, y: 0, z: this.state.z };
    const view = lookAt(eye, target, { x: 0, y: 1, z: 0 });
    const projection = perspective((48 * Math.PI) / 180, aspect, 0.1, 120);

    return multiplyMat4(projection, view);
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
    const worldPerPixel = (this.state.distance * 1.45) / Math.max(1, rect.height);

    this.state.x = this.dragStart.cameraX - dx * worldPerPixel;
    this.state.z = this.dragStart.cameraZ - dy * worldPerPixel;
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 1 && event.button !== 2) {
      return;
    }

    this.dragStart = {
      cameraX: this.state.x,
      cameraZ: this.state.z,
      x: event.clientX,
      y: event.clientY
    };
    this.canvas.setPointerCapture(event.pointerId);
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomDelta = event.deltaY > 0 ? 1.08 : 0.92;
    this.state.distance = Math.min(32, Math.max(8, this.state.distance * zoomDelta));
  }

  private eyePosition(): Vec3 {
    return {
      x: this.state.x,
      y: this.state.distance,
      z: this.state.z + this.state.distance * 0.72
    };
  }
}

function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const focalLength = 1 / Math.tan(fovY / 2);
  const range = near - far;
  const matrix = new Float32Array(16);

  matrix[0] = focalLength / aspect;
  matrix[5] = focalLength;
  matrix[10] = far / range;
  matrix[11] = -1;
  matrix[14] = (far * near) / range;
  return matrix;
}

function lookAt(eye: Vec3, target: Vec3, up: Vec3): Float32Array {
  const zAxis = normalize({ x: eye.x - target.x, y: eye.y - target.y, z: eye.z - target.z });
  const xAxis = normalize(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);
  const matrix = new Float32Array(16);

  matrix[0] = xAxis.x;
  matrix[1] = yAxis.x;
  matrix[2] = zAxis.x;
  matrix[4] = xAxis.y;
  matrix[5] = yAxis.y;
  matrix[6] = zAxis.y;
  matrix[8] = xAxis.z;
  matrix[9] = yAxis.z;
  matrix[10] = zAxis.z;
  matrix[12] = -dot(xAxis, eye);
  matrix[13] = -dot(yAxis, eye);
  matrix[14] = -dot(zAxis, eye);
  matrix[15] = 1;
  return matrix;
}

function multiplyMat4(left: Float32Array, right: Float32Array): Float32Array {
  const output = new Float32Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      output[column * 4 + row] =
        matrixValue(left, row) * matrixValue(right, column * 4) +
        matrixValue(left, 4 + row) * matrixValue(right, column * 4 + 1) +
        matrixValue(left, 8 + row) * matrixValue(right, column * 4 + 2) +
        matrixValue(left, 12 + row) * matrixValue(right, column * 4 + 3);
    }
  }

  return output;
}

function invertMat4(matrix: Float32Array): Float32Array {
  const output = new Float32Array(16);
  const a00 = matrixValue(matrix, 0);
  const a01 = matrixValue(matrix, 1);
  const a02 = matrixValue(matrix, 2);
  const a03 = matrixValue(matrix, 3);
  const a10 = matrixValue(matrix, 4);
  const a11 = matrixValue(matrix, 5);
  const a12 = matrixValue(matrix, 6);
  const a13 = matrixValue(matrix, 7);
  const a20 = matrixValue(matrix, 8);
  const a21 = matrixValue(matrix, 9);
  const a22 = matrixValue(matrix, 10);
  const a23 = matrixValue(matrix, 11);
  const a30 = matrixValue(matrix, 12);
  const a31 = matrixValue(matrix, 13);
  const a32 = matrixValue(matrix, 14);
  const a33 = matrixValue(matrix, 15);
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!determinant) {
    return output;
  }

  const inverseDeterminant = 1 / determinant;
  output[0] = (a11 * b11 - a12 * b10 + a13 * b09) * inverseDeterminant;
  output[1] = (a02 * b10 - a01 * b11 - a03 * b09) * inverseDeterminant;
  output[2] = (a31 * b05 - a32 * b04 + a33 * b03) * inverseDeterminant;
  output[3] = (a22 * b04 - a21 * b05 - a23 * b03) * inverseDeterminant;
  output[4] = (a12 * b08 - a10 * b11 - a13 * b07) * inverseDeterminant;
  output[5] = (a00 * b11 - a02 * b08 + a03 * b07) * inverseDeterminant;
  output[6] = (a32 * b02 - a30 * b05 - a33 * b01) * inverseDeterminant;
  output[7] = (a20 * b05 - a22 * b02 + a23 * b01) * inverseDeterminant;
  output[8] = (a10 * b10 - a11 * b08 + a13 * b06) * inverseDeterminant;
  output[9] = (a01 * b08 - a00 * b10 - a03 * b06) * inverseDeterminant;
  output[10] = (a30 * b04 - a31 * b02 + a33 * b00) * inverseDeterminant;
  output[11] = (a21 * b02 - a20 * b04 - a23 * b00) * inverseDeterminant;
  output[12] = (a11 * b07 - a10 * b09 - a12 * b06) * inverseDeterminant;
  output[13] = (a00 * b09 - a01 * b07 + a02 * b06) * inverseDeterminant;
  output[14] = (a31 * b01 - a30 * b03 - a32 * b00) * inverseDeterminant;
  output[15] = (a20 * b03 - a21 * b01 + a22 * b00) * inverseDeterminant;
  return output;
}

function transformPoint(matrix: Float32Array, point: [number, number, number]): Vec3 {
  const clip = transformClip(matrix, point);
  return { x: clip.x, y: clip.y, z: clip.z };
}

function transformClip(matrix: Float32Array, point: [number, number, number]): Vec3 {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w = matrixValue(matrix, 3) * x + matrixValue(matrix, 7) * y + matrixValue(matrix, 11) * z + matrixValue(matrix, 15);
  const safeW = Math.abs(w) > 0.0001 ? w : 1;

  return {
    x: (matrixValue(matrix, 0) * x + matrixValue(matrix, 4) * y + matrixValue(matrix, 8) * z + matrixValue(matrix, 12)) / safeW,
    y: (matrixValue(matrix, 1) * x + matrixValue(matrix, 5) * y + matrixValue(matrix, 9) * z + matrixValue(matrix, 13)) / safeW,
    z: (matrixValue(matrix, 2) * x + matrixValue(matrix, 6) * y + matrixValue(matrix, 10) * z + matrixValue(matrix, 14)) / safeW
  };
}

function matrixValue(matrix: Float32Array, index: number): number {
  return matrix[index] ?? 0;
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
  };
}

function dot(left: Vec3, right: Vec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}