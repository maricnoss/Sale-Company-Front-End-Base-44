const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, daysSince } from '@/lib/crmUtils';
import { CYCLE_LABELS } from '@/lib/polandRegionUtils';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Wallet, Receipt, AlertTriangle, Moon, PackageX, Plus, UserPlus, CalendarClock } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [o, p, c, v] = await Promise.all([
        db.entities.Order.list('-created_date', 500),
        db.entities.Product.list('-created_date', 500),
        db.entities.Client.list('-created_date', 500),
        db.entities.RegionVisit.list('-visit_date', 1000),
      ]);
      setOrders(o); setProducts(p); setClients(c); setVisits(v);
      setItems(await db.entities.OrderItem.list('-created_date', 2000));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground">Ładowanie pulpitu…</div>;

  const now = new Date();
  const inPeriod = (d) => {
    const date = new Date(d);
    if (period === 'today') return date.toDateString() === now.toDateString();
    if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    return date.getFullYear() === now.getFullYear();
  };
  const sold = orders.filter((o) => (o.type === 'executed' || o.status === 'delivered') && o.status !== 'cancelled');
  const filtered = sold.filter((o) => inPeriod(o.delivery_date || o.created_date));
  const revenue = filtered.reduce((s, o) => s + (o.total_revenue || 0), 0);
  const profit = filtered.reduce((s, o) => s + (o.total_profit || 0), 0);
  const avgValue = filtered.length ? revenue / filtered.length : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const plannedVisits = visits
    .filter((v) => v.status === 'planned' && (v.visit_date || '') >= todayStr)
    .sort((a, b) => (a.visit_date || '').localeCompare(b.visit_date || ''))
    .slice(0, 3);

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));

  const soldItemFilter = (it) => {
    const o = orders.find((ord) => ord.id === it.order_id);
    return o && (o.type === 'executed' || o.status === 'delivered') && o.status !== 'cancelled' && inPeriod(o.delivery_date || o.created_date);
  };
  const prodQty = {};
  items.filter(soldItemFilter).forEach((it) => {
    prodQty[it.product_id] = (prodQty[it.product_id] || 0) + (it.quantity || 0);
  });
  const bestsellers = Object.entries(prodQty).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, q]) => ({ name: productsById[id]?.name || 'Usunięty', qty: q }));

  const deadStock = products.filter((p) => (p.physical_stock || 0) > 0 && daysSince(p.last_delivery_date) > 60);

  const clientRev = {};
  filtered.forEach((o) => { clientRev[o.client_id] = (clientRev[o.client_id] || 0) + (o.total_revenue || 0); });
  const ranking = Object.entries(clientRev).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, r]) => ({ name: clientsById[id]?.company_name || 'Usunięty', rev: r }));

  const lastOrder = {};
  orders.forEach((o) => {
    const d = new Date(o.delivery_date || o.created_date);
    if (!lastOrder[o.client_id] || d > lastOrder[o.client_id]) lastOrder[o.client_id] = d;
  });
  const sleepy = clients.filter((c) => !lastOrder[c.id] || daysSince(lastOrder[c.id]) > 30);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pulpit</h1>
          <p className="text-sm text-muted-foreground">Kluczowe wskaźniki i raporty sprzedaży</p>
        </div>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="today">Dzień</TabsTrigger>
            <TabsTrigger value="month">Miesiąc</TabsTrigger>
            <TabsTrigger value="year">Rok</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/zamowienia?nowe=1')} className="gap-2"><Plus className="h-4 w-4" /> Nowe zamówienie</Button>
        <Button variant="outline" onClick={() => navigate('/klienci?nowy=1')} className="gap-2"><UserPlus className="h-4 w-4" /> Nowy klient</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Przychód</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCurrency(revenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Zysk</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCurrency(profit)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Śr. wartość zamówienia</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{formatCurrency(avgValue)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Najbliższe planowane wizyty</CardTitle>
          <CardDescription>3 najbliższe gminy i dzielnice zaplanowane na mapie rejonów</CardDescription>
        </CardHeader>
        <CardContent>
          {plannedVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Brak zaplanowanych wizyt — oznacz je na mapie rejonów w{' '}
              <button className="underline" onClick={() => navigate('/trasy')}>planerze tras</button>.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {plannedVisits.map((v) => (
                <div key={v.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium truncate">{v.dzielnica ? `${v.dzielnica} (${v.gmina})` : v.gmina}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.wojewodztwo}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="default">{v.visit_date}</Badge>
                    {v.cycle && v.cycle !== 'none' && <Badge variant="secondary">{CYCLE_LABELS[v.cycle]}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 Bestsellerów</CardTitle><CardDescription>Najbardziej sprzedawane produkty</CardDescription></CardHeader>
          <CardContent>
            {bestsellers.length === 0 ? <p className="text-sm text-muted-foreground">Brak danych</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Produkt</TableHead><TableHead className="text-right">Szt.</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bestsellers.map((b, i) => (
                    <TableRow key={i}><TableCell>{b.name}</TableCell><TableCell className="text-right">{b.qty}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><PackageX className="h-4 w-4" /> Leżący towar</CardTitle><CardDescription>Stan dodatni, ostatnia dostawa ponad 60 dni temu</CardDescription></CardHeader>
          <CardContent>
            {deadStock.length === 0 ? <p className="text-sm text-muted-foreground">Brak leżącego towaru</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Produkt</TableHead><TableHead className="text-right">Stan</TableHead><TableHead className="text-right">Dni</TableHead></TableRow></TableHeader>
                <TableBody>
                  {deadStock.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right">{p.physical_stock}</TableCell>
                      <TableCell className="text-right">{daysSince(p.last_delivery_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ranking klientów</CardTitle><CardDescription>Wg przychodu</CardDescription></CardHeader>
          <CardContent>
            {ranking.length === 0 ? <p className="text-sm text-muted-foreground">Brak danych</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Klient</TableHead><TableHead className="text-right">Przychód</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ranking.map((r, i) => (
                    <TableRow key={i}><TableCell>{r.name}</TableCell><TableCell className="text-right">{formatCurrency(r.rev)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Moon className="h-4 w-4" /> Śpiący klienci</CardTitle><CardDescription>Brak zamówień od 30 dni</CardDescription></CardHeader>
          <CardContent>
            {sleepy.length === 0 ? <p className="text-sm text-muted-foreground">Brak śpiących klientów</p> : (
              <div className="flex flex-wrap gap-2">
                {sleepy.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />{c.company_name}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}