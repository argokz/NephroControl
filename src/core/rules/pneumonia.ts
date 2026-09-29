// 8.3. Пневмония [И3]. Сама проверка ОПП (7.3) выполняется в общих правилах.

import { MS_PER_DAY } from '../dates';
import type { Finding } from '../types';
import type { RuleContext } from './context';

export function pneumoniaRules(ctx: RuleContext): Finding[] {
  const { rules, input } = ctx;
  const out: Finding[] = [rules.finding('pneu.unstable')];

  const days = rules.value<number>('pneu.aki.noHistory');
  const hasRecent = ctx.prior.some((p) => ctx.time - p.time > 0 && ctx.time - p.time <= days * MS_PER_DAY);
  if (!hasRecent) out.push(rules.finding('pneu.aki.noHistory'));

  if (input.ureaMmolL !== undefined && input.ureaMmolL > rules.value<{ above: number }>('pneu.urea').above) {
    out.push(rules.finding('pneu.urea', { urea: input.ureaMmolL }));
  }
  if (ctx.creatinineUmolL > rules.value<{ above: number }>('pneu.creatinine').above) {
    out.push(rules.finding('pneu.creatinine', { creatinine: ctx.creatinineUmolL }));
  }
  out.push(rules.finding('pneu.crclDosing', { crcl: ctx.crcl.rounded }));
  return out;
}
