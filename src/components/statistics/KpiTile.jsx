import React from 'react';

export default function KpiTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 truncate text-xl font-semibold leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}