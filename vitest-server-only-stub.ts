// Vitest-only stand-in for the "server-only" package (aliased in
// vitest.config.ts). The real package's exports map only resolves to a
// no-op under Next's "react-server" condition, which Vitest never sets —
// everywhere else it unconditionally throws (see node_modules/server-only).
export {};
