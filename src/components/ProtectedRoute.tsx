// src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import React, { ReactNode } from 'react'; // Importamos ReactNode

interface ProtectedRouteProps {
    children: ReactNode; // Agregamos la prop children
}

// Recibe 'children' como prop
export default function ProtectedRoute({ children }: ProtectedRouteProps) { 
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    // Puedes poner un spinner aquí para la carga inicial
    if (isLoading) return null; 

    // Si está autenticado, renderiza los hijos (Layout + Routes internas)
    return isAuthenticated
        ? <>{children}</> // Renderiza los hijos que le pasamos desde App.tsx
        // Si NO está autenticado, redirige a /auth
        : <Navigate to="/auth" replace state={{ from: location }} />;
}
