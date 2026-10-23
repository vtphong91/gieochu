import { homePublishIssues, homeSectionsSchema, parseHomeSections, resolveCommunityView } from "./home-sections";
import { defaultSiteMenu, parseSiteMenu, siteMenuSchema } from "./site-menu";

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
  });
});
