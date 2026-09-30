import { describe, expect, it } from 'vitest';
import { rules } from '../src/config/rules';
import { LAB_CSV_TEMPLATE, cohenKappa, compareLab, labComparisonToCsv, parseLabCsv } from '../src/core/labCompare';

const AGE = { min: 18, max: 110 };
const parse = (text: string) => parseLabCsv(text, 'umol/L', AGE);

describe('сверка с лабораторией: разбор CSV', () => {
  it('шаблон разбирается без ошибок; «>60» — цензурированное значение', () => {
    const p = parse(LAB_CSV_TEMPLATE);
    expect(p.missingColumns).toEqual([]);
    expect(p.errors).toEqual([]);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[1]).toMatchObject({ ageYears: 72, sex: 'female', creatinine: { value: 0.8, unit: 'mg/dL' }, labEgfr: 60, censored: true });
  });

  it('разделитель «,», английские заголовки, BOM; без колонки единиц — единица по умолчанию', () => {
    const p = parseLabCsv('﻿age,sex,creatinine,eGFR\n50,M,1.2,70\n', 'mg/dL', AGE);
    expect(p.errors).toEqual([]);
    expect(p.rows[0]).toMatchObject({ id: '1', ageYears: 50, sex: 'male', creatinine: { value: 1.2, unit: 'mg/dL' }, labEgfr: 70 });
  });

  it('нет обязательной колонки — сообщение о ней, строки не разбираются', () => {
    const p = parse('Возраст;Пол;Креатинин\n50;м;106');
    expect(p.missingColumns).toEqual(['СКФ лаборатории']);
    expect(p.rows).toEqual([]);
  });

  it('ошибочные строки пропускаются с номером строки и причиной', () => {
    const p = parse('Возраст;Пол;Креатинин;Единица;СКФ\n17;м;106;мкмоль/л;70\n50;x;106;ммоль;\n50;ж;80;мкмоль/л;75');
    expect(p.rows).toHaveLength(1);
    expect(p.errors).toEqual([
      { line: 2, message: 'возраст вне 18–110 лет' },
      { line: 3, message: 'пол не распознан (м/ж); единица «ммоль» не распознана; СКФ лаборатории не распознана' },
    ]);
  });
});

describe('сверка с лабораторией: расчёт', () => {
  // 50 лет, м, 106 мкмоль/л: CKD-EPI 2009 → 70, 2021 → 74 (округлённо).
  const csv = [
    'ID;Возраст;Пол;Креатинин;Единица;СКФ лаборатории',
    'a;50;м;106;мкмоль/л;70',
    'b;50;м;106;мкмоль/л;74',
    'c;50;м;106;мкмоль/л;>60',
    'd;50;м;106;мкмоль/л;>90',
  ].join('\n');
  const c = compareLab(parse(csv).rows, rules);

  it('eGFR приложения округляется до целого и сравнивается с обеими формулами', () => {
    expect(c.rows[0]!.ours).toEqual({ '2009': 70, '2021': 74 });
    expect(c.rows[0]!.diff).toEqual({ '2009': 0, '2021': 4 });
    expect(c.rows[1]!.diff).toEqual({ '2009': -4, '2021': 0 });
  });

  it('«>N» не входит в статистику, но проверяется на согласованность', () => {
    expect(c.summary['2009'].n).toBe(2);
    expect(c.summary['2009'].censoredN).toBe(2);
    expect(c.summary['2009'].censoredConsistent).toBe(1); // 70 ≥ 60, но 70 < 90
    expect(c.rows[2]!.diff['2009']).toBeNull();
  });

  it('сводка: средняя разница, пределы согласия, доли в пределах ±1/3/5, стадии', () => {
    const s = c.summary['2009'];
    expect(s.meanDiff).toBe(-2);
    expect(s.sdDiff).toBeCloseTo(Math.SQRT2 * 2, 10);
    expect(s.loaLow).toBeCloseTo(-2 - 1.96 * 2 * Math.SQRT2, 10);
    expect(s.meanAbsDiff).toBe(2);
    expect(s.maxAbsDiff).toBe(4);
    expect(s.within).toEqual({ 1: 0.5, 3: 0.5, 5: 1 });
    expect(s.stageAgreement).toBe(1);
    expect(c.closer).toBeNull(); // средний модуль расхождения одинаков
  });

  it('формула с меньшим расхождением определяется автоматически', () => {
    const only2021 = compareLab(parse('Возраст;Пол;Креатинин;СКФ\n50;м;106;74\n50;м;106;73').rows, rules);
    expect(only2021.closer).toBe('2021');
  });

  it('стадии на границе: лаборатория 60 (С2), приложение 59 (С3а) — несовпадение в матрице', () => {
    // 60 лет, ж, 85 мкмоль/л: CKD-EPI 2009 ≥ 60 (С2); лаборатория 59 → С3а.
    const r = compareLab(parse('Возраст;Пол;Креатинин;СКФ\n60;ж;85;59').rows, rules);
    const s = r.summary['2009'];
    expect(r.rows[0]!.labStage).toBe('C3a');
    expect(r.rows[0]!.ourStage['2009']).toBe('C2');
    expect(s.stageAgreement).toBe(0);
    expect(s.confusion[2]![1]).toBe(1);
  });

  it('каппа Коэна: полное совпадение 1, совпадение на уровне случайного 0', () => {
    expect(cohenKappa([[5, 0], [0, 5]])).toBe(1);
    expect(cohenKappa([[25, 25], [25, 25]])).toBe(0);
  });

  it('отчёт CSV: разделитель «;», «>» у цензурированных, пустая разница', () => {
    const lines = labComparisonToCsv(c).split('\r\n');
    expect(lines).toHaveLength(5);
    expect(lines[1]).toBe('2;a;50;м;106;мкмоль/л;70;70;0;74;4;C2;C2;C2');
    expect(lines[3]).toBe('4;c;50;м;106;мкмоль/л;>60;70;;74;;;C2;C2');
  });
});
