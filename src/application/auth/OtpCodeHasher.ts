export interface OtpCodeHasher {
  hash(code: string): string;
  verify(code: string, hash: string): boolean;
}
