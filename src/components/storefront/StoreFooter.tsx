import Link from "next/link";

export function StoreFooter() {
  return (
    <footer className="bg-[#120D0C] text-[#D7C6B6] border-t border-[#33221D] mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-3">
            <img
              src="/logo.jpg"
              alt="Death By Chocolate"
              className="w-11 h-11 rounded-full object-cover border border-[#D4A048]/60 shrink-0 bg-black"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-lg text-[#FAF6F1]">
                  Death By Chocolate
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#D4A048]">
                  İstanbul
                </span>
              </div>
              <p className="text-xs text-[#A89286] max-w-md">
                Gerçek Belçika çikolatası, taze hamur ve özenle demlenen
                kahvelerle Beşiktaş, Kağıthane ve Rumelihisarı şubelerimizde.
              </p>
            </div>
          </div>

          <nav
            aria-label="Yasal ve kurumsal bağlantılar"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
          >
            <Link
              href="/sozlesme"
              className="hover:text-[#E8BD6D] transition-colors"
            >
              Mesafeli Satış Sözleşmesi
            </Link>
            <Link
              href="/kvkk"
              className="hover:text-[#E8BD6D] transition-colors"
            >
              KVKK Aydınlatma Metni
            </Link>
            <Link
              href="/iptal-iade"
              className="hover:text-[#E8BD6D] transition-colors"
            >
              İptal ve İade Koşulları
            </Link>
            <a
              href="/panel/giris"
              className="text-[#8A6F62] hover:text-[#D4A048] transition-colors"
            >
              Şube &amp; Yönetim Paneli
            </a>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-[#281A16] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-[#8A6F62]">
          <p>© {new Date().getFullYear()} Death By Chocolate. Tüm hakları saklıdır.</p>
          <p>PayTR ile 256-bit SSL güvenli online ödeme altyapısı</p>
        </div>
      </div>
    </footer>
  );
}
