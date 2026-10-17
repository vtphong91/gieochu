import { afterAll, describe, expect, it } from "vitest";
import { hashPassword } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { lockUser, unlockUser } from "../../lib/admin-users";
import { audit } from "../../lib/audit";
import type { CurrentUser } from "../../lib/session";
import { POST as login } from "../../app/api/auth/login/route";

// ADR-037 mục 6 (M12a). Dữ liệu tạm (users) được dọn ở afterAll; các dòng audit_logs do test tạo KHÔNG xoá được
// (đúng bản chất chỉ-INSERT) — tồn tới khi cron purge sau 12 tháng. Chỉ chứa id/email giả @example.com.

const prisma = getPrismaClient();
const RUN_PREFIX = `m12test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.com`;
}

function toCurrentUser(userId: string): CurrentUser {
  return { userId, familyId: "test-family", role: "SYSTEM_ADMIN", emailVerified: true, profileCompleted: true };
}

function loginRequest(email: string, password: string): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "m12-audit-test" },
    body: JSON.stringify({ email, password }),
  });
}

describe("M12 audit", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("audit: key actions write audit logs and audit rows cannot be updated or deleted", async () => {
    const password = "Str0ngPass!";
    const admin = await prisma.user.create({
      data: { email: nextEmail(), passwordHash: "not-used", status: "ACTIVE", systemRole: "SYSTEM_ADMIN", emailVerifiedAt: new Date() },
    });
    const target = await prisma.user.create({
      data: { email: nextEmail(), passwordHash: await hashPassword(password), status: "ACTIVE", emailVerifiedAt: new Date() },
    });

    // 1. Đăng nhập sai rồi đúng → AUTH_LOGIN_FAILED + AUTH_LOGIN (ip = phần tử đầu x-forwarded-for).
    expect((await login(loginRequest(target.email, "wrong-password"))).status).toBe(401);
    expect((await login(loginRequest(target.email, password))).status).toBe(200);

    // 2. Admin khoá rồi mở khoá → USER_LOCKED + USER_UNLOCKED, actor là admin.
    await lockUser(toCurrentUser(admin.id), target.id);
    await unlockUser(toCurrentUser(admin.id), target.id);

    // 3. Metadata nhạy cảm bị lọc trước khi ghi.
    expect(
      await audit.log({
        actorId: admin.id,
        scope: "SYSTEM",
        action: "SYSTEM_SETTINGS_UPDATED",
        targetType: "User",
        targetId: target.id,
        metadata: { apiKey: "sk_live_should_not_leak", nested: { password: "p", note: "ok" } },
        ip: null,
        userAgent: null,
      }),
    ).toBe(true);

    const rows = await prisma.auditLog.findMany({ where: { targetId: target.id }, orderBy: { createdAt: "asc" } });
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining(["AUTH_LOGIN_FAILED", "AUTH_LOGIN", "USER_LOCKED", "USER_UNLOCKED", "SYSTEM_SETTINGS_UPDATED"]),
    );
    const failed = rows.find((r) => r.action === "AUTH_LOGIN_FAILED");
    expect(failed?.actorId).toBe(target.id);
    expect(failed?.ip).toBe("203.0.113.7");
    expect(failed?.userAgent).toBe("m12-audit-test");
    expect(rows.find((r) => r.action === "USER_LOCKED")?.actorId).toBe(admin.id);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain("sk_live_should_not_leak");
    expect(rows.find((r) => r.action === "SYSTEM_SETTINGS_UPDATED")?.metadata).toEqual({
      apiKey: "[REDACTED]",
      nested: { password: "[REDACTED]", note: "ok" },
    });

    // 4. Không sửa được (quyền gieochu_app + trigger), kể cả qua raw SQL.
    const sample = rows[0]!;
    await expect(prisma.auditLog.update({ where: { id: sample.id }, data: { action: "TAMPERED" } })).rejects.toThrow();
    await expect(prisma.$executeRaw`UPDATE "audit_logs" SET "action" = 'TAMPERED' WHERE "id" = ${sample.id}`).rejects.toThrow();

    // 5. Không xoá được — không cờ purge; và có cờ purge nhưng dòng chưa quá 12 tháng (trigger chặn).
    await expect(prisma.auditLog.delete({ where: { id: sample.id } })).rejects.toThrow();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL gieochu.audit_purge = 'on'`;
        await tx.$executeRaw`DELETE FROM "audit_logs" WHERE "id" = ${sample.id}`;
      }),
    ).rejects.toThrow();

    // 6. Purge hằng ngày không chạm dòng mới.
    await audit.purgeExpired();
    const after = await prisma.auditLog.findUnique({ where: { id: sample.id } });
    expect(after?.action).toBe(sample.action);
    expect(await prisma.auditLog.count({ where: { targetId: target.id } })).toBe(rows.length);
  });
});
