// Контекст, по которому вычисляются правила.

import type { RuleBook } from '../ruleBook';
import type { AlbCategory, CkdStage, CrClResult, Finding, MeasurementInput } from '../types';

/** Предыдущий анализ пациента (строго раньше текущего по sampledAt). */
export interface PriorPoint {
  sampledAt: string;
  time: number;
  creatinineUmolL: number;
  /** eGFR CKD-EPI 2009, округлённая до целого. */
  egfr: number;
  stage: CkdStage;
}

export interface RuleContext {
  input: MeasurementInput;
  time: number;
  creatinineUmolL: number;
  /** eGFR CKD-EPI 2009, округлённая до целого (правило stage.rounding). */
  egfr: number;
  stage: CkdStage;
  stage2021: CkdStage;
  crcl: CrClResult;
  crclVariants: CrClResult[];
  /** ИМТ, округлённый до 0,1; undefined — рост не указан. */
  bmi?: number;
  albuminuria?: AlbCategory;
  /** По возрастанию даты. */
  prior: PriorPoint[];
  rules: RuleBook;
  /** Результаты детекторов 7.2–7.3, нужны правилам 7.1 и 8.2. */
  aki: boolean;
  rapidDecline: boolean;
}

export type RuleModule = (ctx: RuleContext) => Finding[];
