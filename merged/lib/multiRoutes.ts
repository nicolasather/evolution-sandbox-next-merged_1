/**
 * MultiRouteManager — Multiple crafting routes with player focus
 */

export interface RouteInfo {
  recipe: string[];
  display: string;
  isFocused: boolean;
  isAvailable: boolean;
}

type RoutePreference = Record<string, number>;

const STORAGE_KEY = 'evo.routes.v1';

export class MultiRouteManager {
  private preferences: RoutePreference = {};

  constructor() {
    this.load();
  }

  /**
   * Get all routes for a discovery with availability
   */
  getRoutes(discovery: any, byId: Record<string, any>, found: Set<string>): RouteInfo[] {
    if (!discovery?.rec || !Array.isArray(discovery.rec)) return [];

    const focusedIndex = this.preferences[discovery.id || ''] || 0;

    return discovery.rec.map((recipe: string[], index: number) => {
      const isAvailable = recipe.every((id) => found.has(id));
      const display = recipe.map((id) => byId[id]?.n || id).join(' + ');

      return {
        recipe,
        display,
        isFocused: index === focusedIndex,
        isAvailable,
      };
    });
  }

  /**
   * Set player's preferred route for discovery
   */
  setFocusedRoute(discoveryId: string, routeIndex: number): void {
    this.preferences[discoveryId] = routeIndex;
    this.save();
  }

  /**
   * Get focused route for discovery
   */
  getFocusedRoute(discovery: any): RouteInfo | null {
    const routes = this.getRoutes(discovery, {}, new Set());
    const focusedIndex = this.preferences[discovery.id || ''] || 0;
    return routes[focusedIndex] || routes[0] || null;
  }

  /**
   * Load preferences from localStorage
   */
  load(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      this.preferences = saved ? JSON.parse(saved) : {};
    } catch {
      this.preferences = {};
    }
  }

  /**
   * Save preferences to localStorage
   */
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch {
      // Silently fail if localStorage unavailable
    }
  }

  /**
   * Reset all preferences
   */
  reset(): void {
    this.preferences = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently fail
    }
  }
}
