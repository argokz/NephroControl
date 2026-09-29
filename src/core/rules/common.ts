// Правила для всех групп (ТЗ, раздел 7) и общие напоминания по классификации (раздел 6).

import { stageLabel } from '../classification';
import { MS_PER_DAY, MS_PER_HOUR } from '../dates';
import type { RuleBook } from '../ruleBook';
import type { Finding } from '../types';
import type { PriorPoint, RuleContext } from './context';

type AkiValue = { deltaUmolL: number; windowHours: number; factor: number; windowDays: number };
type DoublingValue = { factor: number; windowDays: number };

/** Защита от ошибок округления при сравнении с порогом (например, 0,3 мг/дл = 26,52 мкмоль/л). */
const EPS = 1e-9;

/**
 * 7.3. ОПП [И2, И5]: рост креатинина на ≥ 26,5 мкмоль/л в пределах 48 ч
 * ИЛИ рост в ≥ 1,5 раза от минимального значения за предыдущие 7 суток.
 */
export function detectAki(currentUmolL: number, time: number, prior: PriorPoint[], rules: RuleBook): boolean {
  const v = rules.value<AkiValue>('common.aki');
  const within = (hours: number) =>
    prior.filter((p) => time - p.time > 0 && time - p.time <= hours * MS_PER_HOUR).map((p) => p.creatinineUmolL);
  const w48 = within(v.windowHours);
  if (w48.length && currentUmolL - Math.min(...w48) >= v.deltaUmolL - EPS) return true;
  const w7 = within(v.windowDays * 24);
  return w7.length > 0 && currentUmolL >= v.factor * Math.min(...w7) - EPS;
}

/** 7.2. Удвоение креатинина менее чем за 2 месяца (60 суток — допущение, см. rules.json). */
export function detectDoubling(currentUmolL: number, time: number, prior: PriorPoint[], rules: RuleBook): boolean {
  const v = rules.value<DoublingValue>('common.hospital.doubling');
  const inWindow = prior.filter((p) => time - p.time > 0 && time - p.time < v.windowDays * MS_PER_DAY);
  return inWindow.some((p) => currentUmolL >= v.factor * p.creatinineUmolL - EPS);
}

export function commonRules(ctx: RuleContext): Finding[] {
  const { rules, input } = ctx;
  const out: Finding[] = [];

  // Раздел 6: однократное измерение — оценка, а не диагноз
  out.push(rules.finding('ckd.singleMeasurement'));

  if (ctx.stage !== ctx.stage2021) {
    out.push(
      rules.finding('stage.discrepancy', {
        stage2009: stageLabel(ctx.stage, rules),
        stage2021: stageLabel(ctx.stage2021, rules),
      }),
    );
  }

  const early = rules.value<string[]>('stage.earlyStageMarkers');
  if (early.includes(ctx.stage) && ctx.albuminuria !== 'A2' && ctx.albuminuria !== 'A3') {
    out.push(rules.finding('stage.earlyStageMarkers'));
  }

  if (!input.acr) out.push(rules.finding('risk.noAcr'));

  // 7.1. Формула недостоверна
  const reasons: string[] = [];
  if (ctx.bmi === undefined) {
    out.push(rules.finding('common.bmiUnknown'));
  } else {
    const b = rules.value<{ bmiBelow: number; bmiAbove: number }>('common.unreliable');
    if (ctx.bmi < b.bmiBelow || ctx.bmi > b.bmiAbove) {
      reasons.push(rules.label('common.unreliable', 'bmi', { bmi: ctx.bmi }));
    }
  }
  for (const s of input.specialConditions) reasons.push(rules.label('common.unreliable', s));
  if (ctx.aki) reasons.push(rules.label('common.unreliable', 'aki'));
  if (ctx.rapidDecline) reasons.push(rules.label('common.unreliable', 'rapidDecline'));
  if (reasons.length) out.push(rules.finding('common.unreliable', undefined, reasons));

  // 7.2. Пороги госпитализации
  const egfrThreshold = rules.value<number>('common.hospital.egfr');
  if (ctx.egfr < egfrThreshold && !ctx.prior.some((p) => p.egfr < egfrThreshold)) {
    out.push(rules.finding('common.hospital.egfr'));
  }
  const cr = rules.value<{ maleAbove: number; femaleAbove: number }>('common.hospital.creatinine');
  const crLimit = input.sex === 'male' ? cr.maleAbove : cr.femaleAbove;
  if (ctx.creatinineUmolL > crLimit) {
    out.push(rules.finding('common.hospital.creatinine', { creatinine: ctx.creatinineUmolL }));
  }
  if (ctx.rapidDecline) out.push(rules.finding('common.hospital.doubling'));

  // 7.3. ОПП
  if (ctx.aki) out.push(rules.finding('common.aki'));

  return out;
}
