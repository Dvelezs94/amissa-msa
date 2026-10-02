"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 ClipboardList,
 ListChecks,
 BarChart2,
 CalendarDays,
 LayoutDashboard,
 BookOpen,
 User,
 Menu,
 X,
 Settings,
 LogOut,
 ChevronDown,
 ChevronLeft,
 ChevronRight,
 Wrench,
 Bell,
 GitBranch,
 CircleHelp,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { SessionUser } from "@/lib/auth-shared";
import {
  checklistRevisionNotificationHref,
  CHECKLIST_REVISION_REVIEW_TITLE,
  parseChecklistRevisionNotificationBody,
} from "@/lib/checklist-notification-parse";
import { UserAvatar } from "@/components/UserAvatar";
import { WorkOrderStatusColorsProvider } from "@/components/WorkOrderStatusColorsProvider";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  PageHeaderProvider,
  resolveAppShellTitle,
  usePageHeader,
} from "@/components/PageHeaderContext";
import type { WorkOrderStatusColors } from "@/lib/work-order-status-colors";

function AppShellPageTitle() {
  const pathname = usePathname();
  const header = usePageHeader();
  const pageTitle = header.title ?? resolveAppShellTitle(pathname);
  const pageSubtitle = header.subtitle ?? null;
  if (!pageTitle && !pageSubtitle) return null;
  return (
    <div className="min-w-0 flex-1 basis-[10rem]">
      {pageTitle ? (
        <h1 className="truncate text-base font-semibold leading-tight text-zinc-900 md:text-lg">
          {pageTitle}
        </h1>
      ) : null}
      {pageSubtitle ? (
        <p className="truncate text-xs leading-tight text-zinc-500">
          {pageSubtitle}
        </p>
      ) : null}
    </div>
  );
}

/** Content-area toolbar: filters/search left, page actions right. */
function AppShellContentToolbar() {
  const header = usePageHeader();
  if (!header.filters && !header.actions) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {header.filters ?? null}
      </div>
      {header.actions ? (
        <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
          {header.actions}
        </div>
      ) : null}
    </div>
  );
}

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const SIDEBAR_COLLAPSED_KEY = "app-shell-sidebar-collapsed";

const baseNavSections: { type: string; items: NavItem[] }[] = [
 {
  type: "Principal",
  items: [
   { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ],
 },
 {
  type: "Operaciones",
  items: [
   { href: "/calendario", label: "Calendario", icon: CalendarDays },
   { href: "/tareas", label: "Tareas", icon: ClipboardList },
   { href: "/checklists", label: "Checklist", icon: ListChecks },
   { href: "/assets", label: "Maquinas", icon: Wrench },
  ],
 },
 {
  type: "Contenido",
  items: [{ href: "/knowledge-base", label: "Base de conocimiento", icon: BookOpen }],
 },
 {
  type: "Reportes",
  items: [{ href: "/analytics", label: "Analíticas", icon: BarChart2 }],
 },
];

function roleLabel(role: string) {
 if (role === "admin") return "Administrador";
 if (role === "tecnico") return "Técnico";
 if (role === "calidad") return "Calidad";
 return role;
}

function ProfileSubmenu({
 role,
 onClose,
}: {
 role: SessionUser["role"];
 onClose: () => void;
}) {
 return (
  <div
   className="w-full rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
  >
   {role !== "calidad" && (
    <Link
     href="/profile"
     onClick={onClose}
     className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 tap-target"
    >
     <Settings className="h-4 w-4 shrink-0" />
     Ajustes
    </Link>
   )}
   <form action="/api/auth/logout" method="POST" className="border-t border-zinc-100">
    <button
     type="submit"
     className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 tap-target"
    >
     <LogOut className="h-4 w-4 shrink-0" />
     Cerrar sesión
    </button>
   </form>
  </div>
 );
}

export function AppShell({
 user,
 workOrderStatusColors,
 children,
}: {
 user: SessionUser;
 workOrderStatusColors: WorkOrderStatusColors;
 children: React.ReactNode;
}) {
 const pathname = usePathname();
 const userRole = roleLabel(user.role);
 const navSections = [
  ...(user.role === "admin"
   ? baseNavSections
   : user.role === "calidad"
    ? [
      {
       type: "Operaciones",
       items: [
        {
         href: "/calendario",
         label: "Calendario",
         icon: CalendarDays,
        } satisfies NavItem,
        {
         href: "/tareas",
         label: "Tareas",
         icon: ClipboardList,
        } satisfies NavItem,
        {
         href: "/checklists",
         label: "Checklist",
         icon: ListChecks,
        } satisfies NavItem,
       ],
      },
     ]
    : [
      {
       type: "Operaciones",
       items: [
        {
         href: "/tareas",
         label: "Tareas",
         icon: ClipboardList,
        } satisfies NavItem,
       ],
      },
      {
       type: "Contenido",
       items: [
        {
         href: "/knowledge-base",
         label: "Base de conocimiento",
         icon: BookOpen,
        } satisfies NavItem,
       ],
      },
     ]),
  ...(user.role === "admin"
   ? [
     {
      type: "Plataforma",
      items: [
       {
        href: "/flujos",
        label: "Flujos",
        icon: GitBranch,
       } satisfies NavItem,
       {
        href: "/users",
        label: "Usuarios",
        icon: User,
       } satisfies NavItem,
      ],
     },
    ]
   : []),
  {
   type: "Ayuda",
   items: [
    {
     href: "/documentacion",
     label: "Documentación",
     icon: CircleHelp,
    } satisfies NavItem,
   ],
  },
 ];
 const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
 const [sidebarOpen, setSidebarOpen] = useState(false);
 const [profileMenuOpen, setProfileMenuOpen] = useState(false);
 const [notificationsOpen, setNotificationsOpen] = useState(false);
 const [notificationsLoading, setNotificationsLoading] = useState(false);
 const [notifications, setNotifications] = useState<
  Array<{
   id: string;
   title: string;
   body: string | null;
   type: "assignment" | "work_order_update" | "mention";
   workOrderId: string | null;
  noteId: string | null;
   readAt: string | null;
   createdAt: string;
  }>
 >([]);
 const [unreadCount, setUnreadCount] = useState(0);
 const canUseTaskFeatures =
  user.role === "admin" || user.role === "tecnico" || user.role === "calidad";
 const showBackButton =
  pathname.startsWith("/tareas/") ||
  pathname.startsWith("/checklists/") ||
  pathname.startsWith("/assets/");

 const profileDesktopRef = useRef<HTMLDivElement>(null);
 const profileHeaderRef = useRef<HTMLDivElement>(null);
 const notificationsRef = useRef<HTMLDivElement>(null);
 const notificationsMobileRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  try {
   const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
   if (v === "1") setSidebarCollapsed(true);
  } catch {
   /* ignore */
  }
 }, []);

 function toggleSidebarCollapsed() {
  setSidebarCollapsed((prev) => {
   const next = !prev;
   try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
   } catch {
    /* ignore */
   }
   return next;
  });
 }

 useEffect(() => {
  if (!profileMenuOpen && !notificationsOpen) return;
  function handleClickOutside(e: MouseEvent) {
   const target = e.target as Node;
   const insideDesktop = profileDesktopRef.current?.contains(target);
   const insideHeader = profileHeaderRef.current?.contains(target);
   const insideNotifications = notificationsRef.current?.contains(target);
   const insideNotificationsMobile = notificationsMobileRef.current?.contains(target);
   if (!insideDesktop && !insideHeader) setProfileMenuOpen(false);
   if (!insideNotifications && !insideNotificationsMobile) setNotificationsOpen(false);
  }
  document.addEventListener("click", handleClickOutside);
  return () => document.removeEventListener("click", handleClickOutside);
 }, [profileMenuOpen, notificationsOpen]);

 useEffect(() => {
  if (!canUseTaskFeatures) return;
  let cancelled = false;
  async function loadNotifications() {
   setNotificationsLoading(true);
   try {
    const res = await fetch("/api/notifications");
    const data = await res.json().catch(() => ({}));
    if (!cancelled) {
     setNotifications(Array.isArray(data.items) ? data.items : []);
     setUnreadCount(Number(data.unreadCount ?? 0));
    }
   } finally {
    if (!cancelled) setNotificationsLoading(false);
   }
  }
  void loadNotifications();
  const timer = setInterval(() => {
   void loadNotifications();
  }, 15000);
  return () => {
   cancelled = true;
   clearInterval(timer);
  };
 }, [canUseTaskFeatures]);

 async function markAllNotificationsRead() {
  await fetch("/api/notifications", { method: "PATCH" });
  setNotifications((prev) =>
   prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
  );
  setUnreadCount(0);
 }

 function notificationHref(n: {
  title: string;
  workOrderId: string | null;
  noteId: string | null;
  body: string | null;
 }) {
  const parsed = parseChecklistRevisionNotificationBody(n.body);
  if (n.title === CHECKLIST_REVISION_REVIEW_TITLE && parsed?.checklistId) {
   return checklistRevisionNotificationHref(parsed);
  }
  return n.workOrderId ? `/tareas/${n.workOrderId}` : "/tareas";
 }

 const profileAreaActive =
  pathname.startsWith("/profile") || profileMenuOpen;

 return (
  <WorkOrderStatusColorsProvider initialColors={workOrderStatusColors}>
  <PageHeaderProvider>
  <div className="min-h-screen flex flex-col md:flex-row">
   {/* Desktop sidebar */}
   <aside
    className={`hidden border-r border-zinc-200 bg-white transition-[width] duration-200 ease-out md:fixed md:inset-y-0 md:flex md:flex-col ${
     sidebarCollapsed ? "md:w-20" : "md:w-[260px]"
    }`}
   >
    <div
     className={`relative flex shrink-0 flex-col justify-center border-b border-zinc-200 ${
      sidebarCollapsed ? "min-h-[4.5rem] px-2 pt-9 pb-2" : "h-24 px-6"
     }`}
    >
     <button
      type="button"
      onClick={toggleSidebarCollapsed}
      className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
      aria-label={sidebarCollapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
      title={sidebarCollapsed ? "Expandir" : "Contraer"}
     >
      {sidebarCollapsed ? (
       <ChevronRight className="h-4 w-4" aria-hidden />
      ) : (
       <ChevronLeft className="h-4 w-4" aria-hidden />
      )}
     </button>
     <Link
      href="/tareas"
      className={`font-bold uppercase leading-none tracking-tight text-[#F14C03] ${
       sidebarCollapsed
        ? "flex justify-center text-xl"
        : "text-[33px]"
      }`}
      title="MSA"
     >
      {sidebarCollapsed ? "M" : "MSA"}
     </Link>
     {!sidebarCollapsed && (
      <p className="mt-1 text-xs uppercase tracking-[0.15em] text-neutral-400">
       Maintenance Software Assistant
      </p>
     )}
    </div>
    <nav className={`flex-1 space-y-6 overflow-y-auto py-4 ${sidebarCollapsed ? "px-1.5" : "px-3"}`}>
     {navSections.map((section) => (
      <div key={section.type}>
       {!sidebarCollapsed && (
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
         {section.type}
        </p>
       )}
       <div className="space-y-1">
        {section.items.map(({ href, label, icon: Icon }) => (
         <Link
          key={href}
          href={href}
          title={label}
          className={`flex items-center rounded-md text-sm font-semibold uppercase tracking-[0.08em] tap-target ${
           sidebarCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5"
          } ${
           pathname.startsWith(href)
            ? "bg-[#F14C03] text-white"
            : "text-zinc-700 hover:bg-primary-50"
          }`}
         >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {!sidebarCollapsed && <span className="truncate">{label}</span>}
         </Link>
        ))}
       </div>
      </div>
     ))}
    </nav>
    <div className="relative border-t border-zinc-200 p-3" ref={profileDesktopRef}>
     <button
      type="button"
      onClick={() => setProfileMenuOpen((o) => !o)}
      className={`flex w-full items-center rounded-md text-sm font-medium tap-target ${
       sidebarCollapsed ? "justify-center px-1 py-2" : "justify-between gap-2 px-3 py-2.5"
      } ${
       profileAreaActive
        ? "bg-[#F14C03] text-white"
        : "text-zinc-700 hover:bg-primary-50"
      }`}
      title="Perfil"
      aria-expanded={profileMenuOpen}
     >
      <span
       className={`flex min-w-0 items-center ${sidebarCollapsed ? "justify-center" : "flex-1 gap-3"}`}
      >
       <UserAvatar
        userId={user.id}
        name={user.name}
        avatarUrl={user.avatarUrl}
        size="sm"
       />
       {!sidebarCollapsed && (
        <span className="flex min-w-0 flex-col text-left leading-tight">
         <span className="truncate">Perfil</span>
         <span
          className={`truncate text-xs font-normal ${
           profileAreaActive ? "text-white/85" : "text-neutral-400"
          }`}
         >
          {user.name} · {userRole}
         </span>
        </span>
       )}
      </span>
      {!sidebarCollapsed && (
       <ChevronDown
        className={`h-4 w-4 shrink-0 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
        aria-hidden
       />
      )}
     </button>
     {profileMenuOpen && (
      <div
       className={
        sidebarCollapsed
         ? "absolute bottom-2 left-full z-50 ml-1 min-w-[180px]"
         : "mt-1 pl-2"
       }
      >
       <ProfileSubmenu role={user.role} onClose={() => setProfileMenuOpen(false)} />
      </div>
     )}
    </div>
   </aside>

   {/* Mobile sidebar overlay */}
   {sidebarOpen && (
    <div
     className="fixed inset-0 z-40 bg-black/50 md:hidden"
     onClick={() => setSidebarOpen(false)}
     aria-hidden
    />
   )}
   <aside
    className={`fixed left-0 top-0 z-50 h-full w-64 transform border-r border-zinc-200 bg-white transition-transform md:hidden ${
     sidebarOpen ? "translate-x-0" : "-translate-x-full"
    }`}
   >
    <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
     <span className="font-semibold text-[#F14C03]">Menú</span>
     <button
      type="button"
      onClick={() => setSidebarOpen(false)}
      className="rounded-lg p-2 tap-target hover:bg-zinc-100"
      aria-label="Cerrar menú"
     >
      <X className="h-5 w-5 text-zinc-700" />
     </button>
    </div>
    <nav className="flex-1 space-y-6 overflow-y-auto p-3">
     {navSections.map((section) => (
      <div key={section.type}>
       <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {section.type}
       </p>
       <div className="space-y-0.5">
        {section.items.map(({ href, label, icon: Icon }) => (
         <Link
          key={href}
          href={href}
          onClick={() => setSidebarOpen(false)}
          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] tap-target ${
           pathname.startsWith(href)
            ? "bg-[#F14C03] text-white"
            : "text-zinc-700 hover:bg-primary-50"
          }`}
         >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
         </Link>
        ))}
       </div>
      </div>
     ))}
    </nav>
   </aside>

   {/* Main content */}
   <div
    className={`flex min-h-screen flex-1 flex-col !bg-zinc-200 transition-[padding] duration-200 ease-out ${
     sidebarCollapsed ? "md:pl-20" : "md:pl-[260px]"
    }`}
   >
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur">
     <button
      type="button"
      onClick={() => setSidebarOpen(true)}
      className="-ml-2 rounded-lg p-2 tap-target hover:bg-zinc-100 md:hidden"
      aria-label="Abrir menú"
     >
      <Menu className="h-5 w-5 text-zinc-600" />
     </button>
     <AppShellPageTitle />
     <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
      {canUseTaskFeatures && (
      <div className="relative md:hidden" ref={notificationsMobileRef}>
       <button
        type="button"
        onClick={() => setNotificationsOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-md bg-transparent p-2 text-zinc-600 hover:bg-zinc-100"
        aria-label="Notificaciones"
       >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
         <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#F14C03] px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
         </span>
        )}
       </button>
       {notificationsOpen && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-zinc-200 bg-white shadow-lg">
         <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
           Notificaciones
          </p>
          <button
           type="button"
           onClick={markAllNotificationsRead}
           className="text-xs font-medium text-[#F14C03] hover:underline"
          >
           Marcar todo leido
          </button>
         </div>
         <div className="max-h-80 overflow-y-auto p-2">
          {notificationsLoading ? (
           <p className="px-2 py-3 text-xs text-neutral-400">Cargando...</p>
          ) : notifications.length === 0 ? (
           <p className="px-2 py-3 text-xs text-neutral-400">Sin notificaciones</p>
          ) : (
           notifications.map((n) => (
            <Link
             key={n.id}
             href={notificationHref(n)}
             onClick={async () => {
              await fetch(`/api/notifications/${n.id}`, {
               method: "PATCH",
              });
              setNotifications((prev) =>
               prev.map((item) =>
                item.id === n.id
                 ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
                 : item
               )
              );
              setUnreadCount((prev) => Math.max(0, prev - (n.readAt ? 0 : 1)));
              setNotificationsOpen(false);
             }}
             className={`mb-1 block rounded-md border px-2 py-2 text-xs ${
              n.readAt
               ? "border-zinc-200 text-zinc-600"
               : "border-primary-200 bg-primary-50 text-zinc-800"
             }`}
            >
             <p className="font-semibold">{n.title}</p>
             {n.body && (
              <p className="mt-0.5 truncate">
               {parseChecklistRevisionNotificationBody(n.body)?.cleanBody ?? n.body}
              </p>
             )}
            </Link>
           ))
          )}
         </div>
        </div>
       )}
      </div>
      )}
      <div className="relative md:hidden" ref={profileHeaderRef}>
       <button
        type="button"
        onClick={() => setProfileMenuOpen((o) => !o)}
        className={`inline-flex items-center justify-center rounded-md ${
         profileAreaActive
          ? "bg-[#FFF5F0]"
          : "bg-transparent hover:bg-zinc-100"
        }`}
        aria-label="Perfil"
        aria-expanded={profileMenuOpen}
       >
        <UserAvatar
         userId={user.id}
         name={user.name}
         avatarUrl={user.avatarUrl}
         size="sm"
        />
       </button>
       {profileMenuOpen && (
        <div className="absolute right-0 z-40 mt-2 w-48">
         <ProfileSubmenu role={user.role} onClose={() => setProfileMenuOpen(false)} />
        </div>
       )}
      </div>
      {canUseTaskFeatures && <GlobalSearch />}
      {canUseTaskFeatures && (
      <div className="relative hidden md:block" ref={notificationsRef}>
       <button
        type="button"
        onClick={() => setNotificationsOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-100"
        aria-label="Notificaciones"
       >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
         <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#F14C03] px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
         </span>
        )}
       </button>
       {notificationsOpen && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-md border border-zinc-200 bg-white shadow-lg">
         <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
           Notificaciones
          </p>
          <button
           type="button"
           onClick={markAllNotificationsRead}
           className="text-xs font-medium text-[#F14C03] hover:underline"
          >
           Marcar todo leido
          </button>
         </div>
         <div className="max-h-80 overflow-y-auto p-2">
          {notificationsLoading ? (
           <p className="px-2 py-3 text-xs text-neutral-400">Cargando...</p>
          ) : notifications.length === 0 ? (
           <p className="px-2 py-3 text-xs text-neutral-400">Sin notificaciones</p>
          ) : (
           notifications.map((n) => (
            <Link
             key={n.id}
             href={notificationHref(n)}
             onClick={async () => {
              await fetch(`/api/notifications/${n.id}`, {
               method: "PATCH",
              });
              setNotifications((prev) =>
               prev.map((item) =>
                item.id === n.id
                 ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
                 : item
               )
              );
              setUnreadCount((prev) => Math.max(0, prev - (n.readAt ? 0 : 1)));
              setNotificationsOpen(false);
             }}
             className={`mb-1 block rounded-md border px-2 py-2 text-xs ${
              n.readAt
               ? "border-zinc-200 text-zinc-600"
               : "border-primary-200 bg-primary-50 text-zinc-800"
             }`}
            >
             <p className="font-semibold">{n.title}</p>
             {n.body && (
              <p className="mt-0.5 truncate">
               {parseChecklistRevisionNotificationBody(n.body)?.cleanBody ?? n.body}
              </p>
             )}
            </Link>
           ))
          )}
         </div>
        </div>
       )}
      </div>
      )}
     </div>
    </header>

    <main className="flex-1 min-h-0 !bg-zinc-200 p-4 md:mx-auto md:w-full md:max-w-none md:pb-4">
     <AppShellContentToolbar />
     {children}
    </main>
   </div>
  </div>
  </PageHeaderProvider>
  </WorkOrderStatusColorsProvider>
 );
}
