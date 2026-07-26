export const captureModes = [
  "plan",
  "command",
  "standup",
  "meeting",
  "note",
] as const;

export type CaptureMode = (typeof captureModes)[number];
export type CaptureSource =
  | "manual"
  | "dictation"
  | "meeting_transcript"
  | "import";
export type CaptureStatus = "draft" | "ready" | "archived";

export type CaptureSession = {
  id: string;
  workspaceId: string;
  createdBy: string;
  mode: CaptureMode;
  source: CaptureSource;
  inputText: string;
  status: CaptureStatus;
  createdAt: string;
  updatedAt: string;
};

export const captureModeDetails: Record<
  CaptureMode,
  { label: string; shortLabel: string; description: string }
> = {
  plan: {
    label: "Push to plan",
    shortLabel: "Solicitud",
    description: "Explica libremente una necesidad o resultado esperado.",
  },
  command: {
    label: "Command",
    shortLabel: "Comando",
    description: "Registra una instrucción breve y accionable.",
  },
  standup: {
    label: "Stand-up",
    shortLabel: "Stand-up",
    description: "Resume avances, bloqueos y la siguiente acción.",
  },
  meeting: {
    label: "Meeting mode",
    shortLabel: "Reunión",
    description: "Pega una minuta autorizada o dicta con consentimiento.",
  },
  note: {
    label: "Nota pegada",
    shortLabel: "Nota",
    description: "Conserva contexto previo antes de organizarlo.",
  },
};

export function getCaptureTitle(input: string) {
  const firstLine = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Captura sin título";
  }

  return firstLine.length > 72
    ? `${firstLine.slice(0, 69).trimEnd()}…`
    : firstLine;
}
