export function pointsToText(points: string[]) {
  return points.join('\n');
}

export function textToPoints(text: string) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}
