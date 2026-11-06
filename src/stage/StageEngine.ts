// Owns the animation clock and particles for one canvas. In "closed" and "frozen" modes, and
// under reduced motion, it draws a single frame and stops: nothing moves without new data.

import { renderStage, WHEEL_RADIUS, type SceneState, type Streak } from "./renderStage";
import { intensity, MAX_SPEED_LINES, sparksPerSecond, wheelDegreesPerSecond, type StageInput } from "./scene";

const FLASH_SECONDS = 1.1;
const TARGET_LIGHT = { closed: 0, frozen: 0, idle: 0.32, active: 1 } as const;
const IDLE_FRAME_MS = 1000 / 30;

function newStreak(width: number, scatter: boolean): Streak {
  return {
    y: 86 + Math.random() * 240,
    x: scatter ? Math.random() * width : width + Math.random() * 120,
    speed: 420 + Math.random() * 520,
    length: 30 + Math.random() * 54,
  };
}

export class StageEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private input: StageInput = { mode: "closed", rpmMilli: 0, speedMmPerSecond: 0, celebrationId: 0 };
  private scene: SceneState = {
    t: 0,
    wheelAngle: 0,
    stride: 0,
    light: 0,
    pose: "sleep",
    flash: 0,
    hop: 0,
    sparks: [],
    confetti: [],
    streaks: [],
  };
  private width = 400;
  private spin = 0;
  private sparkDebt = 0;
  private rafId = 0;
  private lastFrame = 0;
  private lastDraw = 0;
  private celebrationSeen = 0;
  private reducedMotion = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.ctx = ctx;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (cssWidth <= 0 || cssHeight <= 0) return;
    const scale = Math.min(dpr, 2);
    this.canvas.width = Math.round(cssWidth * scale);
    this.canvas.height = Math.round(cssHeight * scale);
    this.width = (cssWidth / cssHeight) * 400;
    this.scene.streaks = Array.from({ length: MAX_SPEED_LINES }, () => newStreak(this.width, true));
    this.draw();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.sync();
  }

  setInput(input: StageInput): void {
    const previous = this.input;
    this.input = input;
    if (input.mode === "idle") this.scene.pose = "sleep";
    if (input.mode === "active") this.scene.pose = "awake";
    if (input.mode === "frozen" || input.mode === "closed") this.freezeScene();
    if (input.celebrationId !== this.celebrationSeen) {
      this.celebrationSeen = input.celebrationId;
      if (previous.mode !== "closed" && input.celebrationId > 0 && !this.reducedMotion && input.mode !== "frozen") {
        this.startCelebration();
      }
    }
    this.sync();
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private freezeScene(): void {
    this.scene.light = TARGET_LIGHT[this.input.mode];
    this.scene.flash = 0;
    this.scene.hop = 0;
    this.scene.sparks = [];
    this.scene.confetti = [];
  }

  private startCelebration(): void {
    const cx = this.width / 2;
    this.scene.flash = 1;
    this.scene.confetti = Array.from({ length: 70 }, () => ({
      x: cx + (Math.random() - 0.5) * 60,
      y: 150 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 340,
      vy: -160 - Math.random() * 240,
      spin: (Math.random() - 0.5) * 12,
      angle: Math.random() * Math.PI,
      hue: [44, 350, 160, 200][Math.floor(Math.random() * 4)] ?? 44,
      life: 1.6 + Math.random() * 0.5,
    }));
  }

  private animated(): boolean {
    const mode = this.input.mode;
    return !this.reducedMotion && (mode === "idle" || mode === "active");
  }

  private sync(): void {
    if (this.animated()) {
      if (!this.rafId) {
        this.lastFrame = performance.now();
        this.rafId = requestAnimationFrame(this.frame);
      }
      return;
    }
    this.stop();
    // A still frame shows the state at its settled brightness, with the speed lines in place.
    this.scene.light = TARGET_LIGHT[this.input.mode];
    this.scene.flash = 0;
    this.draw();
  }

  private readonly frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    // Sleeping uses fewer frames, which keeps the Browser Source light on a streaming PC.
    if (this.input.mode === "idle" && now - this.lastDraw < IDLE_FRAME_MS) return;
    this.lastDraw = now;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.step(dt);
    this.draw();
  };

  private step(dt: number): void {
    const s = this.scene;
    const input = this.input;
    s.t += dt;
    s.light += (TARGET_LIGHT[input.mode] - s.light) * Math.min(1, dt * 3);

    // The spin eases toward the real speed so one reading does not snap the wheel.
    const targetSpin = (wheelDegreesPerSecond(input) * Math.PI) / 180;
    this.spin = targetSpin === 0 ? 0 : this.spin + (targetSpin - this.spin) * Math.min(1, dt * 4);
    s.wheelAngle = (s.wheelAngle + this.spin * dt) % (Math.PI * 2);
    s.stride += this.spin * dt * 3;

    const level = intensity(input.rpmMilli);
    for (const streak of s.streaks) {
      streak.x -= streak.speed * (0.35 + level) * dt;
      if (streak.x + streak.length * 1.3 < 0) Object.assign(streak, newStreak(this.width, false));
    }
    this.stepSparks(dt, level);
    this.stepCelebration(dt);
  }

  private stepSparks(dt: number, level: number): void {
    const s = this.scene;
    const cx = this.width / 2;
    this.sparkDebt += sparksPerSecond(this.input) * dt;
    while (this.sparkDebt >= 1) {
      this.sparkDebt -= 1;
      if (this.input.mode === "active") {
        const life = 0.28 + Math.random() * 0.34 + level * 0.2;
        s.sparks.push({
          x: cx - 64 + Math.random() * 40,
          y: 200 + WHEEL_RADIUS - 18,
          vx: -60 - Math.random() * (120 + level * 240),
          vy: -30 - Math.random() * (80 + level * 170),
          life,
          max: life,
          size: 1 + level * 1.6 + Math.random() * 0.8,
        });
      } else {
        const life = 2.4 + Math.random() * 1.6;
        s.sparks.push({
          x: cx - 110 + Math.random() * 220,
          y: 330,
          vx: (Math.random() - 0.5) * 12,
          vy: -14 - Math.random() * 12,
          life,
          max: life / 0.35,
          size: 1.6,
        });
      }
    }
    const gravity = this.input.mode === "active" ? 460 : 0;
    for (const spark of s.sparks) {
      spark.vy += gravity * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.life -= dt;
    }
    s.sparks = s.sparks.filter((spark) => spark.life > 0);
  }

  private stepCelebration(dt: number): void {
    const s = this.scene;
    s.flash = Math.max(0, s.flash - dt / FLASH_SECONDS);
    s.hop = s.flash > 0 ? Math.sin(s.flash * Math.PI) * 26 : 0;
    for (const piece of s.confetti) {
      piece.vy += 420 * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.angle += piece.spin * dt;
      piece.life -= dt;
    }
    s.confetti = s.confetti.filter((piece) => piece.life > 0);
  }

  private draw(): void {
    if (this.canvas.width === 0) return;
    this.ctx.setTransform(this.canvas.height / 400, 0, 0, this.canvas.height / 400, 0, 0);
    renderStage(this.ctx, this.width, this.input, this.scene);
  }
}
