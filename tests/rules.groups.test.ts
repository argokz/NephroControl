import { describe, expect, it } from 'vitest';
import type { RuleId } from '../src/core/ruleBook';
import { finding, has, ids, isoPlusHours, record, rules, run, withEgfr } from './helpers';

const T0 = '2026-03-01T08:00:00Z';
const umol = (value: number) => ({ value, unit: 'umol/L' as const });
const dm = { groups: ['diabetes' as const] };
const pneu = { groups: ['pneumonia' as const] };

describe('8.2. Сахарный диабет — метформин', () => {
  const cases: [number, RuleId][] = [
    [60, 'dm.metformin.noLimit'],
    [59, 'dm.metformin.consider'],
    [45, 'dm.metformin.consider'],
    [44, 'dm.metformin.reduce'],
    [30, 'dm.metformin.reduce'],
    [29, 'dm.metformin.stop'],
  ];
  for (const [egfr, id] of cases) {
    it(`eGFR ${egfr} → ${id}`, () => {
      const a = run(withEgfr(egfr, dm));
      expect(a.egfr2009.rounded).toBe(egfr);
      const metformin = ids(a).filter((x) => x.startsWith('dm.metformin.'));
      expect(metformin).toEqual([id]);
      expect(finding(a, id)?.message).toBe(rules.text(id));
    });
  }

  it('правила метформина — только для группы СД', () => {
    expect(ids(run(withEgfr(35))).some((x) => x.startsWith('dm.'))).toBe(false);
  });

  it('при подозрении на ОПП — отдельное предупреждение о лактатацидозе', () => {
    const hist = [record({ creatinine: umol(80), sampledAt: T0, ...dm })];
    const a = run({ creatinine: umol(110), sampledAt: isoPlusHours(T0, 36), ...dm }, hist);
    expect(finding(a, 'dm.metformin.aki')?.message).toBe(rules.text('dm.metformin.aki'));
  });

  it('коррекция дозы метформина — «требует сверки» (граница 30 расходится с И4)', () => {
    expect(finding(run(withEgfr(35, dm)), 'dm.metformin.reduce')?.status).toBe('требует сверки');
  });
});

describe('8.2. Сахарный диабет — иНГЛТ-2, САК, ИМТ', () => {
  it('eGFR 20 → начало возможно; 19 → ниже порога', () => {
    const a20 = run(withEgfr(20, dm));
    expect(has(a20, 'dm.sglt2.start')).toBe(true);
    expect(has(a20, 'dm.sglt2.belowStart')).toBe(false);
    const a19 = run(withEgfr(19, dm));
    expect(has(a19, 'dm.sglt2.start')).toBe(false);
    expect(finding(a19, 'dm.sglt2.belowStart')?.message).toBe(rules.text('dm.sglt2.belowStart'));
  });

  it('напоминание о временной отмене иНГЛТ-2 выводится всегда', () => {
    expect(has(run(dm), 'dm.sglt2.sickDays')).toBe(true);
  });

  it('САК не введено → рекомендуется определить; введено → нет', () => {
    expect(finding(run(dm), 'dm.acrMissing')?.message).toBe(rules.text('dm.acrMissing'));
    expect(has(run({ ...dm, acr: { value: 10, unit: 'mg/g' } }), 'dm.acrMissing')).toBe(false);
  });

  it('ИМТ ≥ 30 → предупреждение о переоценке CrCl по фактической массе', () => {
    const a = run({ ...dm, heightCm: 175, weightKg: 120, creatinine: { value: 1.2, unit: 'mg/dL' } });
    expect(finding(a, 'dm.obesityCrcl')?.message).toBe(rules.text('dm.obesityCrcl', { crclActual: 111 }));
    expect(has(run({ ...dm, heightCm: 175, weightKg: 80 }), 'dm.obesityCrcl')).toBe(false);
  });
});

describe('8.3. Пневмония', () => {
  it('при каждом расчёте — «креатинин нестабилен»', () => {
    expect(finding(run(pneu), 'pneu.unstable')?.message).toBe(rules.text('pneu.unstable'));
  });

  it('мочевина 7,1 → «признак тяжёлого течения»; 7,0 → нет', () => {
    const a = run({ ...pneu, ureaMmolL: 7.1 });
    expect(finding(a, 'pneu.urea')?.message).toBe(rules.text('pneu.urea', { urea: 7.1 }));
    expect(has(run({ ...pneu, ureaMmolL: 7.0 }), 'pneu.urea')).toBe(false);
  });

  it('креатинин 177 → сигнал; 176 → нет', () => {
    expect(finding(run({ ...pneu, creatinine: umol(177) }), 'pneu.creatinine')?.message).toBe(
      rules.text('pneu.creatinine', { creatinine: 177 }),
    );
    expect(has(run({ ...pneu, creatinine: umol(176) }), 'pneu.creatinine')).toBe(false);
  });

  it('CrCl для дозирования антибиотиков выделяется', () => {
    const a = run(pneu);
    expect(finding(a, 'pneu.crclDosing')?.message).toBe(rules.text('pneu.crclDosing', { crcl: a.crcl.rounded }));
  });

  it('проверка ОПП обязательна: без предыдущих значений за 7 суток — сообщение', () => {
    expect(has(run(pneu), 'pneu.aki.noHistory')).toBe(true);
    const hist = [record({ ...pneu, creatinine: umol(80), sampledAt: T0 })];
    const a = run({ ...pneu, creatinine: umol(110), sampledAt: isoPlusHours(T0, 36) }, hist);
    expect(has(a, 'pneu.aki.noHistory')).toBe(false);
    expect(has(a, 'common.aki')).toBe(true);
  });
});

describe('8.1. Хронический пиелонефрит', () => {
  it('снижение СКФ к предыдущему → пометка о преходящем снижении', () => {
    const hist = [record(withEgfr(70, { sampledAt: T0 }))];
    const a = run(withEgfr(65, { sampledAt: isoPlusHours(T0, 30 * 24) }), hist);
    expect(finding(a, 'pyelo.egfrDecrease')?.message).toBe(
      rules.text('pyelo.egfrDecrease', { previous: 70, current: 65 }),
    );
  });

  it('рост или отсутствие истории → нет', () => {
    const hist = [record(withEgfr(60, { sampledAt: T0 }))];
    expect(has(run(withEgfr(65, { sampledAt: isoPlusHours(T0, 30 * 24) }), hist), 'pyelo.egfrDecrease')).toBe(false);
    expect(has(run(), 'pyelo.egfrDecrease')).toBe(false);
  });

  it('напоминание о коррекции доз по CrCl', () => {
    const a = run();
    expect(finding(a, 'pyelo.doseReminder')?.message).toBe(rules.text('pyelo.doseReminder', { crcl: a.crcl.rounded }));
  });
});

describe('несколько групп и порядок вывода', () => {
  it('СД + пневмония → срабатывают правила обеих групп', () => {
    const a = run(withEgfr(35, { groups: ['diabetes', 'pneumonia'] }));
    expect(has(a, 'dm.metformin.reduce')).toBe(true);
    expect(has(a, 'pneu.unstable')).toBe(true);
    expect(has(a, 'pyelo.doseReminder')).toBe(false);
  });

  it('предупреждения сгруппированы: экстренно → важно → информация', () => {
    const hist = [record({ creatinine: umol(80), sampledAt: T0 })];
    const a = run(
      { creatinine: umol(170), sampledAt: isoPlusHours(T0, 40 * 24), groups: ['diabetes', 'pneumonia'], ureaMmolL: 9 },
      hist,
    );
    const order = { emergency: 0, important: 1, info: 2 };
    const ranks = a.findings.map((f) => order[f.severity]);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    expect(a.findings[0]?.severity).toBe('emergency');
  });
});
