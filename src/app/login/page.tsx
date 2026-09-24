import { AuthForm } from "@/components/auth-form";
import { BrandMark } from "@/components/brand-mark";

export default function LoginPage() {
  return <main className="auth-page">
    <div className="auth-layout">
      <section className="auth-intro">
        <BrandMark priority />
        <div className="auth-kicker">Ambiente privado de treinamento</div>
        <h1>TSE — Treinamento <span>Sucessores de Élpis</span></h1>
        <p>Simulador didático de abordagem técnica para o CATTS 2026. Acesso individual, sessões protegidas e prática guiada por diálogo.</p>
        <div className="auth-points"><span>Acesso aprovado pelo instrutor</span><span>Simulações fictícias e seguras</span><span>Histórico privado de aprendizagem</span></div>
      </section>
      <section className="auth-card" aria-labelledby="access-title">
        <h2 id="access-title">Acessar treinamento</h2>
        <p>Entre com sua conta ou envie uma solicitação de acesso.</p>
        <AuthForm />
      </section>
    </div>
  </main>;
}
