// Работа с датами анализа. sampledAt — ISO 8601; строка без часового пояса
// трактуется как местное время (так её вводит врач).

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export function parseDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toTime(iso: string): number {
  return new Date(iso).getTime();
}

/** Календарные месяцы; при переполнении дня — последний день месяца (31.01 + 1 мес = 28/29.02). */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + months);
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, lastDay));
  return r;
}

export function addWeeks(d: Date, weeks: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + weeks * 7);
  return r;
}

/** YYYY-MM-DD по местному времени. */
export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
