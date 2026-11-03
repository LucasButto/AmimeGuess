import type { Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { DismissibleFooter } from '@/components/DismissibleFooter';
import { SkinRoot } from '@/components/skin/SkinRoot';
import { getFranchise } from '@/franchises';
import { appShellEnabled } from '@/franchises/visibility';
import { SITE_THEME_COLOR, THEME_COLORS } from '@/franchises/themeColor';
import { themeCss } from '@/franchises/theme';
import { getSkin } from '@/franchises/themes';

/** El color de la barra del navegador: el de la franquicia (de su paleta), para que se vea como la barra superior del juego. */
export async function generateViewport({ params }: { params: Promise<{ franchise: string }> }): Promise<Viewport> {
  const { franchise: slug } = await params;
  return { themeColor: THEME_COLORS[slug] ?? SITE_THEME_COLOR };
}

/**
 * Aplica el tema de la franquicia a todas sus páginas (SPEC 9.2), en dos capas:
 * - el tema base (config.theme): redefine las variables CSS de los tokens en `:root` (colores, forma, fuente
 *   de títulos y fondo). El `<style>` va dentro del árbol, así al salir de la franquicia se va con él y el
 *   sitio vuelve a su aspecto base;
 * - la piel: `SkinRoot` envuelve todo con su clase y publica la piel por contexto, y acá se montan sus slots
 *   de fondo y de pie.
 * La estructura de pantalla es la misma en las cuatro.
 */
export default async function FranchiseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ franchise: string }>;
}) {
  const { franchise: slug } = await params;
  const franchise = getFranchise(slug);
  if (!franchise) notFound();
  const { Backdrop, Footer } = getSkin(franchise.slug).slots;

  return (
    <>
      <style>{themeCss(franchise.theme)}</style>
      {/* Las barras del sistema de la app instalada (la de gestos de abajo, ver globals.scss) llevan el mismo color que la de arriba. */}
      <style>{`:root { --system-bar: ${THEME_COLORS[franchise.slug] ?? SITE_THEME_COLOR}; }`}</style>
      {/* Las barras del sistema de la app instalada (la de gestos de abajo, ver globals.scss) llevan el mismo color que la de arriba. */}
      <style>{}</style>
      <SkinRoot slug={franchise.slug}>
        <Backdrop />
        {children}
        <DismissibleFooter phoneOnce={appShellEnabled(franchise.slug)}>
          <Footer />
        </DismissibleFooter>
      </SkinRoot>
    </>
  );
}
