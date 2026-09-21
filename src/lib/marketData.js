const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


export const MARKET_CATEGORIES = [
  { key: 'warsztaty', label: 'Warsztaty samochodowe (mechanika, blacharstwo, lakiernictwo)' },
  { key: 'wulkanizacja', label: 'Wulkanizacja / opony' },
  { key: 'czesci', label: 'Sklepy motoryzacyjne / części' },
  { key: 'myjnie', label: 'Myjnie samochodowe' },
  { key: 'fryzjerzy', label: 'Fryzjerzy i barberzy' },
  { key: 'kosmetyka', label: 'Salony kosmetyczne' },
  { key: 'tatuaze', label: 'Studio tatuażu' },
  { key: 'gastronomia', label: 'Lokale gastronomiczne (restauracje, bary, kawiarnie)' },
];

export async function fetchRegionMarketData({ kind, name, wojewodztwo, powiat, gmina }) {
  const res = await db.functions.invoke('getRegionMarketData', { kind, name, wojewodztwo, powiat, gmina });
  return res.data;
}