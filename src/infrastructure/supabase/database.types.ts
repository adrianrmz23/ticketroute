export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "planner"
  | "member"
  | "viewer";

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";
export type CaptureMode =
  | "plan"
  | "command"
  | "standup"
  | "meeting"
  | "note";
export type CaptureSource =
  | "manual"
  | "dictation"
  | "meeting_transcript"
  | "import";
export type CaptureStatus = "draft" | "ready" | "archived";
export type TicketStatus =
  | "draft"
  | "needs_context"
  | "ready"
  | "planned"
  | "in_progress"
  | "review"
  | "blocked"
  | "done"
  | "archived";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type EstimationUnit = "hours" | "days" | "points";
export type EstimateConfidence = "low" | "medium" | "high";
export type EstimateFactorDirection =
  | "increases"
  | "decreases"
  | "neutral";
export type AssignmentStrategy =
  | "fast_delivery"
  | "balanced_load"
  | "knowledge_transfer"
  | "custom";
export type AssignmentLoadLevel = "low" | "medium" | "high" | "overloaded";
export type KnowledgeConcentration = "low" | "medium" | "high";
export type GuidePhase =
  | "prepare"
  | "build"
  | "integrate"
  | "verify"
  | "handoff";
export type GuideSourceKind =
  | "ticket"
  | "unknown"
  | "dependency"
  | "subtask"
  | "requirement"
  | "criterion"
  | "outcome"
  | "manual";
export type ExecutionRunStatus =
  | "active"
  | "blocked"
  | "completed"
  | "cancelled";
export type ExecutionStepStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "done"
  | "skipped";
export type CalibrationStatus = "draft" | "confirmed";
export type CalibrationScenario =
  | "favorable"
  | "probable"
  | "adverse"
  | "outside";
export type AiProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "kimi"
  | "manual";
export type CouncilOpinionSource =
  | "provider"
  | "local_fallback"
  | "manual";
export type CouncilStatus = "draft" | "completed" | "failed";
export type NotificationKind =
  | "execution_blocked"
  | "assignment"
  | "invitation"
  | "council_completed"
  | "job_completed"
  | "system";
export type DigestFrequency = "never" | "daily" | "weekly";
export type IntegrationProvider =
  | "webhook"
  | "slack"
  | "github"
  | "linear"
  | "jira";
export type IntegrationEventStatus =
  | "queued"
  | "processing"
  | "delivered"
  | "failed";
export type PrivacyRequestType = "export" | "delete" | "correct";
export type PrivacyRequestStatus =
  | "pending"
  | "processing"
  | "completed"
  | "rejected";
export type BackgroundJobType =
  | "privacy_export"
  | "privacy_delete"
  | "integration_delivery"
  | "notification_digest"
  | "retention_cleanup";
export type BackgroundJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          estimation_unit: string;
          weekly_capacity_hours: number;
          default_ai_provider: string;
          data_retention_days: number;
          delete_audio_after_transcription: boolean;
          onboarding_completed_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          estimation_unit?: string;
          weekly_capacity_hours?: number;
          default_ai_provider?: string;
          data_retention_days?: number;
          delete_audio_after_transcription?: boolean;
          onboarding_completed_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          timezone?: string;
          estimation_unit?: string;
          weekly_capacity_hours?: number;
          default_ai_provider?: string;
          data_retention_days?: number;
          delete_audio_after_transcription?: boolean;
          onboarding_completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          joined_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          joined_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: WorkspaceRole;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_invites: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role: WorkspaceRole;
          status: InviteStatus;
          token_hash: string;
          invited_by: string;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          role?: WorkspaceRole;
          status?: InviteStatus;
          token_hash: string;
          invited_by: string;
          expires_at: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: WorkspaceRole;
          status?: InviteStatus;
          expires_at?: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: number;
          workspace_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          workspace_id: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      capture_sessions: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string;
          mode: CaptureMode;
          source: CaptureSource;
          input_text: string;
          status: CaptureStatus;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by: string;
          mode?: CaptureMode;
          source?: CaptureSource;
          input_text?: string;
          status?: CaptureStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          mode?: CaptureMode;
          source?: CaptureSource;
          input_text?: string;
          status?: CaptureStatus;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      consent_records: {
        Row: {
          id: string;
          workspace_id: string;
          capture_session_id: string | null;
          user_id: string;
          consent_type:
            | "microphone"
            | "transcription"
            | "meeting_recording"
            | "audio_retention";
          decision: "granted" | "denied" | "revoked";
          policy_version: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          capture_session_id?: string | null;
          user_id: string;
          consent_type:
            | "microphone"
            | "transcription"
            | "meeting_recording"
            | "audio_retention";
          decision: "granted" | "denied" | "revoked";
          policy_version?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          workspace_id: string;
          source_capture_id: string | null;
          created_by: string;
          title: string;
          objective: string;
          problem: string;
          context: string;
          expected_outcome: string;
          scope: string[];
          out_of_scope: string[];
          functional_requirements: string[];
          technical_requirements: string[];
          constraints: string[];
          risks: string[];
          assumptions: string[];
          unknowns: string[];
          dependencies_notes: string[];
          labels: string[];
          priority: TicketPriority;
          target_date: string | null;
          status: TicketStatus;
          organizer_kind: string;
          organizer_version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ticket_criteria: {
        Row: {
          id: string;
          workspace_id: string;
          ticket_id: string;
          position: number;
          content: string;
          completed: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ticket_subtasks: {
        Row: {
          id: string;
          workspace_id: string;
          ticket_id: string;
          position: number;
          title: string;
          status: "draft" | "ready" | "in_progress" | "done" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ticket_revisions: {
        Row: {
          id: number;
          workspace_id: string;
          ticket_id: string;
          revision_number: number;
          snapshot: Json;
          change_summary: string;
          created_by: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      estimates: {
        Row: {
          id: string;
          workspace_id: string;
          ticket_id: string;
          version: number;
          is_current: boolean;
          unit: EstimationUnit;
          favorable_low: number;
          favorable_high: number;
          probable_low: number;
          probable_high: number;
          adverse_low: number;
          adverse_high: number;
          confidence: EstimateConfidence;
          basis: string;
          assumptions: string[];
          unknowns: string[];
          risks: string[];
          dependencies_notes: string[];
          historical_references: string[];
          calculation_snapshot: Json;
          engine_kind: string;
          engine_version: string;
          created_by: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      estimate_factors: {
        Row: {
          id: string;
          workspace_id: string;
          estimate_id: string;
          position: number;
          factor_key: string;
          label: string;
          direction: EstimateFactorDirection;
          weight: number;
          evidence: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      estimate_breakdown: {
        Row: {
          id: string;
          workspace_id: string;
          estimate_id: string;
          position: number;
          label: string;
          effort_share: number;
          basis: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      member_planning_profiles: {
        Row: {
          workspace_id: string;
          user_id: string;
          availability_hours: number | null;
          planned_hours: number;
          skills: string[];
          component_experience: string[];
          technical_ownership: string[];
          learning_goals: string[];
          updated_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assignment_plans: {
        Row: {
          id: string;
          workspace_id: string;
          ticket_id: string;
          estimate_id: string;
          version: number;
          is_current: boolean;
          strategy: AssignmentStrategy;
          range_low: number;
          range_high: number;
          unit: EstimationUnit;
          confidence: EstimateConfidence;
          resulting_load_percent: number | null;
          resulting_load_level: AssignmentLoadLevel;
          knowledge_concentration: KnowledgeConcentration;
          rationale: string;
          change_consequence: string;
          risks: string[];
          discarded_alternatives: string[];
          evidence_limitations: string[];
          evidence_snapshot: Json;
          engine_kind: string;
          engine_version: string;
          created_by: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assignment_plan_participants: {
        Row: {
          id: string;
          workspace_id: string;
          assignment_plan_id: string;
          user_id: string;
          participation_role: "responsible" | "collaborator";
          contribution_percent: number;
          reason: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      planning_guides: {
        Row: {
          id: string;
          workspace_id: string;
          ticket_id: string;
          estimate_id: string;
          assignment_plan_id: string;
          version: number;
          is_current: boolean;
          objective: string;
          sequence_rationale: string;
          verification_strategy: string;
          assumptions: string[];
          evidence_limitations: string[];
          evidence_snapshot: Json;
          engine_kind: string;
          engine_version: string;
          created_by: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      planning_guide_steps: {
        Row: {
          id: string;
          workspace_id: string;
          planning_guide_id: string;
          position: number;
          phase: GuidePhase;
          title: string;
          outcome: string;
          responsible_user_id: string;
          effort_share: number;
          verification: string;
          dependencies: string[];
          risks: string[];
          source_kind: GuideSourceKind;
          source_label: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      execution_runs: {
        Row: {
          id: string;
          workspace_id: string;
          ticket_id: string;
          planning_guide_id: string;
          status: ExecutionRunStatus;
          started_by: string;
          started_at: string;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      execution_steps: {
        Row: {
          id: string;
          workspace_id: string;
          execution_run_id: string;
          planning_guide_step_id: string;
          position: number;
          phase: GuidePhase;
          title_snapshot: string;
          outcome_snapshot: string;
          responsible_user_id: string;
          effort_share: number;
          verification_snapshot: string;
          source_kind: GuideSourceKind;
          source_label: string;
          dependencies_snapshot: string[];
          risks_snapshot: string[];
          status: ExecutionStepStatus;
          evidence_note: string;
          blocker_note: string;
          updated_by: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      execution_step_events: {
        Row: {
          id: number;
          workspace_id: string;
          execution_run_id: string;
          execution_step_id: string;
          actor_id: string;
          from_status: ExecutionStepStatus | null;
          to_status: ExecutionStepStatus;
          evidence_note: string;
          blocker_note: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      calibration_records: {
        Row: {
          id: string;
          workspace_id: string;
          ticket_id: string;
          execution_run_id: string;
          estimate_id: string;
          assignment_plan_id: string;
          planning_guide_id: string;
          status: CalibrationStatus;
          estimated_low: number;
          estimated_high: number;
          unit: EstimationUnit;
          actual_value: number;
          interruption_count: number;
          scope_changed: boolean;
          unexpected_blockers: string[];
          unexpected_dependencies: string[];
          deviation_cause: string;
          selected_scenario: CalibrationScenario;
          learning_summary: string;
          created_by: string;
          confirmed_by: string | null;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ai_provider_configs: {
        Row: {
          id: string;
          workspace_id: string;
          provider: AiProvider;
          model: string;
          enabled: boolean;
          is_default: boolean;
          secret_configured: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      council_sessions: {
        Row: {
          id: string;
          workspace_id: string;
          requested_by: string;
          title: string;
          prompt: string;
          status: CouncilStatus;
          providers: AiProvider[];
          synthesis: string;
          limitations: string[];
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      council_opinions: {
        Row: {
          id: string;
          workspace_id: string;
          council_session_id: string;
          position: number;
          provider: AiProvider;
          model: string;
          source: CouncilOpinionSource;
          recommendation: string;
          reasoning: string;
          risks: string[];
          confidence: EstimateConfidence;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          workspace_id: string;
          user_id: string;
          in_app: boolean;
          email: boolean;
          blocked_steps: boolean;
          assignments: boolean;
          invitations: boolean;
          council_results: boolean;
          digest_frequency: DigestFrequency;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          kind: NotificationKind;
          title: string;
          body: string;
          href: string;
          metadata: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          kind: NotificationKind;
          title: string;
          body?: string;
          href?: string;
          metadata?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      workspace_integrations: {
        Row: {
          id: string;
          workspace_id: string;
          provider: IntegrationProvider;
          display_name: string;
          endpoint: string;
          enabled: boolean;
          secret_configured: boolean;
          settings: Json;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      integration_events: {
        Row: {
          id: string;
          workspace_id: string;
          integration_id: string;
          event_type: string;
          status: IntegrationEventStatus;
          payload: Json;
          attempt_count: number;
          last_error: string;
          created_at: string;
          processed_at: string | null;
        };
        Insert: never;
        Update: {
          status?: IntegrationEventStatus;
          attempt_count?: number;
          last_error?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      privacy_requests: {
        Row: {
          id: string;
          workspace_id: string;
          requested_by: string;
          request_type: PrivacyRequestType;
          status: PrivacyRequestStatus;
          details: string;
          resolution_note: string;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          status?: PrivacyRequestStatus;
          resolution_note?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      background_jobs: {
        Row: {
          id: string;
          workspace_id: string | null;
          job_type: BackgroundJobType;
          status: BackgroundJobStatus;
          payload: Json;
          result: Json;
          attempt_count: number;
          run_after: string;
          locked_at: string | null;
          completed_at: string | null;
          last_error: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_workspace: {
        Args: {
          p_name: string;
          p_slug: string;
          p_timezone?: string;
          p_estimation_unit?: string;
        };
        Returns: string;
      };
      create_workspace_v2: {
        Args: {
          p_name: string;
          p_slug: string;
          p_timezone?: string;
          p_estimation_unit?: string;
          p_weekly_capacity_hours?: number;
          p_default_ai_provider?: string;
          p_data_retention_days?: number;
          p_delete_audio_after_transcription?: boolean;
        };
        Returns: string;
      };
      get_my_workspaces: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          slug: string;
          role: WorkspaceRole;
          timezone: string;
          estimation_unit: string;
          weekly_capacity_hours: number;
          default_ai_provider: string;
          data_retention_days: number;
          delete_audio_after_transcription: boolean;
          joined_at: string;
        }[];
      };
      get_workspace_members: {
        Args: { p_workspace_id: string };
        Returns: {
          user_id: string;
          display_name: string;
          email: string;
          role: WorkspaceRole;
          joined_at: string;
        }[];
      };
      create_workspace_invite: {
        Args: {
          p_workspace_id: string;
          p_email: string;
          p_role: WorkspaceRole;
          p_token_hash: string;
          p_expires_at: string;
        };
        Returns: string;
      };
      preview_workspace_invite: {
        Args: { p_token_hash: string };
        Returns: {
          invite_id: string;
          workspace_id: string;
          workspace_name: string;
          role: WorkspaceRole;
          expires_at: string;
        }[];
      };
      accept_workspace_invite: {
        Args: { p_token_hash: string };
        Returns: string;
      };
      revoke_workspace_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
      change_workspace_member_role: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
          p_role: WorkspaceRole;
        };
        Returns: undefined;
      };
      remove_workspace_member: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      save_capture_session: {
        Args: {
          p_capture_id: string;
          p_workspace_id: string;
          p_mode: string;
          p_input_text: string;
          p_status?: string;
          p_source?: string;
          p_metadata?: Json;
        };
        Returns: string;
      };
      archive_capture_session: {
        Args: { p_capture_id: string };
        Returns: undefined;
      };
      record_capture_consent: {
        Args: {
          p_workspace_id: string;
          p_capture_session_id: string | null;
          p_consent_type: string;
          p_decision: string;
          p_metadata?: Json;
        };
        Returns: string;
      };
      create_ticket_from_capture: {
        Args: {
          p_workspace_id: string;
          p_capture_id: string;
          p_payload: Json;
        };
        Returns: string;
      };
      update_ticket_draft: {
        Args: {
          p_ticket_id: string;
          p_payload: Json;
          p_change_summary?: string;
        };
        Returns: undefined;
      };
      save_ticket_estimate: {
        Args: {
          p_ticket_id: string;
          p_payload: Json;
        };
        Returns: string;
      };
      confirm_assignment_plan: {
        Args: {
          p_ticket_id: string;
          p_payload: Json;
        };
        Returns: string;
      };
      confirm_planning_guide: {
        Args: {
          p_ticket_id: string;
          p_payload: Json;
        };
        Returns: string;
      };
      start_execution_run: {
        Args: {
          p_ticket_id: string;
          p_planning_guide_id: string;
        };
        Returns: string;
      };
      update_execution_step: {
        Args: {
          p_execution_step_id: string;
          p_status: string;
          p_evidence_note: string;
          p_blocker_note: string;
        };
        Returns: Json;
      };
      save_calibration_record: {
        Args: {
          p_ticket_id: string;
          p_payload: Json;
        };
        Returns: string;
      };
      save_ai_provider_config: {
        Args: {
          p_workspace_id: string;
          p_payload: Json;
        };
        Returns: string;
      };
      save_council_session: {
        Args: {
          p_workspace_id: string;
          p_payload: Json;
        };
        Returns: string;
      };
      save_notification_preferences: {
        Args: {
          p_workspace_id: string;
          p_payload: Json;
        };
        Returns: undefined;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      save_workspace_integration: {
        Args: {
          p_workspace_id: string;
          p_payload: Json;
        };
        Returns: string;
      };
      create_privacy_request: {
        Args: {
          p_workspace_id: string;
          p_request_type: string;
          p_details?: string;
        };
        Returns: string;
      };
      resolve_privacy_request: {
        Args: {
          p_request_id: string;
          p_status: string;
          p_resolution_note: string;
        };
        Returns: undefined;
      };
      claim_background_jobs: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["background_jobs"]["Row"][];
      };
      finish_background_job: {
        Args: {
          p_job_id: string;
          p_status: string;
          p_result?: Json;
          p_error?: string;
        };
        Returns: undefined;
      };
      save_member_planning_profile: {
        Args: {
          p_workspace_id: string;
          p_user_id: string;
          p_payload: Json;
        };
        Returns: undefined;
      };
      healthcheck: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      has_workspace_role: {
        Args: {
          p_workspace_id: string;
          p_roles: WorkspaceRole[];
        };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { p_workspace_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      invite_status: InviteStatus;
      workspace_role: WorkspaceRole;
    };
    CompositeTypes: Record<never, never>;
  };
};
