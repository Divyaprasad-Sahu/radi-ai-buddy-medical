import { Moon, Sun, Stethoscope } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import type { Language } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface NavbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  dark: boolean;
  onToggleDark: () => void;
  onHome: () => void;
}

export function Navbar({ language, onLanguageChange, dark, onToggleDark, onHome }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <button type="button" onClick={onHome} aria-label={t(language,"home")} className="flex items-center gap-2.5 rounded-xl text-left outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-lg font-bold text-foreground">
            Radiant<span className="text-primary">.</span>
          </span>
        </button>

        <div className="flex items-center gap-3">
          <LanguageSelector language={language} onChange={onLanguageChange} />
          <button
            onClick={onToggleDark}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t(language, "toggleDark")}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
}

