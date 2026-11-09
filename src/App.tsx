import { useState, useEffect } from 'react';
import type { TabKey, RecordItem, ServerStatus } from './types.ts';
import { RECORDS } from './data/database.ts';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { ArchiveScreen } from './screens/ArchiveScreen.tsx';
import { GuildsScreen } from './screens/GuildsScreen.tsx';
import { GeminiQAScreen } from './screens/GeminiQAScreen.tsx';
import { SourcesCommunityScreen } from './screens/SourcesCommunityScreen.tsx';
import { AuthorScreen } from './screens/AuthorScreen.tsx';
import { RecordDetailModal } from './screens/RecordDetailModal.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  // Fetch status from server on mount
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch (e) {
      console.warn('Could not connect to /api/status endpoint (client-only fallback active):', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Handle Tab Switch & Scroll to top
  const handleSelectTab = (tab: TabKey) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Find index for next/prev navigation
  const currentIndex = selectedRecord
    ? RECORDS.findIndex((r) => r.id === selectedRecord.id)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < RECORDS.length - 1;

  const handleNext = () => {
    if (hasNext) {
      setSelectedRecord(RECORDS[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setSelectedRecord(RECORDS[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#292524]">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        hasApiKey={serverStatus?.hasApiKey ?? false}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {activeTab === 'home' && (
          <HomeScreen
            onSelectTab={handleSelectTab}
            onSelectRecord={(rec) => setSelectedRecord(rec)}
          />
        )}

        {activeTab === 'archive' && (
          <ArchiveScreen onSelectRecord={(rec) => setSelectedRecord(rec)} />
        )}

        {activeTab === 'guilds' && <GuildsScreen />}

        {activeTab === 'ask' && (
          <GeminiQAScreen
            serverStatus={serverStatus}
            onRefreshStatus={fetchStatus}
          />
        )}

        {activeTab === 'sources' && <SourcesCommunityScreen />}

        {activeTab === 'author' && <AuthorScreen />}
      </main>

      {/* Record Detail Modal */}
      <RecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onNext={handleNext}
        onPrev={handlePrev}
        hasNext={hasNext}
        hasPrev={hasPrev}
      />

      {/* Footer */}
      <Footer onSelectTab={handleSelectTab} />
    </div>
  );
}
