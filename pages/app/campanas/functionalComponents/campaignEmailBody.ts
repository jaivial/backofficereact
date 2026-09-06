import type { CampaignTheme } from "../../../../api/types";

// Client twin of the backend markdown-to-email renderer (campaign_markdown.go).
// It only produces the body: the surrounding document is the shell served by
// the backend, so the preview matches the delivered email exactly.

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(line: string, theme: CampaignTheme): string {
  return escapeHTML(line)
    .replace(
      /!\[([^\]]*)\]\(([^)\s]+)\)/g,
      '<img src="$2" alt="$1" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:12px 0" />'
    )
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, `<a href="$2" style="color:${theme.accent};text-decoration:underline">$1</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function renderCampaignEmailBody(markdown: string, theme: CampaignTheme): string {
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      html += `<h3 style="margin:18px 0 8px;font-size:18px;color:${theme.text}">${renderInline(line.slice(4), theme)}</h3>`;
    } else if (line.startsWith("## ")) {
      closeList();
      html += `<h2 style="margin:20px 0 10px;font-size:22px;color:${theme.text}">${renderInline(line.slice(3), theme)}</h2>`;
    } else if (line.startsWith("# ")) {
      closeList();
      html += `<h1 style="margin:0 0 14px;font-size:27px;color:${theme.accent}">${renderInline(line.slice(2), theme)}</h1>`;
    } else if (line.startsWith("> ")) {
      closeList();
      html += `<blockquote style="margin:14px 0;padding:10px 14px;border-left:4px solid ${theme.accent};background:${theme.accent}11">${renderInline(line.slice(2), theme)}</blockquote>`;
    } else if (line === "---") {
      closeList();
      html += `<hr style="border:none;border-top:1px solid ${theme.text}33;margin:20px 0" />`;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        html += '<ul style="margin:10px 0;padding-left:20px">';
        inList = true;
      }
      html += `<li style="margin:4px 0">${renderInline(line.slice(2), theme)}</li>`;
    } else {
      closeList();
      html += `<p style="margin:10px 0;line-height:1.6">${renderInline(line, theme)}</p>`;
    }
  }
  closeList();
  return html;
}
