const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


export const formatCurrency = (n) => `${(Number(n) || 0).toFixed(2)} zł`;
export const formatNumber = (n) => `${Number(n) || 0}`;

export const netToGross = (net, rate) => net * (1 + (rate || 0) / 100);
export const vatAmount = (net, rate) => net * ((rate || 0) / 100);

export const daysSince = (d) => {
  if (!d) return null;
  const diff = Date.now() - new Date(d).getTime();
  return Math.floor(diff / 86400000);
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

// Target stock/debt effect for an order given its type+status+payment
export function targetEffects(order) {
  const { type, status, payment_status, total_revenue } = order;
  const reservedMul = (type === 'planned' && status === 'pending') ? 1 : 0;
  const physicalMul =
    status !== 'cancelled' && (type === 'executed' || (type === 'planned' && status === 'delivered')) ? -1 : 0;
  const debt = (payment_status === 'unpaid' && status !== 'cancelled') ? (total_revenue || 0) : 0;
  return { reservedMul, physicalMul, debt };
}

// Reconcile product stock + client debt to the order's target state.
// Idempotent: stores applied amounts on items/order and only applies deltas.
export async function syncOrderEffects(order, items, productsById, client) {
  const t = targetEffects(order);
  for (const item of items) {
    const p = productsById[item.product_id];
    if (!p) continue;
    const targetReserved = t.reservedMul * (item.quantity || 0);
    const targetPhysical = t.physicalMul * (item.quantity || 0);
    const dReserved = targetReserved - (item.applied_reserved || 0);
    const dPhysical = targetPhysical - (item.applied_physical || 0);
    if (dReserved !== 0 || dPhysical !== 0) {
      const updates = {
        reserved_stock: (p.reserved_stock || 0) + dReserved,
        physical_stock: (p.physical_stock || 0) + dPhysical,
      };
      if (dPhysical < 0) updates.last_delivery_date = new Date().toISOString();
      await db.entities.Product.update(p.id, updates);
    }
    await db.entities.OrderItem.update(item.id, {
      applied_reserved: targetReserved,
      applied_physical: targetPhysical,
    });
  }
  const appliedDebt = order.applied_debt || 0;
  if (t.debt !== appliedDebt) {
    if (client) {
      await db.entities.Client.update(client.id, {
        total_debt: (client.total_debt || 0) + (t.debt - appliedDebt),
      });
    }
    await db.entities.Order.update(order.id, { applied_debt: t.debt });
  }
}