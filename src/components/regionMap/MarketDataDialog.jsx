import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Info, Database, Store } from 'lucide-react';
import { fetchRegionMarketData, MARKET_CATEGORIES } from '@/lib/marketData';
import { formatCurrency } from '@/lib/crmUtils';

export default function MarketDataDialog({ scope, d2dStats, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!scope) return;
    setLoading(true);
    setData(null);
    setFailed(false);
    fetchRegionMarketData({
      kind: scope.kind,
      name: scope.name,
      wojewodztwo: scope.wojewodztwo || '',
      powiat: scope.powiat || '',
      gmina: scope.parentName || '',
    })
      .then((d) => setData(d))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [scope]);

  const kindLabel = { wojewodztwo: 'województwo', powiat: 'powiat', gmina: 'gmina', dzielnica: 'dzielnica' };

  return (
    <Dialog open={!!scope} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {scope && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Dane rynkowe — {scope.name}
              </DialogTitle>
              <DialogDescription>
                Poziom: {kindLabel[scope.kind]} • dane GUS zapisane na stałe (bez aktualizacji)
              </DialogDescription>
            </DialogHeader>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Pobieram i zapisuję dane z GUS…
              </div>
            )}
            {failed && <p className="py-6 text-center text-sm text-muted-foreground">Nie udało się pobrać danych. Spróbuj ponownie za chwilę.</p>}
            {data && (
              <div className="space-y-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Liczba ludności (GUS)</p>
                  <p className="text-xl font-semibold">
                    {data.population ? `${data.population.toLocaleString('pl-PL')} os.` : '—'}
                    {data.population && data.population_year && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">stan {data.population_year}</span>
                    )}
                  </p>
                </div>
                <p className="pt-1 text-xs text-muted-foreground">Lokale branżowe — przybliżone liczby wg Google Maps i katalogów firm</p>
                <div className="space-y-1.5">
                  {MARKET_CATEGORIES.map((c) => {
                    const v = data.data?.[c.key];
                    return (
                      <div key={c.key} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5">
                        <p className="min-w-0 flex-1 truncate text-sm" title={c.label}>{c.label}</p>
                        <Badge variant="secondary">{v == null ? '—' : v}</Badge>
                      </div>
                    );
                  })}
                </div>
                {d2dStats && (
                  <div className="rounded-lg border p-3">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Store className="h-3 w-3" /> Sprzedaż door-to-door w rejonie
                    </p>
                    {d2dStats.count > 0 ? (
                      <p className="text-sm font-semibold">
                        {formatCurrency(d2dStats.revenue)} <span className="font-normal text-muted-foreground">• {d2dStats.count} {d2dStats.count === 1 ? 'zamówienie' : 'zamówień'}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Brak zrealizowanej sprzedaży D2D w tym rejonie</p>
                    )}
                  </div>
                )}
                <p className="flex items-start gap-1 text-xs text-muted-foreground">
                  <Database className="mt-0.5 h-3 w-3 shrink-0" />
                  {data.cached
                    ? 'Dane GUS zapisane na stałe przy pierwszym pobraniu — kolejne otwarcia nie pobierają nic od nowa.'
                    : 'Pobrano dane GUS i zapisano je na stałe — bez automatycznych aktualizacji.'}
                </p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}