export interface RepoInsights {
  languages:     Record<string, number>;
  detectedTools: string[];
  frameworks:    string[];
  readme:        string | null;
}

export interface GithubRepository {
  name:        string;
  fullName:    string;
  url:         string;
  description: string | null;
  language:    string | null;
  stars:       number;
  forks:       number;
  isForked:    boolean;
  topics:      string[];
  updatedAt:   string;
  insights:    RepoInsights;
}

export interface GithubProfile {
  username:        string;
  name:            string | null;
  bio:             string | null;
  company:         string | null;
  location:        string | null;
  email:           string | null;
  blog:            string | null;
  avatarUrl:       string;
  profileUrl:      string;
  followers:       number;
  following:       number;
  publicRepos:     number;
  publicGists:     number;
  topRepositories: GithubRepository[];
  contributions:   number;
  createdAt:       string;
  updatedAt:       string;
}
