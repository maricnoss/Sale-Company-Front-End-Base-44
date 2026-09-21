const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/crmUtils';
import { downloadCsv } from '@/lib/csvExport';
import { osmReverse, regionFromOsm, googleNavUrl, osmLink } from '@/lib/osmUtils';
import RegionMapCard from '@/components/regionMap/RegionMapCard';
import PlannedVisitsTab from '@/components/regionMap/PlannedVisitsTab';
import VisitHistoryTab from '@/components/regionMap/VisitHistoryTab';
import { Navigation, MapPin, Download, Loader2, ChevronDown, ChevronRight, CalendarClock } from 'lucide-react';

export default function RoutePlanner() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regionBusy, setRegionBusy] = useState(false);
  const [showNoRegion, setShowNoRegion] = useState(false);

  const load = async () => {
    const [o, l, c] = await Promise.all([
      db.entities.Order.list('-created_date', 500),
      db.entities.Location.list('-created_date', 1000),
      db.entities.Client.list('-created_date', 500),
    ]);
    setOrders(o); setLocations(l); setClients(c);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const locationsById = Object.fromEntries(locations.map((l) => [l.id, l]));

  const pending = orders
    .filter((o) => o.type === 'planned' && o.status === 'pending')
    .sort((a, b) => (a.delivery_date || '9999').localeCompare(b.delivery_date || '9999'));

  const exportPending = () => {
    downloadCsv('zamowienia-do-zrealizowania.csv',
      ['Klient', 'Punkt odbioru', 'Adres', 'Rejon', 'Data dostawy', 'Wartość (zł)', 'Płatność'],
      pending.map((o) => {
        const loc = locationsById[o.location_id];
        return [
          o.client_name || '',
          o.location_name || loc?.point_name || '',
          loc?.full_address || '',
          [loc?.wojewodztwo, loc?.gmina, loc?.dzielnica].filter(Boolean).join(', '),
          o.delivery_date || '',
          (o.total_revenue || 0).toFixed(2),
          o.payment_status === 'paid' ? 'opłacone' : 'nieopłacone',
        ];
      })
    );
    toast({ title: 'Wyeksportowano zamówienia do zrealizowania (CSV)' });
  };

  const exportClients = () => {
    downloadCsv('adresy-klientow.csv',
      ['Klient', 'Punkt', 'Adres', 'Województwo', 'Gmina', 'Dzielnica', 'Lat', 'Lng'],
      locations.map((l) => [
        clientsById[l.client_id]?.company_name || '',
        l.point_name || '',
        l.full_address || '',
        l.wojewodztwo || '',
        l.gmina || '',
        l.dzielnica || '',
        l.lat ?? '',
        l.lng ?? '',
      ])
    );
    toast({ title: 'Wyeksportowano adresy klientów (CSV)' });
  };

  const fillRegions = async () => {
    const toFill = locations.filter((l) => l.lat != null && l.lng != null && !l.wojewodztwo).slice(0, 25);
    if (toFill.length === 0) {
      toast({ title: 'Brak punktów do uzupełnienia', description: 'Punkty bez rejonu potrzebują współrzędnych — dodaj je w formularzu klienta.' });
      return;
    }
    setRegionBusy(true);
    let done = 0;
    try {
      for (const loc of toFill) {
        const data = await osmReverse(loc.lat, loc.lng);
        if (data?.address) {
          await db.entities.Location.update(loc.id, regionFromOsm(data.address));
          done++;
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
    } catch {
      toast({ title: 'Wystąpił błąd przy pobieraniu rejonów z OSM' });
    } finally {
      setRegionBusy(false);
    }
    if (done > 0) {
      toast({ title: `Uzupełniono rejony dla ${done} punktów`, description: toFill.length === 25 ? 'Kliknij ponownie, aby uzupełnić kolejne.' : undefined });
    }
    load();
  };

  const withoutRegion = locations.filter((l) => !l.wojewodztwo);

  const locRow = (l) => (
    <div key={l.id} className="flex items-center justify-between rounded-md border bg-background p-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{clientsById[l.client_id]?.company_name || '—'} — {l.point_name}</p>
        <p className="text-xs text-muted-foreground truncate">{l.full_address || '—'}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <a href={googleNavUrl({ lat: l.lat, lng: l.lng, address: l.full_address || l.point_name })} target="_blank" rel="noreferrer">
          <Button size="icon" variant="ghost" title="Nawiguj (Google Maps)"><Navigation className="h-4 w-4" /></Button>
        </a>
        {l.lat != null && (
          <a href={osmLink(l.lat, l.lng)} target="_blank" rel="noreferrer">
            <Button size="icon" variant="ghost" title="Zobacz w OpenStreetMap"><MapPin className="h-4 w-4" /></Button>
          </a>
        )}
      </div>
    </div>
  );

  if (loading) return <div className="text-muted-foreground">Ładowanie…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planer tras</h1>
        <p className="text-sm text-muted-foreground">Sprzedaże do zrealizowania oraz planowanie wizyt D2D na mapie rejonów</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportPending} className="gap-2"><Download className="h-4 w-4" /> Zamówienia do zrealizowania (CSV)</Button>
        <Button variant="outline" onClick={exportClients} className="gap-2"><Download className="h-4 w-4" /> Adresy klientów (CSV)</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Navigation className="h-4 w-4" /> Sprzedaże do zrealizowania ({pending.length})</CardTitle>
          <CardDescription>Adresy do odwiedzenia lub wysłania</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {pending.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Brak sprzedaży do zrealizowania.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Punkt</TableHead>
                  <TableHead>Adres</TableHead>
                  <TableHead className="text-right">Wartość</TableHead>
                  <TableHead>Płatność</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((o) => {
                  const loc = locationsById[o.location_id];
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{o.delivery_date || '—'}</TableCell>
                      <TableCell className="font-medium">{o.client_name || '—'}</TableCell>
                      <TableCell>{o.location_name || loc?.point_name || '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{loc?.full_address || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(o.total_revenue)}</TableCell>
                      <TableCell><Badge variant={o.payment_status === 'paid' ? 'default' : 'outline'}>{o.payment_status === 'paid' ? 'Opłacone' : 'Nieopłacone'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <a href={googleNavUrl({ lat: loc?.lat, lng: loc?.lng, address: loc?.full_address || o.client_name })} target="_blank" rel="noreferrer">
                            <Button size="icon" variant="ghost" title="Nawiguj (Google Maps)"><Navigation className="h-4 w-4" /></Button>
                          </a>
                          {loc?.lat != null && (
                            <a href={osmLink(loc.lat, loc.lng)} target="_blank" rel="noreferrer">
                              <Button size="icon" variant="ghost" title="Zobacz w OpenStreetMap"><MapPin className="h-4 w-4" /></Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RegionMapCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Planer D2D</CardTitle>
          <CardDescription>Wizyty planowane z mapy — odhaczaj jako odbyte (z mini kalendarzem), edytuj terminy i usuwaj plany</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="planned">
            <TabsList className="ml-4">
              <TabsTrigger value="planned">Planowane wizyty</TabsTrigger>
              <TabsTrigger value="history">Historia odwiedzin</TabsTrigger>
            </TabsList>
            <TabsContent value="planned" className="p-4 pt-3">
              <PlannedVisitsTab />
            </TabsContent>
            <TabsContent value="history" className="p-4 pt-3">
              <VisitHistoryTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {withoutRegion.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Punkty bez rejonu ({withoutRegion.length})</CardTitle>
                <CardDescription>Uzupełnij województwo i gminę automatycznie z OSM</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={fillRegions} disabled={regionBusy} className="gap-1">
                {regionBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />} Uzupełnij rejony z OSM
              </Button>
            </div>
          </CardHeader>
          {showNoRegion && <CardContent className="space-y-1 pt-0">{withoutRegion.map(locRow)}</CardContent>}
          <button className="w-full border-t p-2 text-xs text-muted-foreground hover:bg-accent flex items-center justify-center gap-1" onClick={() => setShowNoRegion(!showNoRegion)}>
            {showNoRegion ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showNoRegion ? 'Zwiń listę' : 'Rozwiń listę'}
          </button>
        </Card>
      )}
    </div>
  );
}