/**
 * Shared analysis limits. Kept in one place so the ingest layer (which decides
 * what file content to hold in memory) and the import graph (which decides what
 * to read) agree — otherwise a file can be stored but never read, leaving
 * dangling, unresolvable import edges.
 */

/**
 * Largest single text file whose content is retained at ingest and read by the
 * import graph. Files above this are still listed in the tree (with size) but
 * are treated as opaque — real source files are far smaller, and anything this
 * big is almost always minified or generated.
 */
export const MAX_SOURCE_TEXT_BYTES = 2_000_000;
