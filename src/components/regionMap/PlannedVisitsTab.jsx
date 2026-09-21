const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { todayISO } from '@/lib/crmUtils';
import { CYCLE_LABELS, powiatFor } from '@/lib/polandRegionUtils';
import VisitDateDialog from '@/components/regionMap/VisitDateDialog';
import { Pencil, Trash2, Check, Repeat } from 'lucide-react';

const CYCLE_OPTIONS = [
  { value: 'none', label: 'Jednorazowo' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'quarterly', label: 'Co kwartał' },
];

const addCycle = (isoDate, cycle) => {
  const d = new Date(`${isoDate}T00:00:00`);
  if (cycle === 'weekly') d.setDate(d.getDate() + 7);
  else if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
};

export default function PlannedVisitsTab() {
  const { toast } = useToast();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [doneUnit, setDoneUnit] = useState(null);

  const load = async () => {
    setVisits(await db.entities.RegionVisit.list('-visit_date', 1000));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const today = todayISO();
  const planned = visits
    .filter((v) => v.status === 'planned')
    .sort((a, b) => (a.visit_date || '').localeCompare(b.visit_date || ''));

  const regionLabel = (v) => {
    const p = v.powiat || powiatFor(v.wojewodztwo, v.gmina) || '—';
    return [v.wojewodztwo, p, v.dzielnica ? `${v.gmina} — ${v.dzielnica}` : v.gmina].filter(Boolean).join(' › ');
  };

  const saveEdit = async () => {
    if (!edit || !edit.visit_date) return;
    const updated = await db.entities.RegionVisit.update(edit.id, { visit_date: edit.visit_date, cycle: edit.cycle });
    setVisits((vs) => vs.map((v) => (v.id === edit.id ? updated : v)));
    setEdit(null);
  };

  const remove = async (v) => {
    if (!confirm('Usunąć planowaną wizytę?')) return;
    await db.entities.RegionVisit.delete(v.id);
    setVisits((vs) => vs.filter((x) => x.id !== v.id));
  };

  const confirmDone = async (date) => {
    const v = doneUnit;
    if (!v) return;
    const updated = await db.entities.RegionVisit.update(v.id, { status: 'done', visit_date: date, cycle: 'none' });
    let next = [updated];
    if (v.cycle && v.cycle !== 'none') {
      const recurring = await db.entities.RegionVisit.create({
        wojewodztwo: v.wojewodztwo,
        powiat: v.powiat,
        gmina: v.gmina,
        dzielnica: v.dzielnica,
        visit_date: addCycle(date, v.cycle),
        status: 'planned',
        cycle: v.cycle,
      });
      next.push(recurring);
    }
    setVisits((vs) => [...vs.filter((x) => x.id !== v.id), ...next]);
    setDoneUnit(null);
    toast({
      title: 'Odhaczono wizytę',
      description: v.cycle !== 'none' ? `Następna zaplanowana na ${addCycle(date, v.cycle)} (${CYCLE_LABELS[v.cycle]})` : undefined,
    });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;

  return (
    <div className="space-y-2">
      {planned.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Brak zaplanowanych wizyt — zaplanuj je z poziomu mapy rejonów powyżej.
        </p>
      )}
      {planned.map((v) => {
        const overdue = (v.visit_date || '') < today;
        return (
          <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={overdue ? 'destructive' : 'secondary'}>
                  {v.visit_date}{overdue ? ' • po terminie' : ''}
                </Badge>
                {v.cycle && v.cycle !== 'none' && (
                  <Badge variant="outline" className="gap-1">
                    <Repeat className="h-3 w-3" /> {CYCLE_LABELS[v.cycle]}
                  </Badge>
                )}
              </div>
              <p className="mt-1 truncate text-sm font-medium">{regionLabel(v)}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1"
                onClick={() => setDoneUnit(v)}
              >
                <Check className="h-3 w-3" /> Odbyte
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1"
                onClick={() => setEdit({ id: v.id, visit_date: v.visit_date || '', cycle: v.cycle || 'none' })}
              >
                <Pencil className="h-3 w-3" /> Edytuj
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-destructive" onClick={() => remove(v)}>
                <Trash2 className="h-3 w-3" /> Usuń
              </Button>
            </div>
          </div>
        );
      })}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-sm">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle>Edytuj planowaną wizytę</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-date">Data planowanej wizyty</Label>
                  <Input id="edit-date" type="date" value={edit.visit_date} onChange={(e) => setEdit({ ...edit, visit_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Powtarzanie</Label>
                  <Select value={edit.cycle} onValueChange={(c) => setEdit({ ...edit, cycle: c })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CYCLE_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveEdit} disabled={!edit.visit_date}>Zapisz</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <VisitDateDialog
        open={!!doneUnit}
        title="Kiedy odbyła się wizyta?"
        description={doneUnit ? regionLabel(doneUnit) : ''}
        onConfirm={confirmDone}
        onClose={() => setDoneUnit(null)}
      />
    </div>
  );
}