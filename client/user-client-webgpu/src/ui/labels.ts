import type { StrategyCamera } from "../engine/camera.js";
import type { SceneState } from "../game/scene.js";

export function renderLabels(container: HTMLElement, scene: SceneState, camera: StrategyCamera): void {
  container.replaceChildren(
    ...scene.labels.map((label) => {
      const screen = camera.worldToScreen(label.position);
      const element = document.createElement("div");
      const name = document.createElement("strong");

      element.className = label.kind === "ship" ? "scene-label ship-label" : "scene-label planet-label";
      element.style.left = `${screen.x}px`;
      element.style.top = `${screen.y}px`;
      name.textContent = label.name;
      element.append(name);

      if (label.detail) {
        const detail = document.createElement("span");
        detail.textContent = label.detail;
        element.append(detail);
      }

      if (label.kind === "ship" && label.fuel) {
        element.append(fuelBar(label.fuel.current, label.fuel.capacity));
      }

      return element;
    })
  );
}

function fuelBar(current: number, capacity: number): HTMLElement {
  const ratio = capacity > 0 ? Math.max(0, Math.min(1, current / capacity)) : 0;
  const wrapper = document.createElement("div");
  const fill = document.createElement("i");
  const value = document.createElement("em");

  wrapper.className = `fuel-bar ${fuelLevelClass(ratio)}`;
  fill.style.width = `${ratio * 100}%`;
  value.textContent = `${formatFuel(current)}/${formatFuel(capacity)}`;
  wrapper.append(fill, value);
  return wrapper;
}

function fuelLevelClass(ratio: number): string {
  if (ratio < 0.25) {
    return "fuel-low";
  }

  if (ratio < 0.55) {
    return "fuel-mid";
  }

  return "fuel-ok";
}

function formatFuel(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}