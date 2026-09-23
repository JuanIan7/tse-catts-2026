"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm() {
  const [signup, setSignup] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    if (signup) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: String(form.get("displayName") ?? "") }, emailRedirectTo: `${location.origin}/auth/callback` } });
      if (error) return setMessage(error.message);
      if (data.session) return router.replace("/app");
      return setMessage("Cadastro recebido. Confirme seu e-mail e aguarde a aprovação.");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage("Não foi possível entrar com essas credenciais.");
    router.replace("/app");
  }
  return <form onSubmit={submit}><p><button type="button" onClick={() => setSignup(false)}>Entrar</button> <button type="button" onClick={() => setSignup(true)}>Solicitar acesso</button></p>{signup && <p><label>Nome <input name="displayName" required minLength={2} /></label></p>}<p><label>E-mail <input name="email" type="email" required /></label></p><p><label>Senha <input name="password" type="password" required minLength={8} /></label></p><button type="submit">{signup ? "Enviar solicitação" : "Entrar"}</button>{message && <p role="status">{message}</p>}</form>;
}
