"use client";

import { useActionState, useEffect, useState } from "react";
import { sendTrainingTurn } from "@/app/app/actions";

const initialState = { error: "", sent: false, nonce: 0 };

export function TextTurnForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(sendTrainingTurn, initialState);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (state.sent) setContent("");
  }, [state.nonce, state.sent]);

  return <form action={action}>
    <input type="hidden" name="sessionId" value={sessionId} />
    <label>Sua fala
      <textarea name="content" rows={4} required maxLength={3000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escreva como você conduziria a conversa." />
    </label>
    <button type="submit" disabled={pending}>{pending ? "Aguardando resposta do tentante…" : "Enviar fala"}</button>
    {state.error && <p className="notice" role="alert">{state.error}</p>}
  </form>;
}
