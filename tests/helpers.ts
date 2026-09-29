import { rules } from '../src/config/rules';
import { assess, type AssessOptions } from '../src/core/assess';
import { toHistoryRecord } from '../src/core/record';
import type { RuleId } from '../src/core/ruleBook';
import type { Assessment, HistoryRecord, MeasurementDraft, Sex } from '../src/core/types';

export { rules };

export const NOW = new Date('2030-01-01T00:00:00Z');

export const base: MeasurementDraft = {
  creatinine: { value: 80, unit: 'umol/L' },
  ageYears: 60,
  weightKg: 70,
  sex: 'male',
  groups: ['pyelonephritis'],
  sampledAt: '2026-03-01T08:00:00Z',
  specialConditions: [],
};

export function run(patch: MeasurementDraft = {}, history: HistoryRecord[] = [], options: AssessOptions = {}): Assessment {
  const r = assess({ ...base, ...patch }, history, rules, { now: NOW, ...options });
  if (!r.ok) throw new Error(`Ожидался успешный расчёт: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.assessment;
}

let seq = 0;
export function record(patch: MeasurementDraft, history: HistoryRecord[] = []): HistoryRecord {
  const a = run(patch, history);
  seq += 1;
  return toHistoryRecord(a, 'p1', `r${seq}`, a.input.sampledAt);
}

export const ids = (a: Assessment) => a.findings.map((f) => f.ruleId);
export const has = (a: Assessment, id: RuleId) => ids(a).includes(id);
export const finding = (a: Assessment, id: RuleId) => a.findings.find((f) => f.ruleId === id);

export function isoPlusHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

/**
 * Обратная CKD-EPI 2009: креатинин (мг/дл), при котором eGFR равна target.
 * Нужна для граничных тестов порогов СКФ (ветка Scr/κ > 1).
 */
export function scrForEgfr2009(target: number, age: number, sex: Sex): number {
  const female = sex === 'female';
  const kappa = female ? 0.7 : 0.9;
  const k = 141 * 0.993 ** age * (female ? 1.018 : 1);
  return kappa * (target / k) ** (-1 / 1.209);
}

/** Черновик, дающий заданную eGFR CKD-EPI 2009 (мужчина 60 лет). */
export function withEgfr(target: number, patch: MeasurementDraft = {}): MeasurementDraft {
  return { ...patch, creatinine: { value: scrForEgfr2009(target, 60, 'male'), unit: 'mg/dL' }, ageYears: 60, sex: 'male' };
}
