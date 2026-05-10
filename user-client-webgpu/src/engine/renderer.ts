import type { StrategyCamera } from "./camera.js";
import type { Vec3 } from "../game/types.js";

export interface SceneInstance {
  color: [number, number, number, number];
  kind: "explored" | "planet" | "ship";
  position: Vec3;
  scale: number;
}

interface Mesh {
  indexBuffer: GPUBuffer;
  indexCount: number;
  vertexBuffer: GPUBuffer;
}

const INSTANCE_STRIDE = 8;
const VERTEX_STRIDE = 6;

export class WebGpuRenderer {
  private readonly bindGroup: GPUBindGroup;
  private depthTexture: GPUTexture | null = null;
  private readonly cubeMesh: Mesh;
  private exploredBuffer: GPUBuffer;
  private exploredCapacity = 64;
  private readonly exploredMesh: Mesh;
  private shipBuffer: GPUBuffer;
  private shipCapacity = 8;
  private planetBuffer: GPUBuffer;
  private planetCapacity = 16;
  private readonly pipeline: GPURenderPipeline;
  private readonly sphereMesh: Mesh;
  private readonly uniformBuffer: GPUBuffer;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GPUDevice,
    private readonly context: GPUCanvasContext,
    private readonly format: GPUTextureFormat
  ) {
    this.uniformBuffer = device.createBuffer({ size: 80, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
    this.exploredBuffer = this.createInstanceBuffer(this.exploredCapacity);
    this.planetBuffer = this.createInstanceBuffer(this.planetCapacity);
    this.shipBuffer = this.createInstanceBuffer(this.shipCapacity);
    this.exploredMesh = this.createMesh(createDiscGeometry(40));
    this.sphereMesh = this.createMesh(createSphereGeometry(20, 12));
    this.cubeMesh = this.createMesh(createCubeGeometry());
    this.pipeline = this.createPipeline();
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
    });
  }

  static async create(canvas: HTMLCanvasElement): Promise<WebGpuRenderer> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not available in this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
      throw new Error("No WebGPU adapter was found.");
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");

    if (!context) {
      throw new Error("Could not create a WebGPU canvas context.");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ alphaMode: "opaque", device, format });

    return new WebGpuRenderer(canvas, device, context, format);
  }

  render(instances: SceneInstance[], camera: StrategyCamera): void {
    this.resizeCanvas();
    this.writeUniforms(camera);

    const exploredAreas = instances.filter((instance) => instance.kind === "explored");
    const planets = instances.filter((instance) => instance.kind === "planet");
    const ships = instances.filter((instance) => instance.kind === "ship");

    this.ensureExploredCapacity(exploredAreas.length);
    this.ensurePlanetCapacity(planets.length);
    this.ensureShipCapacity(ships.length);
    this.writeInstances(this.exploredBuffer, exploredAreas);
    this.writeInstances(this.planetBuffer, planets);
    this.writeInstances(this.shipBuffer, ships);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
          loadOp: "clear",
          storeOp: "store",
          view: this.context.getCurrentTexture().createView()
        }
      ],
      depthStencilAttachment: {
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
        view: this.depthView()
      }
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    this.drawMesh(pass, this.exploredMesh, this.exploredBuffer, exploredAreas.length);
    this.drawMesh(pass, this.sphereMesh, this.planetBuffer, planets.length);
    this.drawMesh(pass, this.cubeMesh, this.shipBuffer, ships.length);
    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  private createPipeline(): GPURenderPipeline {
    const module = this.device.createShaderModule({ code: shaderCode });

    return this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vertexMain",
        buffers: [
          {
            arrayStride: VERTEX_STRIDE * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" }
            ]
          },
          {
            arrayStride: INSTANCE_STRIDE * 4,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 2, offset: 0, format: "float32x4" },
              { shaderLocation: 3, offset: 16, format: "float32x4" }
            ]
          }
        ]
      },
      fragment: {
        module,
        entryPoint: "fragmentMain",
        targets: [{ format: this.format }]
      },
      primitive: { topology: "triangle-list" },
      depthStencil: {
        depthCompare: "less",
        depthWriteEnabled: true,
        format: "depth24plus"
      }
    });
  }

  private createInstanceBuffer(capacity: number): GPUBuffer {
    return this.device.createBuffer({
      size: Math.max(1, capacity) * INSTANCE_STRIDE * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
    });
  }

  private createMesh(geometry: { indices: Uint16Array; vertices: Float32Array }): Mesh {
    const vertexBuffer = this.device.createBuffer({
      mappedAtCreation: true,
      size: geometry.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(geometry.vertices);
    vertexBuffer.unmap();

    const indexBuffer = this.device.createBuffer({
      mappedAtCreation: true,
      size: geometry.indices.byteLength,
      usage: GPUBufferUsage.INDEX
    });
    new Uint16Array(indexBuffer.getMappedRange()).set(geometry.indices);
    indexBuffer.unmap();

    return { indexBuffer, indexCount: geometry.indices.length, vertexBuffer };
  }

  private depthView(): GPUTextureView {
    if (this.depthTexture?.width !== this.canvas.width || this.depthTexture.height !== this.canvas.height) {
      this.depthTexture?.destroy();
      this.depthTexture = this.device.createTexture({
        format: "depth24plus",
        size: [this.canvas.width, this.canvas.height],
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
    }

    return this.depthTexture.createView();
  }

  private drawMesh(pass: GPURenderPassEncoder, mesh: Mesh, instanceBuffer: GPUBuffer, instanceCount: number): void {
    if (instanceCount === 0) {
      return;
    }

    pass.setVertexBuffer(0, mesh.vertexBuffer);
    pass.setVertexBuffer(1, instanceBuffer);
    pass.setIndexBuffer(mesh.indexBuffer, "uint16");
    pass.drawIndexed(mesh.indexCount, instanceCount);
  }

  private ensureExploredCapacity(instanceCount: number): void {
    if (instanceCount <= this.exploredCapacity) {
      return;
    }

    this.exploredCapacity = Math.ceil(instanceCount * 1.5);
    this.exploredBuffer.destroy();
    this.exploredBuffer = this.createInstanceBuffer(this.exploredCapacity);
  }

  private ensurePlanetCapacity(instanceCount: number): void {
    if (instanceCount <= this.planetCapacity) {
      return;
    }

    this.planetCapacity = Math.ceil(instanceCount * 1.5);
    this.planetBuffer.destroy();
    this.planetBuffer = this.createInstanceBuffer(this.planetCapacity);
  }

  private ensureShipCapacity(instanceCount: number): void {
    if (instanceCount <= this.shipCapacity) {
      return;
    }

    this.shipCapacity = Math.ceil(instanceCount * 1.5);
    this.shipBuffer.destroy();
    this.shipBuffer = this.createInstanceBuffer(this.shipCapacity);
  }

  private resizeCanvas(): void {
    const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * pixelRatio));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private writeInstances(buffer: GPUBuffer, instances: SceneInstance[]): void {
    const data = new Float32Array(Math.max(1, instances.length) * INSTANCE_STRIDE);

    instances.forEach((instance, index) => {
      const offset = index * INSTANCE_STRIDE;
      data.set([instance.position.x, instance.position.y, instance.position.z, instance.scale], offset);
      data.set(instance.color, offset + 4);
    });

    this.device.queue.writeBuffer(buffer, 0, data);
  }

  private writeUniforms(camera: StrategyCamera): void {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const viewProjection = camera.viewProjection(aspect);
    const uniforms = new Float32Array(20);

    uniforms.set(viewProjection, 0);
    uniforms.set([0.45, 0.75, 0.35, 0], 16);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
  }
}

function createDiscGeometry(segments: number) {
  const vertices: number[] = [0, 0, 0, 0, 1, 0];
  const indices: number[] = [];

  for (let segment = 0; segment <= segments; segment += 1) {
    const angle = (segment / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle), 0, Math.sin(angle), 0, 1, 0);
  }

  for (let segment = 1; segment <= segments; segment += 1) {
    indices.push(0, segment, segment + 1);
  }

  return { indices: new Uint16Array(indices), vertices: new Float32Array(vertices) };
}

function createSphereGeometry(segments: number, rings: number) {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const v = ring / rings;
    const theta = v * Math.PI;
    const y = Math.cos(theta);
    const radius = Math.sin(theta);

    for (let segment = 0; segment <= segments; segment += 1) {
      const u = segment / segments;
      const phi = u * Math.PI * 2;
      const x = Math.cos(phi) * radius;
      const z = Math.sin(phi) * radius;
      vertices.push(x, y, z, x, y, z);
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const first = ring * (segments + 1) + segment;
      const second = first + segments + 1;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }

  return { indices: new Uint16Array(indices), vertices: new Float32Array(vertices) };
}

function createCubeGeometry() {
  const faces = [
    { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { normal: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { normal: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
  ];
  const vertices: number[] = [];
  const indices: number[] = [];

  faces.forEach((face, faceIndex) => {
    const start = faceIndex * 4;

    face.corners.forEach((corner) => vertices.push(...corner, ...face.normal));
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });

  return { indices: new Uint16Array(indices), vertices: new Float32Array(vertices) };
}

const shaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4<f32>,
  lightDirection: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) color: vec4<f32>,
}

@vertex
fn vertexMain(
  @location(0) vertexPosition: vec3<f32>,
  @location(1) vertexNormal: vec3<f32>,
  @location(2) instanceTransform: vec4<f32>,
  @location(3) instanceColor: vec4<f32>,
) -> VertexOutput {
  let worldPosition = vertexPosition * instanceTransform.w + instanceTransform.xyz;

  var output: VertexOutput;
  output.position = uniforms.viewProjection * vec4<f32>(worldPosition, 1.0);
  output.normal = normalize(vertexNormal);
  output.color = instanceColor;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let light = normalize(uniforms.lightDirection.xyz);
  let diffuse = max(dot(input.normal, light), 0.0);
  let intensity = 0.28 + diffuse * 0.72;
  return vec4<f32>(input.color.rgb * intensity, input.color.a);
}
`;