// Explicit wire projections for mobile responses. Rows carry Date columns
// (and full internal fields); the DTOs in @maison/shared are JSON-safe ISO
// strings, so every response is field-picked here — never spread blindly.
import type {
  MyOrderDTO,
  OrderDetailDTO,
  ProductCardDTO,
  ProductDTO,
} from "@maison/shared";
import type {
  MyOrderDTO as ActionMyOrderDTO,
  OrderDetailDTO as ActionOrderDetailDTO,
} from "@/lib/actions/orders";
import type { Product } from "@/lib/queries/products";

export function toProductCardDTO(p: Product): ProductCardDTO {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    priceBaseCents: p.priceBaseCents,
    stock: p.stock,
    room: p.room,
    category: p.category,
    images: p.images,
    featured: p.featured,
  };
}

export function toProductDTO(p: Product): ProductDTO {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    story: p.story,
    priceBaseCents: p.priceBaseCents,
    stock: p.stock,
    room: p.room,
    category: p.category,
    materials: p.materials,
    dimensions: p.dimensions,
    weightKg: p.weightKg,
    care: p.care,
    images: p.images,
    active: p.active,
    featured: p.featured,
    search: p.search,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toMyOrderDTO(o: ActionMyOrderDTO): MyOrderDTO {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    currencyCode: o.currencyCode,
    currencySymbol: o.currencySymbol,
    fxRateSnapshot: o.fxRateSnapshot,
    subtotalBaseCents: o.subtotalBaseCents,
    shippingBaseCents: o.shippingBaseCents,
    totalBaseCents: o.totalBaseCents,
    itemCount: o.itemCount,
    createdAt: o.createdAt.toISOString(),
  };
}

export function toOrderDetailDTO(d: ActionOrderDetailDTO): OrderDetailDTO {
  return {
    order: {
      id: d.order.id,
      number: d.order.number,
      userId: d.order.userId,
      email: d.order.email,
      status: d.order.status,
      currencyCode: d.order.currencyCode,
      fxRateSnapshot: d.order.fxRateSnapshot,
      subtotalBaseCents: d.order.subtotalBaseCents,
      shippingBaseCents: d.order.shippingBaseCents,
      totalBaseCents: d.order.totalBaseCents,
      address: d.order.address,
      clientToken: d.order.clientToken,
      paymentMethod: d.order.paymentMethod,
      paymentStatus: d.order.paymentStatus,
      paystackRef: d.order.paystackRef,
      paidAt: d.order.paidAt ? d.order.paidAt.toISOString() : null,
      paystackAuth: d.order.paystackAuth,
      createdAt: d.order.createdAt.toISOString(),
    },
    items: d.items.map((l) => ({
      productId: l.productId,
      slug: l.slug,
      name: l.name,
      image: l.image,
      qty: l.qty,
      unitBaseCents: l.unitBaseCents,
    })),
    zoneName: d.zoneName,
    currency: {
      code: d.currency.code,
      symbol: d.currency.symbol,
      label: d.currency.label,
      rateToBase: d.currency.rateToBase,
      isBase: d.currency.isBase,
      active: d.currency.active,
    },
  };
}
