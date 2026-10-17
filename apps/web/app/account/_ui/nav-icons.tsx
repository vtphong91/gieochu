import type { ComponentType } from "react";
import { IconCard, IconGrid, IconPackage, IconReceipt, IconShield, IconStore, IconUsers } from "../../admin/_ui/icons";
import type { AccountNavIcon } from "./account-nav";

/** Map key → icon SVG (`admin/_ui/icons.tsx`). Server-safe — dùng được ở cả Server và Client Component. */
export const ACCOUNT_NAV_ICONS: Record<AccountNavIcon, ComponentType<{ className?: string }>> = {
  grid: IconGrid,
  user: IconUsers,
  shield: IconShield,
  package: IconPackage,
  receipt: IconReceipt,
  store: IconStore,
  card: IconCard,
};
