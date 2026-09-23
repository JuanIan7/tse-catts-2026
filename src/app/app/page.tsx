import Link from "next/link";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";

export default async function AppHome() {
  try {
    const { profile } = await requireApprovedUser();
    return <main><h1>Olá, {profile.display_name}</h1><p className="notice">Acesso aprovado. A área do aluno está sendo preparada.</p>{profile.role === "ADMINISTRADOR" && <p><Link href="/admin">Abrir painel administrativo</Link></p>}</main>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(message === "Acesso ainda não aprovado." ? "/pending" : "/login");
  }
}
