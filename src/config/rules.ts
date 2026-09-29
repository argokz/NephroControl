// Загрузка rules.json с проверкой структуры при старте приложения.

import raw from './rules.json';
import { RuleBook, validateRulesConfig } from '../core/ruleBook';

export const rulesConfig = validateRulesConfig(raw);
export const rules = new RuleBook(rulesConfig);
