import type { CaptureMode } from "@/domain/capture/capture";
import type { TicketDraft, TicketPriority } from "@/domain/tickets/ticket";

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sentences(input: string) {
  return unique(
    input
      .replace(/\r/g, "")
      .split(/(?:\n+|(?<=[.!?])\s+)/)
      .map((value) => value.replace(/^[-*]\s*/, "").trim()),
  );
}

function titleFrom(input: string) {
  const cleaned = input
    .replace(/^(crea|crear|necesito|necesitamos|queremos|agrega|agregar)\s+/i, "")
    .split(/[.!?\n]/)[0]
    .trim();
  const title = cleaned || "Nueva solicitud técnica";
  return title.length > 90 ? `${title.slice(0, 87).trimEnd()}…` : title;
}

function includesAny(input: string, terms: string[]) {
  return terms.some((term) => input.includes(term));
}

export function organizeCaptureLocally(
  inputText: string,
  mode: CaptureMode,
): TicketDraft {
  const input = inputText.trim();
  const normalized = input.toLocaleLowerCase("es-MX");
  const parts = sentences(input);
  const hasDeadline = includesAny(normalized, [
    "antes de",
    "viernes",
    "lunes",
    "urgente",
    "hoy",
    "mañana",
    "fecha",
  ]);
  const authRelated = includesAny(normalized, [
    "login",
    "inicio de sesión",
    "autentic",
    "oauth",
    "google",
  ]);
  const apiRelated = includesAny(normalized, ["api", "endpoint", "backend"]);
  const uiRelated = includesAny(normalized, [
    "pantalla",
    "interfaz",
    "frontend",
    "botón",
    "formulario",
  ]);
  const priority: TicketPriority = includesAny(normalized, [
    "urgente",
    "hoy",
    "bloquea",
    "crítico",
  ])
    ? "urgent"
    : hasDeadline
      ? "high"
      : "medium";
  const unknowns = unique([
    ...(authRelated
      ? ["¿Qué debe ocurrir con los usuarios existentes durante el cambio?"]
      : []),
    ...(!includesAny(normalized, ["usuario", "cliente", "equipo", "admin"])
      ? ["¿Quién utilizará este resultado y cuál es su recorrido principal?"]
      : []),
    ...(!hasDeadline && mode !== "command"
      ? ["¿Existe una fecha objetivo o una condición que cambie la prioridad?"]
      : []),
  ]).slice(0, 2);
  const labels = unique([
    mode === "standup" ? "stand-up" : "captura",
    ...(authRelated ? ["autenticación"] : []),
    ...(apiRelated ? ["backend"] : []),
    ...(uiRelated ? ["frontend"] : []),
  ]);

  return {
    title: titleFrom(input),
    objective: `Convertir la solicitud en un resultado verificable: ${parts[0] ?? input}`,
    problem:
      parts[1] ??
      "La entrada identifica una necesidad, pero todavía requiere confirmar su impacto y límites.",
    context: input,
    expectedOutcome:
      "Una implementación revisable que cumpla los criterios acordados sin modificar silenciosamente el alcance.",
    scope: parts.slice(0, 4),
    outOfScope: ["Trabajo no mencionado explícitamente en la entrada original."],
    functionalRequirements: [
      `El resultado debe responder a: ${parts[0] ?? input}`,
      "La persona responsable debe poder verificar el comportamiento esperado.",
    ],
    technicalRequirements: unique([
      ...(authRelated ? ["Conservar una ruta segura de autenticación y sesión."] : []),
      ...(apiRelated ? ["Validar el contrato de API y sus respuestas de error."] : []),
      ...(uiRelated ? ["Mantener accesibilidad y respuesta en distintos tamaños."] : []),
    ]),
    constraints: hasDeadline
      ? ["La entrada menciona una restricción temporal que debe confirmarse."]
      : [],
    acceptanceCriteria: [
      `La solicitud “${titleFrom(input)}” puede completarse de principio a fin.`,
      "Los errores esperables muestran una respuesta clara y recuperable.",
      "La implementación conserva el comportamiento existente fuera del alcance.",
    ],
    risks: unique([
      ...(unknowns.length ? ["El alcance puede cambiar al resolver las incógnitas abiertas."] : []),
      ...(authRelated ? ["La transición de usuarios existentes puede afectar acceso o datos."] : []),
    ]),
    assumptions: [
      "La entrada original es la fuente de verdad hasta que el usuario confirme cambios.",
    ],
    unknowns,
    dependencies: apiRelated
      ? ["Disponibilidad y contrato vigente de la API relacionada."]
      : [],
    labels,
    priority,
    targetDate: "",
    subtasks: [
      "Confirmar alcance, restricciones e incógnitas prioritarias.",
      "Implementar el recorrido principal y sus estados de error.",
      "Verificar criterios de aceptación y documentar el resultado.",
    ],
    status: unknowns.length ? "needs_context" : "draft",
  };
}
