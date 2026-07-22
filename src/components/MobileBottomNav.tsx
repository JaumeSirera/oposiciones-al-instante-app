import { NavLink } from "react-router-dom";
import { Home, BookOpen, Clock, Layers, FileText, Award } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFlashcardStats } from "@/hooks/useFlashcardStats";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { pendingCount } = useFlashcardStats();

  if (!isMobile) return null;

  const items = [
    { to: "/dashboard", label: t("nav.home"), icon: Home, end: true },
    { to: "/test", label: t("sidebar.startTest"), icon: BookOpen },
    { to: "/simulacro", label: t("sidebar.timedSimulation"), icon: Clock },
    { to: "/flashcards", label: t("nav.flashcards"), icon: Layers, badge: pendingCount },
    { to: "/resumenes", label: t("nav.summaries"), icon: FileText },
    { to: "/ranking", label: t("nav.ranking"), icon: Award },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación inferior"
    >
      <ul className="grid grid-cols-6">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] leading-tight transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge && item.badge > 0 ? (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 text-[9px] flex items-center justify-center"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </Badge>
                ) : null}
              </div>
              <span className="truncate max-w-full">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
