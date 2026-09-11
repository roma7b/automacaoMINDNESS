export interface InstagramProfileSnapshot {
  username: string;
  fullName: string;
  bio: string;
  category: string | null;
  followers: number;
  following: number;
  postsCount: number;
  externalUrl: string | null;
  recentCaptions: string[];
}
