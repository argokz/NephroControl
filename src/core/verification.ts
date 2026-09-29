// Самопроверка расчётов: эталоны и сценарии ТЗ (раздел 13), выполняемые тем же кодом, что и расчёт.
// Используется страницей «О программе» (проверка выполняется в браузере пользователя) и тестами.
//
// Это проверка правильности реализации формул и правил, а не клиническая оценка приложения.

import { assess } from './assess';
import { albuminuriaCategory, stageFromEgfr } from './classification';
import { ckdEpi2009 } from './formulas/ckdEpi2009';
import { ckdEpi2021 } from './formulas/ckdEpi2021';
import { cockcroftGault, idealBodyWeightDevine } from './formulas/cockcroftGault';
import { toHistoryRecord } from './record';
import { formatNumber, type RuleBook, type RuleId } from './ruleBook';
import type { Assessment, CkdStage, HistoryRecord, MeasurementDraft, Sex } from './types';
import { mgDlToUmolL, umolLToMgDl } from './units';

export interface CheckResult {
  group: string;
  title: string;
  expected: string;
  actual: string;
  pass: boolean;
}

export interface ReferenceCase {
  name: string;
  draft: MeasurementDraft;
  egfr2009: number;
  stage: CkdStage;
  egfr2021: number;
  stage2021: CkdStage;
  crcl: number;
}

/** Эталонные значения ТЗ, раздел 13 (рассчитаны заранее, допуск ±1). */
export const REFERENCE_CASES: ReferenceCase[] = [
  {
    name: '1: М, 60 л, 70 кг, 106 мкмоль/л',
    draft: { sex: 'male', ageYears: 60, weightKg: 70, creatinine: { value: 106, unit: 'umol/L' } },
    egfr2009: 65, stage: 'C2', egfr2021: 69, stage2021: 'C2', crcl: 65,
  },
  {
    name: '2: Ж, 45 л, 60 кг, 71 мкмоль/л',
    draft: { sex: 'female', ageYears: 45, weightKg: 60, creatinine: { value: 71, unit: 'umol/L' } },
    egfr2009: 89, stage: 'C2', egfr2021: 93, stage2021: 'C1', crcl: 84,
  },
  {
    name: '3: М, 30 л, 80 кг, 0,70 мг/дл',
    draft: { sex: 'male', ageYears: 30, weightKg: 80, creatinine: { value: 0.7, unit: 'mg/dL' } },
    egfr2009: 127, stage: 'C1', egfr2021: 127, stage2021: 'C1', crcl: 175,
  },
  {
    name: '4: Ж, 70 л, 65 кг, 133 мкмоль/л, СД',
    draft: { sex: 'female', ageYears: 70, weightKg: 65, creatinine: { value: 133, unit: 'umol/L' }, groups: ['diabetes'] },
    egfr2009: 35, stage: 'C3b', egfr2021: 37, stage2021: 'C3b', crcl: 36,
  },
];

export const TOLERANCE = 1;

/** Фиксированное «сейчас» — результат самопроверки не зависит от текущей даты. */
export const CHECK_NOW = new Date('2030-01-01T00:00:00Z');
const T0 = '2029-06-01T08:00:00Z';

export const CHECK_BASE: MeasurementDraft = {
  creatinine: { value: 80, unit: 'umol/L' },
  ageYears: 60,
  weightKg: 70,
  sex: 'male',
  groups: ['pyelonephritis'],
  sampledAt: T0,
  specialConditions: [],
};

/**
 * Обратная CKD-EPI 2009: креатинин (мг/дл), при котором eGFR равна target (ветка Scr/κ > 1).
 * Нужна, чтобы задать вход с точно известной СКФ для проверки порогов.
 */
export function scrForEgfr2009(target: number, age: number, sex: Sex): number {
  const female = sex === 'female';
  const kappa = female ? 0.7 : 0.9;
  const k = 141 * 0.993 ** age * (female ? 1.018 : 1);
  return kappa * (target / k) ** (-1 / 1.209);
}

/** Черновик, дающий заданную eGFR CKD-EPI 2009 (мужчина 60 лет). */
export function withEgfr(target: number, patch: MeasurementDraft = {}): MeasurementDraft {
  return { ...patch, creatinine: { value: scrForEgfr2009(target, 60, 'male'), unit: 'mg/dL' }, ageYears: 60, sex: 'male' };
}

const plusHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3_600_000).toISOString();
const umol = (value: number) => ({ value, unit: 'umol/L' as const });

export function runSelfCheck(rules: RuleBook): CheckResult[] {
  const out: CheckResult[] = [];
  const n = (x: number, d = 0) => formatNumber(Number(x.toFixed(d)));
  const stageText = (s: CkdStage) => rules.label('stage.bounds', s);

  const run = (patch: MeasurementDraft, history: HistoryRecord[] = []): Assessment => {
    const r = assess({ ...CHECK_BASE, ...patch }, history, rules, { now: CHECK_NOW });
    if (!r.ok) throw new Error(`Самопроверка: ошибка ввода — ${r.errors.map((e) => e.message).join('; ')}`);
    return r.assessment;
  };
  let seq = 0;
  const rec = (patch: MeasurementDraft, history: HistoryRecord[] = []) => {
    const a = run(patch, history);
    return toHistoryRecord(a, 'check', `check-${++seq}`, a.input.sampledAt);
  };
  const fired = (a: Assessment, id: RuleId) => a.findings.some((f) => f.ruleId === id);
  const check = (group: string, title: string, expected: string, actual: string, pass: boolean) =>
    out.push({ group, title, expected, actual, pass });
  const expectRule = (group: string, title: string, a: Assessment, id: RuleId, want: boolean) =>
    check(group, title, want ? 'сработает' : 'не сработает', fired(a, id) ? 'сработало' : 'не сработало', fired(a, id) === want);

  // 1. Эталоны ТЗ
  const G1 = 'Эталонные значения ТЗ (раздел 13), допуск ±1';
  for (const c of REFERENCE_CASES) {
    const a = run(c.draft);
    const within = (got: number, want: number) => Math.abs(got - want) <= TOLERANCE;
    check(G1, `${c.name} — CKD-EPI 2009`, `${c.egfr2009} (${stageText(c.stage)})`,
      `${n(a.egfr2009.value, 2)} → ${a.egfr2009.rounded} (${stageText(a.stage)})`,
      within(a.egfr2009.rounded, c.egfr2009) && a.stage === c.stage);
    check(G1, `${c.name} — CKD-EPI 2021`, `${c.egfr2021} (${stageText(c.stage2021)})`,
      `${n(a.egfr2021.value, 2)} → ${a.egfr2021.rounded} (${stageText(a.stage2021)})`,
      within(a.egfr2021.rounded, c.egfr2021) && a.stage2021 === c.stage2021);
    check(G1, `${c.name} — Кокрофт–Голт`, `${c.crcl}`, `${n(a.crcl.value, 2)} → ${a.crcl.rounded}`, within(a.crcl.rounded, c.crcl));
  }
  expectRule(G1, 'Тест 2: пояснение о расхождении стадий 2009/2021', run(REFERENCE_CASES[1]!.draft), 'stage.discrepancy', true);
  expectRule(G1, 'Тест 1: стадии совпадают — пояснения нет', run(REFERENCE_CASES[0]!.draft), 'stage.discrepancy', false);
  expectRule(G1, 'Тест 4: «метформин: требуется коррекция дозы»', run(REFERENCE_CASES[3]!.draft), 'dm.metformin.reduce', true);

  // 2. Свойства формул — проверяются независимо от эталонов
  const G2 = 'Свойства формул';
  const eq = (x: number, y: number, eps = 1e-9) => Math.abs(x - y) <= eps * Math.max(1, Math.abs(y));
  check(G2, 'CKD-EPI 2009: при Scr = κ множители креатинина равны 1 (м, 50 лет)', n(141 * 0.993 ** 50, 4),
    n(ckdEpi2009(0.9, 50, 'male'), 4), eq(ckdEpi2009(0.9, 50, 'male'), 141 * 0.993 ** 50));
  check(G2, 'CKD-EPI 2009: женский множитель 1,018 при одинаковом Scr/κ', '1,018',
    n(ckdEpi2009(1.4, 50, 'female') / ckdEpi2009(1.8, 50, 'male'), 4),
    eq(ckdEpi2009(1.4, 50, 'female') / ckdEpi2009(1.8, 50, 'male'), 1.018));
  check(G2, 'CKD-EPI 2009: +1 год возраста → × 0,993', '0,993', n(ckdEpi2009(1.2, 61, 'male') / ckdEpi2009(1.2, 60, 'male'), 4),
    eq(ckdEpi2009(1.2, 61, 'male') / ckdEpi2009(1.2, 60, 'male'), 0.993));
  check(G2, 'CKD-EPI 2021: при Scr = κ множители креатинина равны 1 (ж, 50 лет)', n(142 * 0.9938 ** 50 * 1.012, 4),
    n(ckdEpi2021(0.7, 50, 'female'), 4), eq(ckdEpi2021(0.7, 50, 'female'), 142 * 0.9938 ** 50 * 1.012));
  check(G2, 'CKD-EPI 2021: +1 год возраста → × 0,9938', '0,9938', n(ckdEpi2021(1.2, 61, 'male') / ckdEpi2021(1.2, 60, 'male'), 4),
    eq(ckdEpi2021(1.2, 61, 'male') / ckdEpi2021(1.2, 60, 'male'), 0.9938));
  check(G2, 'Кокрофт–Голт: у женщин × 0,85', '0,85', n(cockcroftGault(1, 60, 70, 'female') / cockcroftGault(1, 60, 70, 'male'), 4),
    eq(cockcroftGault(1, 60, 70, 'female') / cockcroftGault(1, 60, 70, 'male'), 0.85));
  check(G2, 'Пересчёт креатинина: 1 мг/дл = 88,4 мкмоль/л и обратно', '106 → 1,1991 → 106',
    `106 → ${n(umolLToMgDl(106), 4)} → ${n(mgDlToUmolL(umolLToMgDl(106)), 4)}`, eq(mgDlToUmolL(umolLToMgDl(106)), 106));
  check(G2, 'Идеальная масса по Devine: М, 175 см', '70,34 кг', `${n(idealBodyWeightDevine(175, 'male'), 2)} кг`,
    Math.abs(idealBodyWeightDevine(175, 'male') - 70.34) < 0.005);
  const obese = run({ weightKg: 120, heightCm: 175, creatinine: { value: 1.2, unit: 'mg/dL' } });
  const obeseActual = obese.crclVariants.find((c) => c.weightBasis === 'actual');
  check(G2, 'ИМТ ≥ 30: М, 60 л, 120 кг, 175 см, 1,2 мг/дл', 'ИМТ 39,2; CrCl 84 (скорр. 90,2 кг) и 111 (факт.)',
    `ИМТ ${n(obese.bmi ?? 0, 1)}; CrCl ${obese.crcl.rounded} (${rules.label('crcl.adjustedWeight', obese.crcl.weightBasis)} ${n(obese.crcl.weightKg, 1)} кг) и ${obeseActual?.rounded ?? '—'}`,
    obese.bmi === 39.2 && obese.crcl.weightBasis === 'adjusted' && obese.crcl.rounded === 84 && obeseActual?.rounded === 111);
  const noRace = run({ creatinine: { value: 1.2, unit: 'mg/dL' } });
  check(G2, 'Расовый коэффициент не применяется', `${n(ckdEpi2009(1.2, 60, 'male'), 4)}`, n(noRace.egfr2009.value, 4),
    ckdEpi2009.length === 3 && eq(noRace.egfr2009.value, ckdEpi2009(1.2, 60, 'male')));

  // 3. Границы классификации
  const G3 = 'Границы стадий и альбуминурии';
  const stagePairs: [number, CkdStage][] = [
    [90, 'C1'], [89, 'C2'], [60, 'C2'], [59, 'C3a'], [45, 'C3a'], [44, 'C3b'], [30, 'C3b'], [29, 'C4'], [15, 'C4'], [14, 'C5'],
  ];
  for (const [egfr, want] of stagePairs) {
    const got = stageFromEgfr(egfr, rules);
    check(G3, `СКФ ${egfr}`, stageText(want), stageText(got), got === want);
  }
  const roundedEdge = run(withEgfr(89.6));
  check(G3, 'СКФ 89,6 округляется до 90 → стадия по округлённому', stageText('C1'), `${roundedEdge.egfr2009.rounded} → ${stageText(roundedEdge.stage)}`, roundedEdge.stage === 'C1');
  const albPairs: [number, 'mg/g' | 'mg/mmol', string][] = [
    [29, 'mg/g', 'A1'], [30, 'mg/g', 'A2'], [300, 'mg/g', 'A2'], [301, 'mg/g', 'A3'],
    [2.9, 'mg/mmol', 'A1'], [3, 'mg/mmol', 'A2'], [30, 'mg/mmol', 'A2'], [30.1, 'mg/mmol', 'A3'],
  ];
  for (const [value, unit, want] of albPairs) {
    const got = albuminuriaCategory({ value, unit }, rules);
    check(G3, `САК ${n(value, 1)} ${unit === 'mg/g' ? 'мг/г' : 'мг/ммоль'}`, want.replace('A', 'А'), got.replace('A', 'А'), got === want);
  }

  // 4. Сценарии правил
  const G4 = 'Сценарии правил ТЗ (раздел 13)';
  const h80 = [rec({ creatinine: umol(80) })];
  expectRule(G4, 'ОПП: 80 → 110 мкмоль/л через 36 ч', run({ creatinine: umol(110), sampledAt: plusHours(T0, 36) }, h80), 'common.aki', true);
  expectRule(G4, 'ОПП: 80 → 100 мкмоль/л через 36 ч', run({ creatinine: umol(100), sampledAt: plusHours(T0, 36) }, h80), 'common.aki', false);
  expectRule(G4, 'ОПП: 80 → 125 мкмоль/л через 6 суток', run({ creatinine: umol(125), sampledAt: plusHours(T0, 6 * 24) }, h80), 'common.aki', true);
  expectRule(G4, 'Удвоение креатинина за 50 суток', run({ creatinine: umol(160), sampledAt: plusHours(T0, 50 * 24) }, h80), 'common.hospital.doubling', true);
  expectRule(G4, 'Удвоение креатинина за 70 суток', run({ creatinine: umol(160), sampledAt: plusHours(T0, 70 * 24) }, h80), 'common.hospital.doubling', false);
  const pneu: MeasurementDraft = { groups: ['pneumonia'] };
  expectRule(G4, 'Пневмония: мочевина 7,1 ммоль/л', run({ ...pneu, ureaMmolL: 7.1 }), 'pneu.urea', true);
  expectRule(G4, 'Пневмония: мочевина 7,0 ммоль/л', run({ ...pneu, ureaMmolL: 7.0 }), 'pneu.urea', false);
  expectRule(G4, 'Пневмония: креатинин 177 мкмоль/л', run({ ...pneu, creatinine: umol(177) }), 'pneu.creatinine', true);
  expectRule(G4, 'Пневмония: креатинин 176 мкмоль/л', run({ ...pneu, creatinine: umol(176) }), 'pneu.creatinine', false);
  const metformin: [number, RuleId][] = [
    [60, 'dm.metformin.noLimit'], [59, 'dm.metformin.consider'], [45, 'dm.metformin.consider'],
    [44, 'dm.metformin.reduce'], [30, 'dm.metformin.reduce'], [29, 'dm.metformin.stop'],
  ];
  for (const [egfr, id] of metformin) {
    const a = run(withEgfr(egfr, { groups: ['diabetes'] }));
    const got = a.findings.find((f) => f.ruleId.startsWith('dm.metformin.'))?.ruleId ?? '—';
    check(G4, `Метформин при СКФ ${egfr}`, rules.text(id), got === '—' ? '—' : rules.text(got as RuleId), got === id);
  }
  expectRule(G4, 'иНГЛТ-2: СКФ 20 — начало терапии возможно', run(withEgfr(20, { groups: ['diabetes'] })), 'dm.sglt2.start', true);
  expectRule(G4, 'иНГЛТ-2: СКФ 19 — ниже порога начала', run(withEgfr(19, { groups: ['diabetes'] })), 'dm.sglt2.belowStart', true);
  expectRule(G4, 'Госпитализация: креатинин 251 мкмоль/л (м)', run({ creatinine: umol(251) }), 'common.hospital.creatinine', true);
  expectRule(G4, 'Госпитализация: креатинин 250 мкмоль/л (м)', run({ creatinine: umol(250) }), 'common.hospital.creatinine', false);
  const minor = assess({ ...CHECK_BASE, ageYears: 17 }, [], rules, { now: CHECK_NOW });
  check(G4, 'Возраст 17 лет — расчёт не выполняется', 'отказ', minor.ok ? 'расчёт выполнен' : 'отказ',
    !minor.ok && minor.errors.some((e) => e.ruleId === 'validation.age.minor'));

  return out;
}
