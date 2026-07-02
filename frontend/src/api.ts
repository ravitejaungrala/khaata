import type { AuthResponse, ChatReply, Entry, NewEntry, User } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "khaata-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail =
      (data as { detail?: string })?.detail || `Request failed (${res.status})`;
    throw new ApiError(
      typeof detail === "string" ? detail : "Request failed",
      res.status
    );
  }
  return data as T;
}

export const api = {
  async register(
    name: string,
    email: string,
    password: string
  ): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },

  async login(identifier: string, password: string): Promise<AuthResponse> {
    // OAuth2 password flow expects form-encoded username/password.
    // `identifier` can be the user's email OR their login ID (e.g. "016").
    const body = new URLSearchParams();
    body.set("username", identifier);
    body.set("password", password);
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  },

  async me(): Promise<User> {
    return request<User>("/api/auth/me");
  },

  async listEntries(): Promise<Entry[]> {
    return request<Entry[]>("/api/entries");
  },

  async createEntry(entry: NewEntry): Promise<Entry> {
    return request<Entry>("/api/entries", {
      method: "POST",
      body: JSON.stringify(entry),
    });
  },

  async updateEntry(id: string, entry: NewEntry): Promise<Entry> {
    return request<Entry>(`/api/entries/${id}`, {
      method: "PUT",
      body: JSON.stringify(entry),
    });
  },

  async deleteEntry(id: string): Promise<void> {
    await request<void>(`/api/entries/${id}`, { method: "DELETE" });
  },

  async listCategories(): Promise<string[]> {
    return request<string[]>("/api/categories");
  },

  async sendChat(message: string): Promise<ChatReply> {
    return request<ChatReply>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  async sendChatImage(file: File): Promise<ChatReply> {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_URL}/api/chat/image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const detail = (data as { detail?: string })?.detail || "Couldn't read the image.";
      throw new ApiError(typeof detail === "string" ? detail : "Couldn't read the image.", res.status);
    }
    return data as ChatReply;
  },

  async exportPdf(start: string, end: string): Promise<Blob> {
    const token = getToken();
    const res = await fetch(
      `${API_URL}/api/export/pdf?start=${start}&end=${end}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) {
      throw new ApiError("Could not generate the PDF. Please try again.", res.status);
    }
    return res.blob();
  },
};

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { ApiError };
