export interface BoardCategory {
  readonly id: string;
  readonly label: string;
  readonly help: string;
  readonly members: readonly string[];
  readonly wildcard?: boolean;
  readonly requiresSeries?: string;
  readonly excludesSeries?: string;
  readonly replaces?: string;
}

export interface CategoryBoardConfig {
  readonly questionImage?: string;
  readonly roster: readonly string[];
  readonly exclusions?: readonly { readonly series: string; readonly members: readonly string[] }[];
  /** Las primeras ocho son las preferidas; las restantes cubren filtros con categorías vacías. */
  readonly categories: readonly BoardCategory[];
}

export type BoardPhase = 'rolling' | 'choosing' | 'placed' | 'failed' | 'won';
export interface RoundResult {
  readonly placements: readonly string[];
  readonly outcome: 'won' | 'blocked' | 'wrong';
  readonly rejectedCategory?: string;
}
export interface BoardDraft {
  readonly placements: readonly string[];
  readonly phase: BoardPhase;
  readonly rejectedCategory?: string;
}
export interface BoardState {
  readonly rounds: readonly RoundResult[];
  readonly draft: BoardDraft;
}
