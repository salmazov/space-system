interface PlayOptions {
  volume?: number;
}

export class AudioEngine {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer>>();
  private context: AudioContext | null = null;

  constructor(private readonly sources: Record<string, string>) {}

  play(soundId: string, options: PlayOptions = {}): void {
    const volume = options.volume ?? 0.6;

    void this.playSound(soundId, volume).catch(() => undefined);
  }

  preload(soundId: string): void {
    void this.loadBuffer(soundId).catch(() => undefined);
  }

  private async playSound(soundId: string, volume: number): Promise<void> {
    const context = this.audioContext();

    if (context.state === "suspended") {
      await context.resume();
    }

    const buffer = await this.loadBuffer(soundId);
    const source = context.createBufferSource();
    const gain = context.createGain();

    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
  }

  private loadBuffer(soundId: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(soundId);

    if (cached) {
      return Promise.resolve(cached);
    }

    const existingLoad = this.loading.get(soundId);

    if (existingLoad !== undefined) {
      return existingLoad;
    }

    const url = this.sources[soundId];

    if (!url) {
      return Promise.reject(new Error(`Unknown sound: ${soundId}`));
    }

    const load = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load sound: ${url}`);
        }

        return response.arrayBuffer();
      })
      .then((bytes) => this.audioContext().decodeAudioData(bytes))
      .then((buffer) => {
        this.buffers.set(soundId, buffer);
        this.loading.delete(soundId);
        return buffer;
      })
      .catch((error: unknown) => {
        this.loading.delete(soundId);
        throw error;
      });

    this.loading.set(soundId, load);
    return load;
  }

  private audioContext(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }
}