import { db } from '../../db/schema';
import type { AppUser, TeacherAssignment, UserPermission } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalUserRepository extends LocalBaseRepository<AppUser> {
  constructor() {
    super(db.users);
  }

  async findByEmail(email: string): Promise<AppUser | undefined> {
    const normalized = email.trim().toLowerCase();
    const items = await this.list({ includeDeleted: true, where: (u) => u.email.toLowerCase() === normalized });
    return items[0];
  }
}

export class LocalTeacherAssignmentRepository extends LocalBaseRepository<TeacherAssignment> {
  constructor() {
    super(db.teacherAssignments);
  }

  async findByTeacher(teacherUserId: string): Promise<TeacherAssignment[]> {
    return this.list({ where: (a) => a.teacherUserId === teacherUserId });
  }

  async findByClass(classId: string): Promise<TeacherAssignment[]> {
    return this.list({ where: (a) => a.classId === classId });
  }
}

export class LocalUserPermissionRepository extends LocalBaseRepository<UserPermission> {
  constructor() {
    super(db.userPermissions);
  }

  async findByUser(userId: string): Promise<UserPermission[]> {
    return this.list({ where: (p) => p.userId === userId });
  }
}
