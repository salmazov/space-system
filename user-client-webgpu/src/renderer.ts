import type { CameraState } from "./camera.js";

export interface SceneInstance {
  color: [number, number, number, number];
  position: { x: number; y: number };
  shape: "box" | "circle";
  size: { x: number; y: number };
}

const INSTANCE_STRIDE = 12;

export class WebGpuRenderer {
  private instanceBuffer: GPUBuffer;
  private instanceCapacity = 64;
  private readonly pipeline: GPURenderPipeline;
  private readonly uniformBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GPUDevice,
    private readonly context: GPUCanvasContext,
    private readonly format: GPUTextureFormat
  ) {
    this.uniformBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
    this.instanceBuffer = this.createInstanceBuffer(this.instanceCapacity);
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

  render(instances: SceneInstance[], camera: CameraState): void {
    this.resizeCanvas();
    this.ensureInstanceCapacity(instances.length);
    this.writeUniforms(camera);
    this.writeInstances(instances);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
          loadOp: "clear",
          storeOp: "store",
          view: this.context.getCurrentTexture().createView()
        }
      ]
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.instanceBuffer);
    pass.draw(6, instances.length);
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
            arrayStride: INSTANCE_STRIDE * 4,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x4" },
              { shaderLocation: 1, offset: 16, format: "float32x4" },
              { shaderLocation: 2, offset: 32, format: "float32x4" }
            ]
          }
        ]
      },
      fragment: {
        module,
        entryPoint: "fragmentMain",
        targets: [{ format: this.format }]
      },
      primitive: { topology: "triangle-list" }
    });
  }

  private createInstanceBuffer(capacity: number): GPUBuffer {
    return this.device.createBuffer({
      size: capacity * INSTANCE_STRIDE * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
    });
  }

  private ensureInstanceCapacity(instanceCount: number): void {
    if (instanceCount <= this.instanceCapacity) {
      return;
    }

    this.instanceCapacity = Math.ceil(instanceCount * 1.5);
    this.instanceBuffer.destroy();
    this.instanceBuffer = this.createInstanceBuffer(this.instanceCapacity);
  }

  private writeUniforms(camera: CameraState): void {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([camera.x, camera.y, camera.zoom, aspect]));
  }

  private writeInstances(instances: SceneInstance[]): void {
    const data = new Float32Array(Math.max(1, instances.length) * INSTANCE_STRIDE);

    instances.forEach((instance, index) => {
      const offset = index * INSTANCE_STRIDE;
      data.set([instance.position.x, instance.position.y, instance.size.x, instance.size.y], offset);
      data.set(instance.color, offset + 4);
      data.set([instance.shape === "circle" ? 0 : 1, 0, 0, 0], offset + 8);
    });

    this.device.queue.writeBuffer(this.instanceBuffer, 0, data);
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
}

const shaderCode = /* wgsl */ `
struct Camera {
  position: vec2<f32>,
  zoom: f32,
  aspect: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) shape: f32,
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) transform: vec4<f32>,
  @location(1) color: vec4<f32>,
  @location(2) instanceMeta: vec4<f32>,
) -> VertexOutput {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
  );

  let local = corners[vertexIndex];
  let world = transform.xy + local * transform.zw;
  let view = (world - camera.position) / camera.zoom;

  var output: VertexOutput;
  output.position = vec4<f32>(view.x / camera.aspect, view.y, 0.0, 1.0);
  output.local = local;
  output.color = color;
  output.shape = instanceMeta.x;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  if (input.shape < 0.5 && length(input.local) > 1.0) {
    discard;
  }

  return input.color;
}
`;