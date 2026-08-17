import type { ChatMessage } from "../lib/api";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mdToHtml(raw: string): string {
  const text = String(raw ?? "");
  if (!text.trim()) return "";
  let s = esc(text);
  s = s.replace(
    /\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  return s
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return '<div class="md-gap"></div>';
      if (/^\d+\.\s+/.test(t)) {
        return `<div class="md-item">${t.replace(/^(\d+)\.\s+/, '<span class="md-n">$1.</span> ')}</div>`;
      }
      if (/^[-*]\s+/.test(t)) {
        return `<div class="md-li">${t.replace(/^[-*]\s+/, "• ")}</div>`;
      }
      return `<div class="md-p">${line}</div>`;
    })
    .join("");
}

export function MarkdownBody({ text }: { text: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />;
}

export function visibleMessages(messages: ChatMessage[] | undefined, fallbackReply?: string): ChatMessage[] {
  const list = (messages || []).filter((m) => m.role === "user" || m.role === "assistant");
  if (list.length) return list;
  if (fallbackReply) return [{ role: "assistant", content: fallbackReply }];
  return [];
}
