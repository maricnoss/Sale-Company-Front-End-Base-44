const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';

let cache = null;

export function useSettings() {
  const [settings, setSettings] = useState(cache);
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (cache) { setSettings(cache); return; }
      const list = await db.entities.Settings.list();
      if (list.length === 0) {
        cache = await db.entities.Settings.create({
          workspace_name: 'Moja firma',
          tax_active: false,
          default_vat_rate: 23,
        });
      } else {
        cache = list[0];
      }
      if (mounted) setSettings(cache);
    }
    load();
    return () => { mounted = false; };
  }, []);
  return settings;
}

export async function saveSettings(patch) {
  if (!cache) return null;
  cache = await db.entities.Settings.update(cache.id, patch);
  return cache;
}