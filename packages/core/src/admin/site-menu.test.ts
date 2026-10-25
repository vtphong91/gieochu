import { formatCompactStatCount, homePublishIssues, homeSectionsSchema, parseHomeSections, resolveCommunityView } from "./home-sections";
import { defaultSiteMenu, parseSiteMenu, resolveNavLinkHref, siteMenuSchema } from "./site-menu";

describe("ADR-050 CMS menu and home sections", () => {
  it("rejects unsafe menu links, parses stored menu/home data defensively and hides unconsented testimonials", () => {
    // Menu: mặc định hợp lệ; link javascript:/data:/http:/protocol-relative/preview bị schema chặt từ chối.
    expect(siteMenuSchema.safeParse(defaultSiteMenu()).success).toBe(true);
    const withTarget = (kind: string, target: string) => {
      const menu = defaultSiteMenu();
      menu.footer.columns[0]!.links[0] = { ...menu.footer.columns[0]!.links[0]!, kind: kind as "internal", target };
      return siteMenuSchema.safeParse(menu).success;
    };
    expect(withTarget("external", "https://example.com/gioi-thieu")).toBe(true);
    expect(withTarget("external", "javascript:alert(1)")).toBe(false);
    expect(withTarget("external", "data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(withTarget("external", "http://example.com")).toBe(false);
    expect(withTarget("external", "https://gieochu-preview.vercel.app")).toBe(false);
    expect(withTarget("internal", "//evil.example")).toBe(false);
    expect(withTarget("internal", "/\\evil.example")).toBe(false);
    expect(withTarget("page", "not-a-page")).toBe(false);
    expect(withTarget("email", "javascript:alert(1)")).toBe(false);
    // ADR-054: loại link "legal" chỉ nhận khoá văn bản đã khai báo; footer mặc định có cột "Thông tin" (7 văn bản).
    expect(withTarget("legal", "privacy")).toBe(true);
    expect(withTarget("legal", "not-a-document")).toBe(false);
    expect(resolveNavLinkHref("legal", "seller")).toBe("/chinh-sach-nguoi-ban");
    expect(defaultSiteMenu().footer.columns.find((c) => c.id === "col-info")?.links.map((l) => l.target)).toEqual([
      "terms", "privacy", "content_policy", "copyright", "usage_license", "seller", "contact",
    ]);

    // Parse phòng thủ: link hỏng bị bỏ riêng, cột rỗng bị bỏ, header > 5 mục bị cắt, đầu vào không phải object → null.
    const stored = {
      header: {
        items: Array.from({ length: 7 }, (_, i) => ({ id: `h${i}`, label: `Mục ${i}`, kind: "internal", target: `/m${i}`, newTab: false, visible: true })),
        cta: { id: "cta", label: "x", kind: "external", target: "javascript:alert(1)", newTab: false, visible: true },
      },
      footer: {
        description: "",
        columns: [
          { id: "c1", title: "Cột", links: [{ id: "l1", label: "Xấu", kind: "external", target: "data:x", newTab: true, visible: true }] },
          { id: "c2", title: "Hỗ trợ", links: [{ id: "l2", label: "Email", kind: "email", target: "hotro@example.com", newTab: false, visible: true }] },
        ],
        copyright: "© {năm} {brand}",
      },
    };
    const menu = parseSiteMenu(stored)!;
    expect(menu.header.items).toHaveLength(5);
    expect(menu.header.cta.target).toBe("register");
    expect(menu.footer.columns.map((c) => c.id)).toEqual(["c2"]);
    expect(parseSiteMenu("menu")).toBeNull();

    // Trang chủ: dữ liệu `testimonials` cũ → `community`, chưa có đồng ý → không hiển thị (rơi về lời mời), xuất bản bị chặn.
    const home = parseHomeSections([
      { id: "t", type: "testimonials", visible: true, data: { items: [{ quote: "Rất hữu ích", name: "Cô Lan", role: "Giáo viên" }] } },
      { id: "c", type: "coaches", visible: true, data: { title: "T", subtitle: "S", limit: 4, pinnedTenantIds: [] } },
      { id: "bad", type: "unknown", visible: true, data: {} },
    ])!;
    expect(home.map((s) => s.type)).toEqual(["community", "coaches"]);
    const community = home[0]!;
    if (community.type !== "community") throw new Error("expected community");
    expect(community.data.testimonials[0]!.consentConfirmed).toBe(false);
    expect(resolveCommunityView(community.data)?.kind).toBe("invite");
    const coaches = home[1]!;
    expect(coaches.type === "coaches" && coaches.data.minToShow).toBe(3);
    expect(homePublishIssues(home).some((issue) => issue.field === "testimonials.0.consentConfirmed")).toBe(true);
    expect(homeSectionsSchema.safeParse(home).success).toBe(true);

    // Hero (ADR-050 lần 3): dữ liệu cũ thiếu `statBadges` → 3 thẻ mặc định ngưỡng 10; trùng số liệu bị từ chối.
    const heroData = { badge: "B", title: "T", subtitle: "S", primaryCta: { label: "A", href: "/a" }, secondaryCta: { label: "B", href: "/b" } };
    const [hero] = parseHomeSections([{ id: "h", type: "hero", visible: true, data: heroData }])!;
    if (hero?.type !== "hero") throw new Error("expected hero");
    expect(hero.data.statBadges.map((b) => [b.metric, b.minValue, b.enabled])).toEqual([["tenants", 10, true], ["products", 10, true], ["sold", 10, true]]);
    const dupBadge = { id: "x", metric: "sold", label: "Lượt mua", minValue: 0, enabled: true };
    const withBadges = (statBadges: unknown[]) => homeSectionsSchema.safeParse([{ id: "h", type: "hero", visible: true, data: { ...heroData, statBadges } }]).success;
    expect(withBadges([])).toBe(true);
    expect(withBadges([dupBadge, { ...dupBadge, id: "y" }])).toBe(false);
    // Số làm gọn luôn làm tròn xuống; "+" chỉ khi đã bị làm tròn.
    expect([7, 99, 100, 120, 125, 129, 999, 1000, 1200, 1250, 1299, 999_999, 1_000_000, 1_250_000].map(formatCompactStatCount)).toEqual([
      "7", "99", "100", "120", "120+", "120+", "990+", "1K", "1,2K", "1,2K+", "1,2K+", "999,9K+", "1M", "1,2M+",
    ]);
  });
});
