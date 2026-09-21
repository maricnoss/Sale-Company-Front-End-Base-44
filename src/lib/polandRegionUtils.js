import poland from '@/data/polandRegions.json';

export const normName = (s) =>
  (s || '').toString().trim().toLowerCase()
    .replace(/^(województwo|powiat|gmina|miasto)\s+/, '')
    .replace(/\s+/g, ' ');

export const WOJEWODZTWA = Object.keys(poland.powiaty);
export const powiatyOf = (woj) => poland.powiaty[woj] || [];

export const cityHasDzielnice = (woj, powiat) => {
  const gs = (poland.gminy[woj] || {})[powiat] || [];
  const dz = (poland.dzielnice[woj] || {})[powiat] || [];
  return dz.length > 0 && gs.length === 1 && gs[0] === powiat;
};

export function leafUnits(woj, powiat) {
  const gs = (poland.gminy[woj] || {})[powiat] || [];
  if (cityHasDzielnice(woj, powiat)) {
    const city = gs[0];
    return ((poland.dzielnice[woj] || {})[powiat] || []).map((d) => ({ gmina: city, dzielnica: d }));
  }
  return gs.map((g) => ({ gmina: g, dzielnica: '' }));
}

const gminaIndex = {};
Object.entries(poland.gminy).forEach(([w, ps]) => {
  const wi = (gminaIndex[normName(w)] = gminaIndex[normName(w)] || {});
  Object.entries(ps).forEach(([p, gs]) => {
    gs.forEach((g) => {
      wi[normName(g)] = p;
    });
  });
});

export function locPowiat(loc) {
  const w = normName(loc.wojewodztwo);
  const g = normName(loc.gmina);
  return gminaIndex[w] ? gminaIndex[w][g] || null : null;
}

export function powiatFor(woj, gmina) {
  const w = normName(woj);
  return gminaIndex[w] ? gminaIndex[w][normName(gmina)] || null : null;
}

export const CYCLE_LABELS = {
  none: '',
  weekly: 'co tydzień',
  monthly: 'co miesiąc',
  quarterly: 'co kwartał',
};