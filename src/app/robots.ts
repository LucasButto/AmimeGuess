import type { MetadataRoute } from 'next';
import { SITE_URL } from './site';

// Se genera al compilar: es un archivo estático, no una función de Vercel.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
