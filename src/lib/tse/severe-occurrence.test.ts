import { describe, expect, it } from "vitest";
import { detectSevereOccurrences, isPlainEndPhrase } from "./severe-occurrence";

describe("detecção determinística de ocorrência grave", () => {
  it("registra uma ofensa explícita dirigida ao tentante", () => {
    expect(detectSevereOccurrences("Fica quieto, seu idiota.")).toEqual([{ erro_id: "hostilidade_verbal", evidencia: "Fica quieto, seu idiota." }]);
  });

  it("não transforma encerramento textual em saída digna", () => {
    expect(isPlainEndPhrase("fim da abordagem")).toBe(true);
    expect(isPlainEndPhrase("Vamos encerrar a abordagem com sua concordância.")).toBe(false);
  });
});
