import jsPDF from 'jspdf';
import { formatCurrency } from './crmUtils';

export async function generateOrderReceiptPDF(order, items, client, location, settings) {
  const doc = new jsPDF();
  const tax = settings?.tax_active;
  const vatRate = settings?.default_vat_rate || 23;
  const company = settings?.workspace_name || 'FieldCRM';

  doc.setFontSize(18);
  doc.text(company, 14, 20);
  doc.setFontSize(10);
  doc.text('Dokument sprzedaży / Paragon', 14, 27);
  doc.setFontSize(9);
  doc.text(`Nr: ${order.id?.slice(-8).toUpperCase()}`, 14, 34);
  doc.text(`Data dostawy: ${order.delivery_date || '-'}`, 14, 40);
  doc.text(`Typ: ${order.type === 'planned' ? 'Planowane' : 'Zrealizowane'}`, 14, 46);
  doc.text(`Status: ${order.status}`, 14, 52);
  doc.text(`Płatność: ${order.payment_status === 'paid' ? 'Opłacone' : 'Nieopłacone'}`, 14, 58);

  doc.text('Klient:', 14, 68);
  doc.text(client?.company_name || '-', 14, 74);
  if (client?.phone) doc.text(`Tel: ${client.phone}`, 14, 80);
  if (location?.full_address) doc.text(`Adres: ${location.full_address}`, 14, 86);

  // Items table
  let y = 98;
  doc.setFontSize(9);
  doc.text('Produkt', 14, y);
  doc.text('Ilość', 120, y);
  doc.text('Cena', 145, y);
  doc.text('Wartość', 175, y);
  y += 4;
  doc.line(14, y, 196, y);
  y += 6;
  items.forEach((it) => {
    doc.text(String(it.product_name || '').slice(0, 40), 14, y);
    doc.text(String(it.quantity), 120, y);
    doc.text(formatCurrency(it.unit_sale_price), 145, y);
    doc.text(formatCurrency((it.quantity || 0) * (it.unit_sale_price || 0)), 175, y);
    y += 6;
  });
  y += 4;
  doc.line(14, y, 196, y);
  y += 8;

  if (tax) {
    doc.text(`Suma netto: ${formatCurrency(order.total_net)}`, 120, y); y += 6;
    doc.text(`VAT (${vatRate}%): ${formatCurrency(order.total_vat)}`, 120, y); y += 6;
  }
  doc.setFontSize(11);
  doc.text(`Razem: ${formatCurrency(order.total_revenue)}`, 120, y); y += 8;
  doc.setFontSize(9);
  doc.text(`Zysk: ${formatCurrency(order.total_profit)}`, 120, y);

  const filename = `zamowienie-${order.id?.slice(-6).toUpperCase()}.pdf`;
  const blob = doc.output('blob');

  // Try native share sheet on mobile, otherwise download
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/pdf' })] })) {
    try {
      await navigator.share({
        files: [new File([blob], filename, { type: 'application/pdf' })],
        title: 'Paragon',
        text: `Zamówienie ${order.id?.slice(-6).toUpperCase()}`,
      });
      return;
    } catch (e) { /* fall through to download */ }
  }
  doc.save(filename);
}