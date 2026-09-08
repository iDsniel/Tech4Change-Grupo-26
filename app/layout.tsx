import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MãoLivre AI | Tech4Change",
  description: "Copiloto multimodal para profissionais de campo"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
