import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TSE — Treinamento Sucessores de Élpis",
  description: "Simulador didático privado CATTS/CBMERJ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
