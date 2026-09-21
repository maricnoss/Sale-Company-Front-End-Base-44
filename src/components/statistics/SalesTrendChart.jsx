import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function SalesTrendChart({ data }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Brak sprzedaży w tym okresie</p>;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={64} />
          <Tooltip formatter={(v) => [`${Number(v).toFixed(0)} zł`, 'Przychód']} />
          <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}