// The first path segments the shell serves under the frame (D-10, D-12). Kept free of React so the server-side
// route glue can import it (a module marked 'use client' hands a server component a reference, not the array).
// The route glue answers 404 for any other first segment.
export const VIEW_ROOTS = ['work', 'evidence', 'decisions', 'gate', 'deliverables', 'graph'];
