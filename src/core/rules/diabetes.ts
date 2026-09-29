// 8.2. Сахарный диабет. Метформин — [И6, И7], сверено с [И4]: граница 30 расходится (см. README, п. 15); иНГЛТ-2 — [И1, И6].
// Пороги СКФ применяются к округлённой eGFR CKD-EPI 2009.

import type { Finding } from '../types';
import type { RuleContext } from './context';

type Band = { min?: number; max?: number; below?: number };

const inBand = (x: number, b: Band) =>
  (b.min === undefined || x >= b.min) &&
  (b.max === undefined || x <= b.max) &&
  (b.below === undefined || x < b.below);

const METFORMIN_BANDS = [
  'dm.metformin.noLimit',
  'dm.metformin.consider',
  'dm.metformin.reduce',
  'dm.metformin.stop',
] as const;

export function diabetesRules(ctx: RuleContext): Finding[] {
  const { rules, input } = ctx;
  const out: Finding[] = [];

  if (ctx.bmi !== undefined && ctx.bmi >= rules.value<number>('dm.obesityCrcl')) {
    const actual = ctx.crclVariants.find((c) => c.weightBasis === 'actual');
    out.push(rules.finding('dm.obesityCrcl', { crclActual: (actual ?? ctx.crcl).rounded }));
  }

  if (!input.acr) out.push(rules.finding('dm.acrMissing'));

  const band = METFORMIN_BANDS.find((id) => inBand(ctx.egfr, rules.value<Band>(id)));
  if (band) out.push(rules.finding(band));
  if (ctx.aki) out.push(rules.finding('dm.metformin.aki'));

  const sglt2 = ctx.egfr >= rules.value<number>('dm.sglt2.start') ? 'dm.sglt2.start' : 'dm.sglt2.belowStart';
  out.push(rules.finding(sglt2));
  out.push(rules.finding('dm.sglt2.sickDays'));

  return out;
}
