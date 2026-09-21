import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useSettings, saveSettings } from '@/lib/useSettings';

export default function Settings() {
  const { toast } = useToast();
  const settings = useSettings();
  const [form, setForm] = useState({ workspace_name: '', tax_active: false, default_vat_rate: 23 });

  useEffect(() => {
    if (settings) setForm({ workspace_name: settings.workspace_name || '', tax_active: settings.tax_active, default_vat_rate: settings.default_vat_rate || 23 });
  }, [settings]);

  const save = async () => {
    await saveSettings(form);
    toast({ title: 'Ustawienia zapisane' });
  };

  if (!settings) return <div className="text-muted-foreground">Ładowanie…</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ustawienia</h1>
        <p className="text-sm text-muted-foreground">Profil firmy i podatki</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil firmy</CardTitle>
          <CardDescription>Nazwa wyświetlana w nawigacji i na dokumentach</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nazwa firmy</Label><Input value={form.workspace_name} onChange={(e) => setForm({ ...form, workspace_name: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Podatki (VAT)</CardTitle>
          <CardDescription>Włącz, aby kalkulować VAT i pokazywać wartości netto/brutto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Aktywny VAT</p>
              <p className="text-xs text-muted-foreground">Gdy wyłączony — ceny płaskie bez podatku</p>
            </div>
            <Switch checked={form.tax_active} onCheckedChange={(v) => setForm({ ...form, tax_active: v })} />
          </div>
          {form.tax_active && (
            <div><Label>Domyślna stawka VAT (%)</Label><Input type="number" value={form.default_vat_rate} onChange={(e) => setForm({ ...form, default_vat_rate: Number(e.target.value) })} /></div>
          )}
        </CardContent>
      </Card>

      <Button onClick={save}>Zapisz ustawienia</Button>
    </div>
  );
}