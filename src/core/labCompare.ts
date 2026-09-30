// Сверка с лабораторией: сравнение eGFR, рассчитанной приложением, со значением
// из бланка лаборатории на обезличенной выгрузке (CSV). Выполняется только в браузере,
// данные не сохраняются и никуда не передаются.
//
// Сравниваются обе формулы — CKD-EPI 2009 и 2021: лаборатории в РК могут использовать
// любую из них, и по меньшему расхождению видно, какую именно.
// Значения вида «>90» / «>60» (цензурированные) не входят в статистику расхождений,
// но проверяются на согласованность: округлённая eGFR приложения должна быть не ниже порога.

import { stageFromEgfr } from './classification';
import { ckdEpi2009 } from './formulas/ckdEpi2009';
import { ckdEpi2021 } from './formulas/ckdEpi2021';
import type { RuleBook } from './ruleBook';
import { STAGES_ORDER, type CkdStage, type CreatinineUnit, type Sex } from './types';
import { creatinineMgDl, roundInt } from './units';

export type LabFormula = '2009' | '2021';
export const LAB_FORMULAS: readonly LabFormula[] = ['2009', '2021'];

export interface LabRow {
  line: number;
  id: string;
  ageYears: number;
  sex: Sex;
  creatinine: { value: number; unit: CreatinineUnit };
  /** Числовое значение из бланка; для «>90» — сам порог 90. */
  labEgfr: number;
  /** true, если в бланке указано «>N» (точное значение неизвестно). */
  censored: boolean;
}

export interface LabRowError {
  line: number;
  message: string;
}

export interface ParsedLab {
  rows: LabRow[];
  errors: LabRowError[];
  /** Колонки, которые не удалось найти (обязательные). */
  missingColumns: string[];
}

type Column = 'id' | 'age' | 'sex' | 'creatinine' | 'unit' | 'egfr';

const REQUIRED: { key: Column; label: string }[] = [
  { key: 'age', label: 'Возраст' },
  { key: 'sex', label: 'Пол' },
  { key: 'creatinine', label: 'Креатинин' },
  { key: 'egfr', label: 'СКФ лаборатории' },
];

/** Поиск колонки по заголовку: порядок важен («скф» раньше «креатинин» не пересекается). */
function columnOf(header: string): Column | null {
  const h = header.trim().toLowerCase();
  if (/^(id|№|n|номер|код)$/.test(h)) return 'id';
  if (h.startsWith('возраст') || h === 'age') return 'age';
  if (h === 'пол' || h === 'sex' || h === 'gender') return 'sex';
  if (h.includes('скф') || h.includes('egfr') || h.includes('gfr')) return 'egfr';
  if (h.startsWith('ед') || h === 'unit' || h === 'units') return 'unit';
  if (h.includes('креатинин') || h.includes('creatinine') || h === 'scr') return 'creatinine';
  return null;
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectSeparator(header: string): string {
  if (header.includes(';')) return ';';
  if (header.includes('\t')) return '\t';
  return ',';
}

function parseNumber(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

function parseSex(s: string): Sex | null {
  const t = s.trim().toLowerCase();
  if (['м', 'муж', 'мужской', 'm', 'male'].includes(t)) return 'male';
  if (['ж', 'жен', 'женский', 'f', 'female'].includes(t)) return 'female';
  return null;
}

function parseUnit(s: string): CreatinineUnit | null {
  const t = s.trim().toLowerCase().replace(/\s/g, '').replace('µ', 'u').replace('μ', 'u');
  if (['мкмоль/л', 'umol/l', 'мкмоль'].includes(t)) return 'umol/L';
  if (['мг/дл', 'mg/dl'].includes(t)) return 'mg/dL';
  return null;
}

/**
 * Разбор CSV лаборатории. Разделитель «;», табуляция или «,»; десятичная запятая допускается
 * (при разделителе «;» или табуляции). Если колонки единиц нет, используется defaultUnit.
 */
export function parseLabCsv(text: string, defaultUnit: CreatinineUnit, ageRange: { min: number; max: number }): ParsedLab {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.trim() !== '');
  if (headerIdx < 0) return { rows: [], errors: [], missingColumns: REQUIRED.map((c) => c.label) };
  const sep = detectSeparator(lines[headerIdx]!);
  const cols = splitLine(lines[headerIdx]!, sep).map(columnOf);
  const idx = (k: Column) => cols.indexOf(k);
  const missingColumns = REQUIRED.filter((c) => idx(c.key) < 0).map((c) => c.label);
  if (missingColumns.length) return { rows: [], errors: [], missingColumns };

  const rows: LabRow[] = [];
  const errors: LabRowError[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i]!;
    if (raw.trim() === '') continue;
    const line = i + 1;
    const f = splitLine(raw, sep);
    const get = (k: Column) => (idx(k) >= 0 ? (f[idx(k)] ?? '') : '');
    const problems: string[] = [];

    const age = parseNumber(get('age'));
    if (age === null) problems.push('возраст не число');
    else if (age < ageRange.min || age > ageRange.max) problems.push(`возраст вне ${ageRange.min}–${ageRange.max} лет`);

    const sex = parseSex(get('sex'));
    if (!sex) problems.push('пол не распознан (м/ж)');

    const scr = parseNumber(get('creatinine'));
    if (scr === null || scr <= 0) problems.push('креатинин не положительное число');

    const unitText = get('unit');
    const unit = unitText ? parseUnit(unitText) : defaultUnit;
    if (!unit) problems.push(`единица «${unitText}» не распознана`);

    const egfrText = get('egfr').replace(/\s/g, '');
    const censored = /^(>|≥|>=)/.test(egfrText);
    const egfr = parseNumber(egfrText.replace(/^(>=|>|≥)/, ''));
    if (egfr === null || egfr <= 0) problems.push('СКФ лаборатории не распознана');

    if (problems.length) {
      errors.push({ line, message: problems.join('; ') });
      continue;
    }
    rows.push({
      line,
      id: get('id') || String(rows.length + 1),
      ageYears: age!,
      sex: sex!,
      creatinine: { value: scr!, unit: unit! },
      labEgfr: egfr!,
      censored,
    });
  }
  return { rows, errors, missingColumns: [] };
}

export interface ComparedRow {
  row: LabRow;
  /** Округлённые до целого eGFR приложения — как на экране. */
  ours: Record<LabFormula, number>;
  /** ours − лаборатория; null для цензурированных значений. */
  diff: Record<LabFormula, number | null>;
  labStage: CkdStage | null;
  ourStage: Record<LabFormula, CkdStage>;
  /** Для «>N»: согласовано, если eGFR приложения ≥ N. */
  consistent: Record<LabFormula, boolean>;
}

export interface FormulaSummary {
  formula: LabFormula;
  /** Строки с точным значением лаборатории. */
  n: number;
  meanDiff: number;
  sdDiff: number;
  loaLow: number;
  loaHigh: number;
  meanAbsDiff: number;
  maxAbsDiff: number;
  /** Доля строк с |разница| ≤ 1, ≤ 3 и ≤ 5 мл/мин/1,73 м². */
  within: { 1: number; 3: number; 5: number };
  stageAgreement: number;
  kappa: number;
  /** confusion[лаборатория][приложение] по STAGES_ORDER. */
  confusion: number[][];
  censoredN: number;
  censoredConsistent: number;
}

export interface LabComparison {
  rows: ComparedRow[];
  summary: Record<LabFormula, FormulaSummary>;
  /** Формула с меньшим средним модулем расхождения (если есть точные значения). */
  closer: LabFormula | null;
}

export function compareRow(row: LabRow, rules: RuleBook): ComparedRow {
  const scr = creatinineMgDl(row.creatinine);
  const ours: Record<LabFormula, number> = {
    '2009': roundInt(ckdEpi2009(scr, row.ageYears, row.sex)),
    '2021': roundInt(ckdEpi2021(scr, row.ageYears, row.sex)),
  };
  const lab = row.labEgfr;
  const labStage = row.censored ? null : stageFromEgfr(roundInt(lab), rules);
  const per = <T>(fn: (f: LabFormula) => T) => ({ '2009': fn('2009'), '2021': fn('2021') });
  return {
    row,
    ours,
    diff: per((f) => (row.censored ? null : ours[f] - lab)),
    labStage,
    ourStage: per((f) => stageFromEgfr(ours[f], rules)),
    consistent: per((f) => (row.censored ? ours[f] >= lab : Math.abs(ours[f] - lab) <= 1)),
  };
}

/** Каппа Коэна (невзвешенная) по квадратной матрице сопряжённости. */
export function cohenKappa(m: number[][]): number {
  const total = m.flat().reduce((a, b) => a + b, 0);
  if (total === 0) return NaN;
  const po = m.reduce((s, r, i) => s + r[i]!, 0) / total;
  const rowSum = m.map((r) => r.reduce((a, b) => a + b, 0));
  const colSum = m[0]!.map((_, j) => m.reduce((s, r) => s + r[j]!, 0));
  const pe = rowSum.reduce((s, r, i) => s + r * colSum[i]!, 0) / (total * total);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

function summarize(rows: ComparedRow[], formula: LabFormula): FormulaSummary {
  const exact = rows.filter((r) => !r.row.censored);
  const d = exact.map((r) => r.diff[formula]!);
  const n = d.length;
  const mean = n ? d.reduce((a, b) => a + b, 0) / n : NaN;
  const sd = n > 1 ? Math.sqrt(d.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : NaN;
  const abs = d.map(Math.abs);
  const share = (lim: number) => (n ? abs.filter((x) => x <= lim).length / n : NaN);
  const confusion = STAGES_ORDER.map(() => STAGES_ORDER.map(() => 0));
  for (const r of exact) {
    const cells = confusion[STAGES_ORDER.indexOf(r.labStage!)]!;
    const j = STAGES_ORDER.indexOf(r.ourStage[formula]);
    cells[j] = cells[j]! + 1;
  }
  const agree = exact.filter((r) => r.labStage === r.ourStage[formula]).length;
  const censored = rows.filter((r) => r.row.censored);
  return {
    formula,
    n,
    meanDiff: mean,
    sdDiff: sd,
    loaLow: mean - 1.96 * sd,
    loaHigh: mean + 1.96 * sd,
    meanAbsDiff: n ? abs.reduce((a, b) => a + b, 0) / n : NaN,
    maxAbsDiff: n ? Math.max(...abs) : NaN,
    within: { 1: share(1), 3: share(3), 5: share(5) },
    stageAgreement: n ? agree / n : NaN,
    kappa: cohenKappa(confusion),
    confusion,
    censoredN: censored.length,
    censoredConsistent: censored.filter((r) => r.consistent[formula]).length,
  };
}

export function compareLab(rows: LabRow[], rules: RuleBook): LabComparison {
  const compared = rows.map((r) => compareRow(r, rules));
  const summary = { '2009': summarize(compared, '2009'), '2021': summarize(compared, '2021') };
  const a = summary['2009'].meanAbsDiff;
  const b = summary['2021'].meanAbsDiff;
  const closer = Number.isNaN(a) || Number.isNaN(b) || a === b ? null : a < b ? '2009' : '2021';
  return { rows: compared, summary, closer };
}

const csvNum = (x: number | null, digits = 0) => (x === null || Number.isNaN(x) ? '' : x.toFixed(digits).replace('.', ','));

/** Построчный отчёт сверки (CSV, «;», десятичная запятая). */
export function labComparisonToCsv(c: LabComparison): string {
  const header = [
    'Строка', 'ID', 'Возраст', 'Пол', 'Креатинин', 'Единица', 'СКФ лаборатории',
    'CKD-EPI 2009', 'Разница 2009', 'CKD-EPI 2021', 'Разница 2021',
    'Стадия лаборатории', 'Стадия 2009', 'Стадия 2021',
  ];
  const rows = c.rows.map((r) => [
    String(r.row.line),
    r.row.id,
    String(r.row.ageYears),
    r.row.sex === 'male' ? 'м' : 'ж',
    String(r.row.creatinine.value).replace('.', ','),
    r.row.creatinine.unit === 'umol/L' ? 'мкмоль/л' : 'мг/дл',
    (r.row.censored ? '>' : '') + String(r.row.labEgfr).replace('.', ','),
    String(r.ours['2009']),
    csvNum(r.diff['2009']),
    String(r.ours['2021']),
    csvNum(r.diff['2021']),
    r.labStage ?? '',
    r.ourStage['2009'],
    r.ourStage['2021'],
  ]);
  const esc = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((row) => row.map(esc).join(';')).join('\r\n');
}

/** Шаблон выгрузки: заголовок и две строки-примера формата (не реальные данные). */
export const LAB_CSV_TEMPLATE = [
  'ID;Возраст;Пол;Креатинин;Единица;СКФ лаборатории',
  '1;50;м;106;мкмоль/л;70',
  '2;72;ж;0,8;мг/дл;>60',
].join('\r\n');
