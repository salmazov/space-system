import { planetColor } from "../game/planet-layout.js";
import type { PlayerShip, Vec3, WorldSnapshot } from "../game/types.js";
import { isExplored } from "../game/visibility.js";

const PADDING = 14;

export function renderMiniMap(canvas: HTMLCanvasElement, world: WorldSnapshot, clientId: string): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const { width, height } = resizeCanvas(canvas, context);
  const ship = world.players.find((player) => player.ownerClientId === clientId) ?? null;
  const bounds = mapBounds(world, ship);
  const project = createProjector(bounds, width, height);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#080d13";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#253141";
  context.strokeRect(0.5, 0.5, width - 1, height - 1);

  drawGrid(context, width, height);

  if (!ship) {
    drawEmptyState(context, width, height);
    return;
  }

  for (const area of ship.exploredAreas) {
    const point = project(area.center);
    context.beginPath();
    context.fillStyle = "rgb(18 59 71 / 70%)";
    context.arc(point.x, point.y, Math.max(area.radius * project.scale, 3), 0, Math.PI * 2);
    context.fill();
  }

  if (ship.destinationPosition) {
    const from = project(ship.position);
    const to = project(ship.destinationPosition);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.strokeStyle = "#e8b15c";
    context.lineWidth = 1.5;
    context.stroke();
  }

  for (const planet of world.planets) {
    if (!isExplored(ship.exploredAreas, planet.position, 1.4)) {
      continue;
    }

    const point = project(planet.position);
    const color = toRgb(planetColor(planet.id));
    context.beginPath();
    context.fillStyle = color;
    context.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#d9e4ef";
    context.font = "11px Inter, sans-serif";
    context.fillText(planet.name, point.x + 7, point.y + 4);
  }

  for (const player of world.players) {
    const ownShip = player.ownerClientId === clientId;

    if (!ownShip && !isExplored(ship.exploredAreas, player.position, 0.8)) {
      continue;
    }

    const point = project(player.position);
    context.fillStyle = ownShip ? "#ff2b22" : "#65b6ff";
    context.fillRect(point.x - 3, point.y - 3, 6, 6);
  }
}

function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): { height: number; width: number } {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
  const displayWidth = Math.max(1, rect.width || 220);
  const displayHeight = Math.max(1, rect.height || 160);
  const width = Math.floor(displayWidth * ratio);
  const height = Math.floor(displayHeight * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { height: displayHeight, width: displayWidth };
}

function mapBounds(world: WorldSnapshot, ship: PlayerShip | null): { maxX: number; maxZ: number; minX: number; minZ: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  const includePoint = (position: Vec3, radius = 0): void => {
    minX = Math.min(minX, position.x - radius);
    maxX = Math.max(maxX, position.x + radius);
    minZ = Math.min(minZ, position.z - radius);
    maxZ = Math.max(maxZ, position.z + radius);
  };

  for (const planet of world.planets) {
    includePoint(planet.position, 3);
  }

  if (ship) {
    includePoint(ship.position, ship.explorationRadius);

    if (ship.destinationPosition) {
      includePoint(ship.destinationPosition, 2);
    }

    for (const area of ship.exploredAreas) {
      includePoint(area.center, area.radius);
    }
  }

  if (!Number.isFinite(minX)) {
    minX = -8;
    maxX = 8;
    minZ = -6;
    maxZ = 6;
  }

  if (maxX - minX < 1) {
    minX -= 0.5;
    maxX += 0.5;
  }

  if (maxZ - minZ < 1) {
    minZ -= 0.5;
    maxZ += 0.5;
  }

  return { maxX, maxZ, minX, minZ };
}

function createProjector(
  bounds: { maxX: number; maxZ: number; minX: number; minZ: number },
  width: number,
  height: number
): ((position: Vec3) => { x: number; y: number }) & { scale: number } {
  const mapWidth = bounds.maxX - bounds.minX;
  const mapHeight = bounds.maxZ - bounds.minZ;
  const scale = Math.min((width - PADDING * 2) / mapWidth, (height - PADDING * 2) / mapHeight);
  const offsetX = (width - mapWidth * scale) / 2;
  const offsetY = (height - mapHeight * scale) / 2;
  const project = ((position: Vec3) => ({
    x: offsetX + (position.x - bounds.minX) * scale,
    y: offsetY + (position.z - bounds.minZ) * scale
  })) as ((position: Vec3) => { x: number; y: number }) & { scale: number };

  project.scale = scale;
  return project;
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.strokeStyle = "rgb(43 52 66 / 42%)";
  context.lineWidth = 1;

  for (let x = 40; x < width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 40; y < height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawEmptyState(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "#7f8b9b";
  context.font = "12px Inter, sans-serif";
  context.textAlign = "center";
  context.fillText("Ship pending", width / 2, height / 2);
  context.textAlign = "start";
}

function toRgb(color: [number, number, number, number]): string {
  return `rgb(${Math.round(color[0] * 255)} ${Math.round(color[1] * 255)} ${Math.round(color[2] * 255)})`;
}