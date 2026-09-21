const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useSettings } from '@/lib/useSettings';
import { formatCurrency, netToGross, vatAmount, daysSince } from '@/lib/crmUtils';
import { Plus, Pencil, Trash2, PackageX, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Products() {
  const { toast } = useToast();
  const settings = useSettings();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, edit: null });
  const [agingOnly, setAgingOnly] = useState(false);
  const [form, setForm] = useState({ sku: '', name: '', purchase_cost: 0, sale_price: 0, physical_stock: 0 });

  const load = async () => {
    setProducts(await db.entities.Product.list('-created_date', 500));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const open = (p) => {
    setForm({ sku: p?.sku || '', name: p?.name || '', purchase_cost: p?.purchase_cost || 0, sale_price: p?.sale_price || 0, physical_stock: p?.physical_stock || 0 });
    setDialog({ open: true, edit: p?.id || null });
  };
  const save = async () => {
    if (!form.name) { toast({ title: 'Podaj nazwę produktu' }); return; }
    const payload = { ...form, reserved_stock: 0, last_delivery_date: form.physical_stock > 0 ? new Date().toISOString() : null };
    if (dialog.edit) await db.entities.Product.update(dialog.edit, form);
    else await db.entities.Product.create(payload);
    setDialog({ open: false, edit: null });
    load();
  };
  const del = async (p) => {
    if (!confirm(`Usunąć produkt ${p.name}?`)) return;
    await db.entities.Product.delete(p.id);
    load();
  };

  if (loading) return <div className="text-muted-foreground">Ładowanie…</div>;
  const visible = agingOnly
    ? products.filter((p) => (p.physical_stock || 0) > 0 && daysSince(p.last_delivery_date) > 90)
    : products;
  const tax = settings?.tax_active;
  const vatRate = settings?.default_vat_rate || 23;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Magazyn</h1>
          <p className="text-sm text-muted-foreground">Produkty, stany i ceny</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={agingOnly ? 'default' : 'outline'} onClick={() => setAgingOnly(!agingOnly)} className="gap-2">
            <PackageX className="h-4 w-4" /> {agingOnly ? 'Wszystkie produkty' : 'Zalegające 90+ dni'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/statystyki')} className="gap-2"><BarChart3 className="h-4 w-4" /> Statystyki</Button>
          <Button onClick={() => open(null)} className="gap-2"><Plus className="h-4 w-4" /> Nowy produkt</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {visible.length === 0 && <p className="p-6 text-sm text-muted-foreground">Brak produktów.</p>}
          {visible.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead className="text-right">Cena zakupu</TableHead>
                <TableHead className="text-right">Cena sprzedaży</TableHead>
                {tax && <TableHead className="text-right">Brutto</TableHead>}
                <TableHead className="text-right">Stan</TableHead>
                <TableHead className="text-right">Rezerw.</TableHead>
                <TableHead className="text-right">Dostępny</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => {
                const available = (p.physical_stock || 0) - (p.reserved_stock || 0);
                const dead = (p.physical_stock || 0) > 0 && daysSince(p.last_delivery_date) > 60;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{p.sku || '—'}</TableCell>
                    <TableCell className="font-medium">{p.name} {dead && <Badge variant="destructive" className="ml-1 gap-1"><PackageX className="h-3 w-3" />Leżący</Badge>}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(p.purchase_cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.sale_price)}</TableCell>
                    {tax && <TableCell className="text-right">{formatCurrency(netToGross(p.sale_price || 0, vatRate))}</TableCell>}
                    <TableCell className="text-right">{p.physical_stock || 0}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.reserved_stock || 0}</TableCell>
                    <TableCell className={`text-right font-medium ${available < 0 ? 'text-destructive' : ''}`}>{available}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => open(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => del(p)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog({ ...dialog, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog.edit ? 'Edytuj produkt' : 'Nowy produkt'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>Nazwa *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cena zakupu (netto)</Label><Input type="number" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: Number(e.target.value) })} /></div>
              <div><Label>Cena sprzedaży (netto)</Label><Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} /></div>
            </div>
            {!dialog.edit && <div><Label>Stan początkowy</Label><Input type="number" value={form.physical_stock} onChange={(e) => setForm({ ...form, physical_stock: Number(e.target.value) })} /></div>}
            {tax && (
              <p className="text-xs text-muted-foreground">Cena brutto: {formatCurrency(netToGross(form.sale_price, vatRate))} (VAT {vatRate}%: {formatCurrency(vatAmount(form.sale_price, vatRate))})</p>
            )}
          </div>
          <DialogFooter><Button onClick={save}>Zapisz</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}