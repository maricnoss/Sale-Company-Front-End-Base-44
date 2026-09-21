import { ExternalLink } from 'lucide-react';
import { osmEmbedUrl, osmLink } from '@/lib/osmUtils';

export default function OsmMapPreview({ lat, lng, height = 180 }) {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isNaN(la) || Number.isNaN(ln)) return null;
  return (
    <div className="space-y-1">
      <iframe
        title="Podgląd mapy OpenStreetMap"
        src={osmEmbedUrl(la, ln)}
        className="w-full rounded-md border"
        style={{ height }}
        loading="lazy"
      />
      <a
        href={osmLink(la, ln)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
      >
        <ExternalLink className="h-3 w-3" /> Otwórz w OpenStreetMap
      </a>
    </div>
  );
}