import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/login", "/api/health", "/forbidden"];

const ROLE_PATHS: Record<string, string[]> = {
  ADMIN: ["/"],
  REGISTRAR: ["/dashboard", "/students", "/staff", "/academics", "/attendance", "/assessments", "/compliance", "/api/export", "/settings/profile"],
  ACCOUNTANT: ["/dashboard", "/students", "/fees", "/compliance", "/api/export", "/settings/profile"],
  TEACHER: ["/dashboard", "/students", "/academics", "/attendance", "/assessments", "/settings/profile"],
  PARENT: ["/portal", "/settings/profile"],
  STUDENT: ["/portal", "/settings/profile"],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = request.cookies.get("sms_session")?.value;
  const loginUrl = new URL("/login", request.url);
  if (!token) {
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    const role = String(payload.role);
    const allowed = ROLE_PATHS[role] ?? [];
    if (pathname === "/" || allowed.some((p) => p === "/" || pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/forbidden", request.url));
  } catch {
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("sms_session");
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|css|js)$).*)"],
};
