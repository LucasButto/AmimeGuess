import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { DismissibleFooter } from '@/components/DismissibleFooter';
import { SkinRoot } from '@/components/skin/SkinRoot';
import { getFranchise } from '@/franchises';
import { themeCss } from '@/franchises/theme';
import { getSkin } from '@/franchises/themes';

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
      <SkinRoot slug={franchise.slug}>
        <Backdrop />
        {children}
        <DismissibleFooter>
          <Footer />
        </DismissibleFooter>
      </SkinRoot>
    </>
  );
}
