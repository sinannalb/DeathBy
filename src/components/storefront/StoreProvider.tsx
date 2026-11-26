"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BranchSummaryDTO,
  CustomerUserDTO,
  ReorderCartItemDTO,
  SelectedOptionSnapshot,
} from "@/lib/types";
import type {
  CartItem,
  NeighborhoodWithBranch,
  StoredNeighborhood,
  ToastMessage,
} from "./types";
import { buildCartKey, calculateCartTotals } from "./utils";

const CART_STORAGE_KEY = "dbc_cart";
const NEIGHBORHOOD_STORAGE_KEY = "dbc_selected_neighborhood";

interface AddToCartInput {
  productId: string;
  productName: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  selectedOptionItemIds: string[];
  selectedOptions: SelectedOptionSnapshot[];
}

export interface BranchAdjustmentInfo {
  previousBranchName: string;
  newBranchName: string;
  removedItems: string[];
  keptItems: string[];
}

interface StoreContextValue {
  hydrated: boolean;
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (item: AddToCartInput) => void;
  updateQuantity: (cartKey: string, delta: number) => void;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;
  applyReorderItems: (items: ReorderCartItemDTO[], branchId: string) => void;

  selectedNeighborhood: StoredNeighborhood | null;
  setSelectedNeighborhood: (
    neighborhood: StoredNeighborhood,
    options?: { clearOutOfService?: boolean; silent?: boolean },
  ) => void;
  applyNeighborhoodWithCartCheck: (
    neighborhood: StoredNeighborhood,
    options?: { clearOutOfService?: boolean; silent?: boolean },
  ) => Promise<{ removedCount: number; keptCount: number }>;
  clearSelectedNeighborhood: () => void;
  outOfServiceMessage: string | null;
  setOutOfServiceMessage: (msg: string | null) => void;
  branchAdjustment: BranchAdjustmentInfo | null;
  dismissBranchAdjustment: () => void;

  neighborhoods: NeighborhoodWithBranch[];
  branches: BranchSummaryDTO[];
  neighborhoodsLoading: boolean;
  refreshNeighborhoods: () => Promise<void>;

  customer: CustomerUserDTO | null;
  authLoading: boolean;
  refreshAuth: () => Promise<CustomerUserDTO | null>;
  setCustomer: (user: CustomerUserDTO | null) => void;
  logout: () => Promise<void>;

  neighborhoodModalOpen: boolean;
  setNeighborhoodModalOpen: (open: boolean) => void;
  otpModalOpen: boolean;
  setOtpModalOpen: (open: boolean) => void;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;

  toasts: ToastMessage[];
  showToast: (text: string, variant?: ToastMessage["variant"]) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function toStoredNeighborhood(
  n: NeighborhoodWithBranch,
): StoredNeighborhood {
  return {
    neighborhoodId: n.id,
    city: n.city,
    district: n.district,
    neighborhood: n.neighborhood,
    minOrderAmount: n.minOrderAmount,
    deliveryFee: n.deliveryFee,
    branch: n.branch,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhoodState] =
    useState<StoredNeighborhood | null>(null);
  const [outOfServiceMessage, setOutOfServiceMessage] = useState<string | null>(
    null,
  );

  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodWithBranch[]>(
    [],
  );
  const [branches, setBranches] = useState<BranchSummaryDTO[]>([]);
  const [neighborhoodsLoading, setNeighborhoodsLoading] = useState(true);

  const [customer, setCustomer] = useState<CustomerUserDTO | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [neighborhoodModalOpen, setNeighborhoodModalOpen] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [branchAdjustment, setBranchAdjustment] =
    useState<BranchAdjustmentInfo | null>(null);

  const cartRef = useRef<CartItem[]>(cart);
  cartRef.current = cart;
  const selectedNeighborhoodRef = useRef<StoredNeighborhood | null>(
    selectedNeighborhood,
  );
  selectedNeighborhoodRef.current = selectedNeighborhood;

  const dismissBranchAdjustment = useCallback(() => {
    setBranchAdjustment(null);
  }, []);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastCounter = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (text: string, variant: ToastMessage["variant"] = "success") => {
      const id = ++toastCounter.current;
      setToasts((prev) => [...prev.slice(-2), { id, text, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3400);
    },
    [],
  );

  // Hydrate localStorage once on client mount
  useEffect(() => {
    try {
      const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
      if (rawCart) {
        const parsed = JSON.parse(rawCart);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
      const rawNb = window.localStorage.getItem(NEIGHBORHOOD_STORAGE_KEY);
      if (rawNb) {
        const parsedNb = JSON.parse(rawNb) as StoredNeighborhood;
        if (parsedNb && parsedNb.neighborhoodId && parsedNb.branch?.id) {
          setSelectedNeighborhoodState(parsedNb);
        }
      }
    } catch {
      // Ignore malformed localStorage
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart, hydrated]);

  // Persist neighborhood to localStorage
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (selectedNeighborhood) {
        window.localStorage.setItem(
          NEIGHBORHOOD_STORAGE_KEY,
          JSON.stringify(selectedNeighborhood),
        );
      } else {
        window.localStorage.removeItem(NEIGHBORHOOD_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedNeighborhood, hydrated]);

  const refreshAuth = useCallback(async (): Promise<CustomerUserDTO | null> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setCustomer(null);
        return null;
      }
      const data = (await res.json()) as {
        authenticated: boolean;
        user: CustomerUserDTO | null;
      };
      const user = data.authenticated ? data.user : null;
      setCustomer(user);
      return user;
    } catch {
      setCustomer(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshNeighborhoods = useCallback(async () => {
    try {
      const res = await fetch("/api/neighborhoods", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        neighborhoods: NeighborhoodWithBranch[];
        branches: BranchSummaryDTO[];
      };
      setNeighborhoods(data.neighborhoods ?? []);
      setBranches(data.branches ?? []);

      // Sync currently selected neighborhood with latest branch status & fees
      setSelectedNeighborhoodState((prev) => {
        if (!prev) return null;
        const fresh = (data.neighborhoods ?? []).find(
          (n) => n.id === prev.neighborhoodId,
        );
        if (!fresh) return null;
        return toStoredNeighborhood(fresh);
      });
    } catch {
      // Keep existing state on transient error
    } finally {
      setNeighborhoodsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
    void refreshNeighborhoods();

    const onFocus = () => {
      void refreshNeighborhoods();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshAuth, refreshNeighborhoods]);

  // If logged-in customer has no selected neighborhood yet, auto-select from saved address or latest order
  const autoAppliedCustomerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || neighborhoodsLoading || !customer) return;
    if (selectedNeighborhood) {
      autoAppliedCustomerRef.current = customer.id;
      return;
    }
    if (autoAppliedCustomerRef.current === customer.id) return;

    const courierNeighborhoods = neighborhoods.filter(
      (n) => n.branch.courierEnabled,
    );
    if (courierNeighborhoods.length === 0) return;

    let cancelled = false;
    autoAppliedCustomerRef.current = customer.id;

    Promise.all([
      fetch("/api/customer/addresses", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { addresses: [] }))
        .catch(() => ({ addresses: [] })),
      fetch("/api/orders/my", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { orders: [] }))
        .catch(() => ({ orders: [] })),
    ]).then(([addrData, ordData]) => {
      if (cancelled) return;
      const addresses = (addrData?.addresses ?? []) as Array<{
        city: string;
        district: string;
        neighborhood: string;
      }>;
      const orders = (ordData?.orders ?? []) as Array<{
        city: string;
        district: string;
        neighborhood: string;
      }>;

      const candidates = [...addresses, ...orders];
      for (const cand of candidates) {
        const match = courierNeighborhoods.find(
          (n) =>
            n.city.toLocaleLowerCase("tr-TR") ===
              cand.city.toLocaleLowerCase("tr-TR") &&
            n.district.toLocaleLowerCase("tr-TR") ===
              cand.district.toLocaleLowerCase("tr-TR") &&
            n.neighborhood.toLocaleLowerCase("tr-TR") ===
              cand.neighborhood.toLocaleLowerCase("tr-TR"),
        );
        if (match) {
          setSelectedNeighborhoodState(toStoredNeighborhood(match));
          return;
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    neighborhoodsLoading,
    customer,
    selectedNeighborhood,
    neighborhoods,
  ]);

  const applyNeighborhoodWithCartCheck = useCallback(
    async (
      next: StoredNeighborhood,
      options?: { clearOutOfService?: boolean; silent?: boolean },
    ): Promise<{ removedCount: number; keptCount: number }> => {
      const prev = selectedNeighborhoodRef.current;
      const currentCart = cartRef.current;

      setSelectedNeighborhoodState(next);
      if (options?.clearOutOfService !== false) {
        setOutOfServiceMessage(null);
      }

      if (!prev || prev.branch.id === next.branch.id || currentCart.length === 0) {
        return { removedCount: 0, keptCount: currentCart.length };
      }

      try {
        const res = await fetch(
          `/api/menu?branchId=${encodeURIComponent(next.branch.id)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          return { removedCount: 0, keptCount: currentCart.length };
        }
        const data = (await res.json()) as {
          categories?: Array<{
            products: Array<{
              id: string;
              branchAvailable: boolean;
            }>;
          }>;
        };
        const availableIds = new Set<string>();
        for (const cat of data.categories ?? []) {
          for (const prod of cat.products) {
            if (prod.branchAvailable) {
              availableIds.add(prod.id);
            }
          }
        }

        const kept: CartItem[] = [];
        const removedNames: string[] = [];
        const keptNames: string[] = [];

        for (const item of currentCart) {
          if (availableIds.has(item.productId)) {
            kept.push(item);
            keptNames.push(item.productName);
          } else {
            removedNames.push(item.productName);
          }
        }

        if (removedNames.length > 0) {
          setCart(kept);
          setBranchAdjustment({
            previousBranchName: prev.branch.name,
            newBranchName: next.branch.name,
            removedItems: removedNames,
            keptItems: keptNames,
          });
        } else if (!options?.silent) {
          showToast(
            `Teslimat şubesi ${next.branch.name} olarak güncellendi.`,
            "info",
          );
        }

        return {
          removedCount: removedNames.length,
          keptCount: kept.length,
        };
      } catch {
        return { removedCount: 0, keptCount: currentCart.length };
      }
    },
    [showToast],
  );

  const setSelectedNeighborhood = useCallback(
    (
      next: StoredNeighborhood,
      options?: { clearOutOfService?: boolean; silent?: boolean },
    ) => {
      void applyNeighborhoodWithCartCheck(next, options);
    },
    [applyNeighborhoodWithCartCheck],
  );

  const clearSelectedNeighborhood = useCallback(() => {
    setSelectedNeighborhoodState(null);
  }, []);

  const addToCart = useCallback((input: AddToCartInput) => {
    const cartKey = buildCartKey(input.productId, input.selectedOptionItemIds);
    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.cartKey === cartKey);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const current = updated[existingIdx];
        updated[existingIdx] = {
          ...current,
          quantity: Math.min(50, current.quantity + input.quantity),
          unitPrice: input.unitPrice,
          basePrice: input.basePrice,
          selectedOptions: input.selectedOptions,
        };
        return updated;
      }
      return [
        ...prev,
        {
          cartKey,
          productId: input.productId,
          productName: input.productName,
          basePrice: input.basePrice,
          unitPrice: input.unitPrice,
          quantity: input.quantity,
          imageUrl: input.imageUrl,
          selectedOptionItemIds: [...input.selectedOptionItemIds].sort(),
          selectedOptions: input.selectedOptions,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((cartKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartKey !== cartKey) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...item, quantity: Math.min(50, nextQty) };
        })
        .filter((x): x is CartItem => x !== null),
    );
  }, []);

  const removeFromCart = useCallback((cartKey: string) => {
    setCart((prev) => prev.filter((item) => item.cartKey !== cartKey));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const applyReorderItems = useCallback(
    (items: ReorderCartItemDTO[], branchId: string) => {
      const mapped: CartItem[] = items.map((item) => {
        const optionsDelta = item.selectedOptions.reduce(
          (sum, o) => sum + o.priceDelta,
          0,
        );
        return {
          cartKey: buildCartKey(item.productId, item.selectedOptionItemIds),
          productId: item.productId,
          productName: item.productName,
          basePrice: Number((item.unitPrice - optionsDelta).toFixed(2)),
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
          selectedOptionItemIds: [...item.selectedOptionItemIds].sort(),
          selectedOptions: item.selectedOptions,
        };
      });

      setCart(mapped);
      setOutOfServiceMessage(null);

      // Ensure selectedNeighborhood matches the reorder branch if needed
      if (
        !selectedNeighborhood ||
        selectedNeighborhood.branch.id !== branchId
      ) {
        const match = neighborhoods.find((n) => n.branchId === branchId);
        if (match) {
          setSelectedNeighborhoodState(toStoredNeighborhood(match));
        }
      }
    },
    [neighborhoods, selectedNeighborhood],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCustomer(null);
      showToast("Oturumunuz kapatıldı.", "info");
    }
  }, [showToast]);

  const { count: cartCount, subtotal: cartSubtotal } = useMemo(
    () => calculateCartTotals(cart),
    [cart],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      hydrated,
      cart,
      cartCount,
      cartSubtotal,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      applyReorderItems,
      selectedNeighborhood,
      setSelectedNeighborhood,
      applyNeighborhoodWithCartCheck,
      clearSelectedNeighborhood,
      outOfServiceMessage,
      setOutOfServiceMessage,
      branchAdjustment,
      dismissBranchAdjustment,
      neighborhoods,
      branches,
      neighborhoodsLoading,
      refreshNeighborhoods,
      customer,
      authLoading,
      refreshAuth,
      setCustomer,
      logout,
      neighborhoodModalOpen,
      setNeighborhoodModalOpen,
      otpModalOpen,
      setOtpModalOpen,
      cartDrawerOpen,
      setCartDrawerOpen,
      toasts,
      showToast,
      dismissToast,
    }),
    [
      hydrated,
      cart,
      cartCount,
      cartSubtotal,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      applyReorderItems,
      selectedNeighborhood,
      setSelectedNeighborhood,
      applyNeighborhoodWithCartCheck,
      clearSelectedNeighborhood,
      outOfServiceMessage,
      branchAdjustment,
      dismissBranchAdjustment,
      neighborhoods,
      branches,
      neighborhoodsLoading,
      refreshNeighborhoods,
      customer,
      authLoading,
      refreshAuth,
      logout,
      neighborhoodModalOpen,
      otpModalOpen,
      cartDrawerOpen,
      toasts,
      showToast,
      dismissToast,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return ctx;
}
