import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Props {
  children: string;
  className?: string;
}

export default function MarkdownMath({ children, className = '' }: Props) {
  return (
    <div className={`markdown-math ${className}`} dir="auto">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <p className="text-base font-bold text-on-surface mt-2 mb-1">{children}</p>,
          h2: ({ children }) => <p className="text-sm font-bold text-primary mt-2 mb-1">{children}</p>,
          h3: ({ children }) => <p className="text-sm font-semibold text-on-surface mt-1.5 mb-0.5">{children}</p>,
          p: ({ children }) => <p className="text-sm text-on-surface leading-relaxed mb-1 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-on-surface">{children}</strong>,
          em: ({ children }) => <em className="italic text-on-surface-variant">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1 text-sm">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1 text-sm">{children}</ol>,
          li: ({ children }) => <li className="text-sm text-on-surface">{children}</li>,
          hr: () => <hr className="border-outline-variant/30 my-2" />,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            return isBlock
              ? <code className="block bg-surface-container/60 rounded-lg p-2 text-xs font-mono text-on-surface my-1 overflow-x-auto" dir="ltr">{children}</code>
              : <code className="bg-surface-container/60 rounded px-1 text-xs font-mono text-primary">{children}</code>;
          },
          blockquote: ({ children }) => <blockquote className="border-r-2 border-primary/40 pr-3 my-1 text-on-surface-variant italic">{children}</blockquote>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
