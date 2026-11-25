import type { Metadata } from "next";
import { PanelAuthProvider } from "@/components/panel/PanelAuthContext";
import { PanelShell } from "@/components/panel/PanelShell";

export const metadata: Metadata = {
  title: "Operasyon Paneli | Death By Chocolate",
  description: "Şube sipariş, fiş yazdırma ve menü yönetim paneli",
};

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelAuthProvider>
      <PanelShell>{children}</PanelShell>
    </PanelAuthProvider>
  );
}
