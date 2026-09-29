import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CITATIONS, SOURCE_DOCUMENTS, citationsFor, pageUrl } from '../src/config/evidence';
import { rulesConfig } from '../src/config/rules';
import { SOURCE_IDS } from '../src/core/types';

const byId = new Map(rulesConfig.rules.map((r) => [r.id, r]));

describe('подтверждения правил страницами источников', () => {
  it('у каждого источника И1–И8 есть официальный PDF (ННЦРЗ МЗ РК или KDIGO)', () => {
    for (const id of SOURCE_IDS) {
      const doc = SOURCE_DOCUMENTS[id];
      expect(doc.url, id).toMatch(/^https:\/\/(nrchd\.kz\/storage\/documents\/|kdigo\.org\/wp-content\/uploads\/).+\.pdf$/);
    }
  });

  it('каждый источник подкреплён хотя бы одной страницей', () => {
    for (const id of SOURCE_IDS) expect(CITATIONS.some((c) => c.source === id), id).toBe(true);
  });

  it('номера страниц существуют в PDF', () => {
    for (const c of CITATIONS) {
      expect(c.page, `${c.source} с. ${c.page}`).toBeGreaterThanOrEqual(1);
      expect(c.page, `${c.source} с. ${c.page}`).toBeLessThanOrEqual(SOURCE_DOCUMENTS[c.source].pages);
      expect(pageUrl(c)).toBe(`${SOURCE_DOCUMENTS[c.source].url}#page=${c.page}`);
    }
  });

  it('подтверждающая страница относится к источнику, указанному у правила', () => {
    for (const c of CITATIONS.filter((x) => !x.differs)) {
      for (const id of c.rules) expect(byId.get(id)?.source, `${id} ← ${c.source} с. ${c.page}`).toContain(c.source);
    }
  });

  it('каждое правило со статусом «проверено» подтверждено страницей хотя бы одного своего источника', () => {
    const missing = rulesConfig.rules
      .filter((r) => r.status === 'проверено')
      .filter((r) => !citationsFor(r.id).some((c) => !c.differs && r.source.includes(c.source)))
      .map((r) => r.id);
    // Обязательная дата анализа — техническое требование (окна ОПП и удвоения), отдельной страницы у него нет.
    expect(missing).toEqual(['validation.sampledAt.required']);
  });

  it('ссылки на страницы в тексте «О программе» есть в реестре подтверждений', () => {
    const about = readFileSync(new URL('../src/ui/AboutView.vue', import.meta.url), 'utf8');
    const refs = [...about.matchAll(/source: '(И\d)', page: (\d+)/g)].map((m) => ({ source: m[1], page: Number(m[2]) }));
    expect(refs.length).toBeGreaterThan(10);
    for (const r of refs) expect(CITATIONS.some((c) => c.source === r.source && c.page === r.page), `${r.source} с. ${r.page}`).toBe(true);
  });

  it('в пересказах нет доз препаратов', () => {
    for (const c of CITATIONS) expect(c.text, `${c.source} с. ${c.page}`).not.toMatch(/\d\s*(мг|mg)(?!\/)/i);
  });
});
