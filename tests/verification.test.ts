import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { runSelfCheck } from '../src/core/verification';
import { rulesConfig } from '../src/config/rules';
import { RuleBook } from '../src/core/ruleBook';
import { rules } from './helpers';

describe('самопроверка для страницы «О программе»', () => {
  const results = runSelfCheck(rules);

  it('все проверки проходят', () => {
    const failed = results.filter((r) => !r.pass).map((r) => `${r.title}: ожидалось ${r.expected}, получено ${r.actual}`);
    expect(failed).toEqual([]);
  });

  it('охватывает эталоны, свойства формул, границы и сценарии', () => {
    expect(new Set(results.map((r) => r.group)).size).toBe(4);
    expect(results.length).toBeGreaterThanOrEqual(50);
  });

  it('самопроверка ловит ошибки: с искажёнными правилами проверки падают', () => {
    // Защита от «проверки, которая всегда зелёная».
    const tampered = new RuleBook({
      ...rulesConfig,
      rules: rulesConfig.rules.map((r) =>
        r.id === 'stage.bounds' ? { ...r, value: { C1: 91, C2: 60, C3a: 45, C3b: 30, C4: 15 } }
        : r.id === 'common.aki' ? { ...r, value: { deltaUmolL: 35, windowHours: 48, factor: 1.5, windowDays: 7 } }
        : r,
      ),
    });
    const failed = runSelfCheck(tampered).filter((r) => !r.pass).map((r) => r.title);
    expect(failed).toContain('СКФ 90');
    expect(failed).toContain('ОПП: 80 → 110 мкмоль/л через 36 ч');
  });
});

describe('текст страницы «О программе»', () => {
  const src = readFileSync(new URL('../src/ui/AboutView.vue', import.meta.url), 'utf8');

  it('нет заявлений о валидации, сертификации и клинической проверке', () => {
    for (const f of [/валидирован/i, /сертифицирован/i, /клинически проверен/i]) expect(src).not.toMatch(f);
  });

  it('единственная внешняя ссылка интерфейса — репозиторий GitHub', () => {
    const dir = new URL('../src/ui/', import.meta.url);
    const urls = readdirSync(dir).flatMap((f) => readFileSync(new URL(f, dir), 'utf8').match(/https?:\/\/[^\s"'`<)]+/g) ?? []);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toBe('https://github.com/argokz/NephroControl');
  });
});
