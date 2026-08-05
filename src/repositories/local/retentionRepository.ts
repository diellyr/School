import { db } from '../../db/schema';
import type { DataRetentionRule } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalDataRetentionRuleRepository extends LocalBaseRepository<DataRetentionRule> {
  constructor() {
    super(db.dataRetentionRules);
  }
}
