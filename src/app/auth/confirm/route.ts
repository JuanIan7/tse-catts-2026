import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

const isPasswordLinkType = (value: string | null): value is EmailOtpType => value === "invite" || value === "recovery";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const passwordChangeUrl = new URL("/password/change", request.url);
  const errorUrl = new URL("/password/forgot?error=link_invalido", request.url);

  if (!tokenHash || !isPasswordLinkType(type)) return NextResponse.redirect(errorUrl);

  const response = NextResponse.redirect(passwordChangeUrl);
  const supabase = createServerClient(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  return error ? NextResponse.redirect(errorUrl) : response;
}
