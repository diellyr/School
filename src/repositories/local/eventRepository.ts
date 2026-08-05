import { db } from '../../db/schema';
import type { EventConfirmation, EventParticipant, SchoolEvent } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalSchoolEventRepository extends LocalBaseRepository<SchoolEvent> {
  constructor() {
    super(db.schoolEvents);
  }

  async findBySchool(schoolId: string): Promise<SchoolEvent[]> {
    const items = await this.list({ where: (e) => e.schoolId === schoolId });
    return items.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  async upcoming(): Promise<SchoolEvent[]> {
    const items = await this.list();
    const now = new Date().toISOString();
    return items.filter((e) => e.startAt >= now).sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
}

export class LocalEventParticipantRepository extends LocalBaseRepository<EventParticipant> {
  constructor() {
    super(db.eventParticipants);
  }

  async findByEvent(eventId: string): Promise<EventParticipant[]> {
    return this.list({ where: (p) => p.eventId === eventId });
  }
}

export class LocalEventConfirmationRepository extends LocalBaseRepository<EventConfirmation> {
  constructor() {
    super(db.eventConfirmations);
  }

  async findByEvent(eventId: string): Promise<EventConfirmation[]> {
    return this.list({ where: (c) => c.eventId === eventId });
  }

  async findByGuardian(guardianId: string): Promise<EventConfirmation[]> {
    return this.list({ where: (c) => c.guardianId === guardianId });
  }
}
