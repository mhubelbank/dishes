// Minimal EPUB reader for the cookbook importer. Extracts just the text payload
// (xhtml/html/opf/ncx/css — never the heavy images/fonts) to a temp dir once, then
// reads documents from disk. Resolves the spine to an ordered list of content
// documents so a per-book profile can walk recipes in reading order.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, type HTMLElement } from "node-html-parser";

export interface MountedEpub {
  dir: string;
  read(entry: string): string;
}

// Extract the text entries to a temp dir and return a reader. Image/font globs are
// excluded so a 400MB photo-heavy epub mounts in a second or two.
export function mountEpub(epubPath: string): MountedEpub {
  const dir = mkdtempSync(join(tmpdir(), "epub-"));
  execFileSync(
    "unzip",
    ["-o", "-qq", epubPath, "-x", "*.jpg", "*.jpeg", "*.png", "*.gif", "*.svg",
      "*.ttf", "*.otf", "*.woff", "*.woff2", "*.mp3", "*.mp4", "-d", dir],
    { stdio: "ignore", maxBuffer: 256 * 1024 * 1024 },
  );
  return { dir, read: (entry: string) => readFileSync(join(dir, entry), "utf8") };
}

function opfPath(epub: MountedEpub): string {
  const container = parse(epub.read("META-INF/container.xml"));
  const full = container.querySelector("rootfile")?.getAttribute("full-path");
  if (!full) throw new Error("No rootfile in container.xml");
  return full;
}

export interface SpineDoc {
  id: string;
  entry: string; // path under the mount dir, ready for epub.read
}

// Ordered content documents from the OPF spine, manifest hrefs resolved to entry
// paths relative to the OPF's directory.
export function spineDocs(epub: MountedEpub): SpineDoc[] {
  const opf = opfPath(epub);
  const dir = opf.includes("/") ? opf.slice(0, opf.lastIndexOf("/") + 1) : "";
  const pkg = parse(epub.read(opf));

  const hrefById = new Map<string, string>();
  for (const item of pkg.querySelectorAll("manifest > item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) hrefById.set(id, decodeURIComponent(href));
  }

  const docs: SpineDoc[] = [];
  for (const ref of pkg.querySelectorAll("spine > itemref")) {
    const idref = ref.getAttribute("idref");
    const href = idref ? hrefById.get(idref) : undefined;
    if (idref && href) docs.push({ id: idref, entry: dir + href });
  }
  return docs;
}

export { parse as parseHtml };
export type { HTMLElement };
