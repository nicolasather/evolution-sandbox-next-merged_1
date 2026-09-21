import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Evolution Sandbox',
    short_name: 'EvoSandbox',
    description: 'An explorable discovery graph mapping the evolution of technology from stone to civilization.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b', // zinc-950
    theme_color: '#09090b',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
