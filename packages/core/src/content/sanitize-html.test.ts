import { sanitizeRichTextHtml } from "./sanitize-html";

describe("ADR-028 rich text sanitizer image policy", () => {
  it("keeps only images from the system Cloudinary cloud, drops external/other-cloud images, and optimizes src only when rendering", () => {
    const own = "https://res.cloudinary.com/gieo/image/upload/v1/gieochu/tenants/t1/content/a.jpg";
    const html = [
      `<p>Mở đầu</p>`,
      `<img src="${own}" alt="Sơ đồ">`,
      `<img src="https://evil.example.com/track.gif" alt="x">`,
      `<img src="https://res.cloudinary.com/other/image/upload/v1/b.jpg">`,
      `<img src="http://res.cloudinary.com/gieo/image/upload/v1/c.jpg">`,
      `<img src="https://res.cloudinary.com/gieo/image/fetch/https://evil.example.com/d.jpg">`,
      `<img src="${own}" onerror="alert(1)">`,
    ].join("");

    const saved = sanitizeRichTextHtml(html, { imageCloudName: "gieo" });
    expect(saved).toBe(`<p>Mở đầu</p><img src="${own}" alt="Sơ đồ" /><img src="${own}" />`);

    const rendered = sanitizeRichTextHtml(saved, { imageCloudName: "gieo", imageWidth: 1200 });
    expect(rendered).toContain(`src="https://res.cloudinary.com/gieo/image/upload/f_auto,q_auto,c_limit,w_1200/v1/gieochu/tenants/t1/content/a.jpg"`);
    expect(rendered).not.toContain("evil.example.com");

    // Chưa cấu hình Cloudinary hệ thống → không ảnh nào qua được.
    expect(sanitizeRichTextHtml(html, { imageCloudName: null })).toBe("<p>Mở đầu</p>");
  });
});
