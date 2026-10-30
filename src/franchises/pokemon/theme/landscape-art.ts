import { POKEMON_PALETTE as palette } from '../palette.ts';

/** Original seamless pixel mosaics. Source coordinates are art pixels, not CSS sizes. */
export function landscapeAssets(): Readonly<Record<string, string>> {
  const rect = (x: number, y: number, width: number, height: number, color: keyof typeof palette, opacity = 1) =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${palette[color]}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
  const svg = (height: number, parts: string[], width = 96) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">${parts.join('')}</svg>\n`;
  // Hand-shaped leaf clumps rather than a single dome. One art pixel remains one cell.
  const canvas = Array.from({ length: 24 }, () => Array<string>(256).fill('.'));
  const leafClumps = [
    ['...DD...', '..DMMD..', '.DMLLMD.', 'DMLLMMDD', 'DMMMMMMD', '.DMMMDD.', '.DDMDD..', '...DD...'],
    ['..DDD...', '.DMLMD..', 'DMLLMMDD', 'DMMMMMMD', '.DMMMDMD', 'DDMMMDD.', '.DDDDD..', '..DD....'],
    ['...DDD..', '.DDMLMD.', 'DMLLMMD.', 'DMLMMMDD', '.DMMMMD.', 'DDMMMDD.', '.DDMDD..', '..DDD...'],
  ];
  const paint = (x: number, y: number, color: string) => {
    if (y >= 0 && y < 24) canvas[y][(x % 256 + 256) % 256] = color;
  };
  const patch = (x: number, y: number, width: number, height: number, variant: number, rear: boolean) => {
    const pattern = leafClumps[variant % leafClumps.length];
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
      const value = pattern[Math.floor(dy * 8 / height)][Math.floor(dx * 8 / width)];
      if (value !== '.') paint(x + dx, y + dy, rear ? value === 'L' ? 'M' : 'D' : value);
    }
  };
  const crown = (x: number, bottom: number, width: number, height: number, count: number, variant: number, rear: boolean) => {
    const top = bottom - height;
    const clump = (left: number, down: number, w: number, h: number, n: number) =>
      patch(x + Math.round(left * width), top + Math.round(down * height), Math.max(4, Math.round(w * width)), Math.max(4, Math.round(h * height)), variant + n, rear);
    clump(0, 0.38, 0.59, 0.6, 0);
    clump(0.42, 0.35, 0.58, 0.62, 1);
    if (count === 3) clump(0.22, 0, 0.62, 0.66, 2);
    else {
      clump(0.06, 0.05, 0.59, 0.65, 2);
      clump(0.43, 0.1, 0.55, 0.61, 3);
      if (count >= 5) clump(0.28, 0, 0.49, 0.52, 4);
      if (count >= 6) clump(0.58, 0.3, 0.4, 0.44, 5);
    }
  };
  // A low rear plane closes the skyline at ground level, never the high crown gaps.
  for (let y = 20; y < 24; y++) for (let x = 0; x < 256; x++) paint(x, y, 'D');
  for (let n = 0; n < 16; n++) crown(n * 17 - 5, 23, 13 + n % 4, 8 + n % 3, 3 + n % 2, n, true);
  // x, width, crown height, leaf-clump count, trunk height: no adjacent matching silhouettes.
  const forest = [
    [-6,19,14,5,3], [10,15,10,3,3], [24,22,17,6,2], [42,17,12,4,4],
    [57,20,15,5,3], [74,14,9,3,3], [91,21,18,6,2], [107,18,13,4,3],
    [125,16,11,3,4], [142,22,16,5,2], [157,15,10,3,3], [175,19,14,4,3],
    [190,21,17,6,2], [207,14,9,3,4], [225,20,13,5,3], [242,18,15,4,3],
  ];
  forest.forEach(([x, width, height, count, trunk], index) => {
    const center = x + Math.floor(width / 2), bottom = 24 - trunk;
    for (let y = bottom - 1; y < 24; y++) {
      paint(center - 1, y, 'B'); paint(center, y, 'H');
      if (index % 3 === 0) paint(center + 1, y, 'B');
    }
    crown(x, bottom + 1, width, height, count, index, false);
    // Sparse dark leaf pixels create pockets of shade without a black outline.
    for (let n = 0; n < 3; n++) {
      const px = (center + n * 3 - 2 + 256) % 256, py = Math.max(0, bottom - 3 - n * 2);
      if (canvas[py][px] === 'M') canvas[py][px] = 'D';
    }
  });
  const trees: string[] = [];
  const treeColors = { D: 'grass-3', M: 'grass-2', L: 'grass-1', B: 'orange', H: 'dawn' } as const;
  for (const [code, name] of Object.entries(treeColors)) {
    let d = '';
    for (let y = 0; y < 24; y++) for (let x = 0; x < 256;) {
      if (canvas[y][x] !== code) { x++; continue; }
      const start = x;
      while (x < 256 && canvas[y][x] === code) x++;
      d += `M${start} ${y}h${x - start}v1H${start}z`;
    }
    trees.push(`<path d="${d}" fill="${palette[name]}"/>`);
  }
  // Four rows of grass bury the trunk bases; two rows of broken earth touch the water.
  const farBank = [rect(0, 0, 96, 2, 'grass-1'), rect(0, 2, 96, 2, 'grass-2'),
    rect(0, 4, 96, 1, 'orange'), rect(0, 5, 96, 1, 'blue')];
  for (const x of [0, 13, 27, 42, 58, 73, 87]) {
    farBank.push(rect(x, 1, 4, 1, 'grass-2'), rect(x + 3, 3, 5, 1, 'grass-3'),
      rect(x, 5, 8, 1, 'orange'), rect(x + 2, 4, 2, 1, 'dawn'), rect(x + 5, 5, 1, 1, 'ink'));
  }
  const water = [rect(0, 0, 96, 24, 'blue'), rect(0, 0, 96, 9, 'cyan', 0.16), rect(0, 16, 96, 8, 'night', 0.18)];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) {
    const x = (col * 21 + row * 13) % 96, y = row * 4;
    if (col < 3) water.push(rect(x, y, 8, 1, 'sky-1', 0.55));
    if ((row + col) % 3 === 0) water.push(rect((x + 9) % 96, y + 2, 5, 1, 'cyan', 0.4));
    if ((row + col) % 4 === 0) water.push(rect((x + 3) % 96, y + 1, 4, 1, 'white', 0.8));
  }
  // Crestas de ola en punta, como los mechones del pasto pero de agua.
  for (const [x, y] of [[4, 3], [22, 7], [39, 2], [55, 10], [71, 5], [86, 12], [12, 15], [47, 18], [64, 21], [90, 19], [30, 12], [78, 1]]) {
    water.push(rect(x, y + 1, 1, 1, 'sky-1'), rect(x + 1, y, 2, 1, 'sky-1'), rect(x + 3, y + 1, 1, 1, 'sky-1'), rect(x + 1, y + 1, 2, 1, 'blue'));
  }
  const bank = [rect(0, 0, 96, 8, 'blue'), rect(0, 3, 96, 5, 'grass-1'), rect(0, 7, 96, 1, 'grass-3')];
  for (const x of [0, 7, 18, 27, 39, 48, 59, 68, 81, 90]) {
    bank.push(rect(x, 1, 2, 5, 'grass-3'), rect(x + 2, 3, 2, 3, 'grass-2'), rect(x, 0, 1, 2, 'grass-1'));
  }
  return { 'trees.svg': svg(24, trees, 256), 'far-bank.svg': svg(6, farBank), 'water.svg': svg(24, water), 'bank.svg': svg(8, bank) };
}
