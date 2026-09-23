import Link from "next/link";
import { PasswordRecoveryForm } from "@/components/password-forms";
export default function ForgotPasswordPage() { return <main><h1>Redefinir senha</h1><p className="notice">Enviaremos um link temporário para criar uma nova senha.</p><PasswordRecoveryForm /><p><Link href="/login">Voltar ao login</Link></p></main>; }
