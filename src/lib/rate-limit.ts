import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, messages } from "@/db/schema";
import { getEnv } from "@/lib/env";

function parseOperatingHours(spec: string): { startMinutes: number; endMinutes: number } {
  const [start, end] = spec.split("-");
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  return { startMinutes: toMinutes(start), endMinutes: toMinutes(end) };
}

export function isWithinOperatingHours(now = new Date()): boolean {
  const env = getEnv();
  const { startMinutes, endMinutes } = parseOperatingHours(env.OPERATING_HOURS);

  const localMinutes = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: env.OPERATING_TIMEZONE,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .reduce((acc, part) => {
        if (part.type === "hour") return acc + Number(part.value) * 60;
        if (part.type === "minute") return acc + Number(part.value);
        return acc;
      }, 0),
  );

  return localMinutes >= startMinutes && localMinutes < endMinutes;
}

function startOfTodayIso(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // en-CA gives YYYY-MM-DD
  return `${parts}T00:00:00.000Z`;
}

export async function getDmsSentToday(): Promise<number> {
  const env = getEnv();
  const since = startOfTodayIso(env.OPERATING_TIMEZONE);
  const [row] = await db
    .select({ total: count() })
    .from(messages)
    .where(
      and(
        eq(messages.direction, "outbound"),
        eq(messages.channel, "browser"),
        eq(messages.status, "sent"),
        gte(messages.sentAt, since),
      ),
    );
  return row?.total ?? 0;
}

export async function canSendBrowserDmNow(): Promise<
  { allowed: true } | { allowed: false; reason: string }
> {
  const env = getEnv();

  if (!isWithinOperatingHours()) {
    return { allowed: false, reason: `Fora da janela de operação (${env.OPERATING_HOURS})` };
  }

  const sentToday = await getDmsSentToday();
  if (sentToday >= env.MAX_DMS_PER_DAY) {
    return {
      allowed: false,
      reason: `Limite diário atingido (${sentToday}/${env.MAX_DMS_PER_DAY})`,
    };
  }

  return { allowed: true };
}

export function randomDmDelayMs(): number {
  const env = getEnv();
  const minMs = env.MIN_SECONDS_BETWEEN_DMS * 1000;
  const maxMs = env.MAX_SECONDS_BETWEEN_DMS * 1000;
  return minMs + Math.random() * (maxMs - minMs);
}

export async function getProfileVisitsToday(): Promise<number> {
  const env = getEnv();
  const since = startOfTodayIso(env.OPERATING_TIMEZONE);
  const [row] = await db
    .select({ total: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "instagram_profile"),
        eq(auditLog.event, "profile_viewed"),
        gte(auditLog.createdAt, since),
      ),
    );
  return row?.total ?? 0;
}

export async function canVisitProfileNow(): Promise<
  { allowed: true } | { allowed: false; reason: string }
> {
  const env = getEnv();

  if (!isWithinOperatingHours()) {
    return { allowed: false, reason: `Fora da janela de operação (${env.OPERATING_HOURS})` };
  }

  const visitedToday = await getProfileVisitsToday();
  if (visitedToday >= env.MAX_PROFILE_VISITS_PER_DAY) {
    return {
      allowed: false,
      reason: `Limite diário de visitas a perfis atingido (${visitedToday}/${env.MAX_PROFILE_VISITS_PER_DAY})`,
    };
  }

  return { allowed: true };
}

export function randomDiscoveryDelayMs(): number {
  const env = getEnv();
  const minMs = env.DISCOVERY_MIN_SECONDS_BETWEEN_ACTIONS * 1000;
  const maxMs = env.DISCOVERY_MAX_SECONDS_BETWEEN_ACTIONS * 1000;
  return minMs + Math.random() * (maxMs - minMs);
}

export async function getInboxChecksToday(): Promise<number> {
  const env = getEnv();
  const since = startOfTodayIso(env.OPERATING_TIMEZONE);
  const [row] = await db
    .select({ total: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "instagram_thread"),
        eq(auditLog.event, "inbox_checked"),
        gte(auditLog.createdAt, since),
      ),
    );
  return row?.total ?? 0;
}

export async function canCheckInboxNow(): Promise<
  { allowed: true } | { allowed: false; reason: string }
> {
  const env = getEnv();

  if (!isWithinOperatingHours()) {
    return { allowed: false, reason: `Fora da janela de operação (${env.OPERATING_HOURS})` };
  }

  const checkedToday = await getInboxChecksToday();
  if (checkedToday >= env.MAX_INBOX_CHECKS_PER_DAY) {
    return {
      allowed: false,
      reason: `Limite diário de checagens de inbox atingido (${checkedToday}/${env.MAX_INBOX_CHECKS_PER_DAY})`,
    };
  }

  return { allowed: true };
}
