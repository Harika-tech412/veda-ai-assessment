"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ClipboardList,
  FileText,
  HelpCircle,
  History,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  School,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

type NavItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: LayoutGrid },
  { label: "My Classroom", icon: Presentation },
  { label: "Assignments", icon: FileText },
  { label: "Exams", icon: ClipboardList, active: true },
  { label: "My Library", icon: History },
];

// Purely decorative chrome matching the Figma app shell — no real routing.
// The sidebar is always icon-only below `md`; at `md`+ it can be manually
// collapsed to the same icon-only rail via the toggle in the header.
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const processingStage = useAppStore((state) => state.processingStage);
  const reset = useAppStore((state) => state.reset);
  const canGoBack = processingStage === "done";

  const labelClass = cn("hidden truncate", !collapsed && "md:inline");
  const rowClass = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 justify-center",
    !collapsed && "md:justify-start"
  );

  return (
    <div className="flex h-screen bg-canvas">
      <aside
        className={cn(
          "flex w-16 shrink-0 flex-col border-r border-border bg-surface transition-[width]",
          !collapsed && "md:w-64"
        )}
      >
        <div className="flex items-center justify-center gap-2 border-b border-border p-4 md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
              V
            </div>
            <span className={cn("text-base font-bold text-ink", labelClass)}>
              VedaAI
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-muted-bg md:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="p-3">
          <div
            className={cn(
              "mx-auto flex h-10 w-10 items-center justify-center gap-2 rounded-full border-2 border-accent bg-ink text-white",
              !collapsed && "md:w-full md:justify-start md:px-4"
            )}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className={cn("text-sm font-semibold", labelClass)}>
              AI Teacher&apos;s Toolkit
            </span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              className={cn(
                rowClass,
                item.active ? "bg-muted-bg font-semibold text-ink" : "text-ink-soft"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className={cn("text-sm", labelClass)}>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-border p-3">
          <div className={cn(rowClass, "text-ink-soft")}>
            <Settings className="h-4 w-4 shrink-0" />
            <span className={cn("text-sm", labelClass)}>Settings</span>
          </div>

          <div
            className={cn(
              "flex items-center justify-center gap-3 rounded-xl border border-border bg-muted-bg p-3",
              !collapsed && "md:justify-start"
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
              <School className="h-4 w-4" />
            </span>
            <span className={cn("min-w-0 flex-col", !collapsed && "md:flex", "hidden")}>
              <span className="truncate text-sm font-semibold text-ink">
                Delhi Public School
              </span>
              <span className="truncate text-xs text-muted">Bokaro Steel City</span>
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={canGoBack ? reset : undefined}
              aria-label="Back"
              disabled={!canGoBack}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors",
                canGoBack ? "hover:bg-muted-bg" : "cursor-default opacity-40"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="hidden items-center gap-1.5 text-sm font-medium text-ink-soft sm:flex">
              <ClipboardList className="h-4 w-4 text-muted" />
              Exams
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              aria-label="Help"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-muted-bg"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-muted-bg"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
            </button>
            <button
              type="button"
              aria-label="AI assistant"
              className="hidden h-8 w-8 items-center justify-center rounded-full text-accent transition-colors hover:bg-muted-bg sm:flex"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <div className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted-bg sm:pr-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted-bg text-muted">
                <UserRound className="h-4 w-4" />
              </span>
              <span className="hidden text-sm font-medium text-ink-soft md:inline">
                Madhur Rastogi
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted md:inline" />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
