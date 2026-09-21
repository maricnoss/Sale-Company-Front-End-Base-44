import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { osmSearch, regionFromOsm } from '@/lib/osmUtils';
import { Search, Loader2 } from 'lucide-react';

export default function AddressSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setResults(await osmSearch(q.trim()));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const pick = (r) => {
    setResults(null);
    setQ('');
    onPick({
      full_address: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      ...regionFromOsm(r.address || {}),
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="Szukaj adresu (OpenStreetMap)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
        />
        <Button variant="outline" onClick={search} disabled={busy} className="gap-1 whitespace-nowrap">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Szukaj
        </Button>
      </div>
      {results && (results.length === 0 ? (
        <p className="text-xs text-muted-foreground">Brak wyników</p>
      ) : (
        <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
          {results.map((r) => (
            <button
              key={r.place_id}
              onClick={() => pick(r)}
              className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
            >
              {r.display_name}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}