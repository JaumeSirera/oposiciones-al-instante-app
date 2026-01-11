import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  BookOpen, 
  Clock, 
  Brain, 
  Zap, 
  TrendingUp, 
  History, 
  Award, 
  FileText, 
  Wand2, 
  Sparkles,
  Home,
  PlusCircle,
  Calendar,
  Dumbbell,
  User,
  Bell,
  Mail,
  Download,
  Layers
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useAppUpdateContext } from "@/contexts/AppUpdateContext";
import { useFlashcardStats } from "@/hooks/useFlashcardStats";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/logo.png";

export function AppSidebar() {
  const { open, isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const { isSuperAdmin, isAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const { pendingCount } = useFlashcardStats();
  
  // Estado de actualización disponible
  let updateAvailable = false;
  let openAppStore: (() => Promise<void>) | null = null;
  
  try {
    const updateContext = useAppUpdateContext();
    updateAvailable = updateContext.updateAvailable;
    openAppStore = updateContext.openAppStore;
  } catch {
    // El contexto no está disponible (fuera del provider)
  }
  
  // Textos del badge según idioma
  const getUpdateText = () => {
    const lang = i18n.language;
    if (lang === 'es') return 'Actualizar app';
    if (lang === 'fr') return 'Mettre à jour';
    if (lang === 'pt') return 'Atualizar app';
    if (lang === 'de') return 'App aktualisieren';
    if (lang === 'zh') return '更新应用';
    return 'Update app';
  };

  const menuItems = [
    {
      group: t('sidebar.principal'),
      items: [
        { title: t('nav.home'), url: "/", icon: Home },
      ]
    },
    {
      group: t('sidebar.tests'),
      items: [
        { title: t('sidebar.startTest'), url: "/test", icon: BookOpen },
        { title: t('sidebar.timedSimulation'), url: "/simulacro", icon: Clock },
        { title: t('sidebar.psychoTest'), url: "/test-psicotecnico", icon: Brain },
        { title: t('sidebar.psychoSimulation'), url: "/simulacro-psicotecnico", icon: Zap },
        { title: t('sidebar.personalityTest'), url: "/test-personalidad", icon: User },
      ]
    },
    {
      group: t('sidebar.myProgress'),
      items: [
        { title: t('nav.statistics'), url: "/estadisticas", icon: TrendingUp },
        { title: t('nav.history'), url: "/historial", icon: History },
        { title: t('nav.ranking'), url: "/ranking", icon: Award },
        { title: t('nav.flashcards'), url: "/flashcards", icon: Layers },
        { title: t('nav.flashcardReminders'), url: "/flashcards/configurar-recordatorios", icon: Bell },
      ]
    },
    {
      group: t('sidebar.aiTools'),
      items: [
        { title: t('sidebar.generateQuestions'), url: "/crear-test", icon: Wand2 },
        { title: t('sidebar.generatePsycho'), url: "/crear-psicotecnicos", icon: Sparkles },
        { title: t('sidebar.createSummary'), url: "/crear-resumen", icon: PlusCircle },
        { title: t('nav.studyPlans'), url: "/planes-estudio", icon: Calendar, notForUsuario: true },
        { title: t('nav.physicalPlans'), url: "/planes-fisicos", icon: Dumbbell, notForUsuario: true },
        { title: t('nav.reminders'), url: "/administrar-recordatorios", icon: Bell, requiresAdmin: true },
        { title: "Email Actualización", url: "/enviar-email-actualizacion", icon: Mail, requiresSA: true },
      ]
    },
    {
      group: t('sidebar.resources'),
      items: [
        { title: t('nav.summaries'), url: "/resumenes", icon: FileText },
      ]
    }
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  // Filtrar secciones según el nivel del usuario
  const filteredMenuItems = menuItems.map(section => {
    if (section.group === t('sidebar.aiTools')) {
      // SA puede ver todo
      if (isSuperAdmin) {
        return section;
      }
      
      // Administrador puede ver herramientas IA excepto las que requieren SA
      if (isAdmin) {
        return {
          ...section,
          items: section.items.filter(item => {
            const itemAny = item as any;
            // Filtrar items que requieren SA
            if (itemAny.requiresSA) return false;
            // Filtrar items que requieren admin
            if (itemAny.requiresAdmin && !isAdmin && !isSuperAdmin) return false;
            return true;
          })
        };
      }
      
      // Usuario normal no puede ver ninguna herramienta IA
      return null;
    }
    return section;
  }).filter(Boolean) as typeof menuItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b flex items-center justify-center">
          {open ? (
            <div className="flex items-center gap-2">
              <img src={logo} alt={t('appName')} className="h-8 w-8" />
              <h2 className="font-bold text-lg">
                <span className="text-blue-600">{t('appNamePart1')}</span>
                <span className="text-green-600">{t('appNamePart2')}</span>
              </h2>
            </div>
          ) : (
            <img src={logo} alt={t('appName')} className="h-8 w-8" />
          )}
        </div>

        {filteredMenuItems.map((section) => (
          <SidebarGroup key={section.group}>
            {open && <SidebarGroupLabel>{section.group}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  const isFlashcards = item.url === '/flashcards';
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          onClick={() => {
                            if (isMobile) {
                              setOpenMobile(false);
                            }
                          }}
                          className="flex items-center justify-between w-full"
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </div>
                          {isFlashcards && pendingCount > 0 && (
                            <Badge 
                              variant="destructive" 
                              className="text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center"
                            >
                              {pendingCount > 99 ? '99+' : pendingCount}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        
        {/* Badge de actualización disponible */}
        {updateAvailable && (
          <div className="p-3 mt-auto border-t">
            <button
              onClick={() => openAppStore?.()}
              className="w-full flex items-center gap-2 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-primary text-sm font-medium"
            >
              <Download className="h-4 w-4 flex-shrink-0" />
              {open && (
                <span className="flex items-center gap-2">
                  {getUpdateText()}
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">
                    NEW
                  </Badge>
                </span>
              )}
              {!open && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0 absolute -top-1 -right-1">
                  !
                </Badge>
              )}
            </button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
