import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import CreateSesionPage from "./CreateSesionPage";
import SesionsPage from "./SesionsPage";
import Dashboard from "./Dashboard";
import Home from "./Home";
import Recover from "./Recover";
import { Login, Register } from "./Auth";
import HistorialPage from "./HistorialPage";
import AnaliticaPage from "./AnaliticaPage";






function PrivateRoute({user, checking}) {
    if (checking) {
        return <div>Cargando...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}


export default function AppRoutes({user, checking, onLogin}) {
    return (
        <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/login" element={<Login onLogin={onLogin} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/recover" element={<Recover />} />
            <Route path="/analitica" element={<AnaliticaPage user={user} />} />

            <Route 
                element={<PrivateRoute user={user} checking={checking} />}
            >
                <Route 
                    path="/dashboard"
                    element={<Dashboard user={user} />}
                />
                <Route path="/new-study" element={<CreateSesionPage />} />
                <Route path="/sesions" element={<SesionsPage />} />

                <Route path="/historial" element={<HistorialPage />} />
                <Route path="/analitica" element={<AnaliticaPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
    );
}
