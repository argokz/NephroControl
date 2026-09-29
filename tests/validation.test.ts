import { describe, expect, it } from 'vitest';
import { assess } from '../src/core/assess';
import type { RuleId } from '../src/core/ruleBook';
import type { MeasurementDraft } from '../src/core/types';
import { validateInput } from '../src/core/validation';
import { base, NOW, rules } from './helpers';

const check = (patch: MeasurementDraft) => validateInput({ ...base, ...patch }, rules, NOW);

function expectError(patch: MeasurementDraft, field: string, ruleId: RuleId) {
  const r = check(patch);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  const e = r.errors.find((x) => x.field === field);
  expect(e?.ruleId).toBe(ruleId);
  expect(e?.message).toBe(rules.text(ruleId));
}

describe('возраст', () => {
  it('17 лет → отказ в расчёте с пояснением', () => {
    expectError({ ageYears: 17 }, 'ageYears', 'validation.age.minor');
    const r = assess({ ...base, ageYears: 17 }, [], rules, { now: NOW });
    expect(r.ok).toBe(false);
  });
  it('18 и 110 — допустимо', () => {
    expect(check({ ageYears: 18 }).ok).toBe(true);
    expect(check({ ageYears: 110 }).ok).toBe(true);
  });
  it('111 и не число → ошибка диапазона', () => {
    expectError({ ageYears: 111 }, 'ageYears', 'validation.age.range');
    expectError({ ageYears: Number.NaN }, 'ageYears', 'validation.age.range');
  });
});

describe('масса тела', () => {
  it('30 и 250 — допустимо', () => {
    expect(check({ weightKg: 30 }).ok).toBe(true);
    expect(check({ weightKg: 250 }).ok).toBe(true);
  });
  it('29,9 и 250,1 → ошибка', () => {
    expectError({ weightKg: 29.9 }, 'weightKg', 'validation.weight.range');
    expectError({ weightKg: 250.1 }, 'weightKg', 'validation.weight.range');
  });
});

describe('креатинин', () => {
  it('0, отрицательное и пустое → ошибка', () => {
    expectError({ creatinine: { value: 0, unit: 'umol/L' } }, 'creatinine', 'validation.creatinine.required');
    expectError({ creatinine: { value: -5, unit: 'umol/L' } }, 'creatinine', 'validation.creatinine.required');
    expectError({ creatinine: { value: Number.NaN, unit: 'mg/dL' } }, 'creatinine', 'validation.creatinine.required');
    expectError({ creatinine: undefined }, 'creatinine', 'validation.creatinine.required');
  });

  it('< 20 мкмоль/л → предупреждение «проверьте единицы», расчёт выполняется', () => {
    const r = check({ creatinine: { value: 1.2, unit: 'umol/L' } });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.ruleId)).toEqual(['validation.creatinine.unitCheck']);
  });

  it('> 20 мг/дл → предупреждение', () => {
    const r = check({ creatinine: { value: 106, unit: 'mg/dL' } });
    expect(r.warnings.map((w) => w.ruleId)).toEqual(['validation.creatinine.unitCheck']);
  });

  it('20 мкмоль/л и 20 мг/дл — без предупреждения', () => {
    expect(check({ creatinine: { value: 20, unit: 'umol/L' } }).warnings).toHaveLength(0);
    expect(check({ creatinine: { value: 20, unit: 'mg/dL' } }).warnings).toHaveLength(0);
  });
});

describe('прочие поля', () => {
  it('пол и группа обязательны', () => {
    expectError({ sex: undefined }, 'sex', 'validation.sex.required');
    expectError({ groups: [] }, 'groups', 'validation.groups.required');
  });

  it('дата: пустая/некорректная → ошибка; в будущем → ошибка', () => {
    expectError({ sampledAt: 'не дата' }, 'sampledAt', 'validation.sampledAt.required');
    expectError({ sampledAt: undefined }, 'sampledAt', 'validation.sampledAt.required');
    expectError({ sampledAt: '2031-01-01T00:00:00Z' }, 'sampledAt', 'validation.sampledAt.future');
  });

  it('необязательные поля: некорректные значения → ошибка', () => {
    expectError({ heightCm: -1 }, 'heightCm', 'validation.height.positive');
    expectError({ acr: { value: -1, unit: 'mg/g' } }, 'acr', 'validation.acr.positive');
    expectError({ ureaMmolL: 0 }, 'ureaMmolL', 'validation.urea.positive');
  });

  it('пустые необязательные поля (NaN из формы) не считаются ошибкой', () => {
    const r = check({ heightCm: Number.NaN, ureaMmolL: Number.NaN });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.heightCm).toBeUndefined();
      expect(r.input.ureaMmolL).toBeUndefined();
    }
  });

  it('несколько ошибок сообщаются одновременно', () => {
    const r = check({ ageYears: 17, weightKg: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field).sort()).toEqual(['ageYears', 'weightKg']);
  });
});
