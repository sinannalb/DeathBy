import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CancelRefundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E5245] hover:text-[#1D110C]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Mağazaya Dön
      </Link>

      <article className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-6 sm:p-8 shadow-sm space-y-5 text-sm text-[#4A342B] leading-relaxed">
        <header className="border-b border-[#EFE6DC] pb-4">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1D110C]">
            İptal ve İade Koşulları
          </h1>
          <p className="text-xs text-[#8A6F62] mt-1">
            Online sipariş iptal, değişim ve PayTR ücret iadesi süreçleri.
          </p>
        </header>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            1. Sipariş Hazırlanmadan Önce İptal
          </h2>
          <p>
            Siparişiniz henüz <strong>&ldquo;Sipariş Alındı&rdquo;</strong>{" "}
            aşamasındayken (şubemiz tarafından hazırlanmaya başlanmadan önce)
            sipariş takip sayfasındaki şube telefon numarasından şubemize
            ulaşarak iptal talebinde bulunabilirsiniz.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            2. Taze Gıda Ürünlerinde İade İstisnası
          </h2>
          <p>
            Death By Chocolate ürünleri sipariş üzerine taze ve sıcak olarak
            hazırlanan gıda ürünleridir. Hijyen ve gıda güvenliği mevzuatı
            gereğince hazırlanmaya başlanmış veya teslim edilmiş kusursuz gıda
            ürünlerinde iade kabul edilmemektedir.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            3. Eksik, Yanlış veya Hasarlı Teslimat
          </h2>
          <p>
            Siparişinizde eksik ürün, yanlış ürün veya kurye taşıması
            kaynaklı hasar olması halinde teslimat anında veya en kısa sürede
            ilgili şubemizle iletişime geçmeniz durumunda ürün telafisi veya
            ücret iadesi derhal sağlanır.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            4. Ücret İadesi Süreci (PayTR)
          </h2>
          <p>
            Onaylanan iptal ve iade tutarları, ödemenin yapıldığı kredi veya
            banka kartına PayTR altyapısı üzerinden iade edilir. Bankaların iç
            işleyişine bağlı olarak iadenin kart ekstrenize yansıması genellikle
            2 ila 7 iş günü sürmektedir.
          </p>
        </section>
      </article>
    </div>
  );
}
