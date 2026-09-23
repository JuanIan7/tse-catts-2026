"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PasswordRecoveryForm() {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/password/change` });
    setMessage("Se houver uma conta com esse e-mail, enviaremos um link de redefinição.");
  }

  return <form onSubmit={submit}><p><label>E-mail <input name="email" type="email" required /></label></p><button type="submit">Enviar link de redefinição</button>{message && <p role="status">{message}</p>}</form>;
}

export function ChangePasswordForm() {
  const [message, setMessage] = useState("Validando link...");
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    createSupabaseBrowserClient().auth.getSession().then(({ data, error }) => {
      if (error || !data.session) return setMessage("O link expirou ou não é válido. Solicite outro link.");
      setReady(true);
      setMessage("");
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) return setMessage("As senhas não coincidem.");

    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
    if (error) return setMessage(`Não foi possível atualizar a senha: ${error.message}`);

    setMessage("Senha atualizada.");
    setTimeout(() => router.replace("/login"), 900);
  }

  return <form onSubmit={submit}><p><label>Nova senha <input name="password" type="password" minLength={8} required disabled={!ready} /></label></p><p><label>Confirmar nova senha <input name="confirm" type="password" minLength={8} required disabled={!ready} /></label></p><button type="submit" disabled={!ready}>Salvar nova senha</button>{message && <p role="status">{message}</p>}</form>;
}
