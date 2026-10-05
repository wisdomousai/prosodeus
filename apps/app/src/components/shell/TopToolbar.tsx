import type { AiSlopMatcherMode } from "@prosodeus/shared/browser";
import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Copy, Download, Loader2, Menu, Sparkles } from "lucide-react";
import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { styleDisplayName } from "@/lib/style-labels";
import { cn } from "@/lib/utils";

export type NavEntry = { label: string; to: string; icon: LucideIcon };

export type TopToolbarProps = {
  /** Mobile navigation entries — rendered in a hamburger-triggered sheet on small screens. */
  navEntries?: NavEntry[];
  /** Breadcrumb items left-to-right (excluding the editable title at the end). */
  breadcrumb?: Array<{ label: string; to?: string }>;
  /** Editable document title; pass undefined for non-document routes. */
  title?: string;
  onTitleChange?: (next: string) => void;
  /** "Saved", "Saving…", "Unsaved" — short label, right of the title. */
  saveState?: string;
  /** Style guide selector. */
  styles?: Array<{ id: string; name: string }>;
  styleId?: string;
  onStyleChange?: (id: string) => void;
  /** Model selector. */
  models?: Array<{ id: string; name: string }>;
  modelId?: string;
  onModelChange?: (id: string) => void;
  /** Static candidate matcher depth. */
  aiSlopMode?: AiSlopMatcherMode;
  onAiSlopModeChange?: (mode: AiSlopMatcherMode) => void;
  /** Background rewrite-suggestion toggle ("Rewrite options"). */
  backgroundSuggest?: boolean;
  onBackgroundSuggestChange?: (on: boolean) => void;
  /** Analyze button. */
  onAnalyze?: () => void;
  analyzing?: boolean;
  /** Client-side export of current document text (document route). */
  onExportPlain?: () => void;
  onExportMarkdown?: () => void;
  onCopyPlain?: () => void;
  /** Slot for trailing icon buttons (export, share, overflow). */
  trailing?: React.ReactNode;
};

export function TopToolbar({
  navEntries,
  breadcrumb,
  title,
  onTitleChange,
  saveState,
  styles,
  styleId,
  onStyleChange,
  models,
  modelId,
  onModelChange,
  aiSlopMode,
  onAiSlopModeChange,
  backgroundSuggest,
  onBackgroundSuggestChange,
  onAnalyze,
  analyzing,
  onExportPlain,
  onExportMarkdown,
  onCopyPlain,
  trailing,
}: TopToolbarProps) {
  const [navOpen, setNavOpen] = React.useState(false);
  const location = useLocation();

  return (
    <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 text-foreground md:h-14 md:flex-nowrap md:gap-3 md:px-5 md:py-0">
      {navEntries && navEntries.length > 0 ? (
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="mr-1 size-8 text-foreground md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-card p-0 text-foreground">
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle className="text-base font-semibold text-foreground">Prosodeus</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-2 py-3">
              {navEntries.map((entry) => {
                const Icon = entry.icon;
                const active =
                  location.pathname === entry.to ||
                  (entry.to !== "/app" && location.pathname.startsWith(entry.to));
                return (
                  <Link
                    key={entry.to}
                    to={entry.to}
                    onClick={() => setNavOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {entry.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      ) : null}

      <Breadcrumb className="min-w-0 flex-1 md:shrink">
        <BreadcrumbList className="text-xs">
          {breadcrumb?.map((item, idx) => {
            const isLast = idx === breadcrumb.length - 1 && title === undefined;
            return (
              <React.Fragment key={`${item.label}-${idx}`}>
                <BreadcrumbItem>
                  {item.to && !isLast ? (
                    <BreadcrumbLink asChild>
                      <Link to={item.to}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <span className={isLast ? "text-foreground" : "text-muted-foreground"}>
                      {item.label}
                    </span>
                  )}
                </BreadcrumbItem>
                {idx < breadcrumb.length - 1 ? <BreadcrumbSeparator /> : null}
              </React.Fragment>
            );
          })}
          {title !== undefined ? (
            <>
              {breadcrumb && breadcrumb.length > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {onTitleChange ? (
                  <input
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className={cn(
                      "w-full min-w-[10ch] max-w-[20ch] truncate bg-transparent text-foreground md:max-w-[40ch]",
                      "rounded border-0 px-1 py-0.5 text-sm font-medium outline-none focus:bg-muted",
                    )}
                    spellCheck={false}
                    aria-label="Document title"
                  />
                ) : (
                  <span className="px-1 py-0.5 text-sm font-medium text-foreground">{title}</span>
                )}
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>

      {saveState ? (
        <span className="hidden font-mono text-[11px] uppercase tracking-wider text-muted-foreground md:inline">
          {saveState}
        </span>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        {styles && styles.length > 0 ? (
          <Select value={styleId ?? ""} onValueChange={onStyleChange}>
            <SelectTrigger size="sm" className="h-8 w-[8.5rem] text-xs">
              <SelectValue placeholder="Style guide" />
            </SelectTrigger>
            <SelectContent>
              {styles.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {styleDisplayName(s.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {models && models.length > 0 ? (
          <Select value={modelId ?? ""} onValueChange={onModelChange}>
            <SelectTrigger size="sm" className="h-8 w-[7rem] text-xs">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {onAiSlopModeChange ? (
          <Select
            value={aiSlopMode ?? "tiered"}
            onValueChange={(value) => onAiSlopModeChange(value as AiSlopMatcherMode)}
          >
            <SelectTrigger size="sm" className="h-8 w-[7rem] text-xs">
              <SelectValue placeholder="Markers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off" className="text-xs">
                Off
              </SelectItem>
              <SelectItem value="fast" className="text-xs">
                Fast
              </SelectItem>
              <SelectItem value="tiered" className="text-xs">
                Tiered
              </SelectItem>
              <SelectItem value="exhaustive" className="text-xs">
                Exhaustive
              </SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        {onBackgroundSuggestChange ? (
          <label className="hidden h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-muted-foreground sm:inline-flex">
            <input
              type="checkbox"
              className="sr-only"
              checked={backgroundSuggest ?? false}
              onChange={(event) => onBackgroundSuggestChange(event.currentTarget.checked)}
            />
            <span
              aria-hidden="true"
              className={cn(
                "relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors",
                backgroundSuggest ? "border-primary bg-primary/80" : "border-border bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-background shadow-sm transition-transform",
                  backgroundSuggest ? "translate-x-3.5" : "translate-x-0.5",
                )}
              />
            </span>
            <span>Rewrite options</span>
          </label>
        ) : null}

        {onAnalyze ? (
          <Button
            size="sm"
            onClick={onAnalyze}
            disabled={analyzing}
            className="h-8 gap-1.5"
            aria-label={analyzing ? "Analyzing" : "Analyze"}
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{analyzing ? "Analyzing" : "Analyze"}</span>
          </Button>
        ) : null}

        {(onExportPlain || onExportMarkdown || onCopyPlain) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onExportPlain ? (
                <DropdownMenuItem onClick={onExportPlain}>Plain text (.txt)</DropdownMenuItem>
              ) : null}
              {onExportMarkdown ? (
                <DropdownMenuItem onClick={onExportMarkdown}>Markdown (.md)</DropdownMenuItem>
              ) : null}
              {onCopyPlain ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onCopyPlain}>
                    <Copy className="mr-2 size-3.5" />
                    Copy plain text
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {trailing}
      </div>
    </header>
  );
}
