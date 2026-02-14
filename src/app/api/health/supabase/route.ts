import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
      return NextResponse.json(
        { ok: false, error: "missing env", hasUrl: !!url, hasAnon: !!anon },
        { status: 500 }
      );
    }

    const supabase = createClient(url, anon);

    // 这个调用不要求你先建表，用来验证“能连上 + key 格式正确”
    const { data, error } = await supabase.auth.getSession();

    return NextResponse.json({
      ok: !error,
      session: !!data?.session,
      error: error?.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
