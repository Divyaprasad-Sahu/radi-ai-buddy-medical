import { Globe } from "lucide-react";
import type { Language } from "@/lib/i18n";

const langs: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "mr", label: "मराठी" },
];

interface Props {
  language: Language;
  onChange: (lang: Language) => void;
}

export function LanguageSelector({ language, onChange }: Props) {
  return (
    <div className="relative flex items-center gap-1.5">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <select
        aria-label="Language"
        value={language}
        onChange={(e) => onChange(e.target.value as Language)}
        className="appearance-none rounded-md border border-border bg-card px-2 py-1.5 pr-6 text-sm text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {langs.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
