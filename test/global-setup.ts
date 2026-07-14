import { writeSocialCalcIstanbulBundle } from "../build";

export default async function buildDefaultTestBundle(): Promise<void> {
  await writeSocialCalcIstanbulBundle();
}
