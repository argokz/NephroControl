// Доступ к rules.json: проверка структуры, получение порогов и текстов.
// Все клинические пороги и тексты предупреждений берутся отсюда, а не из кода.

import {
  SOURCE_IDS,
  type Finding,
  type Rule,
  type RulesConfig,
  type Severity,
  type SourceId,
} from './types';

/** Идентификаторы правил, на которые ссылается код. Должны совпадать с rules.json. */
export const RULE_IDS = [
  'validation.creatinine.required',
  'validation.creatinine.unitCheck',
  'validation.age.range',
  'validation.age.minor',
  'validation.weight.range',
  'validation.sex.required',
  'validation.groups.required',
  'validation.sampledAt.required',
  'validation.sampledAt.future',
  'validation.height.positive',
  'validation.acr.positive',
  'validation.urea.positive',
  'crcl.adjustedWeight',
  'stage.bounds',
  'stage.rounding',
  'stage.discrepancy',
  'stage.earlyStageMarkers',
  'ckd.singleMeasurement',
  'albuminuria.mgG',
  'albuminuria.mgMmol',
  'risk.matrix',
  'risk.noAcr',
  'monitoring.nextTest',
  'monitoring.noAcr',
  'common.bmiUnknown',
  'common.unreliable',
  'common.hospital.egfr',
  'common.hospital.creatinine',
  'common.hospital.doubling',
  'common.aki',
  'pyelo.egfrDecrease',
  'pyelo.doseReminder',
  'dm.obesityCrcl',
  'dm.acrMissing',
  'dm.metformin.noLimit',
  'dm.metformin.consider',
  'dm.metformin.reduce',
  'dm.metformin.stop',
  'dm.metformin.aki',
  'dm.sglt2.start',
  'dm.sglt2.belowStart',
  'dm.sglt2.sickDays',
  'pneu.unstable',
  'pneu.aki.noHistory',
  'pneu.urea',
  'pneu.creatinine',
  'pneu.crclDosing',
  'pneu.antibiotics',
  'dynamics.worsening',
  'dynamics.improvement',
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export type MessageParams = Record<string, string | number>;

const STATUSES = new Set(['проверено', 'требует сверки']);
const SEVERITIES = new Set<Severity>(['emergency', 'important', 'info']);

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, useGrouping: false });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** Подставляет {name} из params; числа форматируются с десятичной запятой. */
export function formatMessage(template: string, params: MessageParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = params[key];
    if (v === undefined) return match;
    return typeof v === 'number' ? formatNumber(v) : v;
  });
}

/** Проверяет структуру rules.json. Бросает ошибку со списком проблем. */
export function validateRulesConfig(raw: unknown): RulesConfig {
  const problems: string[] = [];
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

  if (!isObj(raw)) throw new Error('rules.json: ожидается объект');
  if (typeof raw.version !== 'string' || raw.version === '') problems.push('нет поля version');
  if (typeof raw.updated !== 'string') problems.push('нет поля updated');
  if (!isObj(raw.sources)) problems.push('нет поля sources');
  else for (const s of SOURCE_IDS) if (typeof raw.sources[s] !== 'string') problems.push(`sources: нет ${s}`);
  if (!Array.isArray(raw.rules)) problems.push('нет массива rules');

  const seen = new Set<string>();
  for (const [i, r] of (Array.isArray(raw.rules) ? raw.rules : []).entries()) {
    const where = `rules[${i}]`;
    if (!isObj(r)) {
      problems.push(`${where}: не объект`);
      continue;
    }
    const id = typeof r.id === 'string' ? r.id : '';
    if (!id) problems.push(`${where}: нет id`);
    else if (seen.has(id)) problems.push(`${where}: повтор id ${id}`);
    seen.add(id);
    if (!('value' in r)) problems.push(`${id || where}: нет value`);
    if (!(r.unit === null || typeof r.unit === 'string')) problems.push(`${id}: unit — строка или null`);
    if (typeof r.message !== 'string' || r.message === '') problems.push(`${id}: нет message`);
    if (!Array.isArray(r.source) || r.source.length === 0) problems.push(`${id}: нет source`);
    else
      for (const s of r.source)
        if (!SOURCE_IDS.includes(s as SourceId)) problems.push(`${id}: источник ${String(s)} вне И1–И8`);
    if (typeof r.status !== 'string' || !STATUSES.has(r.status)) problems.push(`${id}: недопустимый status`);
    if (r.severity !== undefined && !SEVERITIES.has(r.severity as Severity))
      problems.push(`${id}: недопустимый severity`);
  }

  if (problems.length) throw new Error(`rules.json некорректен:\n- ${problems.join('\n- ')}`);
  return raw as unknown as RulesConfig;
}

export class RuleBook {
  private readonly byId = new Map<string, Rule>();

  constructor(readonly config: RulesConfig) {
    for (const r of config.rules) this.byId.set(r.id, r);
    const missing = RULE_IDS.filter((id) => !this.byId.has(id));
    if (missing.length) throw new Error(`rules.json: нет правил ${missing.join(', ')}`);
  }

  get version(): string {
    return this.config.version;
  }

  rule<V = unknown>(id: RuleId): Rule<V> {
    return this.byId.get(id) as Rule<V>;
  }

  value<V>(id: RuleId): V {
    return this.rule<V>(id).value;
  }

  text(id: RuleId, params?: MessageParams): string {
    return formatMessage(this.rule(id).message, params);
  }

  label(id: RuleId, key: string, params?: MessageParams): string {
    const l = this.rule(id).labels?.[key];
    return l === undefined ? key : formatMessage(l, params);
  }

  finding(id: RuleId, params?: MessageParams, details?: string[]): Finding {
    const r = this.rule(id);
    if (!r.severity) throw new Error(`Правило ${id} не имеет severity и не может быть предупреждением`);
    const f: Finding = {
      ruleId: r.id,
      severity: r.severity,
      message: formatMessage(r.message, params),
      source: r.source,
      status: r.status,
    };
    if (details?.length) f.details = details;
    return f;
  }
}
