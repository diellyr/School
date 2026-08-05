import { db } from '../../db/schema';
import type { Recommendation } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalRecommendationRepository extends LocalBaseRepository<Recommendation> {
  constructor() {
    super(db.recommendations);
  }
}
