import {
  calculateOrderPricing,
  canManuallyConfirmOrder,
  computeOrderHoldExpiresAt,
  effectiveOrderStatus,
  legalDocumentPath,
  productPath,
  productTypeLabel,
  type OrderStatus,
} from "@gieochu/core";
import { getPrismaClient, withCustomer, withPublic } from "@gieochu/db";
import { isManualConfirmProvider, type CheckoutResult, type PaymentProviderId } from "@gieochu/payments";
import { getSystemSettings } from "./system-settings";
import { getBankByBin, getEnabledProviders } from "./tenant-payment";
import { getProductCoverUrl } from "./product-cover";
import { orderHoldHoursFor, orderHoldStartedAt } from "./order";
import { CUSTOMER_PROVIDER_LABELS } from "./order-customer";
import type { CurrentUser } from "./session";

/**
 * ADR-062 — view model trang thanh toán đơn tài liệu `/{tenantSlug}/checkout/{orderCode}` (contract §6.1 của Phong). Server
 * tính sẵn mọi trạng thái; UI không tự suy. Đợt này chỉ khách ĐÃ đăng nhập (`viewer.kind = "user"`); khách vãng lai
 * (`guest`, `order = null`, `justCreated`) làm ở task 12/13.
 *
 * Dữ liệu: đơn + dòng đơn đọc dưới `withCustomer(user)` (L3 — chính khách); sản phẩm đọc dưới `withPublic` (chỉ thấy khi còn
 * PUBLISHED — không thấy thì `productPath`/`coverUrl` null, `stillPurchasable` false); cổng đang bật của gian hàng qua
 * `getEnabledProviders` (withTenant); `tenants`/`users`/`bank_bins` là L1. Không có secret nào trong view model.
 */

export type CheckoutConfirmMode = "MANUAL" | "AUTO";

export type CheckoutDisplayStatus = "AWAITING_PAYMENT" | "AWAITING_SELLER_CONFIRM" | "PAID" | "EXPIRED" | "CANCELED" | "REFUNDED";

export interface CheckoutProviderOption {
  id: PaymentProviderId;
  confirmMode: CheckoutConfirmMode;
  /** Nhãn cho khách (ADR-062 Q8: SePay = "Chuyển khoản (xác nhận tự động)"). */
  label: string;
  /** `false` = hạn giữ đơn của phương thức này (tính từ lúc đặt đơn) đã qua → không chọn được (ADR-062 Q3). */
  available: boolean;
}

export interface CheckoutView {
  viewer: {
    kind: "user";
    name: string;
    email: string;
    /** ADR-061 Q1: tài khoản vừa được tạo ở bước "Tiếp tục thanh toán" của khách vãng lai (`?vua-tao=1` + phiên guest). */
    justCreated: boolean;
    /** Phiên khách vãng lai (tài khoản chưa kích hoạt — tối đa 24 giờ). UI nhắc kích hoạt qua email. */
    guestSession: boolean;
  };
  order: {
    id: string;
    code: string;
    displayStatus: CheckoutDisplayStatus;
    subtotalVnd: number;
    discountVnd: number;
    totalVnd: number;
    couponCode: string | null;
    provider: PaymentProviderId | null;
    confirmMode: CheckoutConfirmMode | null;
    checkout: CheckoutResult | null;
    createdAt: Date;
    expiresAt: Date;
    paidAt: Date | null;
    customerDeclaredPaidAt: Date | null;
    /** Các nút được phép — đúng luật server (UI chỉ ẩn/hiện, server vẫn kiểm lại). */
    can: {
      changeProvider: boolean;
      applyCoupon: boolean;
      declarePaid: boolean;
      undoDeclarePaid: boolean;
      cancel: boolean;
    };
  };
  item: {
    productId: string;
    title: string;
    unitPriceVnd: number;
    finalPriceVnd: number;
    /** `productPath(tenantSlug, product.slug)`; null khi tài liệu không còn bán → ẩn "Đặt lại đơn". */
    productPath: string | null;
    typeLabel: string | null;
    coverUrl: string | null;
    stillPurchasable: boolean;
  };
  tenant: { name: string; slug: string };
  /** Tên ngân hàng (bank_bins) khi checkout là QR ngân hàng; null = ẩn dòng "Ngân hàng". */
  bank: { shortName: string; name: string } | null;
  enabledProviders: CheckoutProviderOption[];
  links: {
    /** Thư viện, trỏ thẳng tài liệu của đơn (ADR-062 Q7). */
    library: string;
    orders: string;
    /** Trang Điều khoản (CMS pháp lý) — không gõ cứng. */
    terms: string;
    /** Trang chính sách thanh toán của gian hàng (ADR-062 Q12) — dùng chung trang Chính sách người bán của nền tảng. */
    sellerPolicy: string;
    login: string;
  };
}

function confirmModeOf(provider: PaymentProviderId): CheckoutConfirmMode {
  return isManualConfirmProvider(provider) ? "MANUAL" : "AUTO";
}

function displayStatusOf(
  order: { status: OrderStatus; expiresAt: Date; provider: PaymentProviderId | null; customerDeclaredPaidAt: Date | null },
  now: Date,
): CheckoutDisplayStatus {
  const effective = effectiveOrderStatus(order.status, order.expiresAt, now);
  switch (effective) {
    case "PAID":
    case "FULFILLED":
      return "PAID";
    case "CANCELED":
      return "CANCELED";
    case "REFUNDED":
      return "REFUNDED";
    case "EXPIRED": {
      // ADR-062 bổ sung mục 3: khách đã báo chuyển trước hạn → người bán vẫn xác nhận được → hiện "chờ người bán xác nhận".
      const declaredPaidAt = order.provider && isManualConfirmProvider(order.provider) ? order.customerDeclaredPaidAt : null;
      return canManuallyConfirmOrder(order.status, order.expiresAt, now, { declaredPaidAt }) ? "AWAITING_SELLER_CONFIRM" : "EXPIRED";
    }
    case "PENDING":
      return order.customerDeclaredPaidAt ? "AWAITING_SELLER_CONFIRM" : "AWAITING_PAYMENT";
  }
}

/** Người gọi đã `requireCheckoutAccess`. Không tìm thấy đơn của chính khách → null. */
export async function getCheckoutView(user: CurrentUser, orderCode: string, options: { justCreated?: boolean } = {}): Promise<CheckoutView | null> {
  const now = new Date();
  const order = await withCustomer(user.userId, (tx) =>
    tx.order.findFirst({
      where: { code: orderCode, customerId: user.userId },
      select: {
        id: true,
        code: true,
        tenantId: true,
        status: true,
        subtotalVnd: true,
        discountVnd: true,
        totalVnd: true,
        couponCode: true,
        provider: true,
        checkoutPayload: true,
        createdAt: true,
        holdStartedAt: true,
        expiresAt: true,
        paidAt: true,
        customerDeclaredPaidAt: true,
        items: { orderBy: { createdAt: "asc" }, take: 1, select: { productId: true, titleSnapshot: true, unitPriceVnd: true, finalPriceVnd: true } },
      },
    }),
  );
  if (!order || order.items.length === 0) return null;
  const line = order.items[0]!;

  const prisma = getPrismaClient();
  const [tenant, dbUser, product, settings, enabled] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: order.tenantId }, select: { name: true, slug: true, status: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { email: true, profile: { select: { fullName: true } } } }),
    withPublic((tx) =>
      tx.product.findFirst({
        where: { id: line.productId, status: "PUBLISHED" },
        select: { slug: true, type: true, coverImageUrl: true, coverImageKey: true },
      }),
    ),
    getSystemSettings(),
    getEnabledProviders(order.tenantId),
  ]);

  const effective = effectiveOrderStatus(order.status, order.expiresAt, now);
  const pending = effective === "PENDING";
  const declared = order.customerDeclaredPaidAt !== null;
  const checkout = order.checkoutPayload as CheckoutResult | null;
  const stillPurchasable = Boolean(product) && tenant.status === "ACTIVE";
  const checkoutPath = `/${tenant.slug}/checkout/${order.code}`;

  return {
    viewer: {
      kind: "user",
      name: dbUser.profile?.fullName?.trim() || dbUser.email,
      email: dbUser.email,
      justCreated: user.guestCheckout === true && options.justCreated === true,
      guestSession: user.guestCheckout === true && !user.emailVerified,
    },
    order: {
      id: order.id,
      code: order.code,
      displayStatus: displayStatusOf(order, now),
      subtotalVnd: order.subtotalVnd,
      discountVnd: order.discountVnd,
      totalVnd: order.totalVnd,
      couponCode: order.couponCode,
      provider: order.provider,
      confirmMode: order.provider ? confirmModeOf(order.provider) : null,
      checkout,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt,
      customerDeclaredPaidAt: order.customerDeclaredPaidAt,
      can: {
        changeProvider: pending && !declared && stillPurchasable,
        applyCoupon: pending && !declared && stillPurchasable,
        declarePaid: pending && !declared && Boolean(order.provider && isManualConfirmProvider(order.provider)),
        undoDeclarePaid: pending && declared,
        cancel: pending && !declared,
      },
    },
    item: {
      productId: line.productId,
      title: line.titleSnapshot,
      unitPriceVnd: line.unitPriceVnd,
      finalPriceVnd: line.finalPriceVnd,
      productPath: product ? productPath(tenant.slug, product.slug) : null,
      typeLabel: product ? productTypeLabel(product.type) : null,
      coverUrl: product ? await getProductCoverUrl(product) : null,
      stillPurchasable,
    },
    tenant: { name: tenant.name, slug: tenant.slug },
    bank: checkout?.kind === "QR" ? await getBankByBin(checkout.bank.bin) : null,
    enabledProviders: enabled.map((id) => ({
      id,
      confirmMode: confirmModeOf(id),
      label: CUSTOMER_PROVIDER_LABELS[id],
      // ADR-068 mục 8: cùng mốc giữ với initiateOrderCheckout (`holdStartedAt ?? createdAt`).
      available: computeOrderHoldExpiresAt(orderHoldStartedAt(order), orderHoldHoursFor(id, settings)).getTime() > now.getTime(),
    })),
    links: {
      library: `/account/library?tai-lieu=${encodeURIComponent(line.productId)}`,
      orders: "/account/orders",
      terms: legalDocumentPath("terms"),
      sellerPolicy: legalDocumentPath("seller"),
      login: `/login?next=${encodeURIComponent(checkoutPath)}`,
    },
  };
}

/**
 * ADR-062 Q2 — trang trước khi có đơn của khách vãng lai `/{tenantSlug}/checkout?tai-lieu={slug}` (contract §6.1 `viewer.kind =
 * "guest"`, `order = null`). Chỉ đọc dữ liệu công khai: tài liệu PUBLISHED (withPublic), gian hàng ACTIVE (L1), cổng đang bật
 * (withTenant). Giá hiển thị tính lại ở server (giá khuyến mãi nếu đang áp); tổng tiền thật vẫn tính lại khi tạo đơn.
 */
export interface GuestCheckoutView {
  viewer: { kind: "guest" };
  order: null;
  tenant: { name: string; slug: string };
  item: { productId: string; productSlug: string; title: string; priceVnd: number; typeLabel: string; coverUrl: string | null; productPath: string };
  enabledProviders: { id: PaymentProviderId; confirmMode: CheckoutConfirmMode; label: string }[];
  links: { terms: string; privacy: string; login: string };
}

export async function getGuestCheckoutView(tenantSlug: string, productSlug: string): Promise<GuestCheckoutView | null> {
  const tenant = await getPrismaClient().tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, name: true, slug: true, status: true } });
  if (!tenant || tenant.status !== "ACTIVE") return null;
  const product = await withPublic((tx) =>
    tx.product.findFirst({
      where: { tenantId: tenant.id, slug: productSlug, status: "PUBLISHED" },
      select: { id: true, slug: true, title: true, type: true, priceVnd: true, salePriceVnd: true, saleStartsAt: true, saleEndsAt: true, coverImageUrl: true, coverImageKey: true },
    }),
  );
  if (!product) return null;
  const pricing = calculateOrderPricing(
    [{ productId: product.id, title: product.title, priceVnd: product.priceVnd, salePriceVnd: product.salePriceVnd, saleStartsAt: product.saleStartsAt, saleEndsAt: product.saleEndsAt }],
    null,
    0,
    new Date(),
  );
  const enabled = await getEnabledProviders(tenant.id);
  const path = productPath(tenant.slug, product.slug);
  return {
    viewer: { kind: "guest" },
    order: null,
    tenant: { name: tenant.name, slug: tenant.slug },
    item: {
      productId: product.id,
      productSlug: product.slug,
      title: product.title,
      priceVnd: pricing.totalVnd,
      typeLabel: productTypeLabel(product.type),
      coverUrl: await getProductCoverUrl(product),
      productPath: path,
    },
    enabledProviders: enabled.map((id) => ({ id, confirmMode: confirmModeOf(id), label: CUSTOMER_PROVIDER_LABELS[id] })),
    links: {
      terms: legalDocumentPath("terms"),
      privacy: legalDocumentPath("privacy"),
      login: `/login?next=${encodeURIComponent(path)}`,
    },
  };
}
