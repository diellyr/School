import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { FormField, Input, Select } from '../../../components/form/Field';
import type { FamilyPreferences } from '../../../domain';
import { useAuthStore } from '../../../auth/authStore';
import { useRepositories } from '../../../repositories/RepositoryProvider';

const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: 'monday', label: 'Seg' }, { value: 'tuesday', label: 'Ter' }, { value: 'wednesday', label: 'Qua' },
  { value: 'thursday', label: 'Qui' }, { value: 'friday', label: 'Sex' }, { value: 'saturday', label: 'Sáb' }, { value: 'sunday', label: 'Dom' },
];

/** Seção 14: preferências opcionais da família que orientam (sem travar) o plano semanal. */
export function FamilyPreferencesForm({ studentId, preferences }: { studentId: string; preferences: FamilyPreferences | null }) {
  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<string[]>(preferences?.availableDays ?? ['monday', 'wednesday', 'friday']);
  const [maxActivities, setMaxActivities] = useState(preferences?.maxActivitiesPerWeek ?? 3);
  const [maxMinutes, setMaxMinutes] = useState(preferences?.maxMinutesPerActivity ?? 15);
  const [environment, setEnvironment] = useState(preferences?.preferredEnvironment ?? 'either');
  const [saved, setSaved] = useState(false);

  function toggleDay(day: string) {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  }

  async function save() {
    if (!session) return;
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    const data = {
      studentId,
      availableDays: days,
      maxActivitiesPerWeek: Math.min(Math.max(maxActivities, 2), 5),
      maxMinutesPerActivity: maxMinutes,
      availableMaterials: preferences?.availableMaterials ?? [],
      preferredActivityTypes: preferences?.preferredActivityTypes ?? [],
      avoidActivityTypes: preferences?.avoidActivityTypes ?? [],
      preferredEnvironment: environment as FamilyPreferences['preferredEnvironment'],
      avoidRepeatWeeks: preferences?.avoidRepeatWeeks ?? 3,
    };
    if (preferences) await repositories.familyPreferences.update(preferences.id, data, actor);
    else await repositories.familyPreferences.create(data, actor);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Preferências da família</Button>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Preferências da família</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Dias disponíveis" htmlFor="days">
          <div className="flex flex-wrap gap-1.5">
            {DAY_OPTIONS.map((d) => (
              <Button key={d.value} size="sm" variant={days.includes(d.value) ? 'primary' : 'outline'} onClick={() => toggleDay(d.value)}>
                {d.label}
              </Button>
            ))}
          </div>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Máximo de atividades por semana (2 a 5)" htmlFor="maxActivities">
            <Input id="maxActivities" type="number" min={2} max={5} value={maxActivities} onChange={(e) => setMaxActivities(Number(e.target.value))} />
          </FormField>
          <FormField label="Tempo máximo por atividade (minutos)" htmlFor="maxMinutes">
            <Input id="maxMinutes" type="number" min={5} value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))} />
          </FormField>
        </div>
        <FormField label="Ambiente preferido" htmlFor="environment">
          <Select id="environment" value={environment} onChange={(e) => setEnvironment(e.target.value as FamilyPreferences['preferredEnvironment'])}>
            <option value="either">Sem preferência</option>
            <option value="home">Em casa</option>
            <option value="outdoor">Ao ar livre</option>
          </Select>
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button onClick={save}>{saved ? 'Salvo!' : 'Salvar preferências'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
