import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "./brand-mark";

type AppShellProps = {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  tone?: "default" | "immersive";
};

export function AppShell({ children, backHref, backLabel = "Voltar", actions, tone = "default" }: AppShellProps) {
  return <div className={`app-shell app-shell-${tone}`}>
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-start">
          {backHref ? <Link className="back-link" href={backHref}>← {backLabel}</Link> : <BrandMark compact />}
        </div>
        {actions && <div className="app-header-actions">{actions}</div>}
      </div>
    </header>
    <main className="app-main">{children}</main>
    <footer className="app-footer">Ferramenta didática fictícia · em caso de sofrimento real, ligue 188 (CVV).</footer>
  </div>;
}
