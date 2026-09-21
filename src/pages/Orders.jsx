const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useSettings } from '@/lib/useSettings';
import { formatCurrency, netToGross, vatAmount, todayISO, syncOrderEffects } from '@/lib/crmUtils';
import { generateOrderReceiptPDF } from '@/lib/pdfReceipt';
import { Plus, Trash2, FileText, Check, X, Truck, Ban, Pencil, BarChart3 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { marginFromItems } from '@/lib/salesStats';
import { WOJEWODZTWA, powiatyOf, leafUnits, normName, locPowiat } from '@/lib/polandRegionUtils';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';

const statusLabel = { pending: 'Oczekuje', delivered: 'Dostarczone', cancelled: 'Anulowane' };
const typeLabel = { planned: 'Planowane', executed: 'Zrealizowane' };

export default function Orders() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const settings = useSettings();
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tab, setTab] = useState('all');

  const [form, setForm] = useState({
    client_id: '', location_id: '', type: 'planned', status: 'pending',
    payment_status: 'unpaid', delivery_date: todayISO(), notes: '',
    is_d2d: false, d2d_woj: '', d2d_powiat: '', d2d_gmina: '', d2d_dzielnica: '',
  });
  const [rows, setRows] = useState([]);

  const load = async () => {
    const [o, c, l, p] = await Promise.all([
      db.entities.Order.list('-created_date', 500),
      db.entities.Client.list('-created_date', 500),
      db.entities.Location.list('-created_date', 1000),
      db.entities.Product.list('-created_date', 500),
    ]);
    setOrders(o); setClients(c); setLocations(l); setProducts(p);
    setItems(await db.entities.OrderItem.list('-created_date', 3000));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('nowe') === '1') {
      window.history.replaceState({}, '', '/zamowienia');
      openNew();
    }
  }, []);

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  const tax = settings?.tax_active;
  const vatRate = settings?.default_vat_rate || 23;

  const openNew = () => {
    setForm({ client_id: '', location_id: '', type: 'planned', status: 'pending', payment_status: 'unpaid', delivery_date: todayISO(), notes: '', is_d2d: false, d2d_woj: '', d2d_powiat: '', d2d_gmina: '', d2d_dzielnica: '' });
    setRows([]);
    setEditingId(null);
    setDialog(true);
  };

  const openEdit = (order) => {
    const orderItems = items.filter((it) => it.order_id === order.id);
    setForm({
      client_id: order.client_id || '',
      location_id: order.location_id || '',
      type: order.type || 'planned',
      status: order.status || 'pending',
      payment_status: order.payment_status || 'unpaid',
      delivery_date: order.delivery_date || todayISO(),
      notes: order.notes || '',
      is_d2d: !!order.is_d2d,
      d2d_woj: order.d2d_woj || '',
      d2d_powiat: order.d2d_powiat || '',
      d2d_gmina: order.d2d_gmina || '',
      d2d_dzielnica: order.d2d_dzielnica || '',
    });
    setRows(orderItems.map((it) => ({
      id: it.id,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_sale_price: it.unit_sale_price,
      unit_purchase_cost: it.unit_purchase_cost,
      orig_product_id: it.product_id,
      orig_applied_reserved: it.applied_reserved || 0,
      orig_applied_physical: it.applied_physical || 0,
    })));
    setEditingId(order.id);
    setDialog(true);
  };

  const addRow = () => setRows([...rows, { product_id: '', quantity: 1, unit_sale_price: 0, unit_purchase_cost: 0 }]);
  const updateRow = (i, patch) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    if (patch.product_id) {
      const p = productsById[patch.product_id];
      if (p) {
        const disc = clientsById[form.client_id]?.discount_percent || 0;
        next[i].unit_sale_price = Number((p.sale_price * (1 - disc / 100)).toFixed(2));
        next[i].unit_purchase_cost = p.purchase_cost || 0;
        next[i].product_name = p.name;
      }
    }
    setRows(next);
  };
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const totals = rows.reduce((acc, r) => {
    const net = (r.quantity || 0) * (r.unit_sale_price || 0);
    acc.net += net;
    acc.profit += net - (r.quantity || 0) * (r.unit_purchase_cost || 0);
    return acc;
  }, { net: 0, profit: 0 });
  const vat = tax ? vatAmount(totals.net, vatRate) : 0;
  const totalRevenue = tax ? netToGross(totals.net, vatRate) : totals.net;

  const toggleD2d = (checked) => {
    if (checked) {
      const loc = locations.find((l) => l.id === form.location_id);
      setForm((f) => ({
        ...f,
        is_d2d: true,
        d2d_woj: f.d2d_woj || loc?.wojewodztwo || '',
        d2d_powiat: f.d2d_powiat || (loc ? locPowiat(loc) || '' : ''),
        d2d_gmina: f.d2d_gmina || loc?.gmina || '',
        d2d_dzielnica: f.d2d_dzielnica || loc?.dzielnica || '',
      }));
    } else {
      setForm((f) => ({ ...f, is_d2d: false, d2d_woj: '', d2d_powiat: '', d2d_gmina: '', d2d_dzielnica: '' }));
    }
  };

  const save = async () => {
    if (!form.client_id) { toast({ title: 'Wybierz klienta' }); return; }
    if (rows.length === 0) { toast({ title: 'Dodaj co najmniej jedną pozycję' }); return; }
    if (form.is_d2d && (!form.d2d_woj || !form.d2d_powiat || !form.d2d_gmina)) { toast({ title: 'Wybierz rejon sprzedaży D2D (województwo, powiat, gmina)' }); return; }
    const client = clientsById[form.client_id];
    const loc = locations.find((l) => l.id === form.location_id);
    if (editingId) { await saveEdit(client, loc); return; }
    const order = await db.entities.Order.create({
      ...form,
      client_name: client.company_name,
      location_name: loc?.point_name || '',
      total_net: totals.net,
      total_vat: vat,
      total_revenue: totalRevenue,
      total_profit: totals.profit,
      applied_debt: 0,
    });
    const createdItems = await db.entities.OrderItem.bulkCreate(
      rows.map((r) => ({
        order_id: order.id,
        product_id: r.product_id,
        product_name: r.product_name || productsById[r.product_id]?.name,
        quantity: r.quantity,
        unit_sale_price: r.unit_sale_price,
        unit_purchase_cost: r.unit_purchase_cost,
        applied_reserved: 0,
        applied_physical: 0,
      }))
    );
    await syncOrderEffects({ ...order, total_revenue: totalRevenue }, createdItems, productsById, client);
    setDialog(false);
    toast({ title: 'Zamówienie utworzone' });
    load();
  };

  const saveEdit = async (client, loc) => {
    const order = orders.find((o) => o.id === editingId);
    const existingItems = items.filter((it) => it.order_id === editingId);
    const deleteIds = [];
    const stockDeltas = {};
    const addDelta = (pid, dr, dp) => { if (!pid) return; stockDeltas[pid] = stockDeltas[pid] || { reserved: 0, physical: 0 }; stockDeltas[pid].reserved += dr; stockDeltas[pid].physical += dp; };
    for (const it of existingItems) {
      const row = rows.find((r) => r.id === it.id);
      if (!row) { addDelta(it.product_id, -(it.applied_reserved || 0), -(it.applied_physical || 0)); deleteIds.push(it.id); }
      else if (row.product_id !== row.orig_product_id) { addDelta(row.orig_product_id, -(row.orig_applied_reserved || 0), -(row.orig_applied_physical || 0)); deleteIds.push(it.id); }
    }
    for (const pid in stockDeltas) {
      const p = productsById[pid];
      if (p) await db.entities.Product.update(pid, { reserved_stock: (p.reserved_stock || 0) + stockDeltas[pid].reserved, physical_stock: (p.physical_stock || 0) + stockDeltas[pid].physical });
    }
    for (const id of deleteIds) await db.entities.OrderItem.delete(id);
    let appliedDebt = order.applied_debt || 0;
    if (order.client_id !== form.client_id && appliedDebt) {
      const oldClient = clientsById[order.client_id];
      if (oldClient) await db.entities.Client.update(oldClient.id, { total_debt: (oldClient.total_debt || 0) - appliedDebt });
      await db.entities.Order.update(editingId, { applied_debt: 0 });
      appliedDebt = 0;
    }
    const updated = await db.entities.Order.update(editingId, {
      ...form,
      client_name: client.company_name,
      location_name: loc?.point_name || '',
      total_net: totals.net,
      total_vat: vat,
      total_revenue: totalRevenue,
      total_profit: totals.profit,
    });
    const finalItems = [];
    for (const r of rows) {
      if (r.id && !deleteIds.includes(r.id)) {
        await db.entities.OrderItem.update(r.id, { product_id: r.product_id, product_name: r.product_name || productsById[r.product_id]?.name, quantity: r.quantity, unit_sale_price: r.unit_sale_price, unit_purchase_cost: r.unit_purchase_cost });
        const orig = existingItems.find((it) => it.id === r.id);
        finalItems.push({ id: r.id, order_id: editingId, product_id: r.product_id, quantity: r.quantity, applied_reserved: orig?.applied_reserved || 0, applied_physical: orig?.applied_physical || 0 });
      }
    }
    const newRows = [...rows.filter((r) => !r.id), ...rows.filter((r) => r.id && deleteIds.includes(r.id))];
    for (const r of newRows) {
      const created = await db.entities.OrderItem.create({ order_id: editingId, product_id: r.product_id, product_name: r.product_name || productsById[r.product_id]?.name, quantity: r.quantity, unit_sale_price: r.unit_sale_price, unit_purchase_cost: r.unit_purchase_cost, applied_reserved: 0, applied_physical: 0 });
      finalItems.push(created);
    }
    const freshProducts = await db.entities.Product.list('-created_date', 500);
    const freshById = Object.fromEntries(freshProducts.map((p) => [p.id, p]));
    await syncOrderEffects(updated, finalItems, freshById, client);
    setDialog(false);
    setEditingId(null);
    toast({ title: 'Zamówienie zaktualizowane' });
    load();
  };

  const changeStatus = async (order, status) => {
    const orderItems = items.filter((it) => it.order_id === order.id);
    const client = clientsById[order.client_id];
    const updated = await db.entities.Order.update(order.id, status === 'delivered' ? { status, delivered_date: todayISO() } : { status });
    await syncOrderEffects(updated, orderItems, productsById, client);
    toast({ title: `Status: ${statusLabel[status]}` });
    load();
  };
  const changePayment = async (order, payment_status) => {
    const orderItems = items.filter((it) => it.order_id === order.id);
    const client = clientsById[order.client_id];
    const updated = await db.entities.Order.update(order.id, { payment_status });
    await syncOrderEffects(updated, orderItems, productsById, client);
    toast({ title: payment_status === 'paid' ? 'Oznaczono jako opłacone' : 'Oznaczono jako nieopłacone' });
    load();
  };

  const exportPDF = async (order) => {
    const orderItems = items.filter((it) => it.order_id === order.id);
    const client = clientsById[order.client_id];
    const loc = locations.find((l) => l.id === order.location_id);
    await generateOrderReceiptPDF(order, orderItems, client, loc, settings);
  };

  const isRealized = (o) => (o.type === 'executed' || o.status === 'delivered') && o.status !== 'cancelled';
  const tabOrders = tab === 'all'
    ? orders
    : tab === 'planned'
      ? orders.filter((o) => o.type === 'planned' && o.status === 'pending')
      : tab === 'executed'
        ? orders.filter(isRealized)
        : orders.filter((o) => o.status === 'cancelled');
  const tabCount = {
    all: orders.length,
    planned: orders.filter((o) => o.type === 'planned' && o.status === 'pending').length,
    executed: orders.filter(isRealized).length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };
  const visibleRealized = tabOrders.filter(isRealized);
  const visibleSale = visibleRealized.reduce((s, o) => s + (o.total_revenue || 0), 0);
  const visibleMargin = marginFromItems(items, visibleRealized.map((o) => o.id));
  const visibleAov = visibleRealized.length ? visibleSale / visibleRealized.length : 0;

  const d2dGminaOptions = form.d2d_woj && form.d2d_powiat
    ? Array.from(new Set(leafUnits(form.d2d_woj, form.d2d_powiat).map((u) => u.gmina)))
    : [];
  const d2dDzielniceOptions = form.d2d_gmina
    ? leafUnits(form.d2d_woj, form.d2d_powiat)
      .filter((u) => u.dzielnica && normName(u.gmina) === normName(form.d2d_gmina))
      .map((u) => u.dzielnica)
    : [];

  if (loading) return <div className="text-muted-foreground">Ładowanie…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zamówienia</h1>
          <p className="text-sm text-muted-foreground">Sprzedaż planowana i zrealizowana</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nowe zamówienie</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Wszystkie ({tabCount.all})</TabsTrigger>
          <TabsTrigger value="planned">Zaplanowane ({tabCount.planned})</TabsTrigger>
          <TabsTrigger value="executed">Zrealizowane ({tabCount.executed})</TabsTrigger>
          <TabsTrigger value="cancelled">Anulowane ({tabCount.cancelled})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Marża brutto z widocznych: <span className="font-semibold text-foreground">{visibleMargin.toFixed(1)}%</span>
          <span className="mx-2">•</span>
          AOV: <span className="font-semibold text-foreground">{formatCurrency(visibleAov)}</span>
        </p>
        <Button size="sm" variant="outline" onClick={() => navigate('/statystyki')} className="gap-1">
          <BarChart3 className="h-3.5 w-3.5" /> Pełny raport sprzedaży
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {tabOrders.length === 0 && <p className="p-6 text-sm text-muted-foreground">Brak zamówień w tej kategorii.</p>}
          {tabOrders.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Klient</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Płatność</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Wartość</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tabOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {o.client_name || '—'}
                      {o.is_d2d && <Badge variant="outline">D2D</Badge>}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant="outline">{typeLabel[o.type]}</Badge></TableCell>
                  <TableCell><Badge variant={o.status === 'delivered' ? 'default' : o.status === 'cancelled' ? 'destructive' : 'secondary'}>{statusLabel[o.status]}</Badge></TableCell>
                  <TableCell><Badge variant={o.payment_status === 'paid' ? 'default' : 'outline'}>{o.payment_status === 'paid' ? 'Opłacone' : 'Nieopłacone'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{o.delivery_date || '—'}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(o.total_revenue)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Edytuj" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                      {o.status === 'pending' && o.type === 'planned' && (
                        <Button size="icon" variant="ghost" title="Dostarczone" onClick={() => changeStatus(o, 'delivered')}><Truck className="h-4 w-4" /></Button>
                      )}
                      {o.status !== 'cancelled' && (
                        <Button size="icon" variant="ghost" title="Anuluj" onClick={() => changeStatus(o, 'cancelled')}><Ban className="h-4 w-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" title={o.payment_status === 'paid' ? 'Oznacz nieopłacone' : 'Oznacz opłacone'} onClick={() => changePayment(o, o.payment_status === 'paid' ? 'unpaid' : 'paid')}>
                        {o.payment_status === 'paid' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" title="Paragon PDF" onClick={() => exportPDF(o)}><FileText className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={(v) => { setDialog(v); if (!v) setEditingId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edytuj zamówienie' : 'Nowe zamówienie'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Klient *</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v, location_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Punkt odbioru</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>{locations.filter((l) => l.client_id === form.client_id).map((l) => <SelectItem key={l.id} value={l.id}>{l.point_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="planned">Planowane</SelectItem><SelectItem value="executed">Zrealizowane</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pending">Oczekuje</SelectItem><SelectItem value="delivered">Dostarczone</SelectItem><SelectItem value="cancelled">Anulowane</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Płatność</Label>
                <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="unpaid">Nieopłacone</SelectItem><SelectItem value="paid">Opłacone</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Data dostawy</Label><Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} /></div>
            <div><Label>Uwagi</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox id="d2d" checked={!!form.is_d2d} onCheckedChange={toggleD2d} />
                <Label htmlFor="d2d" className="cursor-pointer">Sprzedaż door-to-door (w rejonie)</Label>
              </div>
              {form.is_d2d && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Województwo</Label>
                      <Select value={form.d2d_woj || ''} onValueChange={(v) => setForm({ ...form, d2d_woj: v, d2d_powiat: '', d2d_gmina: '', d2d_dzielnica: '' })}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>{WOJEWODZTWA.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Powiat</Label>
                      <Select value={form.d2d_powiat || ''} onValueChange={(v) => setForm({ ...form, d2d_powiat: v, d2d_gmina: '', d2d_dzielnica: '' })} disabled={!form.d2d_woj}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>{(form.d2d_woj ? powiatyOf(form.d2d_woj) : []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Gmina</Label>
                      <Select value={form.d2d_gmina || ''} onValueChange={(v) => setForm({ ...form, d2d_gmina: v, d2d_dzielnica: '' })} disabled={!form.d2d_powiat}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>{d2dGminaOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {d2dDzielniceOptions.length > 0 && (
                    <div>
                      <Label>Dzielnica (opcjonalnie)</Label>
                      <Select value={form.d2d_dzielnica || ''} onValueChange={(v) => setForm({ ...form, d2d_dzielnica: v })}>
                        <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                        <SelectContent>{d2dDzielniceOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pozycje zamówienia</Label>
                <Button size="sm" variant="outline" onClick={addRow} className="gap-1"><Plus className="h-3 w-3" /> Dodaj</Button>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select value={r.product_id} onValueChange={(v) => updateRow(i, { product_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Produkt" /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Input type="number" value={r.quantity} onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })} /></div>
                  <div className="col-span-4"><Input type="number" step="0.01" value={r.unit_sale_price} onChange={(e) => updateRow(i, { unit_sale_price: Number(e.target.value) })} /></div>
                  <div className="col-span-1"><Button size="icon" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              ))}
              {rows.length > 0 && (
                <div className="flex justify-end pt-2 text-sm space-x-4">
                  <span className="text-muted-foreground">Netto: {formatCurrency(totals.net)}</span>
                  {tax && <span className="text-muted-foreground">VAT: {formatCurrency(vat)}</span>}
                  <span className="font-semibold">Razem: {formatCurrency(totalRevenue)}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editingId ? 'Zapisz zmiany' : 'Zapisz zamówienie'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}