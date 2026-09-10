import type { Metadata } from "next";
import { DemoMode } from "@/components/DemoMode";
import { SpotlightController } from "@/components/SpotlightController";
import "./globals.css";
import "./demo-mode.css";
import "./polish.css";

export const metadata: Metadata = {
  title: "Copiloto Operacional AI | Tech4Change",
  description: "IA que transforma telemetria industrial em orientação para operadores e gestores"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <SpotlightController />
        <DemoMode />
      </body>
    </html>
  );
}
