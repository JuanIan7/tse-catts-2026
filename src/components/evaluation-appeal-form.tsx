"use client";

import { useMemo, useState } from "react";
import { submitEvaluationAppeal } from "@/app/app/actions";
import { annotationMeta, type AnnotationType } from "@/lib/admin/evaluation-review";

type AppealTurn = { id: string; speaker: "ALUNO" | "PERSONAGEM"; content: string };

const tools: AnnotationType[] = ["PARAFRASE", "MEMORIA_LINKADA", "MAIEUTICA_TED", "SAIDA_DIGNA", "PERGUNTA_SIMPLES", "PERGUNTA_COMPLEXA", "FATOR_PROTECAO", "FATOR_RISCO", "FATOR_PRINCIPAL"];
const speakerLabel = { ALUNO: "Você", PERSONAGEM: "Tentante" } as const;

export function EvaluationAppealForm({ sessionId, turns }: { sessionId: string; turns: AppealTurn[] }) {
  const [selectedTurns, setSelectedTurns] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<AnnotationType[]>([]);
  const selectionDescription = useMemo(() => `${selectedTurns.length} fala(s) e ${selectedTools.length} ferramenta(s) selecionada(s).`, [selectedTools.length, selectedTurns.length]);
  const toggle = <T,>(value: T, current: T[], update: (next: T[]) => void) => update(current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);

  return <section className="review-request-form appeal-form">
    <h3>Recurso de nota</h3>
    <p className="panel-subtitle">Selecione as falas e as ferramentas que deveriam ter sido consideradas. O administrador analisará item a item.</p>
    <form action={submitEvaluationAppeal}>
      <input type="hidden" name="sessionId" value={sessionId}/>
      <div className="appeal-turn-list" aria-label="Falas disponíveis para recurso">
        {turns.map((turn) => {
          const selected = selectedTurns.includes(turn.id);
          return <button type="button" key={turn.id} className={selected ? "appeal-turn-selected" : "appeal-turn"} aria-pressed={selected} onClick={() => toggle(turn.id, selectedTurns, setSelectedTurns)}>
            <strong>{speakerLabel[turn.speaker]}</strong><span>{turn.content}</span>
          </button>;
        })}
      </div>
      {selectedTurns.map((id) => <input type="hidden" key={id} name="transcriptIds" value={id}/>)}
      <div className="appeal-tools" role="group" aria-label="Ferramentas alegadas">
        {tools.map((tool) => <label key={tool} style={{ borderColor: annotationMeta[tool].color }}><input type="checkbox" name="tools" value={tool} checked={selectedTools.includes(tool)} onChange={() => toggle(tool, selectedTools, setSelectedTools)}/>{annotationMeta[tool].label}</label>)}
      </div>
      <p className="panel-subtitle">{selectionDescription}</p>
      <button type="submit" disabled={selectedTurns.length === 0 || selectedTools.length === 0}>Enviar recurso para revisão</button>
    </form>
  </section>;
}
