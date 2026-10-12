import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getFranchise } from '@/franchises';
import { themeCss } from '@/franchises/theme';

/**
 * Aplica el tema de la franquicia a todas sus páginas: redefine las variables CSS de los tokens en `:root`
 * (colores, forma, fuente de títulos y fondo). La estructura de pantalla es la misma en las cuatro. El
 * `<style>` va dentro del árbol, así al salir de la franquicia se va con él y el sitio vuelve a su aspecto base.
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

  return (
    <>
      <style>{themeCss(franchise.theme)}</style>
      {children}
    </>
  );
}
