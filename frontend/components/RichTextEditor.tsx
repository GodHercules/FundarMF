"use client";

import { useEffect, useRef } from "react";
import { FiAlignCenter, FiAlignJustify, FiAlignLeft, FiAlignRight, FiBold, FiCode, FiItalic, FiLink, FiList, FiRotateCcw, FiRotateCw, FiSlash, FiUnderline } from "react-icons/fi";

export type EditorMark = { type: "bold" | "italic" | "underline" | "strike" | "code" | "link"; attrs?: { href?: string } };
export type EditorInline = { type: "text"; text: string; marks?: EditorMark[] };
export type EditorBlock = { type: "paragraph" | "heading" | "blockquote" | "bulletList" | "orderedList"; attrs?: { level?: number; textAlign?: string }; content: EditorInline[] };
export type EditorDoc = { type: "doc"; content: EditorBlock[] };

const emptyDoc: EditorDoc = { type: "doc", content: [{ type: "paragraph", content: [] }] };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function editorDocToHtml(input: unknown) {
  const doc = (input && typeof input === "object" ? input : emptyDoc) as EditorDoc;
  return (Array.isArray(doc.content) ? doc.content : emptyDoc.content).map((block) => {
    const align = block.attrs?.textAlign ? ` style="text-align:${escapeHtml(block.attrs.textAlign)}"` : "";
    const inline = (block.content ?? []).map((item) => {
      let text = escapeHtml(item.text).replace(/\n/g, "<br />");
      for (const mark of item.marks ?? []) {
        if (mark.type === "bold") text = `<strong>${text}</strong>`;
        if (mark.type === "italic") text = `<em>${text}</em>`;
        if (mark.type === "underline") text = `<u>${text}</u>`;
        if (mark.type === "strike") text = `<s>${text}</s>`;
        if (mark.type === "code") text = `<code>${text}</code>`;
        if (mark.type === "link" && mark.attrs?.href) text = `<a href="${escapeHtml(mark.attrs.href)}">${text}</a>`;
      }
      return text;
    }).join("") || "<br />";
    if (block.type === "heading") return `<h${block.attrs?.level ?? 2}${align}>${inline}</h${block.attrs?.level ?? 2}>`;
    if (block.type === "blockquote") return `<blockquote${align}>${inline}</blockquote>`;
    if (block.type === "bulletList" || block.type === "orderedList") return `<${block.type === "bulletList" ? "ul" : "ol"}${align}>${inline.split("\n").map((item) => `<li>${item || "<br />"}</li>`).join("")}</${block.type === "bulletList" ? "ul" : "ol"}>`;
    return `<p${align}>${inline}</p>`;
  }).join("");
}

export function htmlToEditorDoc(html: string): EditorDoc {
  if (typeof window === "undefined") return emptyDoc;
  const root = document.createElement("div");
  root.innerHTML = html;
  const blocks: EditorBlock[] = [];
  const blockElements = Array.from(root.children);
  for (const element of blockElements) {
    const tag = element.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      blocks.push({ type: tag === "ul" ? "bulletList" : "orderedList", attrs: { textAlign: (element as HTMLElement).style.textAlign || undefined }, content: [{ type: "text", text: Array.from(element.children).map((item) => item.textContent ?? "").join("\n") }] });
      continue;
    }
    const type = /^h[1-6]$/.test(tag) ? "heading" : tag === "blockquote" ? "blockquote" : "paragraph";
    const content: EditorInline[] = [];
    const walk = (node: Node, marks: EditorMark[]) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) content.push({ type: "text", text: node.textContent, marks: marks.length ? marks : undefined });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const current = node as HTMLElement;
      const next = [...marks];
      const nodeTag = current.tagName.toLowerCase();
      if (["b", "strong"].includes(nodeTag)) next.push({ type: "bold" });
      if (["i", "em"].includes(nodeTag)) next.push({ type: "italic" });
      if (nodeTag === "u") next.push({ type: "underline" });
      if (["s", "strike", "del"].includes(nodeTag)) next.push({ type: "strike" });
      if (nodeTag === "code") next.push({ type: "code" });
      if (nodeTag === "a" && current.getAttribute("href")) next.push({ type: "link", attrs: { href: current.getAttribute("href") ?? "" } });
      current.childNodes.forEach((child) => walk(child, next));
    };
    walk(element, []);
    blocks.push({ type, attrs: { ...(type === "heading" ? { level: Number(tag.slice(1)) } : {}), textAlign: (element as HTMLElement).style.textAlign || undefined }, content });
  }
  return { type: "doc", content: blocks.length ? blocks : emptyDoc.content };
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm text-ink transition hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40">{children}</button>;
}

export function RichTextEditor({ value, onChange }: { value: unknown; onChange: (doc: EditorDoc) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = editorDocToHtml(value);
      initializedRef.current = true;
    }
  }, [value]);

  function emit() {
    if (editorRef.current) onChange(htmlToEditorDoc(editorRef.current.innerHTML));
  }

  function command(commandName: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(commandName, false, commandValue);
    emit();
  }

  function addLink() {
    const href = window.prompt("Endereço do link", "https://");
    if (href) command("createLink", href);
  }

  return <div className="overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-sm">
    <div className="flex flex-wrap items-center gap-1 border-b border-ink/10 bg-cream/60 p-2">
      <select aria-label="Estilo do texto" defaultValue="p" onChange={(event) => command("formatBlock", event.target.value)} className="h-9 rounded-lg border border-ink/10 bg-white px-2 text-xs font-semibold text-ink"><option value="p">Parágrafo</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option><option value="blockquote">Citação</option></select>
      <span className="mx-1 h-6 w-px bg-ink/10" />
      <ToolButton label="Desfazer" onClick={() => command("undo")}><FiRotateCcw /></ToolButton><ToolButton label="Refazer" onClick={() => command("redo")}><FiRotateCw /></ToolButton><span className="mx-1 h-6 w-px bg-ink/10" />
      <ToolButton label="Negrito" onClick={() => command("bold")}><FiBold /></ToolButton><ToolButton label="Itálico" onClick={() => command("italic")}><FiItalic /></ToolButton><ToolButton label="Sublinhado" onClick={() => command("underline")}><FiUnderline /></ToolButton><ToolButton label="Tachado" onClick={() => command("strikeThrough")}><FiSlash /></ToolButton><ToolButton label="Código" onClick={() => command("formatBlock", "pre")}><FiCode /></ToolButton>
      <span className="mx-1 h-6 w-px bg-ink/10" /><ToolButton label="Lista com marcadores" onClick={() => command("insertUnorderedList")}><FiList /></ToolButton><ToolButton label="Lista numerada" onClick={() => command("insertOrderedList")}><span className="text-xs font-bold">1.</span></ToolButton><ToolButton label="Link" onClick={addLink}><FiLink /></ToolButton><ToolButton label="Remover link" onClick={() => command("unlink")}><span className="text-xs font-bold">×</span></ToolButton>
      <span className="mx-1 h-6 w-px bg-ink/10" /><ToolButton label="Alinhar à esquerda" onClick={() => command("justifyLeft")}><FiAlignLeft /></ToolButton><ToolButton label="Centralizar" onClick={() => command("justifyCenter")}><FiAlignCenter /></ToolButton><ToolButton label="Alinhar à direita" onClick={() => command("justifyRight")}><FiAlignRight /></ToolButton><ToolButton label="Justificar" onClick={() => command("justifyFull")}><FiAlignJustify /></ToolButton>
      <ToolButton label="Limpar formatação" onClick={() => command("removeFormat")}><span className="text-xs font-bold">Tx</span></ToolButton>
    </div>
    <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={emit} className="min-h-[480px] p-6 text-[15px] leading-7 text-ink outline-none empty:before:text-slate/60 empty:before:content-['Comece_a_digitar_seu_documento...'] [&_a]:text-brass [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-brass [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-ink/5 [&_code]:px-1 [&_code]:font-mono [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-bold [&_li]:ml-6 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:list-disc" />
    <div className="flex items-center justify-between border-t border-ink/10 bg-cream/40 px-4 py-2 text-xs text-slate"><span>Editor visual · alterações preservadas em nova versão</span><span>Ctrl/Cmd + Z para desfazer</span></div>
  </div>;
}
