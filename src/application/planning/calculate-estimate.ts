import type {
  EstimateBreakdownItem,
  EstimateConfidence,
  EstimateFactor,
  EstimateProposal,
  EstimateRange,
  EstimationUnit,
} from "@/domain/planning/estimate";
import type { TicketDraft } from "@/domain/tickets/ticket";

type HistoricalReference = {
  label: string;
  low: number;
  high: number;
};

type CalculateEstimateInput = {
  ticket: TicketDraft;
  unit: EstimationUnit;
  weeklyCapacityHours: number;
  historicalReferences?: HistoricalReference[];
};

function includesAny(input: string, terms: string[]) {
  return terms.some((term) => input.includes(term));
}

function normalizeShares(
  items: Array<Omit<EstimateBreakdownItem, "effortShare"> & { score: number }>,
) {
  const total = items.reduce((sum, item) => sum + item.score, 0);
  const shares = items.map((item) =>
    Math.max(1, Math.round((item.score / total) * 100)),
  );
  const difference = 100 - shares.reduce((sum, share) => sum + share, 0);
  shares[shares.indexOf(Math.max(...shares))] += difference;

  return items.map((item, index) => ({
    label: item.label,
    basis: item.basis,
    effortShare: shares[index],
  }));
}

function roundRangeValue(value: number, unit: EstimationUnit) {
  if (unit === "hours" && value >= 12) {
    return Math.max(2, Math.round(value / 2) * 2);
  }

  return Math.max(1, Math.round(value));
}

function range(
  low: number,
  high: number,
  unit: EstimationUnit,
): EstimateRange {
  const roundedLow = roundRangeValue(low, unit);
  const roundedHigh = roundRangeValue(high, unit);

  return {
    low: roundedLow,
    high: Math.max(
      roundedLow + (unit === "hours" && roundedLow >= 12 ? 2 : 1),
      roundedHigh,
    ),
  };
}

function calculateConfidence(
  ticket: TicketDraft,
  historicalCount: number,
): EstimateConfidence {
  let uncertainty = ticket.unknowns.length * 2;
  uncertainty += ticket.risks.length * 0.8;
  uncertainty += ticket.dependencies.length;
  uncertainty += ticket.constraints.length * 0.4;
  uncertainty += historicalCount ? 0 : 1;

  if (
    uncertainty <= 2 &&
    ticket.acceptanceCriteria.length >= 3 &&
    ticket.subtasks.length >= 2
  ) {
    return "high";
  }

  return uncertainty <= 5 ? "medium" : "low";
}

export function calculateEstimate({
  ticket,
  unit,
  weeklyCapacityHours,
  historicalReferences = [],
}: CalculateEstimateInput): EstimateProposal {
  const searchable = [
    ticket.title,
    ticket.context,
    ...ticket.labels,
    ...ticket.technicalRequirements,
  ]
    .join(" ")
    .toLocaleLowerCase("es-MX");
  const novelty = includesAny(searchable, [
    "nuevo",
    "migración",
    "integración",
    "oauth",
    "autenticación",
    "arquitectura",
  ]);
  const complexityScore =
    2 +
    ticket.functionalRequirements.length * 1.2 +
    ticket.technicalRequirements.length * 1.1 +
    ticket.acceptanceCriteria.length * 0.7 +
    ticket.subtasks.length * 0.9 +
    ticket.constraints.length * 0.7 +
    ticket.risks.length * 1.3 +
    ticket.unknowns.length * 1.5 +
    ticket.dependencies.length * 1.2 +
    (novelty ? 1.2 : 0);
  const rawHours = 4 + complexityScore * 2.25;
  const dailyCapacity = Math.min(
    8,
    Math.max(2, weeklyCapacityHours / 5),
  );
  let probableCenter =
    unit === "hours"
      ? rawHours
      : unit === "days"
        ? rawHours / dailyCapacity
        : complexityScore;

  if (historicalReferences.length) {
    const historicalCenter =
      historicalReferences.reduce(
        (sum, reference) => sum + (reference.low + reference.high) / 2,
        0,
      ) / historicalReferences.length;
    probableCenter = probableCenter * 0.8 + historicalCenter * 0.2;
  }

  const favorable = range(
    probableCenter * 0.58,
    probableCenter * 0.82,
    unit,
  );
  const probable = range(
    Math.max(favorable.low, probableCenter * 0.84),
    Math.max(favorable.high, probableCenter * 1.18),
    unit,
  );
  const adverse = range(
    Math.max(probable.low, probableCenter * 1.3),
    Math.max(probable.high, probableCenter * 1.8),
    unit,
  );
  const confidence = calculateConfidence(ticket, historicalReferences.length);
  const factors: EstimateFactor[] = [
    {
      key: "acceptance-coverage",
      label: "Cobertura verificable",
      direction:
        ticket.acceptanceCriteria.length >= 3 ? "decreases" : "increases",
      weight: ticket.acceptanceCriteria.length >= 3 ? 2 : 1,
      evidence: `${ticket.acceptanceCriteria.length} criterios de aceptación definidos.`,
    },
    {
      key: "work-breakdown",
      label: "Descomposición del trabajo",
      direction: ticket.subtasks.length >= 3 ? "decreases" : "neutral",
      weight: ticket.subtasks.length >= 3 ? 2 : 1,
      evidence: `${ticket.subtasks.length} subtareas permiten revisar la base del cálculo.`,
    },
    {
      key: "open-unknowns",
      label: "Incógnitas abiertas",
      direction: ticket.unknowns.length ? "increases" : "decreases",
      weight: ticket.unknowns.length > 1 ? 3 : ticket.unknowns.length ? 2 : 1,
      evidence: ticket.unknowns.length
        ? `${ticket.unknowns.length} decisiones todavía pueden modificar alcance o riesgo.`
        : "No hay preguntas prioritarias abiertas.",
    },
    {
      key: "risk-load",
      label: "Carga de riesgo",
      direction: ticket.risks.length ? "increases" : "decreases",
      weight: ticket.risks.length > 2 ? 3 : ticket.risks.length ? 2 : 1,
      evidence: `${ticket.risks.length} riesgos explícitos participan en el escenario adverso.`,
    },
    {
      key: "dependencies",
      label: "Dependencias",
      direction: ticket.dependencies.length ? "increases" : "decreases",
      weight: ticket.dependencies.length > 1 ? 3 : ticket.dependencies.length ? 2 : 1,
      evidence: ticket.dependencies.length
        ? `${ticket.dependencies.length} dependencias pueden introducir espera o retrabajo.`
        : "El ticket no declara dependencias externas.",
    },
    {
      key: "declared-capacity",
      label: "Capacidad declarada",
      direction: "neutral",
      weight: 1,
      evidence: `${weeklyCapacityHours} horas semanales convierten esfuerzo en calendario sin alterar la complejidad.`,
    },
    {
      key: "historical-calibration",
      label: "Referencias históricas",
      direction: historicalReferences.length ? "decreases" : "increases",
      weight: historicalReferences.length ? 2 : 1,
      evidence: historicalReferences.length
        ? `${historicalReferences.length} resultados comparables moderan la propuesta.`
        : "Todavía no existen resultados comparables; la confianza no se incrementa.",
    },
  ];

  if (novelty) {
    factors.splice(4, 0, {
      key: "technical-novelty",
      label: "Novedad técnica",
      direction: "increases",
      weight: 2,
      evidence:
        "El contenido menciona integración, migración, autenticación o arquitectura nueva.",
    });
  }

  const decomposition = normalizeShares([
    {
      label: "Descubrimiento y límites",
      score: 2 + ticket.unknowns.length * 2 + ticket.constraints.length,
      basis: "Resolver incógnitas, restricciones y alcance antes de ejecutar.",
    },
    {
      label: "Implementación",
      score:
        4 +
        ticket.functionalRequirements.length * 2 +
        ticket.technicalRequirements.length * 2 +
        ticket.subtasks.length,
      basis: "Construcción del recorrido funcional y sus decisiones técnicas.",
    },
    {
      label: "Integración y riesgo",
      score: 2 + ticket.dependencies.length * 2 + ticket.risks.length * 1.5,
      basis: "Dependencias, compatibilidad y mitigaciones del escenario adverso.",
    },
    {
      label: "Verificación",
      score: 2 + ticket.acceptanceCriteria.length * 1.4,
      basis: "Pruebas, criterios de aceptación y comprobación del resultado.",
    },
  ]);

  return {
    unit,
    scenarios: {
      favorable: {
        key: "favorable",
        label: "Favorable",
        ...favorable,
        explanation:
          "Alcance estable, respuestas rápidas y dependencias disponibles.",
      },
      probable: {
        key: "probable",
        label: "Probable",
        ...probable,
        explanation:
          "Ritmo esperado con revisión normal y las incertidumbres visibles.",
      },
      adverse: {
        key: "adverse",
        label: "Adverso",
        ...adverse,
        explanation:
          "Retrabajo razonable si se materializan riesgos o dependencias.",
      },
    },
    confidence,
    basis:
      "Propuesta determinista basada en complejidad, criterios, subtareas, riesgos, dependencias, novedad y capacidad declarada. El criterio manual puede modificar los rangos antes de confirmar.",
    decomposition,
    assumptions: ticket.assumptions,
    unknowns: ticket.unknowns,
    risks: ticket.risks,
    dependencies: ticket.dependencies,
    historicalReferences: historicalReferences.length
      ? historicalReferences.map(
          (reference) =>
            `${reference.label}: ${reference.low}–${reference.high}`,
        )
      : ["Sin referencias históricas comparables en este workspace."],
    factors,
    calculationSnapshot: {
      complexityScore: Number(complexityScore.toFixed(2)),
      capacityHoursPerWeek: weeklyCapacityHours,
      comparableCount: historicalReferences.length,
    },
    engineKind: "local_rules",
    engineVersion: "tr-estimate-1",
  };
}
