// Gerado por: mcp supabase generate_typescript_types / `npm run db:types`.
// NÃO editar à mão.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_measures: {
        Row: {
          action_plan_id: string
          category_id: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          description: string
          due_on: string | null
          effectiveness: Database["public"]["Enums"]["effectiveness_result"]
          effectiveness_criteria: string | null
          id: string
          kind: Database["public"]["Enums"]["measure_kind"]
          org_id: string
          org_unit_id: string | null
          owner_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["measure_status"]
          updated_at: string
          verification_evidence_id: string | null
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
          verify_on: string | null
        }
        Insert: {
          action_plan_id: string
          category_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description: string
          due_on?: string | null
          effectiveness?: Database["public"]["Enums"]["effectiveness_result"]
          effectiveness_criteria?: string | null
          id?: string
          kind: Database["public"]["Enums"]["measure_kind"]
          org_id: string
          org_unit_id?: string | null
          owner_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["measure_status"]
          updated_at?: string
          verification_evidence_id?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verify_on?: string | null
        }
        Update: {
          action_plan_id?: string
          category_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string
          due_on?: string | null
          effectiveness?: Database["public"]["Enums"]["effectiveness_result"]
          effectiveness_criteria?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["measure_kind"]
          org_id?: string
          org_unit_id?: string | null
          owner_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["measure_status"]
          updated_at?: string
          verification_evidence_id?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verify_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_measures_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_category_distribution"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "action_measures_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_psychosocial_inventory"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "action_measures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_verification_evidence_id_fkey"
            columns: ["verification_evidence_id"]
            isOneToOne: false
            referencedRelation: "report_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          closed_at: string | null
          code: string
          created_at: string
          created_by: string | null
          due_on: string | null
          id: string
          investigation_id: string | null
          org_id: string
          owner_id: string | null
          rationale: string | null
          report_id: string | null
          risk_source: string | null
          starts_on: string | null
          status: Database["public"]["Enums"]["measure_status"]
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          investigation_id?: string | null
          org_id: string
          owner_id?: string | null
          rationale?: string | null
          report_id?: string | null
          risk_source?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["measure_status"]
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          investigation_id?: string | null
          org_id?: string
          owner_id?: string | null
          rationale?: string | null
          report_id?: string | null
          risk_source?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["measure_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          ip_hash: string | null
          org_id: string
          prev_hash: string | null
          report_id: string | null
          row_hash: string
          seq: number
          user_agent_hash: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_hash?: string | null
          org_id: string
          prev_hash?: string | null
          report_id?: string | null
          row_hash: string
          seq?: never
          user_agent_hash?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_hash?: string | null
          org_id?: string
          prev_hash?: string | null
          report_id?: string | null
          row_hash?: string
          seq?: never
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string
          created_at: string
          default_risk: Database["public"]["Enums"]["risk_level"]
          description_pt: string | null
          group_key: Database["public"]["Enums"]["category_group"]
          id: string
          is_active: boolean
          label_pt: string
          nr_reference: string | null
          org_id: string | null
          requires_specification: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_risk?: Database["public"]["Enums"]["risk_level"]
          description_pt?: string | null
          group_key: Database["public"]["Enums"]["category_group"]
          id?: string
          is_active?: boolean
          label_pt: string
          nr_reference?: string | null
          org_id?: string | null
          requires_specification?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_risk?: Database["public"]["Enums"]["risk_level"]
          description_pt?: string | null
          group_key?: Database["public"]["Enums"]["category_group"]
          id?: string
          is_active?: boolean
          label_pt?: string
          nr_reference?: string | null
          org_id?: string | null
          requires_specification?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_access_log: {
        Row: {
          access_kind: string
          created_at: string
          entity_id: string
          entity_type: string
          fields: string[]
          id: string
          ip_hash: string | null
          org_id: string
          user_id: string | null
        }
        Insert: {
          access_kind: string
          created_at?: string
          entity_id: string
          entity_type: string
          fields?: string[]
          id?: string
          ip_hash?: string | null
          org_id: string
          user_id?: string | null
        }
        Update: {
          access_kind?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          fields?: string[]
          id?: string
          ip_hash?: string | null
          org_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_access_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_custody_events: {
        Row: {
          action: Database["public"]["Enums"]["custody_action"]
          actor_id: string | null
          actor_label: string
          created_at: string
          evidence_id: string
          hash_at_event: string | null
          id: string
          notes: string | null
          org_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["custody_action"]
          actor_id?: string | null
          actor_label: string
          created_at?: string
          evidence_id: string
          hash_at_event?: string | null
          id?: string
          notes?: string | null
          org_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["custody_action"]
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          evidence_id?: string
          hash_at_event?: string | null
          id?: string
          notes?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_custody_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_custody_events_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "report_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_custody_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_upload_tickets: {
        Row: {
          consumed_by_report: string | null
          created_at: string
          expires_at: string
          filename: string
          id: string
          ip_hash: string | null
          mime_type: string
          org_id: string
          sha256_client: string | null
          size_bytes: number
          storage_path: string
        }
        Insert: {
          consumed_by_report?: string | null
          created_at?: string
          expires_at?: string
          filename: string
          id?: string
          ip_hash?: string | null
          mime_type: string
          org_id: string
          sha256_client?: string | null
          size_bytes: number
          storage_path: string
        }
        Update: {
          consumed_by_report?: string | null
          created_at?: string
          expires_at?: string
          filename?: string
          id?: string
          ip_hash?: string | null
          mime_type?: string
          org_id?: string
          sha256_client?: string | null
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_upload_tickets_consumed_by_report_fkey"
            columns: ["consumed_by_report"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_upload_tickets_consumed_by_report_fkey"
            columns: ["consumed_by_report"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "evidence_upload_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_access_grants: {
        Row: {
          expires_at: string
          granted_at: string
          granted_by: string | null
          id: string
          justification: string
          org_id: string
          report_id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          expires_at: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          justification: string
          org_id: string
          report_id: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          justification?: string
          org_id?: string
          report_id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_access_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_access_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_access_grants_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_access_grants_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "identity_access_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_findings: {
        Row: {
          confidence: string
          created_at: string
          created_by: string | null
          evidence_ids: string[]
          id: string
          investigation_id: string
          org_id: string
          sort_order: number
          statement: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          evidence_ids?: string[]
          id?: string
          investigation_id: string
          org_id: string
          sort_order?: number
          statement: string
        }
        Update: {
          confidence?: string
          created_at?: string
          created_by?: string | null
          evidence_ids?: string[]
          id?: string
          investigation_id?: string
          org_id?: string
          sort_order?: number
          statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_findings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_findings_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_findings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_interviews: {
        Row: {
          accompanied_by: string | null
          conducted_by: string | null
          consent_recorded: boolean
          created_at: string
          held_at: string | null
          id: string
          interviewee_label: string
          interviewee_user_id: string | null
          investigation_id: string
          kind: Database["public"]["Enums"]["interview_kind"]
          location: string | null
          non_retaliation_notice_given: boolean
          org_id: string
          scheduled_at: string | null
          script: string | null
          summary: string | null
          transcript_evidence_id: string | null
          updated_at: string
        }
        Insert: {
          accompanied_by?: string | null
          conducted_by?: string | null
          consent_recorded?: boolean
          created_at?: string
          held_at?: string | null
          id?: string
          interviewee_label: string
          interviewee_user_id?: string | null
          investigation_id: string
          kind: Database["public"]["Enums"]["interview_kind"]
          location?: string | null
          non_retaliation_notice_given?: boolean
          org_id: string
          scheduled_at?: string | null
          script?: string | null
          summary?: string | null
          transcript_evidence_id?: string | null
          updated_at?: string
        }
        Update: {
          accompanied_by?: string | null
          conducted_by?: string | null
          consent_recorded?: boolean
          created_at?: string
          held_at?: string | null
          id?: string
          interviewee_label?: string
          interviewee_user_id?: string | null
          investigation_id?: string
          kind?: Database["public"]["Enums"]["interview_kind"]
          location?: string | null
          non_retaliation_notice_given?: boolean
          org_id?: string
          scheduled_at?: string | null
          script?: string | null
          summary?: string | null
          transcript_evidence_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_interviews_conducted_by_fkey"
            columns: ["conducted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_interviews_interviewee_user_id_fkey"
            columns: ["interviewee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_interviews_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_interviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_interviews_transcript_evidence_id_fkey"
            columns: ["transcript_evidence_id"]
            isOneToOne: false
            referencedRelation: "report_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_members: {
        Row: {
          added_by: string | null
          conflict_declared_at: string | null
          conflict_statement: string | null
          created_at: string
          investigation_id: string
          role_in_case: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          conflict_declared_at?: string | null
          conflict_statement?: string | null
          created_at?: string
          investigation_id: string
          role_in_case: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          conflict_declared_at?: string | null
          conflict_statement?: string | null
          created_at?: string
          investigation_id?: string
          role_in_case?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_members_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_reports: {
        Row: {
          created_at: string
          investigation_id: string
          is_primary: boolean
          report_id: string
        }
        Insert: {
          created_at?: string
          investigation_id: string
          is_primary?: boolean
          report_id: string
        }
        Update: {
          created_at?: string
          investigation_id?: string
          is_primary?: boolean
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_reports_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
        ]
      }
      investigation_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          investigation_id: string
          org_id: string
          owner_id: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          investigation_id: string
          org_id: string
          owner_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          investigation_id?: string
          org_id?: string
          owner_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_steps_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_steps_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_steps_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations: {
        Row: {
          code: string
          concluded_at: string | null
          created_at: string
          created_by: string | null
          findings: string | null
          hypotheses: string | null
          id: string
          lead_id: string | null
          methodology: string | null
          org_id: string
          outcome: Database["public"]["Enums"]["investigation_outcome"] | null
          planned_end: string | null
          planned_start: string | null
          protective_measures: string | null
          recommendation: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["investigation_status"]
          updated_at: string
        }
        Insert: {
          code: string
          concluded_at?: string | null
          created_at?: string
          created_by?: string | null
          findings?: string | null
          hypotheses?: string | null
          id?: string
          lead_id?: string | null
          methodology?: string | null
          org_id: string
          outcome?: Database["public"]["Enums"]["investigation_outcome"] | null
          planned_end?: string | null
          planned_start?: string | null
          protective_measures?: string | null
          recommendation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          concluded_at?: string | null
          created_at?: string
          created_by?: string | null
          findings?: string | null
          hypotheses?: string | null
          id?: string
          lead_id?: string | null
          methodology?: string | null
          org_id?: string
          outcome?: Database["public"]["Enums"]["investigation_outcome"] | null
          planned_end?: string | null
          planned_start?: string | null
          protective_measures?: string | null
          recommendation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          org_id: string
          read_at: string | null
          report_id: string | null
          target_roles: Database["public"]["Enums"]["app_role"][]
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          org_id: string
          read_at?: string | null
          report_id?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          org_id?: string
          read_at?: string | null
          report_id?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          unit_scope: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          org_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          unit_scope?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          unit_scope?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_units: {
        Row: {
          city: string | null
          cnpj: string | null
          code: string
          created_at: string
          headcount: number | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          parent_id: string | null
          sort_order: number
          state_uf: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          code: string
          created_at?: string
          headcount?: number | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          parent_id?: string | null
          sort_order?: number
          state_uf?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          code?: string
          created_at?: string
          headcount?: number | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          parent_id?: string | null
          sort_order?: number
          state_uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          is_active: boolean
          legal_name: string
          locale: string
          min_cell_size: number
          retention_months: number
          sla_apuracao_hours: number
          sla_triagem_hours: number
          slug: string
          timezone: string
          trade_name: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name: string
          locale?: string
          min_cell_size?: number
          retention_months?: number
          sla_apuracao_hours?: number
          sla_triagem_hours?: number
          slug: string
          timezone?: string
          trade_name: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string
          locale?: string
          min_cell_size?: number
          retention_months?: number
          sla_apuracao_hours?: number
          sla_triagem_hours?: number
          slug?: string
          timezone?: string
          trade_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string | null
          last_seen_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          job_title?: string | null
          last_seen_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          last_seen_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_categories: {
        Row: {
          assigned_by: string | null
          assigned_by_reporter: boolean
          category_id: string
          created_at: string
          is_primary: boolean
          report_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_by_reporter?: boolean
          category_id: string
          created_at?: string
          is_primary?: boolean
          report_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_by_reporter?: boolean
          category_id?: string
          created_at?: string
          is_primary?: boolean
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_categories_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_category_distribution"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "report_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_psychosocial_inventory"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "report_categories_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_categories_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_evidence: {
        Row: {
          created_at: string
          exif_stripped: boolean
          filename: string
          id: string
          is_quarantined: boolean | null
          mime_type: string
          org_id: string
          report_id: string
          scan_result: string | null
          scan_status: string
          sha256_client: string | null
          sha256_verified: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
          uploaded_by_type: Database["public"]["Enums"]["message_author"]
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          exif_stripped?: boolean
          filename: string
          id?: string
          is_quarantined?: boolean | null
          mime_type: string
          org_id: string
          report_id: string
          scan_result?: string | null
          scan_status?: string
          sha256_client?: string | null
          sha256_verified?: string | null
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
          uploaded_by_type?: Database["public"]["Enums"]["message_author"]
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          exif_stripped?: boolean
          filename?: string
          id?: string
          is_quarantined?: boolean | null
          mime_type?: string
          org_id?: string
          report_id?: string
          scan_result?: string | null
          scan_status?: string
          sha256_client?: string | null
          sha256_verified?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
          uploaded_by_type?: Database["public"]["Enums"]["message_author"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_evidence_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_evidence_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_evidence_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "report_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_exports: {
        Row: {
          created_at: string
          expires_at: string | null
          filters: Json
          format: Database["public"]["Enums"]["export_format"]
          id: string
          includes_identity: boolean
          kind: string
          org_id: string
          requested_by: string | null
          row_count: number | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          filters?: Json
          format: Database["public"]["Enums"]["export_format"]
          id?: string
          includes_identity?: boolean
          kind: string
          org_id: string
          requested_by?: string | null
          row_count?: number | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          filters?: Json
          format?: Database["public"]["Enums"]["export_format"]
          id?: string
          includes_identity?: boolean
          kind?: string
          org_id?: string
          requested_by?: string | null
          row_count?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_exports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_exports_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_identities: {
        Row: {
          consent_to_contact: boolean
          consent_to_disclose_to_accused: boolean
          contact: string | null
          contact_kind: string | null
          created_at: string
          full_name: string | null
          org_id: string
          report_id: string
        }
        Insert: {
          consent_to_contact?: boolean
          consent_to_disclose_to_accused?: boolean
          contact?: string | null
          contact_kind?: string | null
          created_at?: string
          full_name?: string | null
          org_id: string
          report_id: string
        }
        Update: {
          consent_to_contact?: boolean
          consent_to_disclose_to_accused?: boolean
          contact?: string | null
          contact_kind?: string | null
          created_at?: string
          full_name?: string | null
          org_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_identities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_identities_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_identities_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_messages: {
        Row: {
          author_id: string | null
          author_type: Database["public"]["Enums"]["message_author"]
          body: string
          created_at: string
          id: string
          internal: boolean
          org_id: string
          read_by_reporter_at: string | null
          report_id: string
        }
        Insert: {
          author_id?: string | null
          author_type: Database["public"]["Enums"]["message_author"]
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          org_id: string
          read_by_reporter_at?: string | null
          report_id: string
        }
        Update: {
          author_id?: string | null
          author_type?: Database["public"]["Enums"]["message_author"]
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          org_id?: string
          read_by_reporter_at?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_recusals: {
        Row: {
          created_at: string
          declared_by: string | null
          reason: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          declared_by?: string | null
          reason: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          declared_by?: string | null
          reason?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_recusals_declared_by_fkey"
            columns: ["declared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_recusals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_recusals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "report_recusals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          created_at: string
          generated_by: string | null
          id: string
          kind: string
          metrics: Json
          org_id: string
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          generated_by?: string | null
          id?: string
          kind: string
          metrics: Json
          org_id: string
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          generated_by?: string | null
          id?: string
          kind?: string
          metrics?: Json
          org_id?: string
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_risk: Database["public"]["Enums"]["risk_level"] | null
          from_status: Database["public"]["Enums"]["report_status"] | null
          id: string
          org_id: string
          rationale: string | null
          report_id: string
          to_risk: Database["public"]["Enums"]["risk_level"] | null
          to_status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_risk?: Database["public"]["Enums"]["risk_level"] | null
          from_status?: Database["public"]["Enums"]["report_status"] | null
          id?: string
          org_id: string
          rationale?: string | null
          report_id: string
          to_risk?: Database["public"]["Enums"]["risk_level"] | null
          to_status: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_risk?: Database["public"]["Enums"]["risk_level"] | null
          from_status?: Database["public"]["Enums"]["report_status"] | null
          id?: string
          org_id?: string
          rationale?: string | null
          report_id?: string
          to_risk?: Database["public"]["Enums"]["risk_level"] | null
          to_status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "report_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_status_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "v_sla_performance"
            referencedColumns: ["report_id"]
          },
        ]
      }
      reports: {
        Row: {
          accused: string | null
          assigned_to: string | null
          category_specification: string | null
          city: string | null
          closed_at: string | null
          closure_disclosed_at: string | null
          closure_summary: string | null
          created_at: string
          created_by: string | null
          description: string
          due_at: string | null
          id: string
          idempotency_key: string | null
          location: string | null
          mode: Database["public"]["Enums"]["report_mode"]
          occurred_from: string | null
          occurred_to: string | null
          org_id: string
          org_unit_id: string | null
          period_text: string | null
          protocol: string
          recurrence: Database["public"]["Enums"]["recurrence_kind"]
          relationship: string | null
          retaliation: boolean
          risk: Database["public"]["Enums"]["risk_level"]
          risk_rationale: string | null
          search_tsv: unknown
          secret_algo: string
          secret_hash: string
          secret_rotated_at: string | null
          source: string
          status: Database["public"]["Enums"]["report_status"]
          unit_unknown: boolean
          updated_at: string
          urgent: boolean
          witnesses: string | null
        }
        Insert: {
          accused?: string | null
          assigned_to?: string | null
          category_specification?: string | null
          city?: string | null
          closed_at?: string | null
          closure_disclosed_at?: string | null
          closure_summary?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          location?: string | null
          mode: Database["public"]["Enums"]["report_mode"]
          occurred_from?: string | null
          occurred_to?: string | null
          org_id: string
          org_unit_id?: string | null
          period_text?: string | null
          protocol?: string
          recurrence?: Database["public"]["Enums"]["recurrence_kind"]
          relationship?: string | null
          retaliation?: boolean
          risk?: Database["public"]["Enums"]["risk_level"]
          risk_rationale?: string | null
          search_tsv?: unknown
          secret_algo?: string
          secret_hash: string
          secret_rotated_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["report_status"]
          unit_unknown?: boolean
          updated_at?: string
          urgent?: boolean
          witnesses?: string | null
        }
        Update: {
          accused?: string | null
          assigned_to?: string | null
          category_specification?: string | null
          city?: string | null
          closed_at?: string | null
          closure_disclosed_at?: string | null
          closure_summary?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_at?: string | null
          id?: string
          idempotency_key?: string | null
          location?: string | null
          mode?: Database["public"]["Enums"]["report_mode"]
          occurred_from?: string | null
          occurred_to?: string | null
          org_id?: string
          org_unit_id?: string | null
          period_text?: string | null
          protocol?: string
          recurrence?: Database["public"]["Enums"]["recurrence_kind"]
          relationship?: string | null
          retaliation?: boolean
          risk?: Database["public"]["Enums"]["risk_level"]
          risk_rationale?: string | null
          search_tsv?: unknown
          secret_algo?: string
          secret_hash?: string
          secret_rotated_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["report_status"]
          unit_unknown?: boolean
          updated_at?: string
          urgent?: boolean
          witnesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_category_distribution: {
        Row: {
          alto_risco: number | null
          category_code: string | null
          category_id: string | null
          group_key: Database["public"]["Enums"]["category_group"] | null
          label_pt: string | null
          org_id: string | null
          org_unit_id: string | null
          period_month: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_open_measures: {
        Row: {
          action_plan_id: string | null
          category_id: string | null
          description: string | null
          due_on: string | null
          effectiveness:
            | Database["public"]["Enums"]["effectiveness_result"]
            | null
          kind: Database["public"]["Enums"]["measure_kind"] | null
          measure_id: string | null
          org_id: string | null
          org_unit_id: string | null
          owner_id: string | null
          plan_code: string | null
          status: Database["public"]["Enums"]["measure_status"] | null
          title: string | null
          vencida: boolean | null
          verificacao_devida: boolean | null
          verify_on: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_measures_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_category_distribution"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "action_measures_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "v_psychosocial_inventory"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "action_measures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_measures_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_psychosocial_inventory: {
        Row: {
          agravados: number | null
          altos: number | null
          category_code: string | null
          category_id: string | null
          criticos: number | null
          frequencia: number | null
          label_pt: string | null
          org_id: string | null
          org_unit_id: string | null
          severidade: Database["public"]["Enums"]["risk_level"] | null
          tem_plano_ativo: boolean | null
          ultimo_relato: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_report_metrics: {
        Row: {
          alto_risco: number | null
          anonimos: number | null
          com_retaliacao: number | null
          mode: Database["public"]["Enums"]["report_mode"] | null
          org_id: string | null
          org_unit_id: string | null
          period_month: string | null
          relationship: string | null
          risk: Database["public"]["Enums"]["risk_level"] | null
          status: Database["public"]["Enums"]["report_status"] | null
          total: number | null
          urgentes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sla_performance: {
        Row: {
          atrasado: boolean | null
          closed_at: string | null
          created_at: string | null
          dentro_do_sla: boolean | null
          due_at: string | null
          first_triage_at: string | null
          horas_ate_conclusao: number | null
          horas_ate_triagem: number | null
          org_id: string | null
          org_unit_id: string | null
          report_id: string | null
          retaliation: boolean | null
          risk: Database["public"]["Enums"]["risk_level"] | null
          status: Database["public"]["Enums"]["report_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_org_unit_id_fkey"
            columns: ["org_unit_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_key_hash: string
          p_limit: number
          p_window: string
        }
        Returns: boolean
      }
      expire_upload_tickets: { Args: never; Returns: string[] }
      get_report_catalog: { Args: { p_org_slug: string }; Returns: Json }
      next_code: { Args: { p_org: string; p_prefix: string }; Returns: string }
      open_evidence: {
        Args: { p_evidence: string }
        Returns: {
          evidence_id: string
          filename: string
          mime_type: string
          org_id: string
          report_id: string
          sha256: string
          size_bytes: number
          storage_path: string
        }[]
      }
      prune_rate_limits: { Args: never; Returns: undefined }
      record_export: {
        Args: {
          p_filters: Json
          p_format: Database["public"]["Enums"]["export_format"]
          p_includes_identity?: boolean
          p_kind: string
          p_org: string
          p_row_count: number
        }
        Returns: string
      }
      request_identity_access: {
        Args: { p_justification: string; p_report: string }
        Returns: undefined
      }
      reveal_identity: {
        Args: { p_report: string }
        Returns: {
          consent_to_contact: boolean
          consent_to_disclose_to_accused: boolean
          contact: string | null
          contact_kind: string | null
          created_at: string
          full_name: string | null
          org_id: string
          report_id: string
        }
        SetofOptions: {
          from: "*"
          to: "report_identities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suppress_small_cell: {
        Args: { p_count: number; p_org: string }
        Returns: number
      }
      sweep_overdue: { Args: never; Returns: Json }
      verify_audit_chain: {
        Args: { p_from?: string; p_org: string }
        Returns: {
          id: string
          ok: boolean
          seq: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "triagem" | "investigador" | "comite"
      category_group: "violencia_conduta" | "organizacao_trabalho"
      custody_action:
        | "coletada"
        | "armazenada"
        | "acessada"
        | "transferida"
        | "copiada"
        | "devolvida"
        | "descartada"
      effectiveness_result:
        | "nao_verificada"
        | "eficaz"
        | "parcialmente_eficaz"
        | "ineficaz"
      export_format: "pdf" | "csv" | "xlsx" | "json"
      interview_kind:
        | "denunciante"
        | "denunciado"
        | "testemunha"
        | "especialista"
        | "outro"
      investigation_outcome:
        | "procedente"
        | "parcialmente_procedente"
        | "improcedente"
        | "inconclusiva"
      investigation_status:
        | "planejada"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      measure_kind:
        | "preventiva"
        | "corretiva"
        | "disciplinar"
        | "estrutural"
        | "treinamento"
        | "comunicacao"
      measure_status:
        | "planejada"
        | "em_andamento"
        | "concluida"
        | "atrasada"
        | "cancelada"
      member_status: "invited" | "active" | "suspended"
      message_author: "reporter" | "staff" | "system"
      recurrence_kind: "once" | "recurring" | "ongoing" | "unknown"
      report_mode: "anonymous" | "identified"
      report_status:
        | "em_triagem"
        | "em_apuracao"
        | "aguardando_informacao"
        | "concluida"
        | "arquivada"
      risk_level: "baixo" | "moderado" | "alto" | "critico"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "triagem", "investigador", "comite"],
      category_group: ["violencia_conduta", "organizacao_trabalho"],
      custody_action: [
        "coletada",
        "armazenada",
        "acessada",
        "transferida",
        "copiada",
        "devolvida",
        "descartada",
      ],
      effectiveness_result: [
        "nao_verificada",
        "eficaz",
        "parcialmente_eficaz",
        "ineficaz",
      ],
      export_format: ["pdf", "csv", "xlsx", "json"],
      interview_kind: [
        "denunciante",
        "denunciado",
        "testemunha",
        "especialista",
        "outro",
      ],
      investigation_outcome: [
        "procedente",
        "parcialmente_procedente",
        "improcedente",
        "inconclusiva",
      ],
      investigation_status: [
        "planejada",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      measure_kind: [
        "preventiva",
        "corretiva",
        "disciplinar",
        "estrutural",
        "treinamento",
        "comunicacao",
      ],
      measure_status: [
        "planejada",
        "em_andamento",
        "concluida",
        "atrasada",
        "cancelada",
      ],
      member_status: ["invited", "active", "suspended"],
      message_author: ["reporter", "staff", "system"],
      recurrence_kind: ["once", "recurring", "ongoing", "unknown"],
      report_mode: ["anonymous", "identified"],
      report_status: [
        "em_triagem",
        "em_apuracao",
        "aguardando_informacao",
        "concluida",
        "arquivada",
      ],
      risk_level: ["baixo", "moderado", "alto", "critico"],
    },
  },
} as const
