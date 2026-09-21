import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Package, ShoppingCart, MapPin, BarChart3, Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

const nav = [
  { to: '/', label: 'Pulpit', icon: LayoutDashboard, end: true },
  { to: '/klienci', label: 'Klienci', icon: Users },
  { to: '/produkty', label: 'Magazyn', icon: Package },
  { to: '/zamowienia', label: 'Zamówienia', icon: ShoppingCart },
  { to: '/trasy', label: 'Trasy', icon: MapPin },
  { to: '/statystyki', label: 'Statystyki', icon: BarChart3 },
  { to: '/ustawienia', label: 'Ustawienia', icon: SettingsIcon },
];

export default function Layout() {
  const settings = useSettings();
  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r bg-background">
        <div className="px-5 pt-6 pb-4">
          <h1 className="text-lg font-semibold tracking-tight">{settings?.workspace_name || 'FieldCRM'}</h1>
          <p className="text-xs text-muted-foreground">Sprzedaż terenowa</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className="md:pl-60 pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-background z-50">
        <div className="flex justify-around">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-2 py-2 text-[10px] ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}