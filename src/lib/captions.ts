// Local template captions for a settled round. No network and no paid AI.
// The line is chosen from the round number, so every open copy of the page shows the same
// caption and consecutive rounds always rotate to a different line.

type Template = (round: string, block: string | null) => string | null;

const TEMPLATES: Template[] = [
  (r) => `Round ${r} is in the books. The hamster takes a bow.`,
  (r, b) => (b ? `Curtain call for round ${r}, settled at block ${b}.` : null),
  (r) => `Round ${r} settled. The wheel asks for no applause, but it will take some.`,
  (r, b) => (b ? `Encore! Round ${r} just landed on block ${b}.` : null),
  (r) => `Round ${r} wraps. Sawdust swept, places for the next act.`,
  (r) => `Round ${r} settled. Cheeks full, spirits high.`,
  (r, b) => (b ? `That is a wrap on round ${r}. Block ${b} has the receipts.` : null),
  (r) => `Round ${r} is official. Somebody hand this star a sunflower seed.`,
  (r) => `Another round, another bow. Round ${r} is settled.`,
  (r) => `Round ${r} closes to thunderous squeaking.`,
];

export const CAPTION_COUNT = TEMPLATES.length;

export function captionFor(round: bigint, block: bigint | null): string {
  const roundText = new Intl.NumberFormat("en-US").format(round);
  const blockText = block === null ? null : new Intl.NumberFormat("en-US").format(block);
  const start = Number(round % BigInt(TEMPLATES.length));
  for (let i = 0; i < TEMPLATES.length; i += 1) {
    const line = TEMPLATES[(start + i) % TEMPLATES.length]!(roundText, blockText);
    if (line) return line;
  }
  return `Round ${roundText} is settled.`;
}
