import { describe, expect, it } from 'vitest';
import raw from '../src/config/rules.json';
import { RULE_IDS, RuleBook, validateRulesConfig } from '../src/core/ruleBook';
import { SOURCE_IDS } from '../src/core/types';

const config = validateRulesConfig(raw);

describe('rules.json', () => {
  it('каждое правило из кода есть в конфиге и наоборот', () => {
    const inJson = config.rules.map((r) => r.id).sort();
    expect(inJson).toEqual([...RULE_IDS].sort());
  });

  it('у каждого правила есть обязательные поля; источники только И1–И8', () => {
    for (const r of config.rules) {
      expect(r.id).toBeTruthy();
      expect('value' in r).toBe(true);
      expect(r.unit === null || typeof r.unit === 'string').toBe(true);
      expect(r.message.length).toBeGreaterThan(0);
      expect(r.source.length).toBeGreaterThan(0);
      for (const s of r.source) expect(SOURCE_IDS).toContain(s);
      expect(['проверено', 'требует сверки']).toContain(r.status);
    }
  });

  it('все допущения имеют status «требует сверки»', () => {
    for (const r of config.rules.filter((x) => x.note?.includes('Допущение'))) {
      expect(r.status, r.id).toBe('требует сверки');
    }
  });

  it('метформин: граница 30 расходится с [И4] и остаётся «требует сверки»; раздел антибиотиков пуст и «требует сверки»', () => {
    const status = (id: string) => config.rules.find((r) => r.id === id)?.status;
    expect(status('dm.metformin.reduce')).toBe('требует сверки');
    expect(status('dm.metformin.stop')).toBe('требует сверки');
    for (const r of config.rules.filter((x) => x.id.startsWith('dm.metformin.'))) expect(r.note, r.id).toContain('[И4]');
    const ab = config.rules.find((r) => r.id === 'pneu.antibiotics');
    expect(ab?.value).toEqual([]);
    expect(ab?.status).toBe('требует сверки');
  });

  it('граница С1 (= 90) помечена «требует сверки»', () => {
    expect(config.rules.find((r) => r.id === 'stage.bounds')?.status).toBe('требует сверки');
  });

  it('тексты не содержат доз, категоричных назначений и заявлений о валидации', () => {
    const forbidden = [/валидирован/i, /сертифицирован/i, /клинически проверен/i, /назначить/i, /отменить немедленно/i];
    const dose = /\d\s*(мг|г|мкг|ЕД)(\b|\s|$)(?!\/)/i;
    for (const r of config.rules) {
      const texts = [r.message, ...Object.values(r.labels ?? {})];
      for (const t of texts) {
        for (const f of forbidden) expect(t, r.id).not.toMatch(f);
        expect(t, r.id).not.toMatch(dose);
      }
    }
  });

  it('нет расовых категорий', () => {
    const text = JSON.stringify(raw).toLowerCase();
    for (const w of ['раса', 'расов', 'race', 'этнич', '1.159']) expect(text).not.toContain(w);
  });
});

describe('проверка структуры конфига', () => {
  const good = structuredClone(raw) as { rules: Record<string, unknown>[] };

  it('отклоняет источник вне И1–И8', () => {
    const bad = structuredClone(good);
    bad.rules[0]!.source = ['И9'];
    expect(() => validateRulesConfig(bad)).toThrow(/И9/);
  });

  it('отклоняет недопустимый status и повтор id', () => {
    const bad = structuredClone(good);
    bad.rules[0]!.status = 'ok';
    bad.rules[1]!.id = bad.rules[0]!.id;
    expect(() => validateRulesConfig(bad)).toThrow(/status[\s\S]*повтор id/);
  });

  it('RuleBook требует все правила, на которые ссылается код', () => {
    const bad = structuredClone(good);
    bad.rules = bad.rules.filter((r) => r.id !== 'common.aki');
    expect(() => new RuleBook(validateRulesConfig(bad))).toThrow(/common\.aki/);
  });
});
