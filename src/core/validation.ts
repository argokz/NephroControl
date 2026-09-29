// Проверка ввода (ТЗ, раздел 4). Тексты сообщений — из rules.json.

import type { RuleBook } from './ruleBook';
import { parseDate } from './dates';
import {
  SPECIAL_CONDITIONS,
  type MeasurementDraft,
  type MeasurementInput,
  type ValidationIssue,
  type ValidationResult,
} from './types';

type Range = { min: number; max: number };

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isSet = (x: unknown) => x !== undefined && x !== null && !(typeof x === 'number' && Number.isNaN(x));

export function validateInput(
  draft: MeasurementDraft,
  rules: RuleBook,
  now: Date = new Date(),
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (field: string, ruleId: Parameters<RuleBook['text']>[0], params?: Record<string, string | number>) =>
    errors.push({ field, ruleId, message: rules.text(ruleId, params) });

  // Креатинин
  const c = draft.creatinine;
  if (!c || !isNum(c.value) || c.value <= 0 || (c.unit !== 'umol/L' && c.unit !== 'mg/dL')) {
    err('creatinine', 'validation.creatinine.required');
  } else {
    const u = rules.value<{ umolLBelow: number; mgDlAbove: number }>('validation.creatinine.unitCheck');
    if ((c.unit === 'umol/L' && c.value < u.umolLBelow) || (c.unit === 'mg/dL' && c.value > u.mgDlAbove)) {
      warnings.push({
        field: 'creatinine',
        ruleId: 'validation.creatinine.unitCheck',
        message: rules.text('validation.creatinine.unitCheck', {
          value: c.value,
          unit: c.unit === 'umol/L' ? 'мкмоль/л' : 'мг/дл',
        }),
      });
    }
  }

  // Возраст: младше 18 — отказ в расчёте с пояснением
  const age = draft.ageYears;
  const ageRange = rules.value<Range>('validation.age.range');
  if (!isNum(age)) err('ageYears', 'validation.age.range');
  else if (age < rules.value<number>('validation.age.minor')) err('ageYears', 'validation.age.minor');
  else if (age < ageRange.min || age > ageRange.max) err('ageYears', 'validation.age.range');

  // Масса
  const w = draft.weightKg;
  const wRange = rules.value<Range>('validation.weight.range');
  if (!isNum(w) || w < wRange.min || w > wRange.max) err('weightKg', 'validation.weight.range');

  if (draft.sex !== 'male' && draft.sex !== 'female') err('sex', 'validation.sex.required');

  const groups = draft.groups ?? [];
  const validGroups = groups.filter((g) => g === 'pyelonephritis' || g === 'diabetes' || g === 'pneumonia');
  if (validGroups.length < rules.value<number>('validation.groups.required')) err('groups', 'validation.groups.required');

  // Дата анализа
  const date = typeof draft.sampledAt === 'string' ? parseDate(draft.sampledAt) : null;
  if (!date) err('sampledAt', 'validation.sampledAt.required');
  else if (date.getTime() > now.getTime()) err('sampledAt', 'validation.sampledAt.future');

  // Необязательные
  if (isSet(draft.heightCm) && !(isNum(draft.heightCm) && draft.heightCm > 0)) err('heightCm', 'validation.height.positive');
  if (isSet(draft.acr)) {
    const a = draft.acr;
    if (!a || !isNum(a.value) || a.value < 0 || (a.unit !== 'mg/g' && a.unit !== 'mg/mmol')) err('acr', 'validation.acr.positive');
  }
  if (isSet(draft.ureaMmolL) && !(isNum(draft.ureaMmolL) && draft.ureaMmolL > 0)) err('ureaMmolL', 'validation.urea.positive');

  if (errors.length) return { ok: false, errors, warnings };

  const input: MeasurementInput = {
    creatinine: { value: c!.value, unit: c!.unit },
    ageYears: age!,
    weightKg: w!,
    sex: draft.sex!,
    groups: [...new Set(validGroups)],
    sampledAt: draft.sampledAt!,
    specialConditions: (draft.specialConditions ?? []).filter((s) => SPECIAL_CONDITIONS.includes(s)),
  };
  if (isSet(draft.heightCm)) input.heightCm = draft.heightCm!;
  if (isSet(draft.acr)) input.acr = { value: draft.acr!.value, unit: draft.acr!.unit };
  if (isSet(draft.ureaMmolL)) input.ureaMmolL = draft.ureaMmolL!;
  return { ok: true, input, warnings };
}
