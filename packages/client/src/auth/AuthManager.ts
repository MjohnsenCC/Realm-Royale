import {
  CharacterSummary,
  AuthenticatedJoinOptions,
} from "@rotmg-lite/shared";

const TOKEN_STORAGE_KEY = "authToken";

export class AuthManager {
  private static instance: AuthManager;
  private token: string | null = null;

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /** Check URL hash for auth token (from OAuth callback) or restore from localStorage. */
  initialize(): void {
    const hash = window.location.hash;
    const match = hash.match(/auth=([^&]+)/);
    if (match) {
      this.token = match[1];
      localStorage.setItem(TOKEN_STORAGE_KEY, this.token);
      // Clean up URL hash
      history.replaceState(null, "", window.location.pathname);
    } else {
      this.token = localStorage.getItem(TOKEN_STORAGE_KEY);
    }

    // Check for auth error from failed OAuth
    if (hash.includes("auth_error")) {
      console.error("Google authentication failed");
      history.replaceState(null, "", window.location.pathname);
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  getJoinOptions(characterId: string): AuthenticatedJoinOptions {
    if (!this.token) throw new Error("Not authenticated");
    return { authToken: this.token, characterId };
  }

  private async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      this.logout();
      throw new Error("Session expired");
    }

    return res;
  }

  async fetchCharacters(): Promise<CharacterSummary[]> {
    const res = await this.authFetch("/api/characters");
    if (!res.ok) throw new Error("Failed to fetch characters");
    return res.json();
  }

  async createCharacter(name: string): Promise<CharacterSummary> {
    const res = await this.authFetch("/api/characters", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create character");
    }
    return res.json();
  }

  async deleteCharacter(id: string): Promise<void> {
    const res = await this.authFetch(`/api/characters/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete character");
  }
}
