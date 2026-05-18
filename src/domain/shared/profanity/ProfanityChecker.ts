export interface ProfanityChecker {
  containsProfanity(text: string): boolean;
  /**
   * Returns the distinct user-facing tokens (as written) that trip the
   * profanity check. May return an empty array even when `containsProfanity`
   * returns true — for example, when the match comes from cross-token
   * collapse evasion (`п и з д е ц`) and no individual token is profane.
   * Callers should use the empty result as a "no specific words to surface"
   * signal and fall back to a generic message.
   */
  findProfaneWords(text: string): string[];
}
