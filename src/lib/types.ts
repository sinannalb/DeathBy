import type {
  BranchManualStatus,
  OrderStatus,
  PaperWidth,
  PaymentStatus,
  Role,
  RootGroup,
  SelectionType,
} from "@prisma/client";

export interface BranchStatusDTO {
  effectiveStatus: "OPEN" | "BUSY" | "CLOSED";
  canAcceptOrders: boolean;
  reason: string;
  nextOpenText: string | null;
  estimatedMinMinutes: number;
  estimatedMaxMinutes: number;
}

export interface BranchScheduleDTO {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface DeliveryNeighborhoodDTO {
  id: string;
  branchId: string;
  city: string;
  district: string;
  neighborhood: string;
  minOrderAmount: number;
  deliveryFee: number;
  isActive: boolean;
}

export interface BranchSummaryDTO {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  paperWidth: PaperWidth;
  manualStatus: BranchManualStatus;
  isBusy: boolean;
  busyUntil: string | null;
  busyMessage: string | null;
  estimatedMinMinutes: number;
  estimatedMaxMinutes: number;
  courierEnabled: boolean;
  isActive: boolean;
  status: BranchStatusDTO;
}

export interface BranchDetailDTO extends BranchSummaryDTO {
  schedules: BranchScheduleDTO[];
  neighborhoods: DeliveryNeighborhoodDTO[];
}

export interface OptionItemDTO {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface OptionGroupDTO {
  id: string;
  name: string;
  selectionType: SelectionType;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  items: OptionItemDTO[];
}

export interface MenuProductDTO {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  branchAvailable: boolean;
  optionGroups: OptionGroupDTO[];
}

export interface MenuCategoryDTO {
  id: string;
  name: string;
  slug: string;
  rootGroup: RootGroup;
  sortOrder: number;
  isActive: boolean;
  products: MenuProductDTO[];
}

export interface SelectedOptionSnapshot {
  optionGroupId: string;
  optionGroupName: string;
  optionItemId: string;
  optionItemName: string;
  priceDelta: number;
}

export interface OrderItemDTO {
  id: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: SelectedOptionSnapshot[];
  lineTotal: number;
}

export interface OrderDTO {
  id: string;
  orderNumber: string;
  userId: string;
  branchId: string;
  branchName: string;
  branchPhone: string;
  branchAddress: string;
  paperWidth: PaperWidth;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: PaymentStatus;
  paymentStatusLabel: string;
  paymentProvider: string;
  merchantOid: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  city: string;
  district: string;
  neighborhood: string;
  fullAddress: string;
  directions: string | null;
  note: string | null;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDTO[];
}

export interface CustomerUserDTO {
  id: string;
  role: Role;
  name: string;
  phone: string;
  createdAt: string;
}

export interface CustomerAddressDTO {
  id: string;
  userId: string;
  title: string;
  city: string;
  district: string;
  neighborhood: string;
  fullAddress: string;
  directions: string | null;
  createdAt: string;
}

export interface PanelUserDTO {
  id: string;
  role: "ADMIN" | "SYSTEM";
  name: string;
  email: string;
  branchId: string | null;
  branchName: string | null;
  createdAt: string;
}

export interface ReorderCartItemDTO {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  selectedOptionItemIds: string[];
  selectedOptions: SelectedOptionSnapshot[];
  lineTotal: number;
}

export interface ReorderUnavailableItemDTO {
  productName: string;
  reason: string;
}
