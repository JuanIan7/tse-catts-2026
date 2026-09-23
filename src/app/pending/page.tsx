import Link from "next/link";
export default function PendingPage() { return <main><h1>Solicitação em análise</h1><p className="notice">Seu acesso ainda não foi aprovado pelo administrador.</p><Link href="/login">Voltar</Link></main>; }
