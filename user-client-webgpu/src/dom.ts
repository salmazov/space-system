export interface WebGpuElements {
  canvas: HTMLCanvasElement;
  connectionStatus: HTMLElement;
  error: HTMLElement;
  hint: HTMLElement;
  labels: HTMLElement;
  pilotName: HTMLElement;
  shipStatus: HTMLElement;
}

export function getElements(): WebGpuElements {
  return {
    canvas: byId("scene"),
    connectionStatus: byId("connectionStatus"),
    error: byId("error"),
    hint: byId("hint"),
    labels: byId("labels"),
    pilotName: byId("pilotName"),
    shipStatus: byId("shipStatus")
  };
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`#${id}`);

  if (!element) {
    throw new Error(`Missing element #${id}`);
  }

  return element;
}