/**
 * ExcelJS parses comment shapes but drops their TEXT when loading a workbook, so any
 * note carried over from the uploaded file would be written back empty. This helper
 * reads the raw xl/comments*.xml parts straight out of the .xlsx zip and returns a
 * sheet-aware map of "A1" -> note text, so the reconcilers can restore notes verbatim.
 */
export interface NoteMap {
  /** sheet name (lower-cased) -> { "R12" style address -> note text } */
  bySheet: Map<string, Map<string, string>>;
}

async function loadJSZip(): Promise<any> {
  const mod: any = await import('jszip');
  return mod.default || mod;
}

function textOf(xml: string): string {
  // Concatenate every <t>…</t> run inside the comment. Namespaced tags (<x:t>, <a:t>)
  // and run-property blocks (<rPr>…</rPr>) must not leak into the text.
  const parts: string[] = [];
  const body = xml.replace(/<rPr>[\s\S]*?<\/rPr>/g, '');
  const re = /<(?:[a-zA-Z]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z]+:)?t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) parts.push(m[1]);
  return parts
    .join('')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** Strip the leading author line Excel injects ("Author:\n…") when present. */
function stripAuthor(text: string, authors: string[]): string {
  let t = text;
  for (const a of authors) {
    if (a && t.startsWith(a)) { t = t.slice(a.length); break; }
  }
  return t.replace(/^[:\s]+/, '').trim();
}

/**
 * Build a map of real note text from an .xlsx file.
 * Safe to call on any workbook — returns an empty map if anything is missing.
 */
export async function readNotesFromXlsx(data: ArrayBuffer | Uint8Array): Promise<NoteMap> {
  const bySheet = new Map<string, Map<string, string>>();
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(data);

    // workbook.xml -> sheet order & names
    const wbXml = await zip.file('xl/workbook.xml')?.async('string');
    const sheetNames: string[] = [];
    if (wbXml) {
      const re = /<sheet[^>]*name="([^"]*)"[^>]*\/?>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(wbXml))) sheetNames.push(m[1]);
    }

    // For each worksheet part, find its comments part through the rels file.
    for (let i = 0; i < Math.max(sheetNames.length, 1); i++) {
      const sheetPath = `xl/worksheets/sheet${i + 1}.xml`;
      if (!zip.file(sheetPath)) continue;
      const relsPath = `xl/worksheets/_rels/sheet${i + 1}.xml.rels`;
      const relsXml = await zip.file(relsPath)?.async('string');
      let commentsPath: string | null = null;
      if (relsXml) {
        const rm = relsXml.match(/Target="([^"]*comments\d*\.xml)"/i);
        if (rm) {
          const t = rm[1].replace(/^\.\.\//, '');
          commentsPath = t.startsWith('xl/') ? t : `xl/${t}`;
        }
      }
      if (!commentsPath) commentsPath = `xl/comments${i + 1}.xml`;
      const cXml = await zip.file(commentsPath)?.async('string');
      if (!cXml) continue;

      const authors: string[] = [];
      const aBlock = cXml.match(/<authors>([\s\S]*?)<\/authors>/);
      if (aBlock) {
        const re = /<author>([\s\S]*?)<\/author>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(aBlock[1]))) authors.push(m[1]);
      }

      const map = new Map<string, string>();
      const re = /<comment[^>]*ref="([^"]+)"[^>]*>([\s\S]*?)<\/comment>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cXml))) {
        const ref = m[1];
        const body = textOf(m[2]);
        const clean = stripAuthor(body, authors);
        if (clean) map.set(ref.toUpperCase(), clean);
      }
      const name = (sheetNames[i] || `sheet${i + 1}`).toLowerCase();
      bySheet.set(name, map);
    }
  } catch {
    /* notes are best-effort — never block a reconciliation */
  }
  return { bySheet };
}

/** Look up a note for a sheet+address, tolerant of sheet-name casing. */
export function noteFor(nm: NoteMap | null, sheetName: string, address: string): string | undefined {
  if (!nm) return undefined;
  const m = nm.bySheet.get((sheetName || '').toLowerCase());
  if (m) return m.get(address.toUpperCase());
  // fall back to the first sheet map when names don't line up
  const first = nm.bySheet.values().next().value as Map<string, string> | undefined;
  return first ? first.get(address.toUpperCase()) : undefined;
}
