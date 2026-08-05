import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, CheckCircle2, Plus, XCircle } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { FormField, Input, Select, Textarea } from '../../components/form/Field';
import { eventSchema, EVENT_TYPE_LABELS, type EventFormValues } from './eventSchema';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { useCurrentRole, usePermission } from '../../auth/usePermission';
import { formatDateTime } from '../../lib/utils';
import type { School, SchoolEvent } from '../../domain';

const STATUS_TONE = { draft: 'default', published: 'info', confirmed: 'success', cancelled: 'danger', completed: 'default', rescheduled: 'warning' } as const;
const STATUS_LABEL = { draft: 'Rascunho', published: 'Publicado', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Realizado', rescheduled: 'Reagendado' } as const;

export function EventsPage() {
  const role = useCurrentRole();
  const session = useAuthStore((s) => s.session);
  const repositories = useRepositories();
  const canCreate = usePermission('events', 'create');
  const [dialogOpen, setDialogOpen] = useState(false);

  const events = useLiveQuery(async () => {
    const items = await db.schoolEvents.filter((e) => e.status === 'active').toArray();
    return items.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, []);
  const schools = useLiveQuery<School[]>(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const classes = useLiveQuery(() => db.classes.filter((c) => c.status === 'active').toArray(), []);

  const myConfirmations = useLiveQuery(async () => {
    if (!session?.user.guardianId) return [];
    return db.eventConfirmations.filter((c) => c.guardianId === session.user.guardianId && c.status === 'active').toArray();
  }, [session?.user.guardianId]);

  const myChildren = useLiveQuery(async () => {
    if (!session?.user.guardianId) return [];
    const links = await db.studentGuardians.filter((l) => l.guardianId === session.user.guardianId && l.status === 'active').toArray();
    return links.map((l) => l.studentId);
  }, [session?.user.guardianId]);

  async function respond(event: SchoolEvent, response: 'confirmed' | 'declined', studentId: string) {
    if (!session?.user.guardianId) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const existing = myConfirmations?.find((c) => c.eventId === event.id && c.studentId === studentId);
    if (existing) {
      await repositories.eventConfirmations.update(existing.id, { response, respondedAt: new Date().toISOString() }, actor);
    } else {
      await repositories.eventConfirmations.create(
        { eventId: event.id, guardianId: session.user.guardianId, studentId, response, respondedAt: new Date().toISOString() },
        actor,
      );
    }
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'edit', module: 'events', entityId: event.id });
  }

  const schoolName = (id: string) => schools?.find((s) => s.id === id)?.name ?? '—';
  const className = (id?: string) => (id ? classes?.find((c) => c.id === id)?.name : undefined);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Eventos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Calendário de eventos escolares.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Novo evento</Button>
        )}
      </div>

      {events === undefined && <SkeletonList />}
      {events?.length === 0 && <EmptyState icon={CalendarDays} title="Nenhum evento cadastrado" />}

      <div className="space-y-3">
        {events?.map((event) => {
          const myConfirmation = myConfirmations?.find((c) => c.eventId === event.id);
          return (
            <Card key={event.id}>
              <CardContent>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{event.title}</p>
                      <Badge tone={STATUS_TONE[event.eventStatus]}>{STATUS_LABEL[event.eventStatus]}</Badge>
                      <Badge>{EVENT_TYPE_LABELS[event.type as keyof typeof EVENT_TYPE_LABELS] ?? event.type}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {schoolName(event.schoolId)}{className(event.classId) ? ` · ${className(event.classId)}` : ''} · {formatDateTime(event.startAt)}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                    {event.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.description}</p>}
                  </div>
                  {role === 'guardian' && event.requiresConfirmation && myChildren && myChildren.length > 0 && (
                    <div className="flex items-center gap-2">
                      {myConfirmation?.response === 'confirmed' ? (
                        <Badge tone="success">Presença confirmada</Badge>
                      ) : myConfirmation?.response === 'declined' ? (
                        <Badge tone="danger">Não vou comparecer</Badge>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => respond(event, 'confirmed', myChildren[0])}>
                            <CheckCircle2 className="h-4 w-4" /> Confirmar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => respond(event, 'declined', myChildren[0])}>
                            <XCircle className="h-4 w-4" /> Não vou
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EventFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} schools={schools ?? []} classes={classes ?? []} />
    </div>
  );
}

function EventFormDialog({ open, onClose, schools, classes }: { open: boolean; onClose: () => void; schools: School[]; classes: { id: string; name: string; schoolId: string }[] }) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    values: {
      title: '', description: '', schoolId: schools[0]?.id ?? '', classId: '', type: 'evento_escola',
      startDate: new Date().toISOString().slice(0, 10), startTime: '18:00',
      location: '', guardianAttendance: 'optional', requiresConfirmation: false, requiresAuthorization: false, cost: '',
    },
  });

  const selectedSchoolId = watch('schoolId');
  const filteredClasses = classes.filter((c) => c.schoolId === selectedSchoolId);

  async function onSubmit(values: EventFormValues) {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const created = await repositories.schoolEvents.create(
      {
        title: values.title,
        description: values.description || undefined,
        schoolId: values.schoolId,
        classId: values.classId || undefined,
        audience: values.classId ? 'class' : 'school',
        startAt: new Date(`${values.startDate}T${values.startTime}:00`).toISOString(),
        location: values.location || undefined,
        responsibleUserId: session.user.id,
        type: values.type,
        requiresAuthorization: values.requiresAuthorization,
        transportProvided: false,
        cost: values.cost ? Number(values.cost) : undefined,
        guardianAttendance: values.guardianAttendance,
        requiresConfirmation: values.requiresConfirmation,
        eventStatus: 'published',
      },
      actor,
    );
    await repositories.audit.record({ ...actor, role: session.role }, { action: 'create', module: 'events', entityId: created.id });
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Novo evento" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Título" htmlFor="title" error={errors.title?.message} required>
          <Input id="title" {...register('title')} />
        </FormField>
        <FormField label="Descrição" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" {...register('description')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Escola" htmlFor="schoolId" error={errors.schoolId?.message} required>
            <Select id="schoolId" {...register('schoolId')}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Turma (opcional)" htmlFor="classId" error={errors.classId?.message}>
            <Select id="classId" {...register('classId')}>
              <option value="">Toda a escola</option>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Tipo" htmlFor="type" error={errors.type?.message} required>
            <Select id="type" {...register('type')}>
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
          <FormField label="Data" htmlFor="startDate" error={errors.startDate?.message} required>
            <Input id="startDate" type="date" {...register('startDate')} />
          </FormField>
          <FormField label="Horário" htmlFor="startTime" error={errors.startTime?.message} required>
            <Input id="startTime" type="time" {...register('startTime')} />
          </FormField>
        </div>
        <FormField label="Local" htmlFor="location" error={errors.location?.message}>
          <Input id="location" {...register('location')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Presença dos pais" htmlFor="guardianAttendance" error={errors.guardianAttendance?.message}>
            <Select id="guardianAttendance" {...register('guardianAttendance')}>
              <option value="not_required">Não é necessária</option>
              <option value="optional">Opcional</option>
              <option value="required">Obrigatória</option>
            </Select>
          </FormField>
          <div className="flex flex-col justify-end gap-2 pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" className="rounded border-slate-300" {...register('requiresConfirmation')} /> Exigir confirmação de presença
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" className="rounded border-slate-300" {...register('requiresAuthorization')} /> Exigir autorização
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>Publicar evento</Button>
        </div>
      </form>
    </Dialog>
  );
}
