import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function AgingBarChart({ data }) {
  if (!data.some((d) => d.value > 0)) return <p className="py-8 text-center text-sm text-muted-foreground">Brak zapasów na magazynie</p>;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={64} />
          <Tooltip formatter={(v) => [`${Number(v).toFixed(0)} zł`, 'Wartość zapasów']} />
          <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}