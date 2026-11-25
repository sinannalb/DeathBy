import { CartDrawer } from "@/components/storefront/CartDrawer";
import { NeighborhoodModal } from "@/components/storefront/NeighborhoodModal";
import { OtpLoginModal } from "@/components/storefront/OtpLoginModal";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { StoreProvider } from "@/components/storefront/StoreProvider";
import { ToastStack } from "@/components/storefront/ToastStack";

export default function StorefrontLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StoreProvider>
      <div className="min-h-screen flex flex-col bg-[#FBF6F0] text-[#1D110C] selection:bg-[#C68B3C]/25">
        <StoreHeader />
        <main className="flex-1">{children}</main>
        <StoreFooter />
        <NeighborhoodModal />
        <OtpLoginModal />
        <CartDrawer />
        <ToastStack />
      </div>
    </StoreProvider>
  );
}
