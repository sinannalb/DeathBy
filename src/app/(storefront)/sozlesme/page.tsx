import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DistanceSalesContractPage() {
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
            Mesafeli Satış Sözleşmesi
          </h1>
          <p className="text-xs text-[#8A6F62] mt-1">
            6502 Sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli
            Sözleşmeler Yönetmeliği uyarınca düzenlenmiştir.
          </p>
        </header>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            1. Taraflar
          </h2>
          <p>
            <strong>Satıcı:</strong> Death By Chocolate Gıda ve Patisserie
            İşletmeciliği (Beşiktaş / Vişnezade ve Kadıköy / Moda şubeleri
            üzerinden hizmet vermektedir).
          </p>
          <p>
            <strong>Alıcı:</strong> İnternet sitesi üzerinden sipariş veren,
            telefon numarası ile doğrulama yapan ve teslimat adres bilgilerini
            paylaşan tüketici.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            2. Sözleşmenin Konusu
          </h2>
          <p>
            İşbu sözleşmenin konusu, Alıcı&apos;nın Satıcı&apos;ya ait internet
            sitesinden elektronik ortamda siparişini verdiği taze tatlı, unlu
            mamul ve sıcak/soğuk içecek ürünlerinin satışı ve seçilen teslimat
            mahallesine göre ilgili şubeden teslimine ilişkin hak ve
            yükümlülüklerin belirlenmesidir.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            3. Ödeme ve Teslimat Koşulları
          </h2>
          <p>
            Ödemeler yalnızca <strong>PayTR Güvenli Online Ödeme</strong>{" "}
            altyapısı aracılığıyla kredi kartı veya banka kartı ile tahsil
            edilir. Kapıda nakit veya kredi kartı ile ödeme seçeneği
            bulunmamaktadır.
          </p>
          <p>
            Siparişler, Alıcı&apos;nın seçtiği mahallenin bağlı olduğu şube
            tarafından hazırlanır ve kurye aracılığıyla belirtilen açık adrese
            teslim edilir. Teslimat ücreti ve minimum sepet tutarı seçilen
            mahalleye göre sipariş özetinde açıkça gösterilir.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            4. Cayma Hakkı İstisnası
          </h2>
          <p>
            Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15. maddesinin (c) bendi
            gereğince, çabuk bozulabilen veya son kullanma tarihi geçebilecek
            taze gıda, tatlı ve içecek ürünlerinde teslimat sonrasında cayma
            hakkı kullanılamaz. Sipariş hazırlık aşamasına geçmeden önceki
            iptal ve hatalı/hasarlı ürün durumları için{" "}
            <Link
              href="/iptal-iade"
              className="text-[#C68B3C] font-semibold underline"
            >
              İptal ve İade Koşulları
            </Link>{" "}
            sayfası geçerlidir.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            5. Yetkili Merci
          </h2>
          <p>
            İşbu sözleşmeden doğabilecek uyuşmazlıklarda Ticaret Bakanlığınca
            ilan edilen parasal sınırlar dâhilinde Alıcı&apos;nın yerleşim
            yerindeki Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri
            yetkilidir.
          </p>
        </section>
      </article>
    </div>
  );
}
