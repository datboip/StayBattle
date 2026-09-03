/**
 * A listing's "hype" is the submitter's own one-liner about their pick —
 * stored as a comment they authored on their own listing (see the "Your hype"
 * box in the submission phase). Returns the most recent such comment's text,
 * or null. Kept pure so both the card badge and the submission view agree on
 * what counts as the hype.
 */
export function listingHype(listing: {
  added_by_id: string | null;
  comments: { voter_id: string; body: string; created_at: string }[];
}): string | null {
  const owner = listing.added_by_id;
  if (!owner) return null;
  const own = listing.comments.filter((c) => c.voter_id === owner);
  if (own.length === 0) return null;
  // Comments arrive oldest-first; the latest owner note is the current hype.
  const latest = own.reduce((a, b) => (b.created_at >= a.created_at ? b : a));
  const text = latest.body.trim();
  return text || null;
}
