export type EntryType = "income" | "expense";

export interface Entry {
  id: string;
  type: EntryType;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  note: string;
}

export interface EntryWithBalance extends Entry {
  balance: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  login_code: string;
  categories: string[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface NewEntry {
  type: EntryType;
  amount: number;
  category: string;
  date: string;
  note: string;
}

export type ViewMode = "chart" | "table";

export interface ChatReply {
  reply: string;
  created: Entry[];
  needs_clarification: boolean;
}
