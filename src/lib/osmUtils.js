const NOMINATIM = 'https://nominatim.openstreetmap.org';

export async function osmSearch(query) {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=pl&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Błąd wyszukiwania OSM');
  return res.json();
}

export async function osmReverse(lat, lng) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Błąd geokodowania OSM');
  const data = await res.json();
  return data && data.address ? data : null;
}

export function regionFromOsm(addr) {
  return {
    wojewodztwo: addr.state || '',
    gmina: addr.municipality || addr.city || addr.town || addr.village || '',
    dzielnica: addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || '',
  };
}

export function osmEmbedUrl(lat, lng) {
  const d = 0.005;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmLink(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

export function googleNavUrl({ lat, lng, address }) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address || '');
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}