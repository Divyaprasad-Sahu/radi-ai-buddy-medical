import { Clock, ChevronRight } from "lucide-react";
import { t, type Language } from "@/lib/i18n";
import type { HistoryItem } from "@/lib/store";

interface Props {
  history: HistoryItem[];
  language: Language;
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, language, onSelect, onClear }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-heading text-sm font-semibold text-foreground">
          {t(language, "historyTitle")}
        </h3>
        <button className="ml-auto text-sm" onClick={onClear}>{t(language, "clearHistory")}</button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {history.length === 0 ? (
          <p className="p-5 text-center text-sm text-muted-foreground">
            {t(language, "noHistory")}
          </p>
        ) : (
          history.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left transition-colors last:border-0 hover:bg-accent/50"
            >
              <img
                src={item.imageUrl}
                alt={t(language, "xrayPreview")}
                className="h-10 w-10 rounded-md object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {t(language, item.result.disease === "Pneumonia" ? "pneumonia" : item.result.disease === "Uncertain" ? "uncertain" : "normal")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.timestamp).toLocaleDateString(language)} •{" "}
                  {Math.round(item.result.confidence * 100)}%
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
