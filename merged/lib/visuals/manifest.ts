import data from '@/data/visuals_assets.json';
import type { AssetManifest } from './resolver';

/** The published-asset manifest shipped with this build (empty until the owner approves real assets). */
export const assetManifest = data as unknown as AssetManifest;
export const assetUiEnabled = (): boolean => process.env.NEXT_PUBLIC_ASSET_UI === 'true';
export const allowedAssetHosts = (): string[] => (process.env.NEXT_PUBLIC_ASSET_HOSTS ?? '').split(',').map(s => s.trim()).filter(Boolean);
