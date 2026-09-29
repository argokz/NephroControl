// Подписи и форматирование для интерфейса. Клинические тексты — в rules.json.

import { rules } from '../config/rules';
import { riskLabel, stageLabel } from '../core/classification';
import type {
  AlbCategory,
  CkdStage,
  Group,
  IntervalSpec,
  RiskLevel,
  Severity,
  SpecialCondition,
  WeightBasis,
} from '../core/types';
import { SPECIAL_CONDITIONS } from '../core/types';

export const GROUP_LABELS: Record<Group, string> = {
  pyelonephritis: 'Хронический пиелонефрит',
  diabetes: 'Сахарный диабет',
  pneumonia: 'Пневмония',
};

export const GROUPS: Group[] = ['pyelonephritis', 'diabetes', 'pneumonia'];

export const SEVERITY_LABELS: Record<Severity, string> = {
  emergency: 'Экстренно',
  important: 'Важно',
  info: 'Информация',
};

export const SPECIAL_CONDITION_OPTIONS: { id: SpecialCondition; label: string }[] = SPECIAL_CONDITIONS.map((id) => {
  const l = rules.label('common.unreliable', id);
  return { id, label: l.charAt(0).toUpperCase() + l.slice(1) };
});

export const stage = (s: CkdStage) => stageLabel(s, rules);
export const risk = (r: RiskLevel) => riskLabel(r, rules);
export const alb = (a: AlbCategory) => a.replace('A', 'А');
export const weightBasis = (b: WeightBasis) => rules.label('crcl.adjustedWeight', b);

const nf = (digits: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
export const num = (x: number, digits = 0) => nf(digits).format(x);
export const signed = (x: number, digits = 0) => (x > 0 ? '+' : x < 0 ? '−' : '±') + num(Math.abs(x), digits);

export function date(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00` : iso);
  return d.toLocaleDateString('ru-RU');
}

export function dateTime(iso: string): string {
  const d = new Date(iso);
  const t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return t === '00:00' ? d.toLocaleDateString('ru-RU') : `${d.toLocaleDateString('ru-RU')} ${t}`;
}

export function interval(i: IntervalSpec): string {
  const unit = i.unit === 'months' ? 'мес' : 'нед';
  return i.from === i.to ? `${i.from} ${unit}` : `${i.from}–${i.to} ${unit}`;
}

/** Текущие дата и время в формате поля datetime-local. */
export function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Число из текстового поля: допускает запятую; пусто → undefined. */
export function parseNum(s: string): number | undefined {
  const t = s.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function sourcesText(ids: string[]): string {
  return ids.map((s) => `[${s}]`).join(', ');
}

export function sourceTitle(id: string): string {
  return rules.config.sources[id as keyof typeof rules.config.sources] ?? id;
}
