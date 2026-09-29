// Преобразование результата расчёта в запись истории пациента (ТЗ, раздел 9).

import type { Assessment, HistoryRecord } from './types';

export function toHistoryRecord(a: Assessment, patientId: string, id: string, createdAt: string): HistoryRecord {
  const r: HistoryRecord = {
    id,
    patientId,
    sampledAt: a.input.sampledAt,
    creatinine: { ...a.input.creatinine },
    creatinineMgDl: a.scrMgDl,
    egfr2009: a.egfr2009.value,
    egfr2021: a.egfr2021.value,
    crcl: a.crcl.value,
    crclWeightKg: a.crcl.weightKg,
    crclWeightBasis: a.crcl.weightBasis,
    stage: a.stage,
    firedRuleIds: a.findings.map((f) => f.ruleId),
    rulesVersion: a.rulesVersion,
    input: structuredClone(a.input),
    createdAt,
  };
  if (a.albuminuria) r.albuminuria = a.albuminuria;
  return r;
}
