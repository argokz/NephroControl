import { describe, expect, it } from 'vitest';
import { computeDynamics } from '../src/core/dynamics';
import { finding, has, isoPlusHours, record, rules, run, withEgfr } from './helpers';

const T0 = '2026-01-10T08:00:00Z';
const at = (days: number) => isoPlusHours(T0, days * 24);

describe('динамика: предупреждения при расчёте', () => {
  it('снижение ≥ 25% от исходного со сменой стадии → «значимое ухудшение»', () => {
    const hist = [record(withEgfr(80, { sampledAt: at(0) }))];
    const a = run(withEgfr(55, { sampledAt: at(120) }), hist);
    expect(finding(a, 'dynamics.worsening')?.message).toBe(
      rules.text('dynamics.worsening', { percent: 31, stageFrom: 'С2', stageTo: 'С3а' }),
    );
  });

  it('снижение ≥ 25% без смены стадии → нет', () => {
    const hist = [record(withEgfr(120, { sampledAt: at(0) }))];
    expect(has(run(withEgfr(90, { sampledAt: at(120) }), hist), 'dynamics.worsening')).toBe(false);
  });

  it('смена стадии при снижении < 25% → нет', () => {
    const hist = [record(withEgfr(62, { sampledAt: at(0) }))];
    expect(has(run(withEgfr(58, { sampledAt: at(120) }), hist), 'dynamics.worsening')).toBe(false);
  });

  it('переход в более благоприятную стадию → «улучшение»', () => {
    const hist = [record(withEgfr(40, { sampledAt: at(0) }))];
    const a = run(withEgfr(50, { sampledAt: at(120) }), hist);
    expect(finding(a, 'dynamics.improvement')?.message).toBe(
      rules.text('dynamics.improvement', { stageFrom: 'С3б', stageTo: 'С3а' }),
    );
  });
});

describe('динамика: ряд для экрана', () => {
  it('изменение к предыдущему и к первому (мл/мин/1,73 м² и %), записи сортируются по дате', () => {
    const r1 = record(withEgfr(80, { sampledAt: at(0) }));
    const r2 = record(withEgfr(70, { sampledAt: at(90) }));
    const r3 = record(withEgfr(56, { sampledAt: at(180) }));
    const points = computeDynamics([r3, r1, r2], rules);
    expect(points.map((p) => p.egfr)).toEqual([80, 70, 56]);
    expect(points[0]?.toPrevious).toBeUndefined();
    expect(points[1]?.toPrevious).toEqual({ abs: -10, percent: -12.5 });
    expect(points[2]?.toPrevious?.abs).toBe(-14);
    expect(points[2]?.toPrevious?.percent).toBeCloseTo(-20, 10);
    expect(points[2]?.toFirst).toEqual({ abs: -24, percent: -30 });
    expect(points[2]?.trend).toBe('worsening');
    expect(points[1]?.trend).toBeUndefined();
  });
});
