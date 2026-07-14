// Ambient type declarations for istanbul-lib-instrument (no @types package available).
// Only the surface used by build.ts is declared here.

declare module "istanbul-lib-instrument" {
  export interface InstrumenterOptions {
    coverageVariable?: string;
    esModules?: boolean;
    compact?: boolean;
    preserveComments?: boolean;
    autoWrap?: boolean;
    produceSourceMap?: boolean;
    coverageGlobalScope?: string;
    coverageGlobalScopeFunc?: boolean;
  }

  export interface Instrumenter {
    /** Synchronously instrument `code`, tracking coverage against `filename`.
     *  @param code  - source text (must be a string)
     *  @param filename - path used as the coverage key / SF row
     *  @param inputSourceMap - optional source map object mapping `code` back to original source
     */
    instrumentSync(
      code: string,
      filename: string,
      inputSourceMap?: object,
    ): string;
  }

  export function createInstrumenter(opts?: InstrumenterOptions): Instrumenter;
}
