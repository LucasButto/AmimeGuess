'use client';

import { createContext } from 'react';

export const AttemptRules = createContext<{ readonly base: number; readonly adaptive: boolean } | null>(null);
/** Presupuesto ya ajustado a los filtros, compartido también con las ayudas del modal. */
export const ActiveAttemptLimit = createContext<number | undefined>(undefined);
