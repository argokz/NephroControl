// Внешняя проверка на открытых данных: 100 здоровых взрослых, Киншаса (ДР Конго), 2015–2016,
// измеренная СКФ — плазменный клиренс иогексола. Bukabau J.B., Sumaili E.K., Cavalier E., Pottel H. и др.
// Dryad, doi:10.5061/dryad.m67g1 (зеркало — Zenodo, запись 4950330), лицензия CC0.
// В tests/fixtures/kinshasa-iohexol.csv оставлены только нужные колонки; колонки с этническим
// коэффициентом не взяты. Описание и результаты — docs/validation-kinshasa.md.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rules } from '../src/config/rules';
import { ckdEpi2009 } from '../src/core/formulas/ckdEpi2009';
import { ckdEpi2021 } from '../src/core/formulas/ckdEpi2021';
import { compareLab, type LabRow } from '../src/core/labCompare';
import type { Sex } from '../src/core/types';

interface Subject {
  id: number;
  age: number;
  sex: Sex;
  scr: number;
  mgfr: number | null;
  authors: number;
}

const subjects: Subject[] = readFileSync(new URL('./fixtures/kinshasa-iohexol.csv', import.meta.url), 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((l) => l.split(','))
  .map(([id, age, sex, scr, mgfr, authors]) => ({
    id: Number(id),
    age: Number(age),
    sex: sex as Sex,
    scr: Number(scr),
    mgfr: mgfr ? Number(mgfr) : null,
    authors: Number(authors),
  }));

/** Строки, где у авторов CKD-EPI не соответствует креатинину из той же таблицы (см. docs/validation-kinshasa.md). */
const AUTHORS_ERRATA = [2, 3];

const asLab = (value: (s: Subject) => number | null): LabRow[] =>
  subjects
    .filter((s) => value(s) !== null)
    .map((s, i) => ({
      line: i + 2,
      id: String(s.id),
      ageYears: s.age,
      sex: s.sex,
      creatinine: { value: s.scr, unit: 'mg/dL' },
      labEgfr: value(s)!,
      censored: false,
    }));

describe('открытые данные Киншасы (иогексол): совпадение с расчётом авторов', () => {
  it('в наборе 100 человек, у 98 есть измеренная СКФ', () => {
    expect(subjects).toHaveLength(100);
    expect(subjects.filter((s) => s.mgfr !== null)).toHaveLength(98);
  });

  it('CKD-EPI 2009 совпадает с колонкой авторов (без этнического коэффициента) до 0,05 во всех строках, кроме опечаток авторов', () => {
    const mismatched = subjects.filter((s) => Math.abs(ckdEpi2009(s.scr, s.age, s.sex) - s.authors) > 0.05).map((s) => s.id);
    expect(mismatched).toEqual(AUTHORS_ERRATA);
  });

  it('вкладка «Сверка» относит расчёт авторов к CKD-EPI 2009; стадии совпадают во всех строках', () => {
    const c = compareLab(asLab((s) => s.authors), rules);
    expect(c.closer).toBe('2009');
    expect(c.summary['2009'].stageAgreement).toBe(1);
    expect(c.summary['2009'].within[1]).toBe(0.98);
  });
});

describe('открытые данные Киншасы (иогексол): точность формул против измеренной СКФ', () => {
  // Описательные показатели: фиксируются, чтобы изменение формул не прошло незамеченным.
  // Это не критерий «правильности» — см. docs/validation-kinshasa.md.
  const measured = subjects.filter((s) => s.mgfr !== null);
  const p30 = (f: (s: Subject) => number) =>
    measured.filter((s) => Math.abs(f(s) - s.mgfr!) <= 0.3 * s.mgfr!).length / measured.length;

  it('CKD-EPI 2009: смещение +3,9, P30 81,6%, совпадение стадии 66,3%', () => {
    const c = compareLab(asLab((s) => s.mgfr), rules).summary['2009'];
    expect(c.n).toBe(98);
    expect(c.meanDiff).toBeCloseTo(3.9, 1);
    expect(c.stageAgreement).toBeCloseTo(0.663, 3);
    expect(p30((s) => ckdEpi2009(s.scr, s.age, s.sex))).toBeCloseTo(0.816, 3);
  });

  it('CKD-EPI 2021: смещение +7,2, P30 80,6%, совпадение стадии 65,3%', () => {
    const c = compareLab(asLab((s) => s.mgfr), rules).summary['2021'];
    expect(c.meanDiff).toBeCloseTo(7.2, 1);
    expect(c.stageAgreement).toBeCloseTo(0.653, 3);
    expect(p30((s) => ckdEpi2021(s.scr, s.age, s.sex))).toBeCloseTo(0.806, 3);
  });
});
