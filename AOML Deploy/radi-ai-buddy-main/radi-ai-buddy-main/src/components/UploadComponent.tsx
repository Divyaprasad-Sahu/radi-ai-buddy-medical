import { useState, useRef, useCallback } from "react";

import { Upload, SlidersHorizontal, X } from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

import { t, type Language } from "@/lib/i18n";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

import { toast } from "sonner";



interface Props {

  language: Language;

  onSubmit: (file: File, symptoms: string) => void;

  loading: boolean;

}



export function UploadComponent({ language, onSubmit, loading }: Props) {

  const [inspect,setInspect]=useState(false);

  const [brightness,setBrightness]=useState(100);

  const [contrast,setContrast]=useState(100);

  const [file, setFile] = useState<File | null>(null);

  const [preview, setPreview] = useState<string | null>(null);

  const [symptoms, setSymptoms] = useState("");

  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);



  const handleFile = useCallback((f: File) => {

    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { toast.error(t(language, "invalid_image")); return; }

    if (f.size > 10 * 1024 * 1024) { toast.error(t(language, "too_large")); return; }

    setBrightness(100);setContrast(100);

    setFile(f);

    const reader = new FileReader();

    reader.onload = (e) => setPreview(e.target?.result as string);

    reader.readAsDataURL(f);

  }, [language]);



  const handleDrop = useCallback(

    (e: React.DragEvent) => {

      e.preventDefault();

      setDragOver(false);

      const f = e.dataTransfer.files[0];

      if (f && f.type.startsWith("image/")) handleFile(f);

    },

    [handleFile]

  );



  const clearFile = () => {

    setFile(null);

    setPreview(null);

    if (inputRef.current) inputRef.current.value = "";

  };



  return (

    <div className="space-y-4">

      <h2 className="font-heading text-xl font-bold text-foreground">

        {t(language, "uploadTitle")}

      </h2>



      <div

        onDragOver={(e) => {

          e.preventDefault();

          setDragOver(true);

        }}

        onDragLeave={() => setDragOver(false)}

        onDrop={handleDrop}

        onClick={() => !file && inputRef.current?.click()}

        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${

          dragOver

            ? "border-primary bg-primary/5"

            : file

            ? "border-border bg-card"

            : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5"

        }`}

      >

        <input

          ref={inputRef}

          type="file"

          accept="image/jpeg,image/png,image/webp"

          aria-label={t(language, "uploadTitle")}

          className="hidden"

          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}

        />



        <AnimatePresence mode="wait">

          {preview ? (

            <motion.div

              key="preview"

              initial={{ opacity: 0, scale: 0.95 }}

              animate={{ opacity: 1, scale: 1 }}

              exit={{ opacity: 0 }}

              className="relative"

            >

              <img

                src={preview}

                alt={t(language, "xrayPreview")}

                className="mx-auto max-h-56 rounded-lg object-contain"

              />

              <button

                aria-label={t(language, "removeImage")}

                onClick={(e) => {

                  e.stopPropagation();

                  clearFile();

                }}

                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-110"

              >

                <X className="h-4 w-4" />

              </button>

              <p className="mt-3 text-sm text-muted-foreground">{file?.name}</p>

            </motion.div>

          ) : (

            <motion.div

              key="empty"

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              className="flex flex-col items-center gap-3"

            >

              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">

                <Upload className="h-6 w-6 text-primary" />

              </div>

              <div>

                <p className="font-medium text-foreground">{t(language, "dragDrop")}</p>

                <p className="text-sm text-muted-foreground">{t(language, "orBrowse")}</p>

              </div>

              <p className="text-xs text-muted-foreground">{t(language, "supportedFormats")}</p>

            </motion.div>

          )}

        </AnimatePresence>

      </div>



      {preview && <><button onClick={()=>setInspect(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm hover:bg-muted"><SlidersHorizontal className="h-4 w-4"/>{t(language,"inspectImage")}</button>

      <Dialog open={inspect} onOpenChange={setInspect}><DialogContent closeLabel={t(language,"close")} className="max-w-3xl"><DialogHeader><DialogTitle>{t(language,"inspectImage")}</DialogTitle><DialogDescription>{t(language,"originalUpload")}</DialogDescription></DialogHeader>

      <div className="flex h-[45vh] items-center justify-center overflow-hidden rounded-xl bg-slate-950"><img src={preview} alt={t(language,"xrayPreview")} className="max-h-full max-w-full object-contain" style={{filter:`brightness(${brightness}%) contrast(${contrast}%)`}}/></div>

      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm">{t(language,"brightness")} · {brightness}%<input aria-label={t(language,"brightness")} className="block w-full accent-primary" type="range" min="50" max="200" value={brightness} onChange={e=>setBrightness(Number(e.target.value))}/></label><label className="space-y-2 text-sm">{t(language,"contrast")} · {contrast}%<input aria-label={t(language,"contrast")} className="block w-full accent-primary" type="range" min="50" max="200" value={contrast} onChange={e=>setContrast(Number(e.target.value))}/></label></div>

      <button className="rounded-xl border py-2 text-sm hover:bg-muted" onClick={()=>{setBrightness(100);setContrast(100);}}>{t(language,"reset")}</button></DialogContent></Dialog></>}

      <textarea

        maxLength={2000}

        aria-label={t(language, "symptoms")}

        value={symptoms}

        onChange={(e) => setSymptoms(e.target.value)}

        placeholder={t(language, "symptoms")}

        rows={2}

        className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"

      />



      <button

        onClick={() => file && onSubmit(file, symptoms)}

        disabled={!file || loading}

        className="w-full rounded-lg gradient-primary px-6 py-3 font-heading font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"

      >

        {loading ? t(language, "uploading") : t(language, "upload")}

      </button>

    </div>

  );

}

