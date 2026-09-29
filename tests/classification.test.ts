import { describe, expect, it } from 'vitest';
import {
  albuminuriaCategory,
  nextTest,
  riskLevel,
  stageFromEgfr,
} from '../src/core/classification';
import type { AlbCategory, CkdStage } from '../src/core/types';
import { STAGES_ORDER } from '../src/core/types';
import { run, rules, withEgfr } from './helpers';

describe('стадии СКФ на границах', () => {
  const cases: [number, CkdStage][] = [
    [90, 'C1'], [89, 'C2'],
    [60, 'C2'], [59, 'C3a'],
    [45, 'C3a'], [44, 'C3b'],
    [30, 'C3b'], [29, 'C4'],
    [15, 'C4'], [14, 'C5'],
  ];
  for (const [egfr, stage] of cases) {
    it(`${egfr} → ${stage}`, () => expect(stageFromEgfr(egfr, rules)).toBe(stage));
  }

  it('стадия определяется по округлённому значению: 89,6 → 90 → С1; 89,4 → 89 → С2', () => {
    expect(run(withEgfr(89.6)).stage).toBe('C1');
    expect(run(withEgfr(89.4)).stage).toBe('C2');
  });
});

describe('альбуминурия (САК) на границах', () => {
  const cases: [number, 'mg/g' | 'mg/mmol', AlbCategory][] = [
    [29, 'mg/g', 'A1'], [30, 'mg/g', 'A2'],
    [300, 'mg/g', 'A2'], [301, 'mg/g', 'A3'],
    [2.9, 'mg/mmol', 'A1'], [3, 'mg/mmol', 'A2'],
    [30, 'mg/mmol', 'A2'], [30.1, 'mg/mmol', 'A3'],
  ];
  for (const [value, unit, cat] of cases) {
    it(`${value} ${unit} → ${cat}`, () => expect(albuminuriaCategory({ value, unit }, rules)).toBe(cat));
  }
});

describe('риск С × А', () => {
  it('таблица заполнена для всех 18 сочетаний', () => {
    for (const s of STAGES_ORDER)
      for (const a of ['A1', 'A2', 'A3'] as const) expect(riskLevel(s, a, rules)).toMatch(/^(low|moderate|high|veryHigh)$/);
  });

  it('характерные клетки', () => {
    expect(riskLevel('C1', 'A1', rules)).toBe('low');
    expect(riskLevel('C2', 'A2', rules)).toBe('moderate');
    expect(riskLevel('C3a', 'A1', rules)).toBe('moderate');
    expect(riskLevel('C3b', 'A1', rules)).toBe('high');
    expect(riskLevel('C3a', 'A3', rules)).toBe('veryHigh');
    expect(riskLevel('C5', 'A1', rules)).toBe('veryHigh');
  });

  it('без САК риск не определяется', () => {
    const a = run();
    expect(a.risk).toBeUndefined();
    expect(a.findings.some((f) => f.ruleId === 'risk.noAcr')).toBe(true);
  });

  it('с САК риск определяется', () => {
    const a = run({ acr: { value: 50, unit: 'mg/g' } });
    expect(a.albuminuria).toBe('A2');
    expect(a.risk).toBeDefined();
  });
});

describe('срок следующего анализа', () => {
  const at = '2026-01-15T10:00';

  it('С1–С2 / А1 → 12 мес', () => {
    const n = nextTest('C2', 'A1', at, rules);
    expect(n.dueFrom).toBe('2027-01-15');
    expect(n.dueTo).toBe('2027-01-15');
  });

  it('С1–С2 / А3 → диапазон 3–6 мес', () => {
    const n = nextTest('C1', 'A3', at, rules);
    expect(n.dueFrom).toBe('2026-04-15');
    expect(n.dueTo).toBe('2026-07-15');
  });

  it('С3а–С3б: А1/А2 → 6 мес, А3 → 3 мес', () => {
    expect(nextTest('C3a', 'A2', at, rules).dueFrom).toBe('2026-07-15');
    expect(nextTest('C3b', 'A3', at, rules).dueFrom).toBe('2026-04-15');
  });

  it('С4: А1/А2 → 3 мес, А3 → 6 нед; С5 → 6 нед', () => {
    expect(nextTest('C4', 'A1', at, rules).dueFrom).toBe('2026-04-15');
    expect(nextTest('C4', 'A3', at, rules).dueFrom).toBe('2026-02-26');
    expect(nextTest('C5', 'A1', at, rules).dueFrom).toBe('2026-02-26');
  });

  it('без САК — по столбцу А1 с пометкой «без учёта альбуминурии»', () => {
    const n = nextTest('C3a', undefined, at, rules);
    expect(n.dueFrom).toBe('2026-07-15');
    expect(n.withoutAlbuminuria).toBe(true);
    expect(n.note).toBe(rules.text('monitoring.noAcr'));
  });

  it('конец месяца не переполняется: 31.08 + 6 мес → 28.02', () => {
    expect(nextTest('C3a', 'A1', '2026-08-31T09:00', rules).dueFrom).toBe('2027-02-28');
  });
});
