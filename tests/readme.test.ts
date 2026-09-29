import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import raw from '../src/config/rules.json';
import { validateRulesConfig } from '../src/core/ruleBook';

const config = validateRulesConfig(raw);
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

/** Строки таблицы между <!-- name:begin --> и <!-- name:end -->: [id, ...ячейки]. */
function tableRows(name: string): string[][] {
  const m = readme.match(new RegExp(`<!-- ${name}:begin -->([\\s\\S]*?)<!-- ${name}:end -->`));
  expect(m, `нет блока ${name} в README`).toBeTruthy();
  return m![1]!
    .split('\n')
    .filter((l) => l.startsWith('| `'))
    .map((l) => l.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim()));
}

const id = (cell: string) => cell.replace(/`/g, '');
const sources = (ids: string[]) => ids.map((s) => `[${s}]`).join(', ');

describe('README соответствует rules.json', () => {
  it('таблица правил: те же id, источники и статусы', () => {
    const rows = tableRows('rules');
    expect(rows.map((r) => id(r[0]!))).toEqual(config.rules.map((r) => r.id));
    for (const [i, r] of config.rules.entries()) {
      const row = rows[i]!;
      expect(row[3], r.id).toBe(sources(r.source));
      expect(row[4], r.id).toBe(r.status);
    }
  });

  it('список «требует сверки» полный', () => {
    const rows = tableRows('review');
    const expected = config.rules.filter((r) => r.status === 'требует сверки');
    expect(rows.map((r) => id(r[0]!))).toEqual(expected.map((r) => r.id));
    for (const [i, r] of expected.entries()) expect(rows[i]![1], r.id).toBe(sources(r.source));
  });

  it('версия и количество правил в тексте актуальны', () => {
    const review = config.rules.filter((r) => r.status === 'требует сверки').length;
    const assumptions = config.rules.filter((r) => r.note?.includes('Допущение:')).length;
    expect(readme).toContain(`rules.json\` версии ${config.version}`);
    expect(readme).toContain(`Всего ${review} из ${config.rules.length}; из них ${assumptions} — допущения`);
  });

  it('нет заявлений о валидации и сертификации', () => {
    for (const f of [/валидирован/i, /сертифицирован/i, /клинически проверен/i]) expect(readme).not.toMatch(f);
  });
});
