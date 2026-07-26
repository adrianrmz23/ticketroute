import { z } from "zod";

const cleanList = z.array(z.string().trim().min(1).max(500)).max(30);

export const ticketDraftSchema = z.object({
  title: z.string().trim().min(3).max(160),
  objective: z.string().trim().max(4000),
  problem: z.string().trim().max(4000),
  context: z.string().trim().max(12000),
  expectedOutcome: z.string().trim().max(4000),
  scope: cleanList,
  outOfScope: cleanList,
  functionalRequirements: cleanList,
  technicalRequirements: cleanList,
  constraints: cleanList,
  acceptanceCriteria: cleanList.min(1),
  risks: cleanList,
  assumptions: cleanList,
  unknowns: cleanList.max(2),
  dependencies: cleanList,
  labels: z.array(z.string().trim().min(1).max(40)).max(12),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  targetDate: z.union([z.literal(""), z.iso.date()]),
  subtasks: cleanList,
  status: z.enum([
    "draft",
    "needs_context",
    "ready",
    "planned",
    "in_progress",
    "review",
    "blocked",
    "done",
    "archived",
  ]),
});

export const createTicketFromCaptureSchema = z.object({
  workspaceId: z.uuid(),
  captureId: z.uuid(),
  draft: ticketDraftSchema,
});

export const updateTicketSchema = z.object({
  ticketId: z.uuid(),
  draft: ticketDraftSchema,
  changeSummary: z.string().trim().min(2).max(160),
});
