import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { LandingPage } from "@/components/LandingPage";
import { Dashboard } from "@/components/Dashboard";
import { useLanguage, useDarkMode, useHistory } from "@/lib/store";

const Index = () => {
  const { language, changeLanguage } = useLanguage();
  const { dark, toggleDark } = useDarkMode();
  const { history, addToHistory, clearHistory } = useHistory();
  const [started, setStarted] = useState(false);
  const [initialTab,setInitialTab]=useState<"dashboard"|"chat">("dashboard");

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        language={language}
        onLanguageChange={changeLanguage}
        dark={dark}
        onToggleDark={toggleDark}
        onHome={() => setStarted(false)}
      />
      {started ? (
        <Dashboard
          language={language}
          history={history}
          onAddHistory={addToHistory}
          onClearHistory={clearHistory}
          initialTab={initialTab}
          onBack={() => setStarted(false)}
        />
      ) : (
        <LandingPage language={language} onStart={() => {setInitialTab("dashboard");setStarted(true);}} onChat={() => {setInitialTab("chat");setStarted(true);}} />
      )}
    </div>
  );
};

export default Index;

