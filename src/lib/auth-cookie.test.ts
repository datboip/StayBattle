import { describe, expect, it } from "vitest";
import { voterCookieOptions } from "./auth-cookie";

// Regression: the voter cookie was `secure: NODE_ENV === "production"`.
// Browsers drop Secure cookies on plain-http origins (anything but
// localhost), so on a LAN self-host at http://192.168.x.x:3000 sign-in
// "worked" client-side but every server action answered "Sign in first".
describe("voterCookieOptions", () => {
  it("is not Secure on a plain-http production self-host", () => {
    const o = voterCookieOptions({ NODE_ENV: "production" });
    expect(o.secure).toBe(false);
  });

  it("is Secure when the deployment opts into TLS", () => {
    const o = voterCookieOptions({ NODE_ENV: "production", STAYBATTLE_HTTPS: "true" });
    expect(o.secure).toBe(true);
  });

  it("stays httpOnly + lax regardless", () => {
    for (const env of [{}, { STAYBATTLE_HTTPS: "true" }]) {
      const o = voterCookieOptions(env);
      expect(o.httpOnly).toBe(true);
      expect(o.sameSite).toBe("lax");
      expect(o.path).toBe("/");
    }
  });
});
