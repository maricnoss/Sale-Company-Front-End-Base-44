import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Check, Users, CalendarPlus, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/crmUtils';

export default function RegionUnitCard({
  title,
  clients,
  visitedCount,
  totalCount,
  unitLabel,
  lastVisit,
  visitedToday,
  planned,
  plannedCount,
  d2dRevenue,
  isLeaf = false,
  onOpen,
  onToggle,
  onPlan,
  onMarket,
}) {
  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 ${
        isLeaf && lastVisit ? 'border-primary/40 bg-primary/5' : 'bg-card'
      }`}
    >
      <button className="text-left text-sm font-semibold leading-tight disabled:cursor-default" onClick={onOpen} disabled={isLeaf}>
        <span className="flex items-center gap-1">
          {title}
          {!isLeaf && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" /> {clients} klientów
        </Badge>
        {totalCount != null && (
          <Badge variant="secondary">
            {visitedCount}/{totalCount} {unitLabel}
          </Badge>
        )}
        {plannedCount > 0 && (
          <Badge variant="outline" className="gap-1">
            <CalendarPlus className="h-3 w-3" /> plan: {plannedCount}
          </Badge>
        )}
        {d2dRevenue > 0 && (
          <Badge variant="outline">D2D: {formatCurrency(d2dRevenue)}</Badge>
        )}
        {isLeaf && planned && (
          <Badge variant="outline" className="gap-1">
            <CalendarPlus className="h-3 w-3" /> {planned.date}
            {planned.count > 1 ? ` (+${planned.count - 1})` : ''}
          </Badge>
        )}
        {isLeaf &&
          (lastVisit ? (
            <Badge variant="default" className="gap-1">
              <Check className="h-3 w-3" /> {lastVisit}
            </Badge>
          ) : (
            <Badge variant="outline">nieodwiedzone</Badge>
          ))}
      </div>
      {isLeaf && (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant={visitedToday ? 'secondary' : 'outline'} className="h-7 gap-1" onClick={onToggle}>
            {visitedToday ? <Check className="h-3 w-3" /> : null} {visitedToday ? 'Dzisiaj' : 'Oznacz wizytę'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={onPlan}>
            <CalendarPlus className="h-3 w-3" /> Zaplanuj
          </Button>
          {onMarket && (
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={onMarket}>
              <BarChart3 className="h-3 w-3" /> Dane
            </Button>
          )}
        </div>
      )}
    </div>
  );
}