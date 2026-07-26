"use client";

import {
  Bell,
  ChevronDown,
  Command,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import {
  type WorkspaceSummary,
  workspaceRoleLabels,
} from "@/domain/workspaces/workspace";
import {
  allNavigationItems,
  getRouteContext,
  navigationGroups,
  type NavigationItem,
} from "@/lib/navigation";

import styles from "./app-shell.module.css";

type AppShellProps = {
  children: React.ReactNode;
  viewer: {
    displayName: string;
    email: string;
    initials: string;
  };
  currentWorkspace: WorkspaceSummary;
  availableWorkspaces: WorkspaceSummary[];
  selectWorkspaceAction: (formData: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
};

type SidebarContentProps = {
  pathname: string;
  viewer: AppShellProps["viewer"];
  currentWorkspace: AppShellProps["currentWorkspace"];
  availableWorkspaces: AppShellProps["availableWorkspaces"];
  selectWorkspaceAction: AppShellProps["selectWorkspaceAction"];
  signOutAction: AppShellProps["signOutAction"];
  onNavigate?: () => void;
};

function SidebarContent({
  pathname,
  viewer,
  currentWorkspace,
  availableWorkspaces,
  selectWorkspaceAction,
  signOutAction,
  onNavigate,
}: SidebarContentProps) {
  const workspaceInitials =
    currentWorkspace.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase("es-MX") || "TR";

  return (
    <>
      <div className={styles.sidebarBrand}>
        <BrandMark />
      </div>

      <details className={styles.workspaceSwitcher}>
        <summary>
          <span className={styles.workspaceMonogram}>{workspaceInitials}</span>
          <span>
            <small>{workspaceRoleLabels[currentWorkspace.role]}</small>
            <strong>{currentWorkspace.name}</strong>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className={styles.workspaceMenu}>
          <p>Tus workspaces</p>
          {availableWorkspaces.map((workspace) => (
            <form action={selectWorkspaceAction} key={workspace.id}>
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <input type="hidden" name="returnTo" value={pathname} />
              <button
                type="submit"
                data-active={workspace.id === currentWorkspace.id}
                onClick={onNavigate}
              >
                <span>
                  {workspace.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toLocaleUpperCase("es-MX")}
                </span>
                <p>
                  <strong>{workspace.name}</strong>
                  <small>{workspaceRoleLabels[workspace.role]}</small>
                </p>
                {workspace.id === currentWorkspace.id && (
                  <small>Activo</small>
                )}
              </button>
            </form>
          ))}
          <Link href="/onboarding?new=1" onClick={onNavigate}>
            + Crear otro workspace
          </Link>
        </div>
      </details>

      <nav className={styles.sidebarNavigation} aria-label="Navegación privada">
        {navigationGroups.map((group) => (
          <div className={styles.navigationGroup} key={group.label}>
            <p>{group.label}</p>
            <div>
              {group.items.map((item) => (
                <NavigationEntry
                  item={item}
                  isActive={
                    pathname === item.href ||
                    (item.href !== "/app" &&
                      pathname.startsWith(`${item.href}/`))
                  }
                  key={item.href}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.environmentStatus}>
          <span aria-hidden="true" />
          <p>
            <strong>Sesión protegida</strong>
            <small>Supabase SSR activo</small>
          </p>
        </div>
        <div className={styles.userSummary}>
          <span className={styles.avatar}>{viewer.initials}</span>
          <span>
            <strong>{viewer.displayName}</strong>
            <small title={viewer.email}>{viewer.email}</small>
          </span>
          <form action={signOutAction}>
            <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={14} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

type NavigationEntryProps = {
  item: NavigationItem;
  isActive: boolean;
  onNavigate?: () => void;
};

function NavigationEntry({
  item,
  isActive,
  onNavigate,
}: NavigationEntryProps) {
  const Icon = item.icon;
  const className = [
    styles.navigationItem,
    isActive ? styles.navigationItemActive : "",
    !item.available ? styles.navigationItemPending : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!item.available) {
    return (
      <span
        className={className}
        aria-disabled="true"
        title="Se habilitará en un bloque posterior"
      >
        <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        <span>{item.label}</span>
        {item.badge && <small>{item.badge}</small>}
      </span>
    );
  }

  return (
    <Link className={className} href={item.href} onClick={onNavigate}>
      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({
  children,
  viewer,
  currentWorkspace,
  availableWorkspaces,
  selectWorkspaceAction,
  signOutAction,
}: AppShellProps) {
  const pathname = usePathname();
  const routeContext = getRouteContext(pathname);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
    if (!normalizedQuery) {
      return allNavigationItems;
    }

    return allNavigationItems.filter((item) =>
      item.label.toLocaleLowerCase("es-MX").includes(normalizedQuery),
    );
  }, [query]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setCommandOpen(true);
      }

      if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  useEffect(() => {
    const overlayOpen = mobileMenuOpen || commandOpen;
    const previousOverflow = document.body.style.overflow;

    if (overlayOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [commandOpen, mobileMenuOpen]);

  useEffect(() => {
    if (commandOpen) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [commandOpen]);

  return (
    <>
      <a className={styles.skipLink} href="#ticketroute-content">
        Saltar al contenido
      </a>

      <div className={styles.applicationFrame}>
        <aside className={styles.desktopSidebar}>
          <SidebarContent
            pathname={pathname}
            viewer={viewer}
            currentWorkspace={currentWorkspace}
            availableWorkspaces={availableWorkspaces}
            selectWorkspaceAction={selectWorkspaceAction}
            signOutAction={signOutAction}
          />
        </aside>

        <div className={styles.mainColumn}>
          <header className={styles.topbar}>
            <div className={styles.mobileBrand}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Abrir navegación"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu size={19} aria-hidden="true" />
              </button>
              <BrandMark compact />
            </div>

            <div className={styles.routeContext}>
              <span>{routeContext.group.toLocaleUpperCase("es-MX")}</span>
              <strong>{routeContext.item.label}</strong>
            </div>

            <div className={styles.topbarActions}>
              <button
                className={styles.commandTrigger}
                type="button"
                aria-label="Abrir comandos"
                onClick={() => {
                  setQuery("");
                  setCommandOpen(true);
                }}
              >
                <Search size={15} aria-hidden="true" />
                <span>Buscar o ejecutar</span>
                <kbd>
                  <Command size={11} aria-hidden="true" />K
                </kbd>
              </button>

              <Link
                className={styles.iconButton}
                href="/app/notifications"
                aria-label="Notificaciones"
              >
                <Bell size={18} aria-hidden="true" />
              </Link>

              <span className={styles.connectionState}>
                <span aria-hidden="true" />
                Sesión activa
              </span>
            </div>
          </header>

          <main id="ticketroute-content" className={styles.content}>
            {children}
          </main>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className={styles.mobileOverlay}
          role="presentation"
          onMouseDown={() => setMobileMenuOpen(false)}
        >
          <aside
            className={styles.mobileSidebar}
            aria-label="Navegación móvil"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.mobileClose}
              aria-label="Cerrar navegación"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X size={19} aria-hidden="true" />
            </button>
            <SidebarContent
              pathname={pathname}
              viewer={viewer}
              currentWorkspace={currentWorkspace}
              availableWorkspaces={availableWorkspaces}
              selectWorkspaceAction={selectWorkspaceAction}
              signOutAction={signOutAction}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      {commandOpen && (
        <div
          className={styles.commandOverlay}
          role="presentation"
          onMouseDown={() => setCommandOpen(false)}
        >
          <section
            className={styles.commandDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.commandSearch}>
              <Search size={19} aria-hidden="true" />
              <label className={styles.visuallyHidden} htmlFor="command-query">
                Buscar una sección o comando
              </label>
              <input
                ref={searchInputRef}
                id="command-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca una sección o acción…"
              />
              <kbd>ESC</kbd>
            </div>

            <div className={styles.commandResults}>
              <p id="command-title">Navegación global</p>
              {filteredCommands.length > 0 ? (
                filteredCommands.map((item) => {
                  const Icon = item.icon;
                  return item.available ? (
                    <Link
                      className={styles.commandResult}
                      href={item.href}
                      key={item.href}
                      onClick={() => setCommandOpen(false)}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{item.label}</span>
                      <small>Ir</small>
                    </Link>
                  ) : (
                    <span
                      className={`${styles.commandResult} ${styles.commandResultPending}`}
                      key={item.href}
                      aria-disabled="true"
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{item.label}</span>
                      <small>Próximamente</small>
                    </span>
                  );
                })
              ) : (
                <div className={styles.noResults}>
                  No encontramos una sección con ese nombre.
                </div>
              )}
            </div>

            <footer className={styles.commandFooter}>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                navegar
              </span>
              <span>
                <kbd>↵</kbd>
                abrir
              </span>
              <strong>TicketRoute Command</strong>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
