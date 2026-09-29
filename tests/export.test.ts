import { describe, expect, it } from 'vitest';
import { historyToCsv } from '../src/core/csv';
import { toHistoryRecord } from '../src/core/record';
import { record, rules, run } from './helpers';

describe('запись истории и CSV', () => {
  it('запись содержит все поля раздела 9', () => {
    const r = record({ creatinine: { value: 106, unit: 'umol/L' }, sampledAt: '2026-02-01T09:00:00Z' });
    expect(r.creatinine).toEqual({ value: 106, unit: 'umol/L' });
    expect(r.creatinineMgDl).toBeCloseTo(106 / 88.4, 12);
    expect(Math.round(r.egfr2009)).toBe(65);
    expect(Math.round(r.egfr2021)).toBe(69);
    expect(Math.round(r.crcl)).toBe(65);
    expect(r.crclWeightKg).toBe(70);
    expect(r.crclWeightBasis).toBe('actual');
    expect(r.stage).toBe('C2');
    expect(r.firedRuleIds).toContain('ckd.singleMeasurement');
    expect(r.rulesVersion).toBe(rules.version);
  });

  it('запись создаётся из результата, обёрнутого в прокси (реактивное состояние UI)', () => {
    const a = run();
    const proxied = new Proxy({ ...a, input: new Proxy(a.input, {}) }, {});
    const r = toHistoryRecord(proxied, 'p1', 'x', '2026-01-01T00:00:00Z');
    expect(r.input).toEqual(a.input);
  });

  it('CSV: заголовок, «;», десятичная запятая, сортировка по дате', () => {
    const r2 = record({ creatinine: { value: 1.2, unit: 'mg/dL' }, sampledAt: '2026-05-01T09:00:00Z' });
    const r1 = record({ creatinine: { value: 106, unit: 'umol/L' }, sampledAt: '2026-02-01T09:00:00Z' });
    const lines = historyToCsv([r2, r1], rules).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('eGFR CKD-EPI 2009');
    const first = lines[1]!.split(';');
    expect(first[0]).toBe('2026-02-01T09:00:00Z');
    expect(first[2]).toBe('мкмоль/л');
    expect(first[3]).toBe('1,20');
    expect(first[4]).toBe('65');
    expect(first[8]).toBe('фактическая масса');
    expect(first[9]).toBe('С2');
    expect(lines[2]!.split(';')[1]).toBe('1,2');
  });
});
