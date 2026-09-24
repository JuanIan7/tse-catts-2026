import { NextResponse } from "next/server";

// A rota WebRTC direta foi aposentada: ela não pode receber ficha interna nem
// instruções de personagem no navegador. A voz segura usa captura/transcrição
// e síntese mediadas por rotas autenticadas da sessão.
export async function POST() {
  return NextResponse.json({ error: "A conexão de voz foi atualizada. Recarregue a ocorrência para usar o modo seguro." }, { status: 410 });
}
