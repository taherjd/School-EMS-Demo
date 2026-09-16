import "server-only";
import { prisma } from "./db";

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: unknown,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? null,
        details: details === undefined ? null : JSON.stringify(details),
      },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
