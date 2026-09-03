import { describe, expect, it } from "vitest";
import { isListingPhotoUrl } from "./airbnb-graphql";

describe("isListingPhotoUrl", () => {
  const good = [
    "https://a0.muscache.com/im/pictures/hosting/Hosting-U3RheVN1cHBseUxpc3Rpbmc6MTEz/original/4f4f.jpg",
    "https://a0.muscache.com/im/pictures/miso/Hosting-1135079994510563372/original/4f4fcecc.jpeg",
    "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1287755113589757434/original/a1fc36e2.jpg",
    "https://a0.muscache.com/im/pictures/48252cc6-9514-42e5-81dc-65da342173a6.jpg",
  ];
  const junk = [
    // Airbnb UI illustrations/icons — the little house + cartoon person.
    "https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-search-bar-icons/original/4aae.png",
    "https://a0.muscache.com/im/pictures/airbnb-platform-assets/AirbnbPlatformAssets-Something/original/x.png",
    // Host/profile imagery, never a listing photo.
    "https://a0.muscache.com/im/pictures/user/abc/profile_pic/1234/x.jpg",
    "https://a0.muscache.com/defaults/user_pic/avatars/x.png",
    "https://a0.muscache.com/im/users/1234/x.jpg",
    // Wrong host.
    "https://evil.example.com/im/pictures/hosting/x.jpg",
    "not-a-url",
  ];

  it("accepts real listing photos", () => {
    for (const u of good) expect(isListingPhotoUrl(u), u).toBe(true);
  });
  it("rejects Airbnb UI assets, avatars, and off-CDN URLs", () => {
    for (const u of junk) expect(isListingPhotoUrl(u), u).toBe(false);
  });
});
