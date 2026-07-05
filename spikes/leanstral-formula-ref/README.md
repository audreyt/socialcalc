This directory is a local spike for a narrow Rust formula-reference rewrite core (`offset`, `adjust`, `replace`) with WASM and Binaryen `wasm2js` fallback loaders. It does not replace SocialCalc’s full formula engine and does not touch DOM or editor code.

```bash
bun install
rustup target add wasm32-unknown-unknown
cargo test -p formula-ref-core
bun spikes/leanstral-formula-ref/build-rust-backend.mjs
bun test spikes/leanstral-formula-ref/formula-ref-core.parity.test.ts
bun spikes/leanstral-formula-ref/build-context.mjs
```

After these commands pass, hand off `prompt.md` and `context.md` to Leanstral (Mistral API `labs-leanstral-1-5-1` or OMP `mistral/labs-leanstral-1-5-1` when `MISTRAL_API_KEY` is visible to the process). Model output and verification notes live in `leanstral-response.md`. Regenerate `context.md` after changing fixtures or `lib.rs`.