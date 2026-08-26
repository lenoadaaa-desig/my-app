import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables next/navigation's forbidden()/app/forbidden.tsx (Task 9 phase 1)
  // — see node_modules/next/dist/docs/.../functions/forbidden.md, still
  // "experimental" as of 16.3.0 but the only Next-native way to render a
  // themed 403 page with a real 403 status instead of the app's previous
  // silent redirect("/dashboard") on a role mismatch (lib/dal.ts's
  // requireRole). See CLAUDE.md's architecture decisions for the rationale.
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
