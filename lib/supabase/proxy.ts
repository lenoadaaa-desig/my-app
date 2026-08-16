import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/bookings", "/owner"];
const AUTH_PATHS = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Do not run any logic between createServerClient and getUser().
  // A simple mistake could make it very hard to debug issues with users
  // being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isAuthRoute = AUTH_PATHS.includes(pathname);

  // Server Actions POST to the same pathname as the page that invoked them
  // (e.g. the /signup form's action posts to /signup), distinguished from a
  // real navigation only by method. A page-navigation redirect here would
  // otherwise also intercept that POST and hand back a plain 3xx response —
  // which is not a valid Server Action response (no `x-action-redirect`
  // header, wrong content-type), so the browser's Server Actions runtime
  // rejects it with "An unexpected response was received from the server"
  // instead of ever running the action. Redirecting is only correct for an
  // actual page load (GET).
  const isNavigation = request.method === "GET";

  if (isNavigation && isProtectedRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isNavigation && isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
