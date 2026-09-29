// Типы предметной области. Модуль не зависит от UI и хранилища.

export type Sex = 'male' | 'female';
export type Group = 'pyelonephritis' | 'diabetes' | 'pneumonia';
export type CreatinineUnit = 'umol/L' | 'mg/dL';
export type AcrUnit = 'mg/g' | 'mg/mmol';
export type SpecialCondition =
  | 'pregnancy'
  | 'amputation'
  | 'bodybuilding'
  | 'myodystrophy'
  | 'plegia'
  | 'vegetarian'
  | 'kidneyTransplant'
  | 'nephrotoxicDrugs'
  | 'rrtDecision';

export const SPECIAL_CONDITIONS: readonly SpecialCondition[] = [
  'pregnancy',
  'amputation',
  'bodybuilding',
  'myodystrophy',
  'plegia',
  'vegetarian',
  'kidneyTransplant',
  'nephrotoxicDrugs',
  'rrtDecision',
];

export interface Creatinine {
  value: number;
  unit: CreatinineUnit;
}

export interface Acr {
  value: number;
  unit: AcrUnit;
}

/** Проверенный ввод одного анализа. */
export interface MeasurementInput {
  creatinine: Creatinine;
  ageYears: number;
  weightKg: number;
  sex: Sex;
  /** Мультивыбор: у пациента может быть несколько групп (например, СД + пневмония). */
  groups: Group[];
  /** ISO 8601, дата и время взятия анализа (время нужно для правила ОПП «48 ч»). */
  sampledAt: string;
  heightCm?: number;
  acr?: Acr;
  ureaMmolL?: number;
  specialConditions: SpecialCondition[];
}

/** Черновик из формы: любое поле может отсутствовать или быть NaN. */
export type MeasurementDraft = Partial<MeasurementInput>;

// ---------- rules.json ----------

export type SourceId = 'И1' | 'И2' | 'И3' | 'И4' | 'И5' | 'И6' | 'И7' | 'И8';
export const SOURCE_IDS: readonly SourceId[] = ['И1', 'И2', 'И3', 'И4', 'И5', 'И6', 'И7', 'И8'];
export type RuleStatus = 'проверено' | 'требует сверки';
export type Severity = 'emergency' | 'important' | 'info';

export interface Rule<V = unknown> {
  id: string;
  value: V;
  unit: string | null;
  /** Текст для интерфейса; плейсхолдеры вида {name}. */
  message: string;
  source: SourceId[];
  status: RuleStatus;
  /** Важность для правил, которые формируют предупреждение. */
  severity?: Severity;
  /** Подписи/уточнения к правилу (например, причины недостоверности формулы). */
  labels?: Record<string, string>;
  /** Пояснение: «Допущение: …», расхождения и опечатки в источнике. */
  note?: string;
}

export interface RulesConfig {
  version: string;
  updated: string;
  sources: Record<SourceId, string>;
  rules: Rule[];
}

// ---------- результаты ----------

export type CkdStage = 'C1' | 'C2' | 'C3a' | 'C3b' | 'C4' | 'C5';
export const STAGES_ORDER: readonly CkdStage[] = ['C1', 'C2', 'C3a', 'C3b', 'C4', 'C5'];
export type AlbCategory = 'A1' | 'A2' | 'A3';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'veryHigh';
export type FormulaId = 'CKD-EPI 2009' | 'CKD-EPI 2021' | 'Cockcroft-Gault';

export interface ValidationIssue {
  field: string;
  ruleId: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; input: MeasurementInput; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[]; warnings: ValidationIssue[] };

export interface EgfrResult {
  formula: 'CKD-EPI 2009' | 'CKD-EPI 2021';
  /** Неокруглённое значение. */
  value: number;
  /** Округлённое до целого — по нему определяются стадия и пороги. */
  rounded: number;
  unit: 'мл/мин/1,73 м²';
}

export type WeightBasis = 'actual' | 'adjusted';

export interface CrClResult {
  formula: 'Cockcroft-Gault';
  value: number;
  rounded: number;
  unit: 'мл/мин';
  weightKg: number;
  weightBasis: WeightBasis;
  idealWeightKg?: number;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  source: SourceId[];
  status: RuleStatus;
  /** Уточнения (например, какие условия сработали). */
  details?: string[];
}

export interface IntervalSpec {
  from: number;
  to: number;
  unit: 'months' | 'weeks';
}

export interface NextTest {
  interval: IntervalSpec;
  /** ISO-даты (YYYY-MM-DD). При диапазоне «3–6 мес» dueFrom ≠ dueTo. */
  dueFrom: string;
  dueTo: string;
  withoutAlbuminuria: boolean;
  /** Текст пометки «без учёта альбуминурии» из rules.json (если применимо). */
  note?: string;
}

export interface Assessment {
  input: MeasurementInput;
  creatinineUmolL: number;
  scrMgDl: number;
  bmi?: number;
  egfr2009: EgfrResult;
  stage: CkdStage;
  egfr2021: EgfrResult;
  stage2021: CkdStage;
  /** Основной CrCl (по скорректированной массе при ИМТ ≥ порога, иначе по фактической). */
  crcl: CrClResult;
  /** Все рассчитанные варианты CrCl (фактическая масса [+ скорректированная]). */
  crclVariants: CrClResult[];
  albuminuria?: AlbCategory;
  risk?: RiskLevel;
  nextTest: NextTest;
  findings: Finding[];
  rulesVersion: string;
}

export type AssessResult =
  | { ok: true; assessment: Assessment; warnings: ValidationIssue[] }
  | { ok: false; errors: ValidationIssue[]; warnings: ValidationIssue[] };

// ---------- история ----------

export interface Patient {
  id: string;
  /** Псевдоним или номер карты — без ФИО. */
  label: string;
  sex: Sex;
  groups: Group[];
  createdAt: string;
}

export interface HistoryRecord {
  id: string;
  patientId: string;
  sampledAt: string;
  creatinine: Creatinine;
  creatinineMgDl: number;
  egfr2009: number;
  egfr2021: number;
  crcl: number;
  crclWeightKg: number;
  crclWeightBasis: WeightBasis;
  stage: CkdStage;
  albuminuria?: AlbCategory;
  firedRuleIds: string[];
  rulesVersion: string;
  /** Снимок ввода — для воспроизводимости расчёта. */
  input: MeasurementInput;
  createdAt: string;
}
