// Классификация по [И1]: стадии СКФ (С1–С5), категории альбуминурии (А1–А3),
// риск по сочетанию С × А и срок следующего анализа. Пороги — из rules.json.

import type { RuleBook } from './ruleBook';
import { addMonths, addWeeks, parseDate, toIsoDate } from './dates';
import {
  STAGES_ORDER,
  type Acr,
  type AlbCategory,
  type CkdStage,
  type IntervalSpec,
  type NextTest,
  type RiskLevel,
} from './types';

type StageBounds = Record<Exclude<CkdStage, 'C5'>, number>;
type AlbBounds = { a2From: number; a3Above: number };
type NextTestRow = { stages: CkdStage[] } & Record<AlbCategory, IntervalSpec>;

/**
 * Стадия по СКФ. Ожидает значение, округлённое до целого (правило stage.rounding).
 * Границы — нижние, включительно: С1 ≥ 90, С2 ≥ 60, …, С5 < 15.
 */
export function stageFromEgfr(egfr: number, rules: RuleBook): CkdStage {
  const b = rules.value<StageBounds>('stage.bounds');
  if (egfr >= b.C1) return 'C1';
  if (egfr >= b.C2) return 'C2';
  if (egfr >= b.C3a) return 'C3a';
  if (egfr >= b.C3b) return 'C3b';
  if (egfr >= b.C4) return 'C4';
  return 'C5';
}

/** Больший индекс — менее благоприятная стадия. */
export function stageIndex(stage: CkdStage): number {
  return STAGES_ORDER.indexOf(stage);
}

export function stageLabel(stage: CkdStage, rules: RuleBook): string {
  return rules.label('stage.bounds', stage);
}

/** Категория альбуминурии в тех единицах, в которых введено САК. */
export function albuminuriaCategory(acr: Acr, rules: RuleBook): AlbCategory {
  const b = rules.value<AlbBounds>(acr.unit === 'mg/g' ? 'albuminuria.mgG' : 'albuminuria.mgMmol');
  if (acr.value < b.a2From) return 'A1';
  if (acr.value <= b.a3Above) return 'A2';
  return 'A3';
}

export function riskLevel(stage: CkdStage, alb: AlbCategory, rules: RuleBook): RiskLevel {
  const m = rules.value<Record<CkdStage, Record<AlbCategory, RiskLevel>>>('risk.matrix');
  return m[stage][alb];
}

export function riskLabel(level: RiskLevel, rules: RuleBook): string {
  return rules.label('risk.matrix', level);
}

/** Срок следующего анализа. Без САК — по столбцу А1 с пометкой «без учёта альбуминурии». */
export function nextTest(
  stage: CkdStage,
  alb: AlbCategory | undefined,
  sampledAt: string,
  rules: RuleBook,
): NextTest {
  const rows = rules.value<NextTestRow[]>('monitoring.nextTest');
  const row = rows.find((r) => r.stages.includes(stage));
  if (!row) throw new Error(`monitoring.nextTest: нет строки для стадии ${stage}`);
  const column = alb ?? rules.value<AlbCategory>('monitoring.noAcr');
  const interval = row[column];
  const base = parseDate(sampledAt);
  if (!base) throw new Error(`Некорректная дата анализа: ${sampledAt}`);
  const add = (n: number) => (interval.unit === 'months' ? addMonths(base, n) : addWeeks(base, n));
  const result: NextTest = {
    interval,
    dueFrom: toIsoDate(add(interval.from)),
    dueTo: toIsoDate(add(interval.to)),
    withoutAlbuminuria: alb === undefined,
  };
  if (alb === undefined) result.note = rules.text('monitoring.noAcr');
  return result;
}
