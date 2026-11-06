// Draws the theatre on a 2D canvas. All art here is original and drawn in code.
// Logical space: height is always 400, width is 400 * aspect. Outside the arch stays transparent.

import { speedLineCount, intensity, type StageInput } from "./scene";

export interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; }
export interface Confetti { x: number; y: number; vx: number; vy: number; spin: number; angle: number; hue: number; life: number; }
export interface Streak { y: number; x: number; speed: number; length: number; }

export interface SceneState {
  t: number;
  wheelAngle: number;
  stride: number;
  light: number;
  pose: "sleep" | "awake";
  flash: number;
  hop: number;
  sparks: Spark[];
  confetti: Confetti[];
  streaks: Streak[];
}

const COLOR = {
  backdrop: "#21090f",
  backdropLit: "#7a2233",
  velvet: "#a21f33",
  velvetDark: "#5b0e1c",
  velvetLight: "#c93a4d",
  gold: "#f5c453",
  goldDark: "#b4842c",
  floor: "#4a2615",
  floorLine: "#2f170c",
  floorLit: "#8a5026",
  wheel: "#e6edf2",
  wheelShade: "#8fa3b3",
  wheelMark: "#ff7a6b",
  stand: "#7d5230",
  fur: "#dc9650",
  furDark: "#b36f33",
  cream: "#fdf0dc",
  pink: "#f4a9a0",
  nose: "#d9616f",
  ink: "#2a1118",
  white: "#ffffff",
  capA: "#3f6fb5",
  capB: "#fbefdc",
} as const;

export const WHEEL_RADIUS = 124;
const WHEEL_CY = 200;
const TREAD_Y = WHEEL_CY + WHEEL_RADIUS - 16;

function archPath(ctx: CanvasRenderingContext2D, w: number, m: number): void {
  const rx = w / 2 - m;
  ctx.beginPath();
  ctx.moveTo(m, 392);
  ctx.lineTo(m, 150);
  ctx.ellipse(w / 2, 150, rx, 142, 0, Math.PI, 0);
  ctx.lineTo(w - m, 392);
  ctx.closePath();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, s: SceneState): void {
  const cx = w / 2;
  ctx.fillStyle = COLOR.backdrop;
  ctx.fillRect(0, 0, w, 400);
  const glow = ctx.createRadialGradient(cx, 220, 20, cx, 220, Math.max(w * 0.6, 240));
  glow.addColorStop(0, COLOR.backdropLit);
  glow.addColorStop(1, COLOR.backdrop);
  ctx.globalAlpha = 0.25 + s.light * 0.75;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, 400);
  ctx.globalAlpha = 1;
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, s: SceneState): void {
  const cx = w / 2;
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, 332, w, 68);
  ctx.strokeStyle = COLOR.floorLine;
  ctx.lineWidth = 2;
  for (let i = -10; i <= 10; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 26, 332);
    ctx.lineTo(cx + i * 54, 400);
    ctx.stroke();
  }
  const pool = ctx.createRadialGradient(cx, 346, 8, cx, 346, 170);
  pool.addColorStop(0, COLOR.floorLit);
  pool.addColorStop(1, "rgba(138,80,38,0)");
  ctx.globalAlpha = s.light;
  ctx.fillStyle = pool;
  ctx.save();
  ctx.translate(0, 346);
  ctx.scale(1, 0.26);
  ctx.translate(0, -346);
  ctx.fillRect(0, 0, w, 800);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 332, w, 3);
}

function drawSpotlight(ctx: CanvasRenderingContext2D, w: number, s: SceneState): void {
  const cx = w / 2;
  const beam = ctx.createLinearGradient(0, 0, 0, 340);
  beam.addColorStop(0, `rgba(255,226,150,${0.46 * s.light})`);
  beam.addColorStop(1, `rgba(255,226,150,${0.04 * s.light})`);
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx - 30, 0);
  ctx.lineTo(cx + 30, 0);
  ctx.lineTo(cx + 168, 340);
  ctx.lineTo(cx - 168, 340);
  ctx.closePath();
  ctx.fill();
}

function drawStreaks(ctx: CanvasRenderingContext2D, s: SceneState, count: number, level: number): void {
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(253,240,220,${0.22 + level * 0.46})`;
  ctx.lineWidth = 2 + level * 1.5;
  for (let i = 0; i < count; i += 1) {
    const streak = s.streaks[i];
    if (!streak) break;
    ctx.beginPath();
    ctx.moveTo(streak.x, streak.y);
    ctx.lineTo(streak.x + streak.length * (0.5 + level * 0.8), streak.y);
    ctx.stroke();
  }
}

function drawWheelBack(ctx: CanvasRenderingContext2D, cx: number): void {
  ctx.lineCap = "round";
  ctx.strokeStyle = COLOR.stand;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(cx, WHEEL_CY);
  ctx.lineTo(cx - 78, 346);
  ctx.moveTo(cx, WHEEL_CY);
  ctx.lineTo(cx + 78, 346);
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(cx - 100, 348);
  ctx.lineTo(cx - 58, 348);
  ctx.moveTo(cx + 58, 348);
  ctx.lineTo(cx + 100, 348);
  ctx.stroke();
}

function drawWheel(ctx: CanvasRenderingContext2D, cx: number, angle: number): void {
  const R = WHEEL_RADIUS;
  ctx.save();
  ctx.translate(cx, WHEEL_CY);

  // Rim track
  ctx.lineWidth = 16;
  ctx.strokeStyle = COLOR.wheelShade;
  ctx.beginPath();
  ctx.arc(0, 0, R - 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(angle);

  // Spokes
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ctx.strokeStyle = i === 0 ? COLOR.wheelMark : COLOR.wheelShade;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    ctx.lineTo(Math.cos(a) * (R - 14), Math.sin(a) * (R - 14));
    ctx.stroke();
  }

  // Rungs: one is coloured so the spin reads even at low speed
  ctx.lineWidth = 5;
  const rungs = 28;
  for (let i = 0; i < rungs; i += 1) {
    const a = (i / rungs) * Math.PI * 2;
    ctx.strokeStyle = i % 7 === 0 ? COLOR.wheelMark : COLOR.wheel;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (R - 15), Math.sin(a) * (R - 15));
    ctx.lineTo(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2));
    ctx.stroke();
  }
  ctx.restore();

  // Outer and inner hoops stay fixed on top of the rungs
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLOR.wheel;
  ctx.beginPath();
  ctx.arc(cx, WHEEL_CY, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, WHEEL_CY, R - 16, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHub(ctx: CanvasRenderingContext2D, cx: number): void {
  ctx.fillStyle = COLOR.gold;
  ctx.beginPath();
  ctx.arc(cx, WHEEL_CY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.goldDark;
  ctx.beginPath();
  ctx.arc(cx, WHEEL_CY, 6, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, rot = 0): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead(ctx: CanvasRenderingContext2D, eyes: "open" | "closed", level: number): void {
  // Ears
  ellipse(ctx, -17, -28, 12, 13, COLOR.furDark);
  ellipse(ctx, -17, -28, 6.5, 7.5, COLOR.pink);
  ellipse(ctx, 15, -30, 12, 13, COLOR.fur);
  ellipse(ctx, 15, -30, 6.5, 7.5, COLOR.pink);
  // Skull and muzzle
  ellipse(ctx, 0, 0, 33, 30, COLOR.fur);
  ellipse(ctx, 14, 11, 21, 16, COLOR.cream);
  ellipse(ctx, -6, 15, 12, 9, COLOR.pink);
  // Eye
  if (eyes === "open") {
    ellipse(ctx, 12, -6, 6.6, 7.4, COLOR.ink);
    ellipse(ctx, 14.4, -9, 2.3, 2.5, COLOR.white);
    if (level > 0.6) {
      // Determined brow when sprinting
      ctx.strokeStyle = COLOR.furDark;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(3, -18);
      ctx.lineTo(20, -15);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(11, -6, 7, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  // Nose and mouth
  ellipse(ctx, 32, 3, 4.6, 3.6, COLOR.nose);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(30, 8);
  ctx.quadraticCurveTo(26, 14, 20, 12);
  ctx.stroke();
  // Whiskers
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(42,17,24,0.55)";
  ctx.beginPath();
  ctx.moveTo(24, 6);
  ctx.lineTo(46, -1);
  ctx.moveTo(24, 10);
  ctx.lineTo(47, 9);
  ctx.stroke();
}

function drawRunner(ctx: CanvasRenderingContext2D, cx: number, s: SceneState, level: number): void {
  const moving = level > 0;
  const bob = moving ? Math.sin(s.stride * 2) * (2 + level * 3) : 0;
  const lean = moving ? 0.05 + level * 0.1 : 0;
  const leg = (baseX: number, offset: number, color: string) => {
    const phase = s.stride + offset;
    const reach = moving ? 12 + level * 10 : 0;
    const lift = moving ? Math.max(0, Math.sin(phase)) * (6 + level * 8) : 0;
    ellipse(ctx, baseX + Math.cos(phase) * reach, 53 - lift, 13, 7, color);
  };
  ctx.save();
  ctx.translate(cx - 4, TREAD_Y);
  ctx.scale(0.86, 0.86);
  ctx.translate(0, -60 + bob - s.hop);
  ctx.rotate(lean);

  leg(-42, Math.PI, COLOR.furDark);
  leg(34, 0, COLOR.furDark);
  // Tail
  ellipse(ctx, -62, -2 + (moving ? Math.sin(s.stride * 2) * 3 : 0), 10, 7, COLOR.furDark, -0.4);
  // Body
  ellipse(ctx, -6, 4, 58, 44, COLOR.fur);
  ellipse(ctx, -20, -14, 37, 24, COLOR.furDark, -0.25);
  ellipse(ctx, 6, 20, 40, 26, COLOR.cream);
  leg(-26, 0, COLOR.fur);
  leg(20, Math.PI, COLOR.fur);
  // Head
  ctx.translate(40, -22);
  ctx.rotate(-lean * 0.6);
  drawHead(ctx, "open", level);
  ctx.restore();
}

function drawSleeper(ctx: CanvasRenderingContext2D, cx: number, s: SceneState): void {
  // A slow 4.5 second breath
  const breath = Math.sin((s.t * Math.PI * 2) / 4.5);
  ctx.save();
  ctx.translate(cx - 6, TREAD_Y);
  ctx.scale(0.9 + breath * 0.02, 0.9 + breath * 0.045);
  ctx.translate(0, -40);

  ellipse(ctx, -62, 18, 9, 6.5, COLOR.furDark, -0.2);
  ellipse(ctx, -8, 0, 64, 40, COLOR.fur);
  ellipse(ctx, -26, -14, 40, 22, COLOR.furDark, -0.15);
  ellipse(ctx, 6, 22, 44, 17, COLOR.cream);
  ellipse(ctx, -26, 33, 18, 7, COLOR.furDark);

  ctx.save();
  ctx.translate(44, 6);
  ctx.rotate(0.3);
  drawHead(ctx, "closed", 0);
  // Nightcap
  ctx.fillStyle = COLOR.capA;
  ctx.beginPath();
  ctx.moveTo(-30, -11);
  ctx.quadraticCurveTo(-24, -44, -56, -46);
  ctx.quadraticCurveTo(-18, -70, 14, -28);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = COLOR.capB;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-29, -11);
  ctx.quadraticCurveTo(-12, -32, 13, -27);
  ctx.stroke();
  ellipse(ctx, -58, -46, 7, 7, COLOR.capB);
  ctx.restore();
  ctx.restore();
}

function drawZees(ctx: CanvasRenderingContext2D, cx: number, s: SceneState): void {
  ctx.fillStyle = COLOR.cream;
  ctx.textAlign = "center";
  for (let i = 0; i < 3; i += 1) {
    const p = ((s.t / 5.4 + i / 3) % 1 + 1) % 1;
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
    ctx.font = `800 ${16 + p * 18}px "Nunito Variable", sans-serif`;
    ctx.fillText("Z", cx + 58 + p * 24, 232 - p * 76);
  }
  ctx.globalAlpha = 1;
}

function drawSparks(ctx: CanvasRenderingContext2D, s: SceneState): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const spark of s.sparks) {
    const k = spark.life / spark.max;
    ctx.fillStyle = `rgba(255,${170 + k * 60},${80 + k * 60},${k})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size * (0.4 + k * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawConfetti(ctx: CanvasRenderingContext2D, s: SceneState): void {
  for (const piece of s.confetti) {
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.angle);
    ctx.globalAlpha = Math.min(1, piece.life * 2);
    ctx.fillStyle = `hsl(${piece.hue} 90% 66%)`;
    ctx.fillRect(-4.5, -2.5, 9, 5);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** One side of the curtain. `open` is how far the fabric is pulled back, 0 shut to 1 fully open. */
function drawCurtain(ctx: CanvasRenderingContext2D, w: number, m: number, side: -1 | 1, open: number): void {
  const reach = w / 2 - m + 6;
  const width = reach - (reach - 54) * open;
  ctx.save();
  if (side === 1) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  const edge = m + width;
  const tie = m + width * (0.3 + (1 - open) * 0.7);
  const fabric = ctx.createLinearGradient(m, 0, edge, 0);
  const folds = Math.max(3, Math.round(width / 20));
  for (let i = 0; i <= folds; i += 1) {
    fabric.addColorStop(i / folds, i % 2 ? COLOR.velvetLight : COLOR.velvetDark);
  }
  ctx.fillStyle = fabric;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(edge, 0);
  ctx.bezierCurveTo(edge, 110, edge - (edge - tie) * 0.2, 190, tie, 244);
  ctx.bezierCurveTo(tie + 6, 300, tie + (edge - tie) * 0.25, 350, tie + (edge - tie) * 0.35, 400);
  ctx.lineTo(0, 400);
  ctx.closePath();
  ctx.fill();
  // Gold tie-back
  ctx.strokeStyle = COLOR.gold;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(m - 6, 238);
  ctx.quadraticCurveTo((m + tie) / 2, 256, tie + 2, 244);
  ctx.stroke();
  ctx.restore();
}

function drawValance(ctx: CanvasRenderingContext2D, w: number): void {
  const scallops = Math.max(5, Math.round(w / 56));
  const size = w / scallops;
  ctx.fillStyle = COLOR.velvet;
  ctx.fillRect(0, 0, w, 42);
  for (let i = 0; i < scallops; i += 1) {
    const x = i * size + size / 2;
    const y = 42;
    ctx.fillStyle = i % 2 ? COLOR.velvet : COLOR.velvetDark;
    ctx.beginPath();
    ctx.ellipse(x, y, size / 2, 26, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = COLOR.gold;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(x, y, size / 2 - 1.5, 25, 0, 0, Math.PI);
    ctx.stroke();
  }
}

function drawFootlights(ctx: CanvasRenderingContext2D, w: number, light: number): void {
  const count = Math.max(7, Math.round(w / 56));
  const gap = (w - 92) / (count - 1);
  for (let i = 0; i < count; i += 1) {
    const x = 46 + i * gap;
    if (light > 0.02) {
      const glow = ctx.createRadialGradient(x, 382, 1, x, 382, 34);
      glow.addColorStop(0, `rgba(255,214,120,${0.75 * light})`);
      glow.addColorStop(1, "rgba(255,214,120,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 34, 348, 68, 52);
    }
    ctx.fillStyle = light > 0.02 ? `rgba(255,${200 + light * 40},${120 + light * 90},${0.4 + light * 0.6})` : "#5c463f";
    ctx.beginPath();
    ctx.arc(x, 384, 6, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = COLOR.goldDark;
    ctx.fillRect(x - 8, 384, 16, 4);
  }
}

/** Draws one frame. `width` is the logical width: 400 * aspect. */
export function renderStage(ctx: CanvasRenderingContext2D, width: number, input: StageInput, s: SceneState): void {
  const cx = width / 2;
  const m = 8;
  const level = intensity(input.rpmMilli);
  const moving = input.mode === "active";
  ctx.clearRect(0, 0, width, 400);

  ctx.save();
  // Soft dark edge so the frame holds up over bright game footage
  archPath(ctx, width, m);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(15,5,8,0.55)";
  ctx.stroke();
  archPath(ctx, width, m);
  ctx.clip();

  drawBackdrop(ctx, width, s);
  drawSpotlight(ctx, width, s);
  drawFloor(ctx, width, s);
  if (input.mode !== "closed") {
    if (moving) drawStreaks(ctx, s, speedLineCount(input), level);
    drawWheelBack(ctx, cx);
    drawWheel(ctx, cx, s.wheelAngle);
    drawHub(ctx, cx);
    if (s.pose === "sleep") drawSleeper(ctx, cx, s);
    else drawRunner(ctx, cx, s, moving ? level : 0);
    if (input.mode === "idle") drawZees(ctx, cx, s);
    drawSparks(ctx, s);
    drawConfetti(ctx, s);
  }

  const curtainOpen = input.mode === "closed" ? 0 : input.mode === "frozen" ? 0.45 : 1;
  drawCurtain(ctx, width, m, -1, curtainOpen);
  drawCurtain(ctx, width, m, 1, curtainOpen);
  drawValance(ctx, width);
  drawFootlights(ctx, width, s.light);

  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255,224,140,${s.flash * 0.7})`;
    ctx.fillRect(0, 0, width, 400);
  }
  if (input.mode === "frozen" || input.mode === "closed") {
    ctx.fillStyle = "rgba(20,8,12,0.34)";
    ctx.fillRect(0, 0, width, 400);
  }
  ctx.restore();

  archPath(ctx, width, m);
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLOR.gold;
  ctx.stroke();
}
