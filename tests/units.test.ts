import { describe, expect, it } from 'vitest';
import { creatinineMgDl, creatinineUmolL, mgDlToUmolL, round1, roundInt, umolLToMgDl } from '../src/core/units';

describe('пересчёт единиц креатинина (1 мг/дл = 88,4 мкмоль/л)', () => {
  it('мг/дл → мкмоль/л', () => {
    expect(mgDlToUmolL(1)).toBeCloseTo(88.4, 12);
    expect(mgDlToUmolL(1.2)).toBeCloseTo(106.08, 12);
  });

  it('мкмоль/л → мг/дл', () => {
    expect(umolLToMgDl(88.4)).toBeCloseTo(1, 12);
    expect(umolLToMgDl(133)).toBeCloseTo(1.50452, 5);
  });

  it('туда и обратно без потерь', () => {
    for (const v of [20, 71, 106, 250, 1000]) expect(mgDlToUmolL(umolLToMgDl(v))).toBeCloseTo(v, 10);
    for (const v of [0.3, 0.7, 1.2, 5.5]) expect(umolLToMgDl(mgDlToUmolL(v))).toBeCloseTo(v, 10);
  });

  it('значение в исходных единицах берётся без двойного пересчёта', () => {
    expect(creatinineUmolL({ value: 80, unit: 'umol/L' })).toBe(80);
    expect(creatinineMgDl({ value: 0.7, unit: 'mg/dL' })).toBe(0.7);
  });

  it('округление', () => {
    expect(roundInt(89.5)).toBe(90);
    expect(roundInt(89.49)).toBe(89);
    expect(round1(39.18)).toBe(39.2);
  });
});
