import type {
  AssignmentCandidate,
  AssignmentLoad,
  AssignmentParticipant,
  AssignmentScenario,
  AssignmentStrategy,
} from "@/domain/assignment/assignment";
import {
  assignmentLoadLabels,
  assignmentStrategyLabels,
} from "@/domain/assignment/assignment";
import type {
  EstimateConfidence,
  EstimationUnit,
} from "@/domain/planning/estimate";

type EstimateInput = {
  id: string;
  unit: EstimationUnit;
  confidence: EstimateConfidence;
  favorable: { low: number; high: number };
  probable: { low: number; high: number };
  adverse: { low: number; high: number };
};

type GenerateAssignmentScenariosInput = {
  estimate: EstimateInput;
  candidates: AssignmentCandidate[];
  weeklyCapacityHours: number;
  dependencies: string[];
  workSignals?: string[];
};

const roleOrder = {
  owner: 0,
  admin: 1,
  planner: 2,
  member: 3,
  viewer: 4,
} as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesWorkSignal(declaration: string, workSignals: string[]) {
  const declared = normalize(declaration);
  if (!declared) return false;
  const declaredTokens = new Set(
    declared.split(" ").filter((token) => token.length >= 3),
  );

  return workSignals.some((signal) => {
    const normalizedSignal = normalize(signal);
    if (!normalizedSignal) return false;
    if (
      normalizedSignal.includes(declared) ||
      declared.includes(normalizedSignal)
    ) {
      return true;
    }
    return normalizedSignal
      .split(" ")
      .some((token) => token.length >= 3 && declaredTokens.has(token));
  });
}

function declaredMatches(
  candidate: AssignmentCandidate,
  workSignals: string[],
) {
  const profile = candidate.planningProfile;
  if (!profile) {
    return { skills: [], components: [], ownership: [], learning: [], score: 0 };
  }

  const skills = profile.skills.filter((item) =>
    matchesWorkSignal(item, workSignals),
  );
  const components = profile.componentExperience.filter((item) =>
    matchesWorkSignal(item, workSignals),
  );
  const ownership = profile.technicalOwnership.filter((item) =>
    matchesWorkSignal(item, workSignals),
  );
  const learning = profile.learningGoals.filter((item) =>
    matchesWorkSignal(item, workSignals),
  );

  return {
    skills,
    components,
    ownership,
    learning,
    score: skills.length + components.length * 2 + ownership.length * 3,
  };
}

function visibleLoad(candidate: AssignmentCandidate) {
  const availability = candidate.planningProfile?.availabilityHours;
  if (availability) {
    return candidate.planningProfile!.plannedHours / availability;
  }
  return candidate.activeAssignmentCount * 0.2;
}

function byContinuity(
  left: AssignmentCandidate,
  right: AssignmentCandidate,
  workSignals: string[],
) {
  if (left.priorParticipation !== right.priorParticipation) {
    return left.priorParticipation ? -1 : 1;
  }

  const leftMatch = declaredMatches(left, workSignals).score;
  const rightMatch = declaredMatches(right, workSignals).score;
  if (leftMatch !== rightMatch) return rightMatch - leftMatch;

  const loadDifference = visibleLoad(left) - visibleLoad(right);
  if (loadDifference !== 0) return loadDifference;

  if (roleOrder[left.role] !== roleOrder[right.role]) {
    return roleOrder[left.role] - roleOrder[right.role];
  }

  return left.displayName.localeCompare(right.displayName, "es-MX");
}

function byLoad(
  left: AssignmentCandidate,
  right: AssignmentCandidate,
  workSignals: string[],
) {
  const leftHasAvailability = Boolean(
    left.planningProfile?.availabilityHours,
  );
  const rightHasAvailability = Boolean(
    right.planningProfile?.availabilityHours,
  );
  if (leftHasAvailability !== rightHasAvailability) {
    return leftHasAvailability ? -1 : 1;
  }

  const loadDifference = visibleLoad(left) - visibleLoad(right);
  if (loadDifference !== 0) return loadDifference;

  const leftMatch = declaredMatches(left, workSignals).score;
  const rightMatch = declaredMatches(right, workSignals).score;
  if (leftMatch !== rightMatch) return rightMatch - leftMatch;

  return byContinuity(left, right, workSignals);
}

function lowerConfidence(confidence: EstimateConfidence): EstimateConfidence {
  if (confidence === "high") return "medium";
  return "low";
}

function estimateHours(value: number, unit: EstimationUnit): number | null {
  if (unit === "hours") return value;
  if (unit === "days") return value * 8;
  return null;
}

export function calculateAssignmentLoad(
  rangeHigh: number,
  unit: EstimationUnit,
  weeklyCapacityHours: number,
  responsibleShare: number,
  activeAssignmentCount: number,
  declaredAvailabilityHours?: number | null,
  plannedHours = 0,
): AssignmentLoad {
  const estimated = estimateHours(rangeHigh, unit);
  if (estimated === null) {
    return {
      level: activeAssignmentCount > 1 ? "high" : "medium",
      percentage: null,
      label:
        activeAssignmentCount > 1
          ? "Carga previa visible"
          : "Sin conversión a horas",
      basis:
        "Los puntos no se convierten en horas sin una regla declarada por el workspace.",
    };
  }

  const hasDeclaredAvailability = Boolean(declaredAvailabilityHours);
  const capacity = declaredAvailabilityHours ?? weeklyCapacityHours;
  const percentage = Math.round(
    ((plannedHours + estimated * (responsibleShare / 100)) / capacity) * 100 +
      (hasDeclaredAvailability ? 0 : activeAssignmentCount * 20),
  );
  const level =
    percentage > 100
      ? "overloaded"
      : percentage > 75
        ? "high"
        : percentage > 40
          ? "medium"
          : "low";

  return {
    level,
    percentage,
    label: `${assignmentLoadLabels[level]} · ${percentage}%`,
    basis: hasDeclaredAvailability
      ? `Combina ${plannedHours}h ya planeadas con la participación propuesta sobre ${capacity}h declaradas.`
      : `Usa el fallback de ${weeklyCapacityHours}h del workspace e incluye 20% por cada asignación vigente visible.`,
  };
}

function reasonForCandidate(
  candidate: AssignmentCandidate,
  strategy: AssignmentStrategy,
  workSignals: string[],
) {
  const matches = declaredMatches(candidate, workSignals);
  const declared = [
    ...matches.ownership,
    ...matches.components,
    ...matches.skills,
  ].slice(0, 3);

  if (strategy === "balanced_load") {
    const availability = candidate.planningProfile?.availabilityHours;
    return availability
      ? `Menor carga declarada: ${candidate.planningProfile?.plannedHours ?? 0}h de ${availability}h antes de esta propuesta.`
      : "Menor carga confirmada visible; disponibilidad individual aún no declarada.";
  }
  if (candidate.priorParticipation) {
    return "Conserva continuidad con la creación del ticket.";
  }
  if (declared.length) {
    return `Coincidencia declarada con el trabajo: ${declared.join(", ")}.`;
  }
  return "Orden determinista por carga visible y rol autorizado.";
}

function participants(
  responsible: AssignmentCandidate,
  collaborator: AssignmentCandidate | undefined,
  shares: [number, number],
  strategy: AssignmentStrategy,
  workSignals: string[],
): AssignmentParticipant[] {
  const result: AssignmentParticipant[] = [
    {
      userId: responsible.userId,
      displayName: responsible.displayName,
      participationRole: "responsible",
      contributionPercent: collaborator ? shares[0] : 100,
      reason: reasonForCandidate(responsible, strategy, workSignals),
    },
  ];

  if (collaborator) {
    const learning = declaredMatches(collaborator, workSignals).learning;
    result.push({
      userId: collaborator.userId,
      displayName: collaborator.displayName,
      participationRole: "collaborator",
      contributionPercent: shares[1],
      reason:
        strategy === "knowledge_transfer" && learning.length
          ? `Objetivo de aprendizaje declarado relacionado: ${learning.slice(0, 2).join(", ")}.`
          : strategy === "knowledge_transfer"
            ? "Comparte contexto para reducir concentración de conocimiento."
            : "Distribuye revisión y continuidad sin crear una segunda responsabilidad.",
    });
  }

  return result;
}

function commonEvidence(
  candidates: AssignmentCandidate[],
  weeklyCapacityHours: number,
  workSignals: string[],
) {
  const withAvailability = candidates.filter(
    (candidate) => candidate.planningProfile?.availabilityHours,
  );
  const withKnowledge = candidates.filter((candidate) => {
    const profile = candidate.planningProfile;
    return Boolean(
      profile &&
        (profile.skills.length ||
          profile.componentExperience.length ||
          profile.technicalOwnership.length ||
          profile.learningGoals.length),
    );
  });
  const matchCount = candidates.filter(
    (candidate) => declaredMatches(candidate, workSignals).score > 0,
  ).length;

  return [
    {
      signal: "Membresía y rol",
      status: "used" as const,
      detail: `${candidates.length} integrante(s) con rol operativo son elegibles.`,
    },
    {
      signal: "Capacidad declarada",
      status: withAvailability.length ? ("used" as const) : ("missing" as const),
      detail: withAvailability.length
        ? `${withAvailability.length} integrante(s) declararon disponibilidad y horas ya planeadas.`
        : `Se usa el fallback explícito de ${weeklyCapacityHours}h del workspace.`,
    },
    {
      signal: "Asignaciones vigentes",
      status: "used" as const,
      detail:
        "Solo se cuenta participación en planes confirmados dentro del workspace.",
    },
    {
      signal: "Habilidades y ownership",
      status: withKnowledge.length ? ("used" as const) : ("missing" as const),
      detail: withKnowledge.length
        ? `${withKnowledge.length} perfil(es) contienen señales declaradas; ${matchCount} coincide(n) con el ticket.`
        : "Aún no existen habilidades, componentes, ownership ni metas declaradas.",
    },
    {
      signal: "Actividad individual",
      status: "excluded" as const,
      detail:
        "No se usan conexión, presencia, velocidad de escritura ni puntuaciones secretas.",
    },
  ];
}

export function generateAssignmentScenarios({
  estimate,
  candidates,
  weeklyCapacityHours,
  dependencies,
  workSignals = [],
}: GenerateAssignmentScenariosInput): AssignmentScenario[] {
  const assignable = candidates.filter((candidate) => candidate.role !== "viewer");
  if (!assignable.length) return [];

  const continuity = [...assignable].sort((left, right) =>
    byContinuity(left, right, workSignals),
  );
  const balanced = [...assignable].sort((left, right) =>
    byLoad(left, right, workSignals),
  );
  const transferCandidates = [...assignable]
    .filter((candidate) => candidate.userId !== continuity[0].userId)
    .sort((left, right) => {
      const learningDifference =
        declaredMatches(right, workSignals).learning.length -
        declaredMatches(left, workSignals).learning.length;
      return (
        learningDifference || byLoad(left, right, workSignals)
      );
    });
  const dependencyRisk = dependencies.length
    ? `${dependencies.length} dependencia(s) pueden alterar disponibilidad o secuencia.`
    : "No hay dependencias declaradas para este ticket.";
  const evidence = commonEvidence(
    assignable,
    weeklyCapacityHours,
    workSignals,
  );
  const limitations = [
    ...(assignable.some(
      (candidate) => !candidate.planningProfile?.availabilityHours,
    )
      ? ["Algunas personas aún usan la capacidad fallback del workspace."]
      : []),
    ...(assignable.some((candidate) => !candidate.planningProfile)
      ? ["Algunos perfiles todavía no declaran habilidades ni ownership."]
      : []),
    "La carga refleja declaraciones y planes confirmados, no actividad observada.",
  ];

  const definitions: Array<{
    strategy: AssignmentStrategy;
    responsible: AssignmentCandidate;
    collaborator?: AssignmentCandidate;
    shares: [number, number];
    range: { low: number; high: number };
    confidence: EstimateConfidence;
    summary: string;
    rationale: string;
    risks: string[];
    discardedAlternatives: string[];
    changeConsequence: string;
    concentration: "low" | "medium" | "high";
  }> = [
    {
      strategy: "fast_delivery",
      responsible: continuity[0],
      collaborator: continuity[1],
      shares: [80, 20],
      range: estimate.favorable,
      confidence: estimate.confidence,
      summary: "Prioriza continuidad y contexto declarado.",
      rationale:
        "Ordena primero por participación previa, después por ownership, componentes o habilidades coincidentes y finalmente por carga visible.",
      risks: [
        "La velocidad puede concentrar contexto en una sola persona.",
        dependencyRisk,
      ],
      discardedAlternatives: [
        "La distribución equitativa se descarta porque agrega coordinación al inicio.",
        "La transferencia se descarta porque amplía deliberadamente el recorrido.",
      ],
      changeConsequence:
        "Cambiar la responsabilidad puede reducir continuidad y mover el rango hacia el escenario probable.",
      concentration: continuity[1] ? "medium" : "high",
    },
    {
      strategy: "balanced_load",
      responsible: balanced[0],
      collaborator: balanced[1],
      shares: [60, 40],
      range: estimate.probable,
      confidence: estimate.confidence,
      summary: "Distribuye el trabajo según capacidad declarada.",
      rationale:
        "Prioriza el menor cociente entre horas ya planeadas y disponibilidad declarada. Solo usa asignaciones vigentes como fallback visible.",
      risks: [
        assignable.every(
          (candidate) => candidate.planningProfile?.availabilityHours,
        )
          ? "La disponibilidad declarada puede cambiar y debe revisarse antes de confirmar."
          : "Parte del equipo aún no declara disponibilidad individual.",
        dependencyRisk,
      ],
      discardedAlternatives: [
        "La entrega rápida se descarta por su mayor concentración de contexto.",
        "La transferencia se descarta porque el objetivo principal aquí es capacidad.",
      ],
      changeConsequence:
        "Concentrar la contribución en una persona aumenta su carga resultante y reduce redundancia.",
      concentration: balanced[1] ? "medium" : "high",
    },
    {
      strategy: "knowledge_transfer",
      responsible: continuity[0],
      collaborator: transferCandidates[0] ?? continuity[1],
      shares: [55, 45],
      range: {
        low: estimate.probable.low,
        high: estimate.adverse.high,
      },
      confidence: lowerConfidence(estimate.confidence),
      summary: "Conecta contexto con un objetivo de aprendizaje.",
      rationale:
        "Mantiene una fuente de continuidad y prioriza como colaborador a quien declaró un objetivo relacionado con el ticket.",
      risks: [
        "La curva de aprendizaje puede ampliar el rango.",
        dependencyRisk,
      ],
      discardedAlternatives: [
        "La entrega rápida se descarta por concentrar conocimiento.",
        "La carga equilibrada se descarta porque no garantiza transferencia deliberada.",
      ],
      changeConsequence:
        "Eliminar al colaborador acorta coordinación, pero vuelve a concentrar el conocimiento.",
      concentration: transferCandidates[0] ? "low" : "high",
    },
    {
      strategy: "custom",
      responsible: balanced[0],
      collaborator: balanced[1],
      shares: [60, 40],
      range: estimate.probable,
      confidence: lowerConfidence(estimate.confidence),
      summary: "Punto de partida editable para aplicar criterio humano.",
      rationale:
        "Replica la distribución más conservadora para que el usuario ajuste personas, contribución y rango antes de confirmar.",
      risks: [
        "Los cambios manuales deben conservar una razón explícita.",
        dependencyRisk,
      ],
      discardedAlternatives: [
        "Ninguna alternativa se descarta de forma definitiva hasta confirmar.",
      ],
      changeConsequence:
        "Cada cambio modifica la carga, la concentración y la trazabilidad del plan confirmado.",
      concentration: balanced[1] ? "medium" : "high",
    },
  ];

  return definitions.map((definition) => {
    const selected = participants(
      definition.responsible,
      definition.collaborator,
      definition.shares,
      definition.strategy,
      workSignals,
    );
    const responsibleShare = selected[0].contributionPercent;
    const profile = definition.responsible.planningProfile;
    const resultingLoad = calculateAssignmentLoad(
      definition.range.high,
      estimate.unit,
      weeklyCapacityHours,
      responsibleShare,
      definition.responsible.activeAssignmentCount,
      profile?.availabilityHours,
      profile?.plannedHours ?? 0,
    );

    return {
      strategy: definition.strategy,
      label: assignmentStrategyLabels[definition.strategy],
      summary: definition.summary,
      estimateId: estimate.id,
      range: { ...definition.range, unit: estimate.unit },
      confidence: definition.confidence,
      participants: selected,
      resultingLoad,
      knowledgeConcentration: definition.concentration,
      rationale: definition.rationale,
      risks: definition.risks,
      discardedAlternatives: definition.discardedAlternatives,
      changeConsequence: definition.changeConsequence,
      evidence,
      evidenceLimitations: limitations,
      engineKind: "local_rules",
      engineVersion: "tr-assignment-2",
    };
  });
}
