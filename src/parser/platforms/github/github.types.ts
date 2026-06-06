export interface GithubUserRaw {
  login:        string;
  name:         string | null;
  bio:          string | null;
  company:      string | null;
  location:     string | null;
  email:        string | null;
  blog:         string | null;
  avatar_url:   string;
  html_url:     string;
  followers:    number;
  following:    number;
  public_repos: number;
  public_gists: number;
  created_at:   string;
  updated_at:   string;
}

export interface GithubRepoRaw {
  name:        string;
  full_name:   string;
  html_url:    string;
  description: string | null;
  language:    string | null;
  stargazers_count: number;
  forks_count: number;
  fork:        boolean;
  topics:      string[];
  updated_at:  string;
}

export interface GithubEventRaw {
  type:       string;
  created_at: string;
}

export type GithubLanguagesRaw = Record<string, number>;

export interface GithubContentItemRaw {
  name: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}
