/**
 * Keep in sync with User/src/app/lib/serviceDetailsFormat.ts (flatten rules).
 * Converts legacy descriptionPoints + excludedPoints ↔ single textarea.
 */

import { textToPoints } from './branchServiceFormUtils';

function cellToLines(cell: string): string[] {
  return String(cell ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function flattenCells(cells: string[] | undefined): string[] {
  const out: string[] = [];
  for (const c of cells ?? []) out.push(...cellToLines(c));
  return out;
}

function lineHasControlPrefix(line: string): boolean {
  const t = line.trimStart();
  return /^[#*+\-]/.test(t);
}

export function flattenStoredServiceLines(
  descriptionPoints: string[] | undefined,
  excludedPoints: string[] | undefined,
): string[] {
  const fromDesc = flattenCells(descriptionPoints);
  const fromEx = flattenCells(excludedPoints);
  const descStructured = fromDesc.some(lineHasControlPrefix);

  if (descStructured) {
    return [
      ...fromDesc,
      ...fromEx.map((l) => {
        const t = l.trim();
        if (!t) return null;
        return lineHasControlPrefix(t) ? t : `- ${t.replace(/^\s*-\s*/, '').trim()}`;
      }).filter((x): x is string => Boolean(x)),
    ];
  }

  return [
    ...fromDesc.map((l) => (lineHasControlPrefix(l) ? l : `* ${l.replace(/^\s*\*\s*/, '').trim()}`)),
    ...fromEx.map((l) => {
      const t = l.trim();
      if (!t) return null;
      if (lineHasControlPrefix(t)) return t;
      return `- ${t.replace(/^\s*-\s*/, '').trim()}`;
    }).filter((x): x is string => Boolean(x)),
  ];
}

/** One line per row for the admin “Service details” textarea. */
export function storageToDetailsText(
  descriptionPoints: string[] | undefined,
  excludedPoints: string[] | undefined,
): string {
  return flattenStoredServiceLines(descriptionPoints, excludedPoints).join('\n');
}

/** Persist as description_points lines only; excluded_points always empty (API unchanged). */
export function detailsTextToStorage(text: string): { descriptionPoints: string[]; excludedPoints: string[] } {
  return { descriptionPoints: textToPoints(text), excludedPoints: [] };
}
