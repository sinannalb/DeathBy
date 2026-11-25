import type {
  BranchSummaryDTO,
  DeliveryNeighborhoodDTO,
  SelectedOptionSnapshot,
} from "@/lib/types";

export interface NeighborhoodWithBranch extends DeliveryNeighborhoodDTO {
  branch: BranchSummaryDTO;
}

export interface StoredNeighborhood {
  neighborhoodId: string;
  city: string;
  district: string;
  neighborhood: string;
  minOrderAmount: number;
  deliveryFee: number;
  branch: BranchSummaryDTO;
}

export interface CartItem {
  cartKey: string;
  productId: string;
  productName: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  selectedOptionItemIds: string[];
  selectedOptions: SelectedOptionSnapshot[];
}

export interface ToastMessage {
  id: number;
  text: string;
  variant: "success" | "error" | "info";
}
