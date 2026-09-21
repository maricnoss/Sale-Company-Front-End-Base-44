const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useEffect, useState } from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  WOJEWODZTWA, powiatyOf, leafUnits, normName, powiatFor,
} from '@/lib/polandRegionUtils';

export default function VisitHistoryTab() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fWoj, setFWoj] = useState('all');
  const [fPowiat, setFPowiat] = useState('all');
  const [fGmina, setFGmina] = useState('all');

  useEffect(() => {
    (async () => {
      setVisits(await db.entities.RegionVisit.list('-visit_date', 1000));
      setLoading(false);
    })();
  }, []);

  const rows = visits
    .filter((v) => (v.status || 'done') === 'done')
    .map((v) => ({ ...v, powiat: v.powiat || powiatFor(v.wojewodztwo, v.gmina) || '' }));

  const filtered = rows
    .filter((v) => {
      if (fWoj !== 'all' && normName(v.wojewodztwo) !== normName(fWoj)) return false;
      if (fPowiat !== 'all' && normName(v.powiat) !== normName(fPowiat)) return false;
      if (fGmina !== 'all' && normName(v.gmina) !== normName(fGmina)) return false;
      return true;
    })
    .sort((a, b) =>
      (a.wojewodztwo || '').localeCompare(b.wojewodztwo || '', 'pl')
      || (a.powiat || '').localeCompare(b.powiat || '', 'pl')
      || (a.gmina || '').localeCompare(b.gmina || '', 'pl')
      || (a.dzielnica || '').localeCompare(b.dzielnica || '', 'pl')
      || (b.visit_date || '').localeCompare(a.visit_date || '')
    );

  const gminaOptions = fWoj !== 'all'
    ? Array.from(new Set(
        (fPowiat !== 'all'
          ? leafUnits(fWoj, fPowiat)
          : powiatyOf(fWoj).flatMap((p) => leafUnits(fWoj, p))
        ).map((u) => u.gmina)
      ))
    : [];

  if (loading) return <p className="text-sm text-muted-foreground">Ładowanie…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={fWoj} onValueChange={(v) => { setFWoj(v); setFPowiat('all'); setFGmina('all'); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie województwa</SelectItem>
            {WOJEWODZTWA.map((w) => (
              <SelectItem key={w} value={w}>{w}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fWoj !== 'all' && (
          <Select value={fPowiat} onValueChange={(v) => { setFPowiat(v); setFGmina('all'); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie powiaty</SelectItem>
              {powiatyOf(fWoj).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {fWoj !== 'all' && (
          <Select value={fGmina} onValueChange={setFGmina}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie gminy</SelectItem>
              {gminaOptions.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'wizyta' : 'wizyt'} • sortowanie alfabetyczne: województwo → powiat → gmina, potem najnowsze wizyty
      </p>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Brak odwiedzin spełniających filtr.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Województwo</TableHead>
                <TableHead>Powiat</TableHead>
                <TableHead>Gmina / dzielnica</TableHead>
                <TableHead className="text-right">Data wizyty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-muted-foreground">{v.wojewodztwo || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{v.powiat || '—'}</TableCell>
                  <TableCell className="font-medium">
                    {v.dzielnica ? `${v.gmina} — ${v.dzielnica}` : v.gmina || '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">{v.visit_date || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}