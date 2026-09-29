// Динамика СКФ (ТЗ, раздел 9). Сравнение ведётся по округлённой eGFR CKD-EPI 2009.
//  - «значимое ухудшение»: снижение ≥ 25% от исходного (первого) значения со сменой стадии на менее благоприятную;
//  - «улучшение»: переход в более благоприятную стадию относительно исходной (допущение, см. rules.json).

import { stageFromEgfr, stageIndex, stageLabel } from './classification';
import type { RuleBook } from './ruleBook';
import type { RuleContext } from './rules/context';
import { roundInt } from './units';
import type { CkdStage, Finding, HistoryRecord } from './types';

export type Trend = 'worsening' | 'improvement';

export interface Delta {
  /** мл/мин/1,73 м² */
  abs: number;
  /** % от значения сравнения */
  percent: number;
}

export interface DynamicsPoint {
  recordId: string;
  sampledAt: string;
  egfr: number;
  stage: CkdStage;
  toPrevious?: Delta;
  toFirst?: Delta;
  trend?: Trend;
}

interface Point {
  egfr: number;
  stage: CkdStage;
}

export function delta(from: number, to: number): Delta {
  return { abs: to - from, percent: from === 0 ? 0 : ((to - from) / from) * 100 };
}

export function classifyTrend(first: Point, current: Point, rules: RuleBook): Trend | undefined {
  const { declinePercent } = rules.value<{ declinePercent: number }>('dynamics.worsening');
  const worseStage = stageIndex(current.stage) > stageIndex(first.stage);
  const decline = -delta(first.egfr, current.egfr).percent;
  if (worseStage && decline >= declinePercent) return 'worsening';
  if (stageIndex(current.stage) < stageIndex(first.stage)) return 'improvement';
  return undefined;
}

/** Предупреждения по динамике для текущего расчёта относительно первой записи в истории. */
export function dynamicsFindings(ctx: RuleContext): Finding[] {
  const first = ctx.prior[0];
  if (!first) return [];
  const { rules } = ctx;
  const current = { egfr: ctx.egfr, stage: ctx.stage };
  const trend = classifyTrend(first, current, rules);
  const params = { stageFrom: stageLabel(first.stage, rules), stageTo: stageLabel(ctx.stage, rules) };
  if (trend === 'worsening') {
    const percent = Math.round(-delta(first.egfr, current.egfr).percent);
    return [rules.finding('dynamics.worsening', { ...params, percent })];
  }
  if (trend === 'improvement') return [rules.finding('dynamics.improvement', params)];
  return [];
}

/** Ряд для экрана динамики и графика. Записи сортируются по дате анализа. */
export function computeDynamics(records: HistoryRecord[], rules: RuleBook): DynamicsPoint[] {
  const sorted = [...records].sort((a, b) => new Date(a.sampledAt).getTime() - new Date(b.sampledAt).getTime());
  const points: DynamicsPoint[] = [];
  let first: Point | undefined;
  let previous: Point | undefined;
  for (const r of sorted) {
    const egfr = roundInt(r.egfr2009);
    const cur: Point = { egfr, stage: stageFromEgfr(egfr, rules) };
    const p: DynamicsPoint = { recordId: r.id, sampledAt: r.sampledAt, egfr, stage: cur.stage };
    if (previous) p.toPrevious = delta(previous.egfr, egfr);
    if (first) {
      p.toFirst = delta(first.egfr, egfr);
      const trend = classifyTrend(first, cur, rules);
      if (trend) p.trend = trend;
    }
    first ??= cur;
    previous = cur;
    points.push(p);
  }
  return points;
}
