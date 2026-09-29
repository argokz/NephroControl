// Пересчёт единиц. 1 мг/дл креатинина = 88,4 мкмоль/л (ТЗ, раздел 4).

import type { Creatinine } from './types';

export const CREATININE_UMOL_PER_MGDL = 88.4;

export function umolLToMgDl(umolL: number): number {
  return umolL / CREATININE_UMOL_PER_MGDL;
}

export function mgDlToUmolL(mgDl: number): number {
  return mgDl * CREATININE_UMOL_PER_MGDL;
}

/** Креатинин в мг/дл (Scr для формул). */
export function creatinineMgDl(c: Creatinine): number {
  return c.unit === 'mg/dL' ? c.value : umolLToMgDl(c.value);
}

/** Креатинин в мкмоль/л — берётся из исходного значения, без двойного пересчёта. */
export function creatinineUmolL(c: Creatinine): number {
  return c.unit === 'umol/L' ? c.value : mgDlToUmolL(c.value);
}

/** Округление до целых для вывода и сравнения с порогами СКФ. */
export function roundInt(x: number): number {
  return Math.round(x);
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
