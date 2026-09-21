import { daysSince } from '@/lib/crmUtils';

export const isRealized = (o) => (o.type === 'executed' || o.status === 'delivered') && o.status !== 'cancelled';

export function periodRange(period, custom) {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (period === 'week') from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  else if (period === 'month') from.setDate(1);
  else if (period === 'quarter') from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1);
  else if (period === 'year') from.setMonth(0, 1);
  else if (period === 'custom') {
    if (custom?.from) from.setTime(new Date(custom.from).getTime());
    if (custom?.to) to.setTime(new Date(custom.to).getTime() + 86399999);
  }
  return { from, to };
}

export function previousRange({ from, to }) {
  const len = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - len);
  return { from: prevFrom, to: prevTo };
}

export const orderDate = (o) => new Date(o.delivery_date || o.created_date);
export const inRange = (d, { from, to }) => d >= from && d <= to;

export function marginFromItems(items, orderIds) {
  const ids = orderIds instanceof Set ? orderIds : new Set(orderIds);
  let sale = 0;
  let cost = 0;
  items.filter((it) => ids.has(it.order_id)).forEach((it) => {
    sale += (it.quantity || 0) * (it.unit_sale_price || 0);
    cost += (it.quantity || 0) * (it.unit_purchase_cost || 0);
  });
  return sale > 0 ? ((sale - cost) / sale) * 100 : 0;
}

export function agingBuckets(products) {
  const buckets = [
    { bucket: '0–30 dni', value: 0 },
    { bucket: '31–90 dni', value: 0 },
    { bucket: '91–180 dni', value: 0 },
    { bucket: '180+ dni', value: 0 },
  ];
  products.forEach((p) => {
    const stock = p.physical_stock || 0;
    if (stock <= 0) return;
    const days = daysSince(p.last_delivery_date || p.created_date);
    const idx = days <= 30 ? 0 : days <= 90 ? 1 : days <= 180 ? 2 : 3;
    buckets[idx].value += stock * (p.purchase_cost || 0);
  });
  return buckets;
}