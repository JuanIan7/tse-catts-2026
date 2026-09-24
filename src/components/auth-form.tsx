"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm() {
  const [signup, setSignup] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget); const supabase = createSupabaseBrowserClient();
    const email = String(form.get("email") ?? "").trim(); const password = String(form.get("password") ?? "");
    if (signup) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: String(form.get("displayName") ?? "").trim() }, emailRedirectTo: `${location.origin}/auth/callback` } });
      setBusy(false);
      if (error) return setMessage(error.message);
      if (data.session) return router.replace("/app");
      return setMessage("Solicitação recebida. Confirme seu e-mail e aguarde a aprovação do instrutor.");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMessage("Não foi possível entrar com essas credenciais. Se necessário, redefina sua senha.");
    router.replace("/app");
  }
  return <form onSubmit={submit} noValidate>
    <div className="auth-tabs" role="group" aria-label="Tipo de acesso">
      <button className="auth-tab" type="button" aria-pressed={!signup} onClick={() => { setSignup(false); setMessage(""); }}>Entrar</button>
      <button className="auth-tab" type="button" aria-pressed={signup} onClick={() => { setSignup(true); setMessage(""); }}>Solicitar acesso</button>
    </div>
    {signup && <label>Nome completo<input name="displayName" required minLength={2} autoComplete="name" /></label>}
    <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
    <label>Senha<input name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} /></label>
    <div className="form-actions"><button type="submit" disabled={busy}>{busy ? "Aguarde…" : signup ? "Enviar solicitação" : "Entrar"}</button>{!signup && <Link href="/password/forgot">Esqueci minha senha</Link>}</div>
    {message && <p className="form-message" role="status">{message}</p>}
  </form>;
}
