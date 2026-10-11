import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { EditorPage } from './pages/EditorPage';
import { SharedPage } from './pages/SharedPage';
import { Toaster } from './components/Toaster';
import { ErrorBoundary } from './components/ErrorBoundary';

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  const checked = useAuth((s) => s.checked);
  const check = useAuth((s) => s.check);
  useEffect(() => {
    check();
  }, [check]);
  if (!checked) return null;
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/s/:token" element={<SharedPage />} />
        <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/design/:id" element={<RequireAuth><ErrorBoundary><EditorPage /></ErrorBoundary></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
