// Подтверждения правил: где в официальном тексте источника стоит порог или формулировка.
// Номера страниц — по нумерации PDF-файла (ссылка вида url#page=N открывает нужную страницу).
// Сверено 29.09.2026: файлы скачаны по указанным адресам, текст найден на указанных страницах.

import type { RuleId } from '../core/ruleBook';
import type { SourceId } from '../core/types';

export interface SourceDocument {
  /** Официальный PDF источника. */
  url: string;
  /** Где опубликован. */
  publisher: string;
  /** Страниц в PDF — для проверки номеров страниц в тестах. */
  pages: number;
  /** Расхождение реквизитов с ТЗ и т. п. */
  note?: string;
}

export interface Citation {
  source: SourceId;
  /** Страница PDF-файла. */
  page: number;
  /** Что сказано на странице (пересказ; без доз препаратов). */
  text: string;
  /** Правила, которые подтверждает (или с которыми расходится) эта страница. */
  rules: RuleId[];
  /** Раздел страницы «О программе», если цитата относится к формуле, а не к правилу. */
  topic?: 'formula2009' | 'formula2021' | 'race';
  /** true — источник расходится с реализацией; расхождение описано в README. */
  differs?: boolean;
}

const NRCHD = 'https://nrchd.kz/storage/documents/%D0%9A%D0%BB%D0%B8%D0%BD%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B5%20%D0%BF%D1%80%D0%BE%D1%82%D0%BE%D0%BA%D0%BE%D0%BB%D1%8B/%D0%9F%D0%BE%D1%82%D0%BE%D0%BA%20%D0%BA%D0%BB%D0%B8%D0%BD%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B5%20%D0%BF%D1%80%D0%BE%D1%82%D0%BE%D0%BA%D0%BE%D0%BB%D1%8B/';
const KDIGO = 'https://kdigo.org/wp-content/uploads/';

export const SOURCE_DOCUMENTS: Record<SourceId, SourceDocument> = {
  И1: {
    url: `${NRCHD}%D0%A5%D0%A0%D0%9E%D0%9D%D0%98%D0%A7%D0%95%D0%A1%D0%9A%D0%90%D0%AF%20%D0%91%D0%9E%D0%9B%D0%95%D0%97%D0%9D%D0%AC%20%D0%9F%D0%9E%D0%A7%D0%95%D0%9A%20%D0%A3%20%D0%92%D0%97%D0%A0%D0%9E%D0%A1%D0%9B%D0%AB%D0%A5.pdf`,
    publisher: 'ННЦРЗ МЗ РК (nrchd.kz)',
    pages: 70,
  },
  И2: {
    url: `${NRCHD}%D0%9E%D1%81%D1%82%D1%80%D0%B0%D1%8F%20%D0%BF%D0%BE%D1%87%D0%B5%D1%87%D0%BD%D0%B0%D1%8F%20%D0%BD%D0%B5%D0%B4%D0%BE%D1%81%D1%82%D0%B0%D1%82%D0%BE%D1%87%D0%BD%D0%BE%D1%81%D1%82%D1%8C%20%28%D0%BE%D1%81%D1%82%D1%80%D0%BE%D0%B5%20%D0%BF%D0%BE%D1%87%D0%B5%D1%87%D0%BD%D0%BE%D0%B5%20%D0%BF%D0%BE%D0%B2%D1%80%D0%B5%D0%B6%D0%B4%D0%B5%D0%BD%D0%B8%D0%B5%29.pdf`,
    publisher: 'ННЦРЗ МЗ РК (nrchd.kz)',
    pages: 46,
    note: 'В ТЗ указан протокол 2019 года; действующая редакция — ОКК МЗ РК 24.06.2021, протокол №141.',
  },
  И3: {
    url: `${NRCHD}%D0%92%D0%9D%D0%95%D0%91%D0%9E%D0%9B%D0%AC%D0%9D%D0%98%D0%A7%D0%9D%D0%90%D0%AF%20%D0%9F%D0%9D%D0%95%D0%92%D0%9C%D0%9E%D0%9D%D0%98%D0%AF%20%D0%A3%20%D0%92%D0%97%D0%A0%D0%9E%D0%A1%D0%9B%D0%AB%D0%A5.pdf`,
    publisher: 'ННЦРЗ МЗ РК (nrchd.kz)',
    pages: 39,
  },
  И4: {
    url: `${NRCHD}%D0%A1%D0%B0%D1%85%D0%B0%D1%80%D0%BD%D1%8B%D0%B9%20%D0%B4%D0%B8%D0%B0%D0%B1%D0%B5%D1%82%202%20%D1%82%D0%B8%D0%BF%D0%B0.pdf`,
    publisher: 'ННЦРЗ МЗ РК (nrchd.kz)',
    pages: 25,
    note: 'В ТЗ указан протокол 2021 года; действующая редакция — ОКК МЗ РК 04.03.2022, протокол №158.',
  },
  И5: {
    url: `${KDIGO}2016/10/KDIGO-2012-AKI-Guideline-English.pdf`,
    publisher: 'KDIGO (kdigo.org)',
    pages: 141,
  },
  И6: {
    url: `${KDIGO}2022/10/KDIGO-2022-Clinical-Practice-Guideline-for-Diabetes-Management-in-CKD.pdf`,
    publisher: 'KDIGO (kdigo.org)',
    pages: 128,
  },
  И7: {
    url: `${KDIGO}2018/03/ADA-KDIGO-Consensus-Report-Diabetes-CKD-KI-2022.pdf`,
    publisher: 'KDIGO (kdigo.org), Kidney International 2022',
    pages: 16,
  },
  И8: {
    url: `${KDIGO}2024/03/KDIGO-2024-CKD-Guideline.pdf`,
    publisher: 'KDIGO (kdigo.org)',
    pages: 199,
  },
};

export const CITATIONS: Citation[] = [
  // ---------- И1: КП МЗ РК «ХБП у взрослых», протокол №195 ----------
  { source: 'И1', page: 3, text: 'Категория пациентов: взрослые.', rules: ['validation.age.minor'] },
  {
    source: 'И1', page: 4,
    text: 'ХБП — изменения, сохраняющиеся не менее 3 месяцев; маркеры повреждения почек, в первую очередь альбуминурия (САК ≥ 30 мг/г [≥ 3 мг/ммоль]).',
    rules: ['ckd.singleMeasurement', 'stage.earlyStageMarkers'],
  },
  {
    source: 'И1', page: 5,
    text: 'Формула CKD-EPI 2009: 141 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1,209 × 0,993^возраст × 1,018 для женщин; κ 0,7 / 0,9, α −0,329 / −0,411. Для расчёта нужны пол и возраст.',
    rules: ['validation.sex.required', 'stage.discrepancy'], topic: 'formula2009',
  },
  {
    source: 'И1', page: 5,
    text: 'Упрощённая таблица CKD-EPI 2009 с опечатками в строках для мужчин: 144 вместо 141, «СКр/0,0» и «СКр/0,7» вместо «СКр/0,9» (продолжается на с. 6). Не используется.',
    rules: [], topic: 'formula2009', differs: true,
  },
  {
    source: 'И1', page: 6,
    text: 'Стадии С1 > 90, С2 60–89, С3а 45–59, С3б 30–44, С4 15–29, С5 < 15 мл/мин/1,73 м² (значение ровно 90 в тексте не покрыто, отнесено к С1 по ТЗ).',
    rules: ['stage.bounds'],
  },
  {
    source: 'И1', page: 6,
    text: 'Категории альбуминурии: < 30, 30–300, > 300 мг/г; < 3, 3–30, > 30 мг/ммоль. Мониторинг ХБП — по альбуминурии и СКФ.',
    rules: ['albuminuria.mgG', 'albuminuria.mgMmol', 'dm.acrMissing'],
  },
  { source: 'И1', page: 6, text: 'Риск по сочетанию стадии СКФ и категории альбуминурии (18 клеток).', rules: ['risk.matrix'] },
  {
    source: 'И1', page: 9,
    text: 'Расчётная СКФ некорректна: нестандартные размеры тела, ИМТ < 15 и > 40 кг/м², беременность, миодистрофии, плегия, вегетарианская диета, быстрое снижение функции почек и ОПП, токсичные препараты, решение о ЗПТ, трансплантат — нужна проба Реберга–Тареева.',
    rules: ['common.unreliable', 'pneu.unstable'],
  },
  {
    source: 'И1', page: 18,
    text: 'иНГЛТ-2: показание — ХБП, СД 2 типа, СКФ ≥ 20 мл/мин/1,73 м²; временно прекратить при длительном голодании, хирургии и критических состояниях.',
    rules: ['dm.sglt2.start', 'dm.sglt2.belowStart', 'dm.sglt2.sickDays'],
  },
  {
    source: 'И1', page: 35,
    text: 'Частота обследований по стадии и категории альбуминурии («при необходимости чаще»).',
    rules: ['monitoring.nextTest', 'monitoring.noAcr'],
  },
  {
    source: 'И1', page: 35,
    text: 'Плановая госпитализация: впервые выявленное снижение СКФ ниже 30 или креатинин > 250 мкмоль/л (м) / > 200 мкмоль/л (ж).',
    rules: ['common.hospital.egfr', 'common.hospital.creatinine'],
  },
  {
    source: 'И1', page: 36,
    text: 'Экстренная госпитализация: увеличение креатинина вдвое менее чем за 2 месяца.',
    rules: ['common.hospital.doubling'],
  },

  // ---------- И2: КП МЗ РК «ОПН (ОПП)», протокол №141 ----------
  {
    source: 'И2', page: 5,
    text: 'Стадии ОПП (KDIGO 2012): креатинин в 1,5–1,9 раза выше исходного или повышение на 0,3 мг/дл (≥ 26,5 мкмоль/л).',
    rules: ['common.aki'],
  },
  { source: 'И2', page: 15, text: 'После ОПП — наблюдение, в первые 3 месяца не реже раза в неделю, с расчётом СКФ.', rules: ['common.aki'] },

  // ---------- И3: КП МЗ РК «Внебольничная пневмония у взрослых», протокол №169 ----------
  { source: 'И3', page: 5, text: 'Критерии тяжёлого течения ВП, в том числе мочевина > 7,0 ммоль/л.', rules: ['pneu.urea'] },
  {
    source: 'И3', page: 19,
    text: 'Стационарное лечение может быть рассмотрено, в том числе при креатинине крови > 176,0 мкмоль/л.',
    rules: ['pneu.creatinine'],
  },

  // ---------- И4: КП МЗ РК «Сахарный диабет 2 типа», протокол №158 ----------
  {
    source: 'И4', page: 10,
    text: 'Метформин противопоказан при сниженной СКФ ≤ 30 мл/мин (единица без «/1,73 м²»). Отмена до и после рентгеноконтрастных процедур (с. 11) в ТЗ не входит и не проверяется.',
    rules: ['dm.metformin.stop', 'dm.metformin.reduce'],
  },
  {
    source: 'И4', page: 12,
    text: 'иНГЛТ-2: прекратить эмпаглифлозин и дапаглифлозин при устойчивой рСКФ < 45, канаглифлозин — < 30 мл/мин/1,73 м². Более поздний [И1] (2023) допускает начало при СКФ ≥ 20.',
    rules: ['dm.sglt2.start'], differs: true,
  },
  {
    source: 'И4', page: 19,
    text: 'Метформин противопоказан при тяжёлой почечной или печёночной недостаточности из-за риска лактатацидоза и ОПП.',
    rules: ['dm.metformin.aki'],
  },

  // ---------- И5: KDIGO 2012 AKI ----------
  {
    source: 'И5', page: 11,
    text: 'Recommendation 2.1.1: ОПП — прирост креатинина ≥ 0,3 мг/дл (≥ 26,5 мкмоль/л) за 48 ч или ≥ 1,5 раза от исходного за предшествующие 7 дней.',
    rules: ['common.aki', 'pneu.aki.noHistory'],
  },
  { source: 'И5', page: 11, text: 'Recommendation 2.3.4: оценить пациента через 3 месяца после ОПП.', rules: ['common.aki'] },

  // ---------- И6: KDIGO 2022 Diabetes in CKD ----------
  {
    source: 'И6', page: 22,
    text: 'Recommendation 1.3.1: иНГЛТ-2 при СД 2 типа, ХБП и eGFR ≥ 20. Practice Point 1.3.3: иНГЛТ-2 можно временно отменить при длительном голодании, операциях, критических состояниях.',
    rules: ['dm.sglt2.start', 'dm.sglt2.belowStart', 'dm.sglt2.sickDays'],
  },
  {
    source: 'И6', page: 27,
    text: 'Recommendation 4.1.1: метформин при eGFR ≥ 30. Practice Point 4.1.3: коррекция дозы при eGFR < 45 и у части пациентов при 45–59; рис. 27 — подход по уровню eGFR (≥ 60 — без изменения дозы).',
    rules: ['dm.metformin.noLimit', 'dm.metformin.consider', 'dm.metformin.reduce', 'dm.metformin.stop'],
  },

  // ---------- И7: ADA–KDIGO Consensus 2022 ----------
  {
    source: 'И7', page: 2,
    text: 'Консенсус: метформин при eGFR ≥ 30; доза снижается при eGFR 30–44 и у части пациентов 45–59 с высоким риском лактатацидоза.',
    rules: ['dm.metformin.noLimit', 'dm.metformin.consider', 'dm.metformin.reduce', 'dm.metformin.stop'],
  },
  {
    source: 'И7', page: 8,
    text: 'Большинство случаев лактатацидоза на метформине связано с острым заболеванием и ОПП; протоколы «дней болезни» с временной отменой.',
    rules: ['dm.metformin.aki'],
  },

  // ---------- И8: KDIGO 2024 CKD ----------
  {
    source: 'И8', page: 11,
    text: 'Категории СКФ: G1 ≥ 90 мл/мин/1,73 м² — значение 90 относится к G1 (в [И1] — «> 90»).',
    rules: ['stage.bounds'],
  },
  {
    source: 'И8', page: 39,
    text: 'Recommendation 1.2.4.1: валидированное уравнение для eGFR; Practice Point 1.2.4.1: одно уравнение в пределах региона; Practice Point 1.2.4.2: не использовать расу при расчёте eGFR.',
    rules: ['stage.discrepancy'], topic: 'race',
  },
  {
    source: 'И8', page: 49,
    text: 'Practice Points 4.2.1–4.2.3: учитывать СКФ при дозировании препаратов, выводимых почками; для большинства ситуаций подходит eGFR по креатинину, при узком терапевтическом окне — более точная оценка. О Кокрофте–Голте как о предпочтительном методе не сказано.',
    rules: ['pneu.crclDosing', 'pyelo.doseReminder'], differs: true,
  },
  {
    source: 'И8', page: 50,
    text: 'Practice Point 4.2.5: учитывать и адаптировать дозирование, когда СКФ или объём распределения не находятся в стабильном состоянии.',
    rules: ['pneu.unstable'],
  },
  {
    source: 'И8', page: 73,
    text: 'CKD-EPI 2021 по креатинину пересчитана без расового коэффициента.',
    rules: [], topic: 'formula2021',
  },
];

export const pageUrl = (c: Pick<Citation, 'source' | 'page'>) => `${SOURCE_DOCUMENTS[c.source].url}#page=${c.page}`;

export const citationsFor = (id: string) => CITATIONS.filter((c) => (c.rules as string[]).includes(id));
