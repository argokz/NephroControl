// 8.1. Хронический пиелонефрит. Действующего взрослого КП МЗ РК нет; функция почек — по [И1].

import type { Finding } from '../types';
import type { RuleContext } from './context';

export function pyelonephritisRules(ctx: RuleContext): Finding[] {
  const { rules } = ctx;
  const out: Finding[] = [];
  const previous = ctx.prior.at(-1);
  if (previous && previous.egfr - ctx.egfr > rules.value<number>('pyelo.egfrDecrease')) {
    out.push(rules.finding('pyelo.egfrDecrease', { previous: previous.egfr, current: ctx.egfr }));
  }
  out.push(rules.finding('pyelo.doseReminder', { crcl: ctx.crcl.rounded }));
  return out;
}
