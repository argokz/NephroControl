// Сбор предупреждений: общие правила + правила по отмеченным группам + динамика.

import { dynamicsFindings } from '../dynamics';
import type { Finding, Group, Severity } from '../types';
import { commonRules } from './common';
import type { RuleContext, RuleModule } from './context';
import { diabetesRules } from './diabetes';
import { pneumoniaRules } from './pneumonia';
import { pyelonephritisRules } from './pyelonephritis';

const GROUP_MODULES: Record<Group, RuleModule> = {
  pyelonephritis: pyelonephritisRules,
  diabetes: diabetesRules,
  pneumonia: pneumoniaRules,
};

const SEVERITY_ORDER: Record<Severity, number> = { emergency: 0, important: 1, info: 2 };

export function evaluateRules(ctx: RuleContext): Finding[] {
  const findings: Finding[] = [...commonRules(ctx), ...dynamicsFindings(ctx)];
  for (const g of ctx.input.groups) findings.push(...GROUP_MODULES[g](ctx));
  // sort стабилен — порядок внутри одной важности сохраняется.
  return findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
