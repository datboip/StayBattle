import {
  VERSION,
  GIT_SHA,
  GIT_SHA_SHORT,
  GIT_DIRTY,
  BUILT_AT,
} from "@/lib/version";

export const dynamic = "force-static";

export async function GET() {
  return Response.json({
    version: VERSION,
    sha: GIT_SHA,
    shaShort: GIT_SHA_SHORT,
    dirty: GIT_DIRTY,
    builtAt: BUILT_AT,
  });
}
