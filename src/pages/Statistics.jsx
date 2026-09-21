const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import KpiTile from '@/components/statistics/KpiTile';
import SalesTrendChart from '@/components/statistics/SalesTrendChart';
import AgingBarChart from '@/components/statistics/AgingBarChart';
import RegionPieChart from '@/components/statistics/RegionPieChart';
import FinanceBarChart from '@/components/statistics/FinanceBarChart';
import { formatCurrency, daysSince } from '@/lib/crmUtils';
import { isRealized, periodRange, previousRange, orderDate, inRange, marginFromItems, agingBuckets } from '@/lib/salesStats';
import {
  TrendingUp, Percent, Repeat2, Target, Boxes, Timer, PackageX, Warehouse,
  HeartHandshake, UserPlus, Users, Landmark, Hourglass, Wallet, Truck,
} from 'lucide-react';

export default function Statistics() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState({ from: '', to: '' });

  useEffect(() => {
    (async () => {
      const [o, p, c, l, v] = await Promise.all([
        db.entities.Order.list('-created_date', 500),
        db.entities.Product.list('-created_date', 500),
        db.entities.Client.list('-created_date', 500),
        db.entities.Location.list('-created_date', 1000),
        db.entities.RegionVisit.list('-visit_date', 1000),
      ]);
      setOrders(o); setProducts(p); setClients(c); setLocations(l); setVisits(v);
      setItems(await db.entities.OrderItem.list('-created_date', 3000));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground">Ładowanie statystyk…</div>;

  const range = periodRange(period, custom);
  const realizedIn = orders.filter((o) => isRealized(o) && inRange(orderDate(o), range));
  const realizedAll = orders.filter(isRealized);

  // --- Sprzedaż ---
  const revenue = realizedIn.reduce((s, o) => s + (o.total_revenue || 0), 0);
  const profit = realizedIn.reduce((s, o) => s + (o.total_profit || 0), 0);
  const prev = previousRange(range);
  const prevRevenue = orders
    .filter((o) => isRealized(o) && inRange(orderDate(o), prev))
    .reduce((s, o) => s + (o.total_revenue || 0), 0);
  const momPct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;
  const aov = realizedIn.length ? revenue / realizedIn.length : 0;
  const marginPct = marginFromItems(items, realizedIn.map((o) => o.id));
  const visitsDone = visits.filter((v) => (v.status || 'done') === 'done' && v.visit_date && inRange(new Date(`${v.visit_date}T12:00:00`), range));
  const conversion = visitsDone.length ? (realizedIn.length / visitsDone.length) * 100 : null;

  const groupByMonth = range.to.getTime() - range.from.getTime() > 92 * 86400000;
  const keyOf = (d) => (groupByMonth ? d.toISOString().slice(0, 7) : d.toISOString().slice(5, 10));
  const trend = {};
  realizedIn.forEach((o) => {
    const k = keyOf(orderDate(o));
    trend[k] = trend[k] || { label: k, revenue: 0, profit: 0 };
    trend[k].revenue += o.total_revenue || 0;
    trend[k].profit += o.total_profit || 0;
  });
  const trendData = Object.values(trend).sort((a, b) => a.label.localeCompare(b.label));

  // --- Magazyn ---
  const realizedIds = new Set(realizedIn.map((o) => o.id));
  let cogs = 0;
  items.filter((it) => realizedIds.has(it.order_id)).forEach((it) => {
    cogs += (it.quantity || 0) * (it.unit_purchase_cost || 0);
  });
  const inventoryValue = products.reduce((s, p) => s + (p.physical_stock || 0) * (p.purchase_cost || 0), 0);
  const turnover = inventoryValue > 0 ? cogs / inventoryValue : null;
  const deliveredDated = orders.filter((o) => o.status === 'delivered' && o.delivered_date && inRange(orderDate(o), range));
  const onTime = deliveredDated.filter((o) => (o.delivered_date || '') <= (o.delivery_date || '9999')).length;
  const otifPct = deliveredDated.length ? (onTime / deliveredDated.length) * 100 : null;
  const aging = agingBuckets(products);
  const staleValue = aging[2].value + aging[3].value;

  // --- Klienci ---
  const revByClient = {};
  const ordersByClient = {};
  realizedAll.forEach((o) => {
    revByClient[o.client_id] = (revByClient[o.client_id] || 0) + (o.total_revenue || 0);
    ordersByClient[o.client_id] = (ordersByClient[o.client_id] || 0) + 1;
  });
  const clientCount = Object.keys(ordersByClient).length;
  const ltv = clientCount ? Object.values(revByClient).reduce((s, v) => s + v, 0) / clientCount : 0;
  const retentionPct = clientCount
    ? (Object.values(ordersByClient).filter((n) => n > 1).length / clientCount) * 100
    : 0;
  const newClients = clients.filter((c) => inRange(new Date(c.created_date), range)).length;
  const activeClients = new Set(realizedIn.map((o) => o.client_id)).size;
  const locationsById = Object.fromEntries(locations.map((l) => [l.id, l]));
  const revByWoj = {};
  realizedIn.forEach((o) => {
    const w = locationsById[o.location_id]?.wojewodztwo || 'Bez rejonu';
    revByWoj[w] = (revByWoj[w] || 0) + (o.total_revenue || 0);
  });
  const pieData = Object.entries(revByWoj)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // --- Finanse ---
  const ros = revenue ? (profit / revenue) * 100 : 0;
  const unpaid = realizedIn.filter((o) => o.payment_status !== 'paid');
  const unpaidSum = unpaid.reduce((s, o) => s + (o.total_revenue || 0), 0);
  const avgDebtAge = unpaid.length
    ? unpaid.reduce((s, o) => s + daysSince(o.delivery_date || o.created_date), 0) / unpaid.length
    : null;
  const pipeline = orders.filter((o) => o.type === 'planned' && o.status === 'pending');
  const pipelineSum = pipeline.reduce((s, o) => s + (o.total_revenue || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Statystyki</h1>
        <p className="text-sm text-muted-foreground">Kluczowe wskaźniki KPI firmy handlowej</p>
      </div>

      <div className="space-y-2">
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="today">Dziś</TabsTrigger>
            <TabsTrigger value="week">Tydzień</TabsTrigger>
            <TabsTrigger value="month">Miesiąc</TabsTrigger>
            <TabsTrigger value="quarter">Kwartał</TabsTrigger>
            <TabsTrigger value="year">Rok</TabsTrigger>
            <TabsTrigger value="custom">Zakres</TabsTrigger>
          </TabsList>
        </Tabs>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-40" />
            <span className="text-sm text-muted-foreground">do</span>
            <Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-40" />
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sprzedaż</CardTitle>
          <CardDescription>Zrealizowane zamówienia w wybranym okresie</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile icon={TrendingUp} label="AOV (śr. wartość zamówienia)" value={formatCurrency(aov)} sub={`${realizedIn.length} zamówień`} />
            <KpiTile icon={Percent} label="Marża brutto" value={`${marginPct.toFixed(1)}%`} sub="z pozycji zamówień" />
            <KpiTile
              icon={Repeat2}
              label="Dynamika okresu"
              value={momPct == null ? '—' : `${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%`}
              sub={momPct == null ? 'brak danych z poprzedniego okresu' : 'vs poprzedni okres'}
            />
            <KpiTile
              icon={Target}
              label="Konwersja D2D"
              value={conversion == null ? '—' : `${conversion.toFixed(0)}%`}
              sub={`${realizedIn.length} zamówień / ${visitsDone.length} wizyt`}
            />
          </div>
          <SalesTrendChart data={trendData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Magazyn</CardTitle>
          <CardDescription>Rotacja, dostawy na czas i starzenie się zapasów</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              icon={Boxes}
              label="Obrót zapasami"
              value={turnover == null ? '—' : `${turnover.toFixed(2)}x`}
              sub={`COGS ${formatCurrency(cogs)} / magazyn ${formatCurrency(inventoryValue)}`}
            />
            <KpiTile
              icon={Timer}
              label="OTIF (na czas)"
              value={otifPct == null ? '—' : `${otifPct.toFixed(0)}%`}
              sub={`${onTime}/${deliveredDated.length} dostaw z datą realizacji`}
            />
            <KpiTile icon={PackageX} label="Leżący towar (91+ dni)" value={formatCurrency(staleValue)} sub="wartość zakupowa zapasów" />
            <KpiTile icon={Warehouse} label="Wartość magazynu" value={formatCurrency(inventoryValue)} sub={`${products.filter((p) => (p.physical_stock || 0) > 0).length} produktów`} />
          </div>
          <AgingBarChart data={aging} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Klienci</CardTitle>
          <CardDescription>Wartość klientów i podział sprzedaży wg województw</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile icon={HeartHandshake} label="LTV (śr. przychód/klienta)" value={formatCurrency(ltv)} sub={`${clientCount} klientów`} />
            <KpiTile icon={Users} label="Powracalność" value={`${retentionPct.toFixed(0)}%`} sub="klienci z więcej niż 1 zamówieniem" />
            <KpiTile icon={UserPlus} label="Nowi klienci" value={newClients} sub="w wybranym okresie" />
            <KpiTile icon={Truck} label="Aktywni klienci" value={activeClients} sub="z zamówieniem w okresie" />
          </div>
          <RegionPieChart data={pieData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Finanse</CardTitle>
          <CardDescription>Rentowność, należności i planowana sprzedaż</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile icon={Percent} label="ROS (rentowność sprzedaży)" value={`${ros.toFixed(1)}%`} sub="zysk / przychód" />
            <KpiTile
              icon={Hourglass}
              label="Śr. wiek należności (DSO)"
              value={avgDebtAge == null ? '—' : `${Math.round(avgDebtAge)} dni`}
              sub={`${unpaid.length} nieopłaconych zamówień`}
            />
            <KpiTile icon={Wallet} label="Do zapłaty" value={formatCurrency(unpaidSum)} sub="zrealizowane, nieopłacone" />
            <KpiTile icon={Landmark} label="Pipeline (planowane)" value={formatCurrency(pipelineSum)} sub={`${pipeline.length} zamówień oczekujących`} />
          </div>
          <FinanceBarChart data={trendData} />
        </CardContent>
      </Card>
    </div>
  );
}