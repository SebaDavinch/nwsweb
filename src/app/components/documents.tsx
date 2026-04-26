import { useEffect, useState } from "react";
import { DocumentRenderer } from "./document-renderer";
import { useLanguage } from "../context/language-context";
import { BookOpen, ChevronRight, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface PublicDocument {
  id: string;
  slug: string;
  title: string;
  description: string;
  category?: string;
  content?: string;
  contentFormat?: string;
  updatedAt?: string;
}

export function Documents() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<PublicDocument | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadDocuments = async () => {
      setIsListLoading(true);
      try {
        const response = await fetch("/api/public/documents");
        if (!response.ok) {
          throw new Error("Failed to load documents");
        }
        const payload = await response.json();
        const list = Array.isArray(payload?.documents) ? payload.documents : [];
        if (!active) {
          return;
        }
        setDocuments(list);
      } catch (error) {
        console.error("Failed to load documents", error);
        if (active) {
          setDocuments([]);
        }
      } finally {
        if (active) {
          setIsListLoading(false);
        }
      }
    };

    loadDocuments().catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeSlug) {
      setActiveDocument(null);
      return;
    }

    let active = true;

    const loadDocument = async () => {
      setIsDocumentLoading(true);
      try {
        const response = await fetch(`/api/public/documents/${activeSlug}`);
        if (!response.ok) {
          throw new Error("Failed to load document");
        }
        const payload = await response.json();
        if (active) {
          setActiveDocument(payload?.document || null);
        }
      } catch (error) {
        console.error("Failed to load document", error);
        if (active) {
          setActiveDocument(null);
        }
      } finally {
        if (active) {
          setIsDocumentLoading(false);
        }
      }
    };

    loadDocument().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [activeSlug]);

  const openDocument = (slug: string) => {
    setActiveSlug(slug);
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <section
        className="relative py-20 text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(42, 42, 42, 0.85), rgba(42, 42, 42, 0.85)), url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2N1bWVudHMlMjBvZmZpY2V8ZW58MXx8fHwxNzQwMDcyMDAwfDA&ixlib=rb-4.1.0&q=80&w=1080')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl mb-4">
            {t("documents.title")}
          </h1>
          <p className="text-xl text-gray-200">
            {t("documents.subtitle")}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
            <h3 className="text-xl text-blue-900 mb-2">{t("documents.info.title")}</h3>
            <p className="text-blue-800">{t("documents.info.description")}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {isListLoading ? (
              <div className="col-span-full flex items-center justify-center rounded-lg bg-white p-10 text-gray-500 shadow-lg">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading documents...
              </div>
            ) : documents.length > 0 ? (
              documents.map((document) => (
                <button
                  key={document.id}
                  onClick={() => openDocument(document.slug)}
                  className="group flex h-full w-full flex-col rounded-lg border-2 border-transparent bg-white p-6 text-left shadow-lg transition-all hover:border-[#E31E24] hover:shadow-xl"
                >
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-[#E31E24] text-white">
                    <FileText size={28} />
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-xl text-[#2A2A2A]">{document.title}</h3>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-gray-500">
                      {document.category || "General"}
                    </span>
                  </div>
                  <p className="mb-6 flex-1 text-gray-600">{document.description}</p>
                  <div className="flex items-center text-[#E31E24] transition-all group-hover:gap-2">
                    <span>{t("documents.readMore")}</span>
                    <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full rounded-lg bg-white p-10 text-center text-gray-500 shadow-lg">
                No published documents found.
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          {isDocumentLoading ? (
            <div className="flex min-h-[320px] items-center justify-center text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading document...
            </div>
          ) : activeDocument ? (
            <>
              <DialogHeader className="border-b border-gray-200 pb-5 pr-8 text-left">
                <div className="mb-3 flex items-center gap-3 text-sm uppercase tracking-[0.2em] text-gray-400">
                  <BookOpen size={16} />
                  <span>{activeDocument.category || "General"}</span>
                </div>
                <DialogTitle className="text-3xl text-[#2A2A2A]">{activeDocument.title}</DialogTitle>
                <DialogDescription className="mt-3 text-base text-gray-600">
                  {activeDocument.description}
                </DialogDescription>
                <p className="mt-2 text-xs text-gray-400">
                  Updated {activeDocument.updatedAt ? String(activeDocument.updatedAt).slice(0, 10) : "recently"}
                </p>
              </DialogHeader>

              <DocumentRenderer content={activeDocument.content} format={activeDocument.contentFormat} />
            </>
          ) : (
            <div className="flex min-h-[240px] items-center justify-center text-center text-gray-500">
              Select a document to open it.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
