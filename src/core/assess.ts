// Фасад расчёта: ввод + история пациента + правила → результат.
// Промежуточные вычисления не округляются; стадия и пороги СКФ — по округлённому до целого значению.

import { albuminuriaCategory, nextTest, riskLevel, stageFromEgfr } from './classification';
import { toTime } from './dates';
import { ckdEpi2009 } from './formulas/ckdEpi2009';
import { ckdEpi2021 } from './formulas/ckdEpi2021';
import {
  adjustedBodyWeight,
  bodyMassIndex,
  cockcroftGault,
  idealBodyWeightDevine,
} from './formulas/cockcroftGault';
import type { RuleBook } from './ruleBook';
import { detectAki, detectDoubling } from './rules/common';
import type { PriorPoint, RuleContext } from './rules/context';
import { evaluateRules } from './rules/engine';
import type {
  AssessResult,
  Assessment,
  CrClResult,
  EgfrResult,
  HistoryRecord,
  MeasurementDraft,
  MeasurementInput,
} from './types';
import { creatinineMgDl, creatinineUmolL, round1, roundInt } from './units';
import { validateInput } from './validation';

export interface AssessOptions {
  /** Текущее время (для проверки «дата не в будущем»). */
  now?: Date;
  /** Исключить запись из истории (при пересчёте уже сохранённого анализа). */
  excludeRecordId?: string;
}

const egfrResult = (formula: EgfrResult['formula'], value: number): EgfrResult => ({
  formula,
  value,
  rounded: roundInt(value),
  unit: 'мл/мин/1,73 м²',
});

/** Варианты CrCl: по фактической массе и — при ИМТ ≥ порога — по скорректированной (она основная). */
export function computeCrCl(
  input: MeasurementInput,
  scrMgDl: number,
  bmi: number | undefined,
  rules: RuleBook,
): { primary: CrClResult; variants: CrClResult[] } {
  const make = (weightKg: number, weightBasis: CrClResult['weightBasis'], idealWeightKg?: number): CrClResult => {
    const value = cockcroftGault(scrMgDl, input.ageYears, weightKg, input.sex);
    const r: CrClResult = { formula: 'Cockcroft-Gault', value, rounded: roundInt(value), unit: 'мл/мин', weightKg, weightBasis };
    if (idealWeightKg !== undefined) r.idealWeightKg = idealWeightKg;
    return r;
  };
  const actual = make(input.weightKg, 'actual');
  const { bmiFrom, factor } = rules.value<{ bmiFrom: number; factor: number }>('crcl.adjustedWeight');
  if (bmi === undefined || input.heightCm === undefined || bmi < bmiFrom) {
    return { primary: actual, variants: [actual] };
  }
  const ideal = idealBodyWeightDevine(input.heightCm, input.sex);
  const adjusted = make(adjustedBodyWeight(ideal, input.weightKg, factor), 'adjusted', ideal);
  return { primary: adjusted, variants: [adjusted, actual] };
}

export function toPriorPoints(history: HistoryRecord[], before: number, rules: RuleBook, excludeId?: string): PriorPoint[] {
  return history
    .filter((r) => r.id !== excludeId && toTime(r.sampledAt) < before)
    .map((r) => {
      const egfr = roundInt(r.egfr2009);
      return {
        sampledAt: r.sampledAt,
        time: toTime(r.sampledAt),
        creatinineUmolL: creatinineUmolL(r.creatinine),
        egfr,
        stage: stageFromEgfr(egfr, rules),
      };
    })
    .sort((a, b) => a.time - b.time);
}

export function assess(
  draft: MeasurementDraft,
  history: HistoryRecord[],
  rules: RuleBook,
  options: AssessOptions = {},
): AssessResult {
  const v = validateInput(draft, rules, options.now);
  if (!v.ok) return v;
  const input = v.input;

  const scrMgDl = creatinineMgDl(input.creatinine);
  const umolL = creatinineUmolL(input.creatinine);
  const egfr2009 = egfrResult('CKD-EPI 2009', ckdEpi2009(scrMgDl, input.ageYears, input.sex));
  const egfr2021 = egfrResult('CKD-EPI 2021', ckdEpi2021(scrMgDl, input.ageYears, input.sex));
  const stage = stageFromEgfr(egfr2009.rounded, rules);
  const stage2021 = stageFromEgfr(egfr2021.rounded, rules);
  const bmi = input.heightCm !== undefined ? round1(bodyMassIndex(input.weightKg, input.heightCm)) : undefined;
  const crcl = computeCrCl(input, scrMgDl, bmi, rules);
  const albuminuria = input.acr ? albuminuriaCategory(input.acr, rules) : undefined;

  const time = toTime(input.sampledAt);
  const prior = toPriorPoints(history, time, rules, options.excludeRecordId);

  const ctx: RuleContext = {
    input,
    time,
    creatinineUmolL: umolL,
    egfr: egfr2009.rounded,
    stage,
    stage2021,
    crcl: crcl.primary,
    crclVariants: crcl.variants,
    prior,
    rules,
    aki: detectAki(umolL, time, prior, rules),
    rapidDecline: detectDoubling(umolL, time, prior, rules),
  };
  if (bmi !== undefined) ctx.bmi = bmi;
  if (albuminuria) ctx.albuminuria = albuminuria;

  const assessment: Assessment = {
    input,
    creatinineUmolL: umolL,
    scrMgDl,
    egfr2009,
    stage,
    egfr2021,
    stage2021,
    crcl: crcl.primary,
    crclVariants: crcl.variants,
    nextTest: nextTest(stage, albuminuria, input.sampledAt, rules),
    findings: evaluateRules(ctx),
    rulesVersion: rules.version,
  };
  if (bmi !== undefined) assessment.bmi = bmi;
  if (albuminuria) {
    assessment.albuminuria = albuminuria;
    assessment.risk = riskLevel(stage, albuminuria, rules);
  }
  return { ok: true, assessment, warnings: v.warnings };
}
