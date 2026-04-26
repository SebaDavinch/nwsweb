import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "./ui/utils";

export type DocumentContentFormat = "markdown" | "html" | "plain";

const DOCUMENT_FORMATS = new Set<DocumentContentFormat>(["markdown", "html", "plain"]);

const contentClassName = cn(
  "text-sm leading-7 text-gray-700",
  "[&_a]:font-medium [&_a]:text-[#E31E24] [&_a]:underline-offset-4 hover:[&_a]:underline",
  "[&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600",
  "[&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_em]:italic [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:text-gray-900",
  "[&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-gray-900",
  "[&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-gray-900",
  "[&_hr]:my-8 [&_hr]:border-gray-200 [&_li]:ml-5 [&_li]:mt-1",
  "[&_ol]:my-4 [&_ol]:list-decimal [&_p]:my-4 [&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-[#111827] [&_pre]:p-4 [&_pre]:text-gray-100",
  "[&_strong]:font-semibold [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-gray-200",
  "[&_tbody_tr:nth-child(even)]:bg-gray-50 [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2",
  "[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:my-4 [&_ul]:list-disc"
);

const isDocumentContentFormat = (value: unknown): value is DocumentContentFormat =>
  typeof value === "string" && DOCUMENT_FORMATS.has(value as DocumentContentFormat);

export const resolveDocumentContentFormat = (
  content: string | null | undefined,
  format: string | null | undefined
): DocumentContentFormat => {
  const normalizedFormat = String(format || "").trim().toLowerCase();
  if (isDocumentContentFormat(normalizedFormat)) {
    return normalizedFormat;
  }

  const normalizedContent = String(content || "").trim();
  if (/<\/?[a-z][^>]*>/i.test(normalizedContent)) {
    return "html";
  }

  return "markdown";
};

interface DocumentRendererProps {
  content?: string | null;
  format?: string | null;
  className?: string;
  emptyMessage?: string;
}

export function DocumentRenderer({
  content,
  format,
  className,
  emptyMessage = "No content available.",
}: DocumentRendererProps) {
  const normalizedContent = String(content || "").trim();

  if (!normalizedContent) {
    return <div className={cn("text-sm text-gray-500", className)}>{emptyMessage}</div>;
  }

  const resolvedFormat = resolveDocumentContentFormat(normalizedContent, format);

  if (resolvedFormat === "html") {
    const sanitizedHtml = DOMPurify.sanitize(normalizedContent, {
      USE_PROFILES: { html: true },
    });

    return (
      <div
        className={cn(contentClassName, className)}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  if (resolvedFormat === "plain") {
    return (
      <div className={cn(contentClassName, "whitespace-pre-wrap", className)}>
        {normalizedContent}
      </div>
    );
  }

  return (
    <div className={cn(contentClassName, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          h1: ({ children }) => <h1>{children}</h1>,
          h2: ({ children }) => <h2>{children}</h2>,
          h3: ({ children }) => <h3>{children}</h3>,
          ul: ({ children }) => <ul>{children}</ul>,
          ol: ({ children }) => <ol>{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => <blockquote>{children}</blockquote>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          code: ({ className: codeClassName, children, ...props }) => (
            <code className={codeClassName} {...props}>
              {children}
            </code>
          ),
          pre: ({ children }) => <pre>{children}</pre>,
          table: ({ children }) => <table>{children}</table>,
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th>{children}</th>,
          td: ({ children }) => <td>{children}</td>,
          hr: () => <hr />,
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}