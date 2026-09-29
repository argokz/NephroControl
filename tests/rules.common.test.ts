import { describe, expect, it } from 'vitest';
import { SPECIAL_CONDITIONS } from '../src/core/types';
import { base, finding, has, isoPlusHours, record, rules, run, withEgfr } from './helpers';

const T0 = '2026-03-01T08:00:00Z';
const umol = (value: number) => ({ value, unit: 'umol/L' as const });
const history80 = () => [record({ creatinine: umol(80), sampledAt: T0 })];

describe('7.3. ОПП', () => {
  it('80 → 110 мкмоль/л через 36 ч → «возможно ОПП»', () => {
    const a = run({ creatinine: umol(110), sampledAt: isoPlusHours(T0, 36) }, history80());
    expect(finding(a, 'common.aki')?.message).toBe(rules.text('common.aki'));
  });

  it('80 → 100 через 36 ч → нет', () => {
    expect(has(run({ creatinine: umol(100), sampledAt: isoPlusHours(T0, 36) }, history80()), 'common.aki')).toBe(false);
  });

  it('80 → 125 через 6 дней → «возможно ОПП» (≥ 1,5 раза за 7 суток)', () => {
    expect(has(run({ creatinine: umol(125), sampledAt: isoPlusHours(T0, 6 * 24) }, history80()), 'common.aki')).toBe(true);
  });

  it('границы окна 48 ч: +26,5 ровно через 48 ч → да; +27 через 49 ч → нет', () => {
    expect(has(run({ creatinine: umol(106.5), sampledAt: isoPlusHours(T0, 48) }, history80()), 'common.aki')).toBe(true);
    expect(has(run({ creatinine: umol(107), sampledAt: isoPlusHours(T0, 49) }, history80()), 'common.aki')).toBe(false);
  });

  it('+0,3 мг/дл за 48 ч (= 26,52 мкмоль/л) → да', () => {
    const hist = [record({ creatinine: { value: 1.0, unit: 'mg/dL' }, sampledAt: T0 })];
    expect(has(run({ creatinine: { value: 1.3, unit: 'mg/dL' }, sampledAt: isoPlusHours(T0, 24) }, hist), 'common.aki')).toBe(true);
  });

  it('границы окна 7 суток: ×1,5 ровно на 7-е сутки → да; на 8-е → нет', () => {
    expect(has(run({ creatinine: umol(120), sampledAt: isoPlusHours(T0, 7 * 24) }, history80()), 'common.aki')).toBe(true);
    expect(has(run({ creatinine: umol(120), sampledAt: isoPlusHours(T0, 8 * 24) }, history80()), 'common.aki')).toBe(false);
  });

  it('ОПП делает формулу недостоверной (7.1)', () => {
    const a = run({ creatinine: umol(110), sampledAt: isoPlusHours(T0, 36) }, history80());
    expect(finding(a, 'common.unreliable')?.details).toContain(rules.label('common.unreliable', 'aki'));
  });

  it('без истории ОПП не определяется', () => {
    expect(has(run({ creatinine: umol(300) }), 'common.aki')).toBe(false);
  });

  it('запись, внесённая задним числом, не влияет на более ранний анализ', () => {
    const later = [record({ creatinine: umol(40), sampledAt: isoPlusHours(T0, 24) })];
    expect(has(run({ creatinine: umol(80), sampledAt: T0 }, later), 'common.aki')).toBe(false);
  });
});

describe('7.2. Удвоение креатинина', () => {
  it('за 50 дней → экстренный сигнал', () => {
    const a = run({ creatinine: umol(160), sampledAt: isoPlusHours(T0, 50 * 24) }, history80());
    const f = finding(a, 'common.hospital.doubling');
    expect(f?.severity).toBe('emergency');
    expect(f?.message).toBe(rules.text('common.hospital.doubling'));
    expect(a.findings[0]?.ruleId).toBe('common.hospital.doubling');
    expect(finding(a, 'common.unreliable')?.details).toContain(rules.label('common.unreliable', 'rapidDecline'));
  });

  it('за 70 дней → нет', () => {
    const a = run({ creatinine: umol(160), sampledAt: isoPlusHours(T0, 70 * 24) }, history80());
    expect(has(a, 'common.hospital.doubling')).toBe(false);
  });
});

describe('7.2. Плановая госпитализация', () => {
  it('впервые выявленная СКФ 29 → сигнал; 30 → нет', () => {
    expect(has(run(withEgfr(29)), 'common.hospital.egfr')).toBe(true);
    expect(has(run(withEgfr(30)), 'common.hospital.egfr')).toBe(false);
    expect(has(run(withEgfr(29.6)), 'common.hospital.egfr')).toBe(false); // округляется до 30
  });

  it('СКФ < 30 не впервые (была в истории) → нет', () => {
    const hist = [record(withEgfr(25, { sampledAt: T0 }))];
    expect(has(run(withEgfr(28, { sampledAt: isoPlusHours(T0, 90 * 24) }), hist), 'common.hospital.egfr')).toBe(false);
  });

  it('креатинин 250/251 мкмоль/л (м)', () => {
    expect(has(run({ sex: 'male', creatinine: umol(250) }), 'common.hospital.creatinine')).toBe(false);
    expect(has(run({ sex: 'male', creatinine: umol(251) }), 'common.hospital.creatinine')).toBe(true);
  });

  it('креатинин 200/201 мкмоль/л (ж)', () => {
    expect(has(run({ sex: 'female', creatinine: umol(200) }), 'common.hospital.creatinine')).toBe(false);
    const a = run({ sex: 'female', creatinine: umol(201) });
    expect(finding(a, 'common.hospital.creatinine')?.message).toBe(
      rules.text('common.hospital.creatinine', { creatinine: 201 }),
    );
  });
});

describe('7.1. Формула недостоверна', () => {
  // рост 200 см → ИМТ = масса / 4
  const bmi = (weightKg: number) => run({ heightCm: 200, weightKg });

  it('ИМТ 15 → нет; 14,9 → да', () => {
    expect(has(bmi(60), 'common.unreliable')).toBe(false);
    const a = bmi(59.6);
    expect(finding(a, 'common.unreliable')?.message).toBe(rules.text('common.unreliable'));
    expect(finding(a, 'common.unreliable')?.details).toEqual([rules.label('common.unreliable', 'bmi', { bmi: 14.9 })]);
  });

  it('ИМТ 40 → нет; 40,1 → да', () => {
    expect(has(bmi(160), 'common.unreliable')).toBe(false);
    expect(has(bmi(160.4), 'common.unreliable')).toBe(true);
  });

  for (const s of SPECIAL_CONDITIONS) {
    it(`особое состояние «${rules.label('common.unreliable', s)}» → да`, () => {
      const a = run({ specialConditions: [s] });
      expect(finding(a, 'common.unreliable')?.details).toEqual([rules.label('common.unreliable', s)]);
    });
  }

  it('без особых состояний и при нормальном ИМТ → нет', () => {
    expect(has(run({ heightCm: 175, weightKg: 70 }), 'common.unreliable')).toBe(false);
  });

  it('без роста — сообщение «ИМТ не рассчитан»', () => {
    expect(has(run(), 'common.bmiUnknown')).toBe(true);
    expect(has(run({ heightCm: 175 }), 'common.bmiUnknown')).toBe(false);
  });
});

describe('общие напоминания', () => {
  it('напоминание «однократное измерение — не диагноз» выводится всегда', () => {
    expect(finding(run(), 'ckd.singleMeasurement')?.message).toBe(rules.text('ckd.singleMeasurement'));
  });

  it('С1–С2 без альбуминурии → пометка о маркерах повреждения; с А2 или при С3а → нет', () => {
    expect(has(run(withEgfr(75)), 'stage.earlyStageMarkers')).toBe(true);
    expect(has(run(withEgfr(75, { acr: { value: 50, unit: 'mg/g' } })), 'stage.earlyStageMarkers')).toBe(false);
    expect(has(run(withEgfr(50)), 'stage.earlyStageMarkers')).toBe(false);
  });

  it('у каждого предупреждения есть источник и статус', () => {
    const a = run({ ...base, groups: ['pyelonephritis', 'diabetes', 'pneumonia'], ureaMmolL: 9 });
    for (const f of a.findings) {
      expect(f.source.length).toBeGreaterThan(0);
      expect(['проверено', 'требует сверки']).toContain(f.status);
    }
  });
});
