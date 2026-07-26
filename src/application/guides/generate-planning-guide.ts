import type {
  GuideCandidate,
  GuidePhase,
  GuideSourceKind,
  PlanningGuide,
} from "@/domain/guides/planning-guide";
import type { EstimationUnit } from "@/domain/planning/estimate";
import type { TicketDraft } from "@/domain/tickets/ticket";

type GeneratePlanningGuideInput = {
  ticketId: string;
  ticket: TicketDraft;
  estimate: {
    id: string;
    low: number;
    high: number;
    unit: EstimationUnit;
  };
  assignment: {
    id: string;
    participants: GuideCandidate[];
    evidenceLimitations: string[];
  };
};

type WeightedStep = Omit<
  PlanningGuide["steps"][number],
  "localId" | "position" | "effortShare"
> & {
  weight: number;
};

function sentenceList(items: string[], fallback: string) {
  if (!items.length) return fallback;
  return items.slice(0, 4).join("; ");
}

function normalizeEffort(steps: WeightedStep[]) {
  const total = steps.reduce((sum, step) => sum + step.weight, 0);
  const shares = steps.map((step) =>
    Math.max(1, Math.round((step.weight / total) * 100)),
  );
  const difference = 100 - shares.reduce((sum, share) => sum + share, 0);
  const largestIndex = shares.indexOf(Math.max(...shares));
  shares[largestIndex] += difference;

  return steps.map((step, index) => ({
    ...step,
    localId: `guide-step-${index + 1}`,
    position: index,
    effortShare: shares[index],
  }));
}

function selectByContribution(
  participants: GuideCandidate[],
  index: number,
  total: number,
) {
  const point = ((index + 0.5) / Math.max(1, total)) * 100;
  let accumulated = 0;
  for (const participant of participants) {
    accumulated += participant.contributionPercent;
    if (point <= accumulated) return participant;
  }
  return participants[0];
}

function step(
  phase: GuidePhase,
  title: string,
  outcome: string,
  candidate: GuideCandidate,
  verification: string,
  sourceKind: GuideSourceKind,
  sourceLabel: string,
  weight: number,
  dependencies: string[] = [],
  risks: string[] = [],
): WeightedStep {
  return {
    phase,
    title,
    outcome,
    responsibleUserId: candidate.userId,
    responsibleName: candidate.displayName,
    verification,
    dependencies,
    risks,
    sourceKind,
    sourceLabel,
    weight,
  };
}

export function generatePlanningGuide({
  ticketId,
  ticket,
  estimate,
  assignment,
}: GeneratePlanningGuideInput): PlanningGuide {
  const participants = [...assignment.participants].sort((left, right) => {
    if (left.participationRole !== right.participationRole) {
      return left.participationRole === "responsible" ? -1 : 1;
    }
    return right.contributionPercent - left.contributionPercent;
  });
  const responsible = participants[0];
  if (!responsible) {
    throw new Error("A confirmed assignment participant is required.");
  }
  const reviewer =
    participants.find(
      (participant) => participant.userId !== responsible.userId,
    ) ?? responsible;
  const weighted: WeightedStep[] = [];

  weighted.push(
    step(
      "prepare",
      ticket.unknowns.length
        ? "Cerrar incógnitas y límites"
        : "Alinear alcance confirmado",
      sentenceList(
        [...ticket.unknowns, ...ticket.constraints],
        `Acordar el punto de partida para ${ticket.title}.`,
      ),
      responsible,
      ticket.unknowns.length
        ? "Cada incógnita queda respondida o convertida en una decisión explícita."
        : "Alcance, exclusiones y restricciones quedan revisados antes de construir.",
      ticket.unknowns.length ? "unknown" : "ticket",
      sentenceList(ticket.unknowns, ticket.scope[0] ?? ticket.title),
      12,
      ticket.dependencies,
      ticket.risks,
    ),
  );

  if (ticket.dependencies.length) {
    weighted.push(
      step(
        "prepare",
        "Asegurar dependencias",
        sentenceList(
          ticket.dependencies,
          "Dependencias disponibles para iniciar.",
        ),
        responsible,
        "Cada dependencia tiene disponibilidad, responsable o alternativa registrada.",
        "dependency",
        ticket.dependencies.join("; "),
        10,
        ticket.dependencies,
        ticket.risks,
      ),
    );
  }

  const buildSources = (
    ticket.subtasks.length
      ? ticket.subtasks.map((title) => ({
          title,
          kind: "subtask" as const,
        }))
      : ticket.functionalRequirements.length
        ? ticket.functionalRequirements.map((title) => ({
            title,
            kind: "requirement" as const,
          }))
        : [
            {
              title: `Implementar ${ticket.expectedOutcome || ticket.title}`,
              kind: "ticket" as const,
            },
          ]
  ).slice(0, 8);

  buildSources.forEach((source, index) => {
    const candidate = selectByContribution(
      participants,
      index,
      buildSources.length,
    );
    weighted.push(
      step(
        "build",
        source.title,
        `Resultado implementado y revisable: ${source.title}.`,
        candidate,
        (ticket.acceptanceCriteria.length
          ? ticket.acceptanceCriteria[index % ticket.acceptanceCriteria.length]
          : undefined) ??
          "El cambio puede demostrarse con un caso principal y uno de error.",
        source.kind,
        source.title,
        18,
        index === 0 ? ticket.dependencies : [],
        ticket.risks.slice(0, 3),
      ),
    );
  });

  if (
    ticket.technicalRequirements.length ||
    ticket.dependencies.length ||
    ticket.risks.length
  ) {
    weighted.push(
      step(
        "integrate",
        "Integrar el recorrido y sus fronteras",
        sentenceList(
          ticket.technicalRequirements,
          "Los cambios funcionan juntos sin romper el recorrido principal.",
        ),
        responsible,
        "La integración comprueba contratos, errores, dependencias y recuperación.",
        "requirement",
        sentenceList(
          ticket.technicalRequirements,
          "Integración del recorrido",
        ),
        14,
        ticket.dependencies,
        ticket.risks,
      ),
    );
  }

  weighted.push(
    step(
      "verify",
      "Comprobar criterios de aceptación",
      ticket.expectedOutcome ||
        "El resultado esperado queda demostrado de extremo a extremo.",
      reviewer,
      sentenceList(
        ticket.acceptanceCriteria,
        "El resultado esperado se comprueba con evidencia reproducible.",
      ),
      "criterion",
      sentenceList(
        ticket.acceptanceCriteria,
        ticket.expectedOutcome || ticket.title,
      ),
      18,
      [],
      ticket.risks,
    ),
  );

  weighted.push(
    step(
      "handoff",
      "Preparar entrega y trazabilidad",
      ticket.expectedOutcome ||
        "El equipo recibe un resultado utilizable y una decisión rastreable.",
      responsible,
      "La entrega identifica qué cambió, cómo verificarlo, riesgos restantes y siguiente responsable.",
      "outcome",
      ticket.expectedOutcome || ticket.objective || ticket.title,
      10,
      [],
      ticket.risks.slice(0, 3),
    ),
  );

  return {
    ticketId,
    estimateId: estimate.id,
    assignmentPlanId: assignment.id,
    objective:
      ticket.objective ||
      ticket.expectedOutcome ||
      `Completar ${ticket.title} con un resultado verificable.`,
    sequenceRationale:
      "La secuencia resuelve primero límites y dependencias, construye el alcance confirmado, integra sus fronteras y termina con verificación y entrega. Cada paso conserva su fuente.",
    verificationStrategy: ticket.acceptanceCriteria.length
      ? `La guía convierte ${ticket.acceptanceCriteria.length} criterio(s) de aceptación en comprobaciones explícitas y agrega un cierre reproducible.`
      : "La guía exige una comprobación reproducible por paso y declara que todavía faltan criterios formales.",
    estimateRange: {
      low: estimate.low,
      high: estimate.high,
      unit: estimate.unit,
    },
    steps: normalizeEffort(weighted),
    assumptions: ticket.assumptions,
    evidenceLimitations: [
      ...assignment.evidenceLimitations,
      ...(ticket.acceptanceCriteria.length
        ? []
        : ["El ticket todavía no contiene criterios de aceptación formales."]),
      "La guía ordena trabajo confirmado; no observa actividad ni inicia ejecución automáticamente.",
    ],
    engineKind: "local_rules",
    engineVersion: "tr-guide-1",
  };
}
