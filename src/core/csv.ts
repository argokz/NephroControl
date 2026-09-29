// Экспорт истории в CSV. Разделитель «;» и десятичная запятая — для русскоязычного Excel.
// BOM добавляет вызывающий код при сохранении файла.

import { stageLabel } from './classification';
import type { RuleBook } from './ruleBook';
import type { HistoryRecord } from './types';

const HEADER = [
  'Дата анализа',
  'Креатинин',
  'Единица',
  'Креатинин, мг/дл',
  'eGFR CKD-EPI 2009, мл/мин/1,73 м²',
  'eGFR CKD-EPI 2021 (справочно), мл/мин/1,73 м²',
  'CrCl Кокрофт–Голт, мл/мин',
  'Масса для CrCl, кг',
  'Масса',
  'Стадия',
  'Категория А',
  'Сработавшие правила',
  'Версия rules.json',
];

const num = (x: number, digits: number) => x.toFixed(digits).replace('.', ',');

function cell(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function historyToCsv(records: HistoryRecord[], rules: RuleBook): string {
  const sorted = [...records].sort((a, b) => new Date(a.sampledAt).getTime() - new Date(b.sampledAt).getTime());
  const rows = sorted.map((r) => [
    r.sampledAt,
    String(r.creatinine.value).replace('.', ','),
    r.creatinine.unit === 'umol/L' ? 'мкмоль/л' : 'мг/дл',
    num(r.creatinineMgDl, 2),
    num(r.egfr2009, 0),
    num(r.egfr2021, 0),
    num(r.crcl, 0),
    num(r.crclWeightKg, 1),
    rules.label('crcl.adjustedWeight', r.crclWeightBasis),
    stageLabel(r.stage, rules),
    r.albuminuria ? r.albuminuria.replace('A', 'А') : '',
    r.firedRuleIds.join(', '),
    r.rulesVersion,
  ]);
  return [HEADER, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
}
