import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function KvkkPage() {
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
            KVKK Aydınlatma Metni
          </h1>
          <p className="text-xs text-[#8A6F62] mt-1">
            6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında
            hazırlanmıştır.
          </p>
        </header>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            1. Veri Sorumlusu
          </h2>
          <p>
            Death By Chocolate olarak müşterilerimizin kişisel verilerinin
            gizliliğine ve güvenliğine önem veriyoruz. İşbu aydınlatma metni,
            sipariş ve üyelik süreçlerinizde işlenen veriler hakkında sizi
            bilgilendirmek amacıyla hazırlanmıştır.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            2. İşlenen Kişisel Veriler ve Amaçları
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Kimlik ve İletişim Bilgileri:</strong> Ad soyad, cep
              telefonu numarası (SMS OTP doğrulaması ve sipariş bilgilendirmesi
              için).
            </li>
            <li>
              <strong>Adres ve Teslimat Bilgileri:</strong> Şehir, ilçe,
              mahalle, açık adres ve adres tarifi (doğru şubeye yönlendirme ve
              kurye teslimatı için).
            </li>
            <li>
              <strong>Sipariş ve İşlem Güvenliği Bilgileri:</strong> Sipariş
              geçmişi, ödeme referans numarası (PayTR ödeme doğrulaması ve yasal
              saklama yükümlülükleri için). Kredi kartı bilgileriniz
              sunucularımızda saklanmaz.
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            3. Kişisel Verilerin Aktarımı
          </h2>
          <p>
            Kişisel verileriniz yalnızca siparişin hazırlanması ve teslimatı
            kapsamında ilgili Death By Chocolate şubesine, kurye ekibine ve
            online tahsilat işleminin gerçekleştirilmesi amacıyla PayTR Ödeme ve
            Elektronik Para Kuruluşu A.Ş.&apos;ye aktarılır.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-serif text-base font-bold text-[#1D110C]">
            4. İlgili Kişinin Hakları
          </h2>
          <p>
            KVKK&apos;nın 11. maddesi uyarınca; verilerinizin işlenip
            işlenmediğini öğrenme, düzeltilmesini veya silinmesini talep etme
            haklarına sahipsiniz. Taleplerinizi ilgili şubemiz üzerinden yazılı
            olarak iletebilirsiniz.
          </p>
        </section>
      </article>
    </div>
  );
}
