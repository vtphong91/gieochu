import { cloudinaryDeliveryUrl } from "./cloudinary-url";

describe("ADR-028 Cloudinary delivery URL", () => {
  it("inserts f_auto,q_auto,c_limit,w_N after /image/upload/, keeps version/transformations, is idempotent and leaves other URLs untouched", () => {
    const base = "https://res.cloudinary.com/demo/image/upload";

    expect(cloudinaryDeliveryUrl(`${base}/v1712345678/gieochu/tenants/t1/content/abc.jpg`, { width: 800 })).toBe(
      `${base}/f_auto,q_auto,c_limit,w_800/v1712345678/gieochu/tenants/t1/content/abc.jpg`,
    );
    // Không có version: folder public id (gieochu/tenants...) không bị nhận nhầm là transformation.
    expect(cloudinaryDeliveryUrl(`${base}/gieochu/tenants/t1/products/cover.png`, { width: 400 })).toBe(
      `${base}/f_auto,q_auto,c_limit,w_400/gieochu/tenants/t1/products/cover.png`,
    );
    // Transformation có sẵn được giữ, bộ tối ưu nối vào sau cùng.
    expect(cloudinaryDeliveryUrl(`${base}/c_fill,w_300,h_300/v1/a.jpg`, { width: 300 })).toBe(`${base}/c_fill,w_300,h_300/f_auto,q_auto,c_limit,w_300/v1/a.jpg`);
    // Idempotent: gọi lại thay width, không chồng thêm; width bị kẹp ≤ 1600.
    const once = cloudinaryDeliveryUrl(`${base}/v1/a.jpg`, { width: 800 });
    expect(cloudinaryDeliveryUrl(once, { width: 5000 })).toBe(`${base}/f_auto,q_auto,c_limit,w_1600/v1/a.jpg`);

    for (const other of [
      "https://cdn.example.com/image/upload/v1/a.jpg",
      "http://res.cloudinary.com/demo/image/upload/v1/a.jpg",
      "https://res.cloudinary.com/demo/image/fetch/https://evil.example.com/a.jpg",
      "https://res.cloudinary.com/demo/video/upload/v1/a.mp4",
      "not a url",
    ]) {
      expect(cloudinaryDeliveryUrl(other, { width: 800 })).toBe(other);
    }
  });
});
