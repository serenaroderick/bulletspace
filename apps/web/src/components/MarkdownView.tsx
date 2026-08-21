import type { AnchorHTMLAttributes } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toMarkdownLinks } from "../lib/wikilinks";

const WIKILINK_PREFIX = "bulletspace://entry/";

// react-markdown sanitizes unrecognized URI schemes by default (only
// http/https/mailto/relative survive); bulletspace:// needs an explicit
// pass-through or wikilinks silently lose their href.
function urlTransform(url: string): string {
  return url.startsWith(WIKILINK_PREFIX) ? url : defaultUrlTransform(url);
}

interface MarkdownViewProps {
  content: string;
  onNavigate: (title: string) => void;
}

export function MarkdownView({ content, onNavigate }: MarkdownViewProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={urlTransform}
      components={{
        a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => {
          const href = props.href ?? "";
          if (href.startsWith(WIKILINK_PREFIX)) {
            const title = decodeURIComponent(href.slice(WIKILINK_PREFIX.length));
            return (
              <button
                type="button"
                className="wikilink"
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(title);
                }}
              >
                {props.children}
              </button>
            );
          }
          return (
            <a {...props} target="_blank" rel="noreferrer">
              {props.children}
            </a>
          );
        },
      }}
    >
      {toMarkdownLinks(content)}
    </ReactMarkdown>
  );
}
