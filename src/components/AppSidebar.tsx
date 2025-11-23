import { NavLink, useLocation } from "react-router-dom";
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
  Bell
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
import logo from "@/assets/logo.png";

const menuItems = [
  {
    group: "Principal",
    items: [
      { title: "Inicio", url: "/", icon: Home },
    ]
  },
  {
    group: "Tests",
    items: [
      { title: "Iniciar Test", url: "/test", icon: BookOpen },
      { title: "Simulacro Cronometrado", url: "/simulacro", icon: Clock },
      { title: "Test Psicotécnico", url: "/test-psicotecnico", icon: Brain },
      { title: "Simulacro Psicotécnico", url: "/simulacro-psicotecnico", icon: Zap },
      { title: "Test de Personalidad", url: "/test-personalidad", icon: User },
    ]
  },
  {
    group: "Mi Progreso",
    items: [
      { title: "Estadísticas", url: "/estadisticas", icon: TrendingUp },
      { title: "Historial", url: "/historial", icon: History },
      { title: "Ranking", url: "/ranking", icon: Award },
    ]
  },
  {
    group: "Herramientas IA",
    items: [
      { title: "Generar Preguntas", url: "/crear-test", icon: Wand2 },
      { title: "Generar Psicotécnicos", url: "/crear-psicotecnicos", icon: Sparkles },
      { title: "Crear Resumen", url: "/crear-resumen", icon: PlusCircle },
      { title: "Planes de Estudio", url: "/planes-estudio", icon: Calendar, notForUsuario: true },
      { title: "Planes Físicos", url: "/planes-fisicos", icon: Dumbbell, notForUsuario: true },
      { title: "Recordatorios", url: "/administrar-recordatorios", icon: Bell, requiresAdmin: true },
    ]
  },
  {
    group: "Recursos",
    items: [
      { title: "Resúmenes", url: "/resumenes", icon: FileText },
    ]
  }
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { isSuperAdmin, isAdmin } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  // Filtrar secciones según el nivel del usuario
  const filteredMenuItems = menuItems.map(section => {
    if (section.group === "Herramientas IA") {
      // SA puede ver todo
      if (isSuperAdmin) return section;
      
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
              <img src={logo} alt="Oposiciones Test" className="h-8 w-8" />
              <h2 className="font-bold text-lg">
                <span className="text-blue-600">Oposiciones-</span>
                <span className="text-green-600">Test</span>
              </h2>
            </div>
          ) : (
            <img src={logo} alt="OT" className="h-8 w-8" />
          )}
        </div>

        {filteredMenuItems.map((section) => (
          <SidebarGroup key={section.group}>
            {open && <SidebarGroupLabel>{section.group}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink to={item.url} end={item.url === "/"}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
