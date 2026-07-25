// Shape the resume extractor asks the LLM to return. Every field is optional and
// defensively defaulted on parse — these are *suggestions* a user reviews, never
// a contract the model is trusted to honour exactly.

export interface ResumeIdentitySuggestion {
  tagline: string | null;
  bio: string | null;
  location: string | null;
  industry: string | null;
}

export interface ResumeCapabilitySuggestion {
  name: string;
  category: string | null;
}

export interface ResumeTimelineSuggestion {
  category: string;
  date: string; // "YYYY-MM" or "YYYY"
  endDate: string | null;
  label: string;
  organization: string | null;
  description: string | null;
}

export interface ResumeWorkSuggestion {
  name: string;
  tagline: string | null;
  description: string;
  technologies: string[];
}

export interface ResumeExtraction {
  identity: ResumeIdentitySuggestion | null;
  capabilities: ResumeCapabilitySuggestion[];
  timeline: ResumeTimelineSuggestion[];
  works: ResumeWorkSuggestion[];
}
