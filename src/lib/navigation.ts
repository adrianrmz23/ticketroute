import {
  Bell,
  Blocks,
  Bot,
  Gauge,
  Inbox,
  KanbanSquare,
  Network,
  PanelTop,
  Scale,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TicketCheck,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  available: boolean;
  badge?: string;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Operación",
    items: [
      {
        label: "Command Center",
        href: "/app",
        icon: PanelTop,
        available: true,
      },
      {
        label: "Inbox",
        href: "/app/inbox",
        icon: Inbox,
        available: true,
      },
      {
        label: "Capture Hub",
        href: "/app/capture",
        icon: Sparkles,
        available: true,
      },
      {
        label: "Tickets",
        href: "/app/tickets",
        icon: TicketCheck,
        available: true,
      },
      {
        label: "Execution Board",
        href: "/app/board",
        icon: KanbanSquare,
        available: true,
      },
    ],
  },
  {
    label: "Planeación",
    items: [
      {
        label: "Planning Lab",
        href: "/app/planning",
        icon: Network,
        available: true,
      },
      {
        label: "Equipo",
        href: "/app/team",
        icon: UsersRound,
        available: true,
      },
      {
        label: "Capacidad",
        href: "/app/team/capacity",
        icon: Gauge,
        available: true,
      },
      {
        label: "Calibración",
        href: "/app/calibration",
        icon: SlidersHorizontal,
        available: true,
      },
      {
        label: "Council Mode",
        href: "/app/council",
        icon: Scale,
        available: true,
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        label: "Integraciones",
        href: "/app/integrations",
        icon: Blocks,
        available: true,
      },
      {
        label: "Proveedores de IA",
        href: "/app/settings/ai",
        icon: Bot,
        available: true,
      },
      {
        label: "Notificaciones",
        href: "/app/notifications",
        icon: Bell,
        available: true,
      },
      {
        label: "Seguridad",
        href: "/app/settings/security",
        icon: ShieldCheck,
        available: true,
      },
      {
        label: "Configuración",
        href: "/app/settings/system",
        icon: Settings2,
        available: true,
      },
    ],
  },
];

export const allNavigationItems = navigationGroups.flatMap(
  (group) => group.items,
);

export function getRouteContext(pathname: string) {
  const matches = navigationGroups.flatMap((group) =>
    group.items
      .filter(
        (item) =>
          pathname === item.href ||
          (item.href !== "/app" && pathname.startsWith(`${item.href}/`)),
      )
      .map((item) => ({
        group: group.label,
        item,
      })),
  );

  return (
    matches.sort((left, right) => right.item.href.length - left.item.href.length)[
      0
    ] ?? {
      group: "Operación",
      item: allNavigationItems[0],
    }
  );
}
