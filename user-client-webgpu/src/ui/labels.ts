import type { StrategyCamera } from "../engine/camera.js";
import type { SceneState } from "../game/scene.js";

export function renderLabels(container: HTMLElement, scene: SceneState, camera: StrategyCamera): void {
  container.replaceChildren(
    ...scene.labels.map((label) => {
      const screen = camera.worldToScreen(label.position);
      const element = document.createElement("div");

      element.className = "planet-label";
      element.style.left = `${screen.x}px`;
      element.style.top = `${screen.y}px`;
      element.innerHTML = `<strong>${label.name}</strong><span>${label.faction}</span>`;
      return element;
    })
  );
}