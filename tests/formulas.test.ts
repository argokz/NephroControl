import { describe, expect, it } from 'vitest';
import raw from '../src/config/rules.json';
import { ckdEpi2009 } from '../src/core/formulas/ckdEpi2009';
import { ckdEpi2021 } from '../src/core/formulas/ckdEpi2021';
import { bodyMassIndex, idealBodyWeightDevine } from '../src/core/formulas/cockcroftGault';
import { REFERENCE_CASES } from '../src/core/verification';
import { finding, has, rules, run } from './helpers';

// Эталоны ТЗ, раздел 13 (допуск ±1) — общие с самопроверкой на странице «О программе».
const REFERENCE = REFERENCE_CASES;

describe('эталонные значения (раздел 13)', () => {
  for (const c of REFERENCE) {
    it(c.name, () => {
      const a = run(c.draft);
      expect(Math.abs(a.egfr2009.rounded - c.egfr2009)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.egfr2021.rounded - c.egfr2021)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.crcl.rounded - c.crcl)).toBeLessThanOrEqual(1);
      expect(a.stage).toBe(c.stage);
      expect(a.stage2021).toBe(c.stage2021);
      expect(a.crcl.weightBasis).toBe('actual');
    });
  }

  it('тест 2 вызывает пояснение о расхождении стадий', () => {
    const a = run(REFERENCE[1]!.draft);
    expect(finding(a, 'stage.discrepancy')?.message).toBe(
      rules.text('stage.discrepancy', { stage2009: 'С2', stage2021: 'С1' }),
    );
  });

  it('тест 1 (стадии совпадают) не вызывает пояснения о расхождении', () => {
    expect(has(run(REFERENCE[0]!.draft), 'stage.discrepancy')).toBe(false);
  });

  it('тест 4 вызывает «метформин: требуется коррекция дозы»', () => {
    const a = run(REFERENCE[3]!.draft);
    expect(finding(a, 'dm.metformin.reduce')?.message).toBe(rules.text('dm.metformin.reduce'));
  });
});

describe('CKD-EPI: ветки формулы и неокруглённые значения', () => {
  it('ветка Scr/κ ≤ 1 и > 1 непрерывна в точке κ', () => {
    expect(ckdEpi2009(0.9, 50, 'male')).toBeCloseTo(141 * 0.993 ** 50, 10);
    expect(ckdEpi2009(0.7, 50, 'female')).toBeCloseTo(141 * 0.993 ** 50 * 1.018, 10);
    expect(ckdEpi2021(0.9, 50, 'male')).toBeCloseTo(142 * 0.9938 ** 50, 10);
    expect(ckdEpi2021(0.7, 50, 'female')).toBeCloseTo(142 * 0.9938 ** 50 * 1.012, 10);
  });

  it('промежуточные значения не округляются, округление — только rounded', () => {
    const a = run({ creatinine: { value: 106, unit: 'umol/L' } });
    expect(Number.isInteger(a.egfr2009.value)).toBe(false);
    expect(a.egfr2009.rounded).toBe(Math.round(a.egfr2009.value));
  });
});

describe('расовый коэффициент', () => {
  it('не применяется: формула не принимает признак расы, в конфиге коэффициента нет', () => {
    expect(ckdEpi2009.length).toBe(3);
    expect(JSON.stringify(raw)).not.toContain('1.159');
    const a = run({ creatinine: { value: 1.2, unit: 'mg/dL' } });
    expect(a.egfr2009.value).toBeCloseTo(ckdEpi2009(1.2, 60, 'male'), 12);
  });
});

describe('Кокрофт–Голт и скорректированная масса (ИМТ ≥ 30)', () => {
  it('М, 60 л, 120 кг, 175 см, 1,2 мг/дл → основной CrCl по скорректированной массе', () => {
    const a = run({ weightKg: 120, heightCm: 175, creatinine: { value: 1.2, unit: 'mg/dL' } });
    expect(a.bmi).toBe(39.2);
    expect(a.crcl.weightBasis).toBe('adjusted');
    expect(a.crcl.idealWeightKg).toBeCloseTo(70.34, 2);
    expect(a.crcl.weightKg).toBeCloseTo(90.2, 1);
    expect(a.crcl.rounded).toBe(84);
    const actual = a.crclVariants.find((c) => c.weightBasis === 'actual');
    expect(actual?.rounded).toBe(111);
  });

  it('ИМТ ровно 30 → скорректированная масса; 29,9 → только фактическая', () => {
    // рост 200 см: ИМТ = масса / 4
    expect(run({ heightCm: 200, weightKg: 120 }).crcl.weightBasis).toBe('adjusted');
    const below = run({ heightCm: 200, weightKg: 119.6 });
    expect(below.crcl.weightBasis).toBe('actual');
    expect(below.crclVariants).toHaveLength(1);
  });

  it('без роста — только фактическая масса', () => {
    const a = run({ weightKg: 140 });
    expect(a.bmi).toBeUndefined();
    expect(a.crcl.weightBasis).toBe('actual');
  });

  it('формула Devine и ИМТ', () => {
    expect(idealBodyWeightDevine(175, 'male')).toBeCloseTo(70.34, 2);
    expect(idealBodyWeightDevine(175, 'female')).toBeCloseTo(65.84, 2);
    expect(bodyMassIndex(80, 200)).toBe(20);
  });

  it('у женщин множитель 0,85', () => {
    const m = run({ sex: 'male' }).crcl.value;
    const f = run({ sex: 'female' }).crcl.value;
    expect(f / m).toBeCloseTo(0.85, 12);
  });
});
