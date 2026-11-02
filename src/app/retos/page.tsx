import type { Metadata } from 'next';
import { franchises } from '@/franchises';
import { themeCss, themeScope } from '@/franchises/theme';
import { es } from '@/i18n/es';
import { loadPlayableFranchises } from '../playable';
import { ChallengesList } from './ChallengesList';

export const metadata: Metadata = { title: es.challenges.title, robots: { index: false } };

/** Pestaña Retos: los retos de hoy de todas las franquicias, agrupados, con su estado. */
export default async function ChallengesPage() {
  const groups = await loadPlayableFranchises();
  return (
    <>
      {/* El tema de cada franquicia, con alcance de grupo (igual que el inicio): cada lista lleva sus colores y su fuente. */}
      <style>{franchises.map((franchise) => themeCss(franchise.theme, themeScope(franchise.slug))).join('\n')}</style>
      <ChallengesList groups={groups} />
    </>
  );
}
