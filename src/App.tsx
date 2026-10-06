import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SettingsProvider } from './hooks/useSettings';
import { ToastProvider } from './hooks/useToast';
import { UserDataProvider } from './hooks/useUserData';
import { ChapterPage } from './pages/ChapterPage';
import { HomePage } from './pages/HomePage';
import { JuzPage } from './pages/JuzPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PagePage } from './pages/PagePage';
import { SearchPage } from './pages/SearchPage';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <SettingsProvider>
      <UserDataProvider>
        <ToastProvider>
          <BrowserRouter>
            <Navbar onOpenSettings={() => setSettingsOpen(true)} />
            <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/juz/:n" element={<JuzPage />} />
              <Route path="/page/:n" element={<PagePage />} />
              <Route path="/:a" element={<ChapterPage />} />
              <Route path="/:a/:b" element={<ChapterPage />} />
              <Route path="/:a/:b/:c" element={<ChapterPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <Footer />
          </BrowserRouter>
        </ToastProvider>
      </UserDataProvider>
    </SettingsProvider>
  );
}
