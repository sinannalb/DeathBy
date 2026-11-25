import type {
  BranchManualStatus,
  OrderStatus,
  PaymentStatus,
} from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: "Sipariş Alındı",
  PREPARING: "Hazırlanıyor",
  WAITING_COURIER: "Kurye Bekliyor",
  ON_THE_WAY: "Yolda",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal Edildi",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Ödeme Bekleniyor",
  PAID: "Ödendi",
  FAILED: "Ödeme Başarısız",
  REFUNDED: "İade Edildi",
};

export const BRANCH_MANUAL_STATUS_LABELS: Record<BranchManualStatus, string> = {
  AUTO: "Otomatik (Çalışma Saatleri)",
  FORCE_OPEN: "Manuel Açık",
  FORCE_CLOSED: "Geçici Hizmet Dışı",
  BUSY: "Yoğun Saatler",
};

export const DAY_OF_WEEK_LABELS: string[] = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECEIVED: ["PREPARING", "CANCELLED"],
  PREPARING: ["WAITING_COURIER", "CANCELLED"],
  WAITING_COURIER: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
