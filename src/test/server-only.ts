// vitest stand-in for the `server-only` marker package. The real package
// throws when imported from a client bundle and is a no-op on the server;
// under vitest (node) it is not resolvable, so alias it to this empty module.
export {};
