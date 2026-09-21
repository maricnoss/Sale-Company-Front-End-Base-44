const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/crmUtils';
import AddressSearch from '@/components/AddressSearch';
import OsmMapPreview from '@/components/OsmMapPreview';
import { googleNavUrl, osmLink } from '@/lib/osmUtils';
import { Plus, MapPin, Pencil, Trash2, Navigation, ChevronDown, ChevronRight } from 'lucide-react';

const emptyAddr = { point_name: '', full_address: '', lat: '', lng: '', wojewodztwo: '', gmina: '', dzielnica: '' };
const statusLabel = { pending: 'Oczekuje', delivered: 'Dostarczone', cancelled: 'Anulowane' };
const typeLabel = { planned: 'Planowane', executed: 'Zrealizowane' };

export default function Clients() {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientDialog, setClientDialog] = useState({ open: false, edit: null });
  const [locDialog, setLocDialog] = useState({ open: false, clientId: null, edit: null });
  const [form, setForm] = useState({ company_name: '', phone: '', nip: '', discount_percent: 0 });
  const [addrForm, setAddrForm] = useState(emptyAddr);
  const [locForm, setLocForm] = useState(emptyAddr);

  const load = async () => {
    const [c, l, o] = await Promise.all([
      db.entities.Client.list('-created_date', 500),
      db.entities.Location.list('-created_date', 1000),
      db.entities.Order.list('-created_date', 500),
    ]);
    setClients(c); setLocations(l); setOrders(o); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('nowy') === '1') {
      window.history.replaceState({}, '', '/klienci');
      openClient(null);
    }
  }, []);

  const openClient = (c) => {
    setForm({ company_name: c?.company_name || '', phone: c?.phone || '', nip: c?.nip || '', discount_percent: c?.discount_percent || 0 });
    setAddrForm(emptyAddr);
    setClientDialog({ open: true, edit: c?.id || null });
  };

  const saveClient = async () => {
    if (!form.company_name) { toast({ title: 'Podaj nazwę firmy' }); return; }
    let clientId = clientDialog.edit;
    if (clientDialog.edit) {
      await db.entities.Client.update(clientDialog.edit, form);
    } else {
      const created = await db.entities.Client.create({ ...form, total_debt: 0 });
      clientId = created.id;
    }
    if (addrForm.full_address || addrForm.lat !== '') {
      await db.entities.Location.create({
        client_id: clientId,
        point_name: addrForm.point_name || 'Główny adres',
        full_address: addrForm.full_address,
        lat: addrForm.lat === '' ? null : Number(addrForm.lat),
        lng: addrForm.lng === '' ? null : Number(addrForm.lng),
        wojewodztwo: addrForm.wojewodztwo || '',
        gmina: addrForm.gmina || '',
        dzielnica: addrForm.dzielnica || '',
      });
    }
    setClientDialog({ open: false, edit: null });
    load();
  };

  const openLoc = (clientId, loc) => {
    setLocForm({
      point_name: loc?.point_name || '',
      full_address: loc?.full_address || '',
      lat: loc?.lat ?? '',
      lng: loc?.lng ?? '',
      wojewodztwo: loc?.wojewodztwo || '',
      gmina: loc?.gmina || '',
      dzielnica: loc?.dzielnica || '',
    });
    setLocDialog({ open: true, clientId, edit: loc?.id || null });
  };
  const saveLoc = async () => {
    if (!locForm.point_name) { toast({ title: 'Podaj nazwę punktu' }); return; }
    const payload = {
      client_id: locDialog.clientId,
      point_name: locForm.point_name,
      full_address: locForm.full_address,
      lat: locForm.lat === '' ? null : Number(locForm.lat),
      lng: locForm.lng === '' ? null : Number(locForm.lng),
      wojewodztwo: locForm.wojewodztwo || '',
      gmina: locForm.gmina || '',
      dzielnica: locForm.dzielnica || '',
    };
    if (locDialog.edit) await db.entities.Location.update(locDialog.edit, payload);
    else await db.entities.Location.create(payload);
    setLocDialog({ open: false, clientId: null, edit: null });
    load();
  };

  const grabGPS = (setter) => {
    if (!navigator.geolocation) { toast({ title: 'Brak dostępu do GPS' }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setter((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })),
      () => toast({ title: 'Nie udało się pobrać lokalizacji' })
    );
  };

  const pickClientAddr = (a) => setAddrForm((f) => ({ ...f, full_address: a.full_address, lat: a.lat, lng: a.lng, wojewodztwo: a.wojewodztwo, gmina: a.gmina, dzielnica: a.dzielnica }));
  const pickLocAddr = (a) => setLocForm((f) => ({ ...f, full_address: a.full_address, lat: a.lat, lng: a.lng, wojewodztwo: a.wojewodztwo, gmina: a.gmina, dzielnica: a.dzielnica }));

  const delClient = async (c) => {
    if (!confirm(`Usunąć klienta ${c.company_name}?`)) return;
    await db.entities.Client.delete(c.id);
    load();
  };
  const delLoc = async (l) => {
    if (!confirm('Usunąć punkt?')) return;
    await db.entities.Location.delete(l.id);
    load();
  };

  if (loading) return <div className="text-muted-foreground">Ładowanie…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Klienci</h1>
          <p className="text-sm text-muted-foreground">Firmy, punkty odbioru i salda</p>
        </div>
        <Button onClick={() => openClient(null)} className="gap-2"><Plus className="h-4 w-4" /> Nowy klient</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="text-right">Rabat</TableHead>
                <TableHead className="text-right">Zadłużenie</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => {
                const clientLocs = locations.filter((l) => l.client_id === c.id);
                const clientOrders = orders.filter((o) => o.client_id === c.id)
                  .sort((a, b) => (b.delivery_date || b.created_date || '').localeCompare(a.delivery_date || a.created_date || ''));
                const isOpen = expanded === c.id;
                return (
                  <>
                    <TableRow key={c.id}>
                      <TableCell>
                        <button onClick={() => setExpanded(isOpen ? null : c.id)}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{c.company_name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                      <TableCell className="text-right">{c.discount_percent || 0}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.total_debt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openClient(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => delClient(c)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={c.id + '-det'}>
                        <TableCell colSpan={6} className="bg-muted/40 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium">Punkty odbioru ({clientLocs.length})</span>
                            <Button size="sm" variant="outline" onClick={() => openLoc(c.id, null)} className="gap-1"><Plus className="h-3 w-3" /> Dodaj punkt</Button>
                          </div>
                          {clientLocs.length === 0 ? <p className="text-sm text-muted-foreground">Brak punktów</p> : (
                            <div className="space-y-2">
                              {clientLocs.map((l) => (
                                <div key={l.id} className="flex items-center justify-between rounded-md border bg-background p-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">{l.point_name}</p>
                                    <p className="text-xs text-muted-foreground">{l.full_address || '—'}{[l.wojewodztwo, l.gmina, l.dzielnica].filter(Boolean).length ? ` • ${[l.wojewodztwo, l.gmina, l.dzielnica].filter(Boolean).join(', ')}` : ''}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {l.lat != null && l.lng != null && (
                                      <>
                                        <a href={googleNavUrl({ lat: l.lat, lng: l.lng, address: l.full_address })} target="_blank" rel="noreferrer">
                                          <Button size="icon" variant="ghost" title="Nawiguj"><Navigation className="h-4 w-4" /></Button>
                                        </a>
                                        <a href={osmLink(l.lat, l.lng)} target="_blank" rel="noreferrer">
                                          <Button size="icon" variant="ghost" title="OpenStreetMap"><MapPin className="h-4 w-4" /></Button>
                                        </a>
                                      </>
                                    )}
                                    <Button size="icon" variant="ghost" onClick={() => openLoc(c.id, l)}><Pencil className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => delLoc(l)}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 space-y-2">
                            <span className="text-sm font-medium">Historia sprzedaży ({clientOrders.length})</span>
                            {clientOrders.length === 0 ? <p className="text-sm text-muted-foreground">Brak sprzedaży</p> : (
                              <div className="divide-y rounded-md border bg-background">
                                {clientOrders.map((o) => (
                                  <div key={o.id} className="flex items-center justify-between gap-2 p-2.5">
                                    <div className="min-w-0 text-sm">
                                      <span className="text-muted-foreground">{o.delivery_date || '—'}</span>
                                      <span className="ml-2 truncate">{o.location_name || ''}</span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <Badge variant="outline">{typeLabel[o.type]}</Badge>
                                      <Badge variant={o.status === 'delivered' ? 'default' : o.status === 'cancelled' ? 'destructive' : 'secondary'}>{statusLabel[o.status]}</Badge>
                                      <Badge variant={o.payment_status === 'paid' ? 'default' : 'outline'}>{o.payment_status === 'paid' ? 'Opłacone' : 'Nieopłacone'}</Badge>
                                      <span className="w-24 text-right text-sm font-medium">{formatCurrency(o.total_revenue)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={clientDialog.open} onOpenChange={(o) => setClientDialog({ ...clientDialog, open: o })}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{clientDialog.edit ? 'Edytuj klienta' : 'Nowy klient'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nazwa firmy *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>NIP</Label><Input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} /></div>
            </div>
            <div><Label>Rabat (%)</Label><Input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })} /></div>

            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">Adres (opcjonalnie)</p>
              <AddressSearch onPick={pickClientAddr} />
              <div><Label>Nazwa punktu</Label><Input value={addrForm.point_name} onChange={(e) => setAddrForm({ ...addrForm, point_name: e.target.value })} placeholder="np. Sklep, Magazyn" /></div>
              <div><Label>Pełny adres</Label><Input value={addrForm.full_address} onChange={(e) => setAddrForm({ ...addrForm, full_address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Szerokość (lat)</Label><Input type="number" step="any" value={addrForm.lat} onChange={(e) => setAddrForm({ ...addrForm, lat: e.target.value })} /></div>
                <div><Label>Długość (lng)</Label><Input type="number" step="any" value={addrForm.lng} onChange={(e) => setAddrForm({ ...addrForm, lng: e.target.value })} /></div>
              </div>
              <Button variant="outline" size="sm" onClick={() => grabGPS(setAddrForm)} className="gap-1"><MapPin className="h-3 w-3" /> Użyj mojej lokalizacji</Button>
              {addrForm.wojewodztwo && <p className="text-xs text-muted-foreground">Rejon: {[addrForm.wojewodztwo, addrForm.gmina, addrForm.dzielnica].filter(Boolean).join(', ')}</p>}
              <OsmMapPreview lat={addrForm.lat} lng={addrForm.lng} height={150} />
            </div>
          </div>
          <DialogFooter><Button onClick={saveClient}>Zapisz</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locDialog.open} onOpenChange={(o) => setLocDialog({ ...locDialog, open: o })}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{locDialog.edit ? 'Edytuj punkt' : 'Nowy punkt'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nazwa punktu *</Label><Input value={locForm.point_name} onChange={(e) => setLocForm({ ...locForm, point_name: e.target.value })} /></div>
            <AddressSearch onPick={pickLocAddr} />
            <div><Label>Pełny adres</Label><Input value={locForm.full_address} onChange={(e) => setLocForm({ ...locForm, full_address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Szerokość (lat)</Label><Input type="number" step="any" value={locForm.lat} onChange={(e) => setLocForm({ ...locForm, lat: e.target.value })} /></div>
              <div><Label>Długość (lng)</Label><Input type="number" step="any" value={locForm.lng} onChange={(e) => setLocForm({ ...locForm, lng: e.target.value })} /></div>
            </div>
            <Button variant="outline" size="sm" onClick={() => grabGPS(setLocForm)} className="gap-1"><MapPin className="h-3 w-3" /> Użyj mojej lokalizacji</Button>
            {locForm.wojewodztwo && <p className="text-xs text-muted-foreground">Rejon: {[locForm.wojewodztwo, locForm.gmina, locForm.dzielnica].filter(Boolean).join(', ')}</p>}
            <OsmMapPreview lat={locForm.lat} lng={locForm.lng} height={150} />
          </div>
          <DialogFooter><Button onClick={saveLoc}>Zapisz</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}