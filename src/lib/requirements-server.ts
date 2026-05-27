import "server-only";
import { db } from "./db";
import { parseRequirements } from "./requirements";
import type { AmenityTag } from "./airbnb-graphql";

/**
 * Server-only helper to read the parsed must-haves list from settings.
 * Lives outside actions.ts because actions.ts is "use server" — every
 * export there has to be an async server action, and a synchronous
 * SSR-reader doesn't fit that contract.
 */
export function getBattleRequirements(): AmenityTag[] {
  const row = db
    .prepare("select value from settings where key = 'battle_requirements'")
    .get() as { value: string } | undefined;
  return parseRequirements(row?.value);
}
