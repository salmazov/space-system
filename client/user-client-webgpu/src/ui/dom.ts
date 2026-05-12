export interface WebGpuElements {
  canvas: HTMLCanvasElement;
  connectionStatus: HTMLElement;
  dockPanel: HTMLElement;
  error: HTMLElement;
  hint: HTMLElement;
  labels: HTMLElement;
  miniMap: HTMLCanvasElement;
  pilotName: HTMLElement;
  resourceBar: HTMLElement;
  shipStatus: HTMLElement;
}

export function getElements(): WebGpuElements {
  return {
    canvas: byId("scene"),
    connectionStatus: byId("connectionStatus"),
    dockPanel: byId("dockPanel"),
    error: byId("error"),
    hint: byId("hint"),
    labels: byId("labels"),
    miniMap: byId("miniMap"),
    pilotName: byId("pilotName"),
    resourceBar: byId("resourceBar"),
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