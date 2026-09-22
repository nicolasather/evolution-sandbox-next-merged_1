/**
 * MultiRoutesPicker — When a discovery has multiple crafting paths,
 * let player select which one to focus on.
 *
 * Example: Tool can come from Stone+Wood, Stone+Metal, or Bone+Wood.
 * Player can explore each route to see which one they prefer.
 */

import React from 'react';
import type { Discovery } from '@/lib/types';
import type { RouteInfo } from '@/lib/multiRoutes';
import styles from './MultiRoutesPicker.module.css';

interface MultiRoutesPickerProps {
  discovery: Discovery | null;
  routes: RouteInfo[];
  focusedIndex: number;
  onSelectRoute: (index: number) => void;
}

export function MultiRoutesPicker({
  discovery,
  routes,
  focusedIndex,
  onSelectRoute,
}: MultiRoutesPickerProps) {
  if (!discovery || routes.length <= 1) return null;

  return (
    <div className={styles.routesPicker}>
      <div className={styles.routesHeader}>
        <h3 className={styles.title}>Crafting Paths</h3>
        <p className={styles.subtitle}>
          This discovery has {routes.length} known routes. Explore them all.
        </p>
      </div>

      <div className={styles.routesList}>
        {routes.map((route, index) => (
          <button
            key={index}
            className={`${styles.routeButton} ${
              index === focusedIndex ? styles.focused : ''
            } ${route.isAvailable ? '' : styles.unavailable}`}
            onClick={() => onSelectRoute(index)}
            disabled={!route.isAvailable}
            title={
              !route.isAvailable
                ? 'Discover both ingredients to unlock this route'
                : `Route: ${route.display}`
            }
          >
            <span className={styles.routeNumber}>{index + 1}</span>
            <span className={styles.routeRecipe}>{route.display}</span>
            {index === focusedIndex && <span className={styles.checkmark}>✓</span>}
          </button>
        ))}
      </div>

      <div className={styles.routeInfo}>
        <p className={styles.infoText}>
          Selecting a route helps you focus on one crafting path. All routes count toward your progress.
        </p>
      </div>
    </div>
  );
}
