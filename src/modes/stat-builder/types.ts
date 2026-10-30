export interface StatBuilderConfig {
  readonly stats: readonly { readonly key: string; readonly label: string }[];
  readonly targets: readonly number[];
}
