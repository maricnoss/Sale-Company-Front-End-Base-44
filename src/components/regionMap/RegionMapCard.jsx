const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronRight, Loader2, Map, BarChart3 } from 'lucide-react';
import { todayISO } from '@/lib/crmUtils';
import {
  WOJEWODZTWA, powiatyOf, leafUnits, cityHasDzielnice, normName, locPowiat, CYCLE_LABELS,
} from '@/lib/polandRegionUtils';
import RegionUnitCard from '@/components/regionMap/RegionUnitCard';
import VisitDateDialog from '@/components/regionMap/VisitDateDialog';
import MarketDataDialog from '@/components/regionMap/MarketDataDialog';

const CYCLE_OPTIONS = [
  { value: 'none', label: 'Jednorazowo' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'quarterly', label: 'Co kwartał' },
];

const tomorrowISO = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function RegionMapCard() {
  const [locations, setLocations] = useState([]);
  const [visits, setVisits] = useState([]);
  const [orders, setOrders] = useState([]);
  const [marketStats, setMarketStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [woj, setWoj] = useState(null);
  const [powiat, setPowiat] = useState(null);
  const [period, setPeriod] = useState('month');
  const [planUnit, setPlanUnit] = useState(null);
  const [planDate, setPlanDate] = useState('');
  const [planCycle, setPlanCycle] = useState('none');
  const [visitUnit, setVisitUnit] = useState(null);
  const [marketScope, setMarketScope] = useState(null);

  useEffect(() => {
    (async () => {
      const [l, v, o] = await Promise.all([
        db.entities.Location.list('-created_date', 1000),
        db.entities.RegionVisit.list('-visit_date', 1000),
        db.entities.Order.list('-created_date', 500),
      ]);
      setLocations(l);
      setVisits(v);
      setOrders(o);
      setLoading(false);
    })();
  }, []);

  const cutoff = useMemo(() => {
    const d = new Date();
    if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    if (period === 'q') return new Date(d.getFullYear(), d.getMonth() - 3, 1).toISOString().slice(0, 10);
    if (period === 'year') return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
    return '';
  }, [period]);

  const unitKey = (w, g, d) => `${normName(w)}|${normName(g)}|${normName(d)}`;
  const today = todayISO();

  const lastVisitByKey = useMemo(() => {
    const map = {};
    visits
      .filter((v) => (v.status || 'done') === 'done' && (v.visit_date || '') >= cutoff)
      .forEach((v) => {
        const k = unitKey(v.wojewodztwo, v.gmina, v.dzielnica);
        if (!map[k] || v.visit_date > map[k]) map[k] = v.visit_date;
      });
    return map;
  }, [visits, cutoff]);

  const plannedByKey = useMemo(() => {
    const counts = {};
    const upcoming = {};
    const any = {};
    visits
      .filter((v) => v.status === 'planned')
      .forEach((v) => {
        const k = unitKey(v.wojewodztwo, v.gmina, v.dzielnica);
        counts[k] = (counts[k] || 0) + 1;
        const d = v.visit_date || '';
        if (d >= today) {
          if (!upcoming[k] || d < upcoming[k]) upcoming[k] = d;
        }
        if (!any[k] || d < any[k]) any[k] = d;
      });
    const map = {};
    Object.keys(counts).forEach((k) => {
      map[k] = { date: upcoming[k] || any[k], count: counts[k] };
    });
    return map;
  }, [visits, today]);

  const isRealizedD2d = (o) => o.is_d2d && (o.type === 'executed' || o.status === 'delivered') && o.status !== 'cancelled';

  const d2dByKey = useMemo(() => {
    const map = {};
    orders.filter(isRealizedD2d).forEach((o) => {
      const k = `${normName(o.d2d_woj)}|${normName(o.d2d_gmina)}|${normName(o.d2d_dzielnica || '')}`;
      map[k] = map[k] || { revenue: 0, count: 0 };
      map[k].revenue += o.total_revenue || 0;
      map[k].count += 1;
    });
    return map;
  }, [orders]);

  const d2dStatsFor = (scope) => {
    const match = scope.kind === 'wojewodztwo'
      ? (o) => normName(o.d2d_woj) === normName(scope.name)
      : scope.kind === 'powiat'
      ? (o) => normName(o.d2d_powiat) === normName(scope.name)
      : scope.kind === 'gmina'
        ? (o) => normName(o.d2d_gmina) === normName(scope.name)
        : (o) => normName(o.d2d_gmina) === normName(scope.parentName) && normName(o.d2d_dzielnica) === normName(scope.name);
    const sel = orders.filter((o) => isRealizedD2d(o) && match(o));
    return { revenue: sel.reduce((s, o) => s + (o.total_revenue || 0), 0), count: sel.length };
  };

  const { wojClients, powiatClients, unitClients } = useMemo(() => {
    const wc = {};
    const pc = {};
    const uc = {};
    locations.forEach((l) => {
      const w = normName(l.wojewodztwo);
      const g = normName(l.gmina);
      if (!w || !g) return;
      (uc[`${w}|${g}|`] = uc[`${w}|${g}|`] || new Set()).add(l.client_id);
      const d = normName(l.dzielnica);
      if (d) (uc[`${w}|${g}|${d}`] = uc[`${w}|${g}|${d}`] || new Set()).add(l.client_id);
      const p = locPowiat(l);
      if (!p) return;
      (wc[w] = wc[w] || new Set()).add(l.client_id);
      (pc[`${w}|${normName(p)}`] = pc[`${w}|${normName(p)}`] || new Set()).add(l.client_id);
    });
    return { wojClients: wc, powiatClients: pc, unitClients: uc };
  }, [locations]);

  const powiatStats = (w, p) => {
    const units = leafUnits(w, p);
    return {
      total: units.length,
      visited: units.filter((u) => lastVisitByKey[unitKey(w, u.gmina, u.dzielnica)]).length,
      planned: units.filter((u) => plannedByKey[unitKey(w, u.gmina, u.dzielnica)]).length,
    };
  };

  const wojStats = (w) => {
    let total = 0;
    let visited = 0;
    let planned = 0;
    powiatyOf(w).forEach((p) => {
      const s = powiatStats(w, p);
      total += s.total;
      visited += s.visited;
      planned += s.planned;
    });
    return { total, visited, planned };
  };

  const confirmVisited = async (date) => {
    const u = visitUnit;
    if (!u) return;
    const created = await db.entities.RegionVisit.create({
      wojewodztwo: u.woj,
      powiat: u.powiat,
      gmina: u.gmina,
      dzielnica: u.dzielnica,
      visit_date: date,
      status: 'done',
      cycle: 'none',
    });
    setVisits([...visits, created]);
    setVisitUnit(null);
  };

  const openPlan = (w, p, unit) => {
    setPlanDate(tomorrowISO());
    setPlanCycle('none');
    setPlanUnit({ woj: w, powiat: p, gmina: unit.gmina, dzielnica: unit.dzielnica });
  };

  const savePlan = async () => {
    if (!planDate || !planUnit) return;
    const created = await db.entities.RegionVisit.create({
      wojewodztwo: planUnit.woj,
      powiat: planUnit.powiat,
      gmina: planUnit.gmina,
      dzielnica: planUnit.dzielnica,
      visit_date: planDate,
      status: 'planned',
      cycle: planCycle,
    });
    setVisits([...visits, created]);
    setPlanUnit(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" /> Mapa rejonów Polski
          </CardTitle>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Ten miesiąc</SelectItem>
              <SelectItem value="q">Ostatnie 3 miesiące</SelectItem>
              <SelectItem value="year">Ten rok</SelectItem>
              <SelectItem value="all">Wszystko</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>
          Planuj wizyty w gminach i dzielnicach (kolejne plany nie usuwają poprzednich), a odwiedzone rejony odhaczaj z datą.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-1 pt-1 text-sm text-muted-foreground">
          <button className="hover:text-foreground" onClick={() => { setWoj(null); setPowiat(null); }}>
            Polska
          </button>
          {woj && (
            <>
              <ChevronRight className="h-4 w-4" />
              <button className="hover:text-foreground" onClick={() => setPowiat(null)}>
                {woj}
              </button>
            </>
          )}
          {woj && powiat && (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-foreground">{powiat}</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!woj && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {WOJEWODZTWA.map((w) => {
              const s = wojStats(w);
              return (
                <RegionUnitCard
                  key={w}
                  title={w}
                  clients={(wojClients[normName(w)] || new Set()).size}
                  visitedCount={s.visited}
                  totalCount={s.total}
                  plannedCount={s.planned}
                  unitLabel="gmin"
                  onOpen={() => setWoj(w)}
                />
              );
            })}
          </div>
        )}
        {woj && !powiat && (
          <>
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => {
                  const s = { kind: 'wojewodztwo', name: woj, wojewodztwo: woj };
                  setMarketScope(s);
                  setMarketStats(d2dStatsFor(s));
                }}
              >
                <BarChart3 className="h-3 w-3" /> Dane rynkowe województwa
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {powiatyOf(woj).map((p) => {
              const s = powiatStats(woj, p);
              return (
                <RegionUnitCard
                  key={p}
                  title={p}
                  clients={(powiatClients[`${normName(woj)}|${normName(p)}`] || new Set()).size}
                  visitedCount={s.visited}
                  totalCount={s.total}
                  plannedCount={s.planned}
                  unitLabel={cityHasDzielnice(woj, p) ? 'dzielnic' : 'gmin'}
                  onOpen={() => setPowiat(p)}
                />
              );
            })}
            </div>
          </>
        )}
        {woj && powiat && (
          <>
            <div className="mb-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => {
                  const s = { kind: 'powiat', name: powiat, wojewodztwo: woj };
                  setMarketScope(s);
                  setMarketStats(d2dStatsFor(s));
                }}
              >
                <BarChart3 className="h-3 w-3" /> Dane rynkowe powiatu
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {leafUnits(woj, powiat).map((u) => {
                const k = unitKey(woj, u.gmina, u.dzielnica);
                return (
                  <RegionUnitCard
                    key={k}
                    isLeaf
                    title={u.dzielnica || u.gmina}
                    clients={(unitClients[k] || new Set()).size}
                    lastVisit={lastVisitByKey[k]}
                    visitedToday={lastVisitByKey[k] === today}
                    planned={plannedByKey[k]}
                    d2dRevenue={d2dByKey[k]?.revenue || 0}
                    onToggle={() => setVisitUnit({ woj, powiat, gmina: u.gmina, dzielnica: u.dzielnica })}
                    onPlan={() => openPlan(woj, powiat, u)}
                    onMarket={() => {
                      const s = u.dzielnica
                        ? { kind: 'dzielnica', name: u.dzielnica, parentName: u.gmina, wojewodztwo: woj, powiat }
                        : { kind: 'gmina', name: u.gmina, wojewodztwo: woj, powiat };
                      setMarketScope(s);
                      setMarketStats(d2dStatsFor(s));
                    }}
                  />
                );
              })}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={!!planUnit} onOpenChange={(o) => !o && setPlanUnit(null)}>
        <DialogContent className="sm:max-w-sm">
          {planUnit && (
            <>
              <DialogHeader>
                <DialogTitle>Planowanie wizyty</DialogTitle>
                <DialogDescription>
                  {planUnit.woj} • {planUnit.powiat} • {planUnit.dzielnica ? `${planUnit.dzielnica} — ` : ''}{planUnit.gmina}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="plan-date">Data planowanej wizyty</Label>
                  <Input id="plan-date" type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Powtarzanie</Label>
                  <Select value={planCycle} onValueChange={setPlanCycle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CYCLE_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {planCycle !== 'none' && (
                    <p className="text-xs text-muted-foreground">
                      Po odhaczeniu wizyty w Planerze D2D automatycznie zaplanujemy kolejną ({CYCLE_LABELS[planCycle]}).
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Możesz zaplanować kolejne terminy bez usuwania tego planu — edycja i usuwanie w zakładce Planowane wizyty.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={savePlan} disabled={!planDate}>Zaplanuj</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <VisitDateDialog
        open={!!visitUnit}
        title="Kiedy odbyła się wizyta?"
        description={visitUnit ? `${visitUnit.woj} • ${visitUnit.dzielnica ? `${visitUnit.dzielnica} — ` : ''}${visitUnit.gmina}` : ''}
        onConfirm={confirmVisited}
        onClose={() => setVisitUnit(null)}
      />

      <MarketDataDialog
        scope={marketScope}
        d2dStats={marketStats}
        onClose={() => { setMarketScope(null); setMarketStats(null); }}
      />
    </Card>
  );
}