import { svg, type GlyphNode, type GlyphOpts } from '@/lib/glyphs';

/**
 * Renders a discovery's mark. The markup comes from the shape grammar in
 * lib/glyphs.ts — a closed set of numeric path builders with no external
 * input — so injecting it is safe and avoids constructing thousands of
 * React elements per frame for what is a static drawing.
 */
export function Glyph({ node, ...opts }: { node: GlyphNode } & GlyphOpts) {
  return <span className="glyph-host" dangerouslySetInnerHTML={{ __html: svg(node, opts) }} />;
}
