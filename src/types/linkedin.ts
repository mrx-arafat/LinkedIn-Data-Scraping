export interface LinkedInConnection {
  name: string;
  headline: string | null; // occupation/bio shown in list
  username: string | null; // vanity name
  profileUrl: string;
}

export interface ScrapeResult<T> {
  items: T[];
  total: number;
  durationMs: number;
}

