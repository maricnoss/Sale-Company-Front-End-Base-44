const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CATEGORY_KEYS = ['warsztaty', 'wulkanizacja', 'czesci', 'myjnie', 'fryzjerzy', 'kosmetyka', 'tatuaze', 'gastronomia'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await db.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const kind = String(payload.kind || '');
    const name = String(payload.name || '').trim();
    if (!['wojewodztwo', 'powiat', 'gmina', 'dzielnica'].includes(kind) || !name || name.length > 100) {
      return Response.json({ error: 'Nieprawidłowe parametry' }, { status: 400 });
    }
    const wojewodztwo = String(payload.wojewodztwo || '');
    const powiat = String(payload.powiat || '');
    const gmina = String(payload.gmina || '');

    const regionKey = [kind, wojewodztwo, powiat, gmina, name].join('|').toLowerCase();

    const cached = await db.entities.RegionMarketData.filter({ region_key: regionKey });
    if (cached && cached.length > 0) {
      const rec = cached[0];
      return Response.json({
        cached: true,
        population: rec.population,
        population_year: rec.population_year,
        data: rec.data_json ? JSON.parse(rec.data_json) : {},
      });
    }

    const regionDesc = kind === 'wojewodztwo'
      ? `województwo ${name} (Polska)`
      : kind === 'powiat'
      ? `powiat ${name} w województwie ${wojewodztwo} (Polska)`
      : kind === 'gmina'
        ? `gmina ${name} w powiecie ${powiat}, województwo ${wojewodztwo} (Polska)`
        : `dzielnica ${name} w mieście ${gmina}, województwo ${wojewodztwo} (Polska)`;

    const categoryProps = {};
    for (const k of CATEGORY_KEYS) categoryProps[k] = { anyOf: [{ type: 'integer' }, { type: 'null' }] };

    const llm = await db.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Znajdź oficjalne dane statystyczne GUS (Główny Urząd Statystyczny, stat.gov.pl, Bank Danych Lokalnych) dla rejonu: ${regionDesc}.
Zwróć wyłącznie dane, które rzeczywiście znajdziesz w źródłach (GUS lub Wikipedia cytująca GUS). Nie zmyślaj liczb — gdy danej nie ma, wpisz null.
- population: liczba ludności tego rejonu wg GUS (najnowszy dostępny stan, zwykle 31 grudnia).
- population_year: rok stanu danych (np. "2023").
- categories: PRZYBLIŻONE liczby działających punktów usługowych w rejonie, ustalone przez wyszukanie w Google Maps i katalogach firm (Panorama Firm, pkt.pl, Yelp) — policz punkty widoczne w tych serwisach dla tego rejonu. Klucze:
  warsztaty (warsztaty samochodowe: mechanika, blacharstwo, lakiernictwo), wulkanizacja, czesci (sklepy z częściami samochodowymi), myjnie (myjnie samochodowe), fryzjerzy (fryzjerzy i barberzy), kosmetyka (salony kosmetyczne), tatuaze (studia tatuażu), gastronomia (restauracje, bary, kawiarnie). Gdy kategorii nie da się ustalić, wpisz null. Nie zmyślaj liczb.`,
      add_context_from_internet: true,
      model: 'gemini_3_8_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          population: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
          population_year: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          categories: { type: 'object', properties: categoryProps },
        },
        required: ['population', 'population_year', 'categories'],
      },
    });

    const populationNum = Number(llm?.population);
    const population = Number.isFinite(populationNum) && populationNum > 0 ? populationNum : null;
    const categories = llm?.categories && typeof llm.categories === 'object' ? llm.categories : {};

    const created = await db.entities.RegionMarketData.create({
      region_key: regionKey,
      kind,
      name,
      wojewodztwo,
      powiat,
      gmina,
      population,
      population_year: llm?.population_year || '',
      data_json: JSON.stringify(categories),
    });

    return Response.json({
      cached: false,
      population: created.population,
      population_year: created.population_year,
      data: categories,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}