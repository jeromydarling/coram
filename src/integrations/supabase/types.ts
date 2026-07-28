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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activation_checklist_items: {
        Row: {
          category: string
          checklist_id: string
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          help: string | null
          id: string
          item_key: string
          label: string
          notes: string | null
          required: boolean
        }
        Insert: {
          category: string
          checklist_id: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          help?: string | null
          id?: string
          item_key: string
          label: string
          notes?: string | null
          required?: boolean
        }
        Update: {
          category?: string
          checklist_id?: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          help?: string | null
          id?: string
          item_key?: string
          label?: string
          notes?: string | null
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "activation_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "activation_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_checklist_templates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          items: Json
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          items?: Json
          key: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          items?: Json
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      activation_checklists: {
        Row: {
          created_at: string
          id: string
          readiness_score: number
          status: string
          template_keys: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          readiness_score?: number
          status?: string
          template_keys?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          readiness_score?: number
          status?: string
          template_keys?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_checklists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activation_checklists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activation_checklists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_offers: {
        Row: {
          consent_granted: boolean
          consent_granted_at: string | null
          consent_granted_by: string | null
          created_at: string
          id: string
          meeting_link: string | null
          notes: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          consent_granted?: boolean
          consent_granted_at?: string | null
          consent_granted_by?: string | null
          created_at?: string
          id?: string
          meeting_link?: string | null
          notes?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          consent_granted?: boolean
          consent_granted_at?: string | null
          consent_granted_by?: string | null
          created_at?: string
          id?: string
          meeting_link?: string | null
          notes?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activation_offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activation_offers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_sessions: {
        Row: {
          calendar_event_id: string | null
          calendar_event_url: string | null
          created_at: string
          customer_notes: string | null
          duration_minutes: number
          id: string
          meet_link: string | null
          operator_notes: string | null
          purchased_at: string
          purchased_by: string | null
          requested_times: string | null
          scheduled_at: string | null
          session_type: string
          sessions_remaining: number
          sessions_total: number
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          calendar_event_url?: string | null
          created_at?: string
          customer_notes?: string | null
          duration_minutes?: number
          id?: string
          meet_link?: string | null
          operator_notes?: string | null
          purchased_at?: string
          purchased_by?: string | null
          requested_times?: string | null
          scheduled_at?: string | null
          session_type: string
          sessions_remaining: number
          sessions_total: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          calendar_event_url?: string | null
          created_at?: string
          customer_notes?: string | null
          duration_minutes?: number
          id?: string
          meet_link?: string | null
          operator_notes?: string | null
          purchased_at?: string
          purchased_by?: string | null
          requested_times?: string | null
          scheduled_at?: string | null
          session_type?: string
          sessions_remaining?: number
          sessions_total?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activation_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activation_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          activity_date_time: string
          activity_id: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          attended: boolean | null
          contact_id: string | null
          created_at: string | null
          external_ids: Json
          google_calendar_event_id: string | null
          google_calendar_synced_at: string | null
          hours_logged: number | null
          id: string
          is_private: boolean
          location: string | null
          metro_id: string | null
          next_action: string | null
          next_action_due: string | null
          notes: string | null
          opportunity_id: string | null
          outcome: Database["public"]["Enums"]["activity_outcome"] | null
          parent_activity_id: string | null
          project_status: string | null
          stage_suggested:
            | Database["public"]["Enums"]["opportunity_stage"]
            | null
          subject_contact_id: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          activity_date_time: string
          activity_id: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          attended?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          external_ids?: Json
          google_calendar_event_id?: string | null
          google_calendar_synced_at?: string | null
          hours_logged?: number | null
          id?: string
          is_private?: boolean
          location?: string | null
          metro_id?: string | null
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          opportunity_id?: string | null
          outcome?: Database["public"]["Enums"]["activity_outcome"] | null
          parent_activity_id?: string | null
          project_status?: string | null
          stage_suggested?:
            | Database["public"]["Enums"]["opportunity_stage"]
            | null
          subject_contact_id?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_date_time?: string
          activity_id?: string
          activity_type?: Database["public"]["Enums"]["activity_type"]
          attended?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          external_ids?: Json
          google_calendar_event_id?: string | null
          google_calendar_synced_at?: string | null
          hours_logged?: number | null
          id?: string
          is_private?: boolean
          location?: string | null
          metro_id?: string | null
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          opportunity_id?: string | null
          outcome?: Database["public"]["Enums"]["activity_outcome"] | null
          parent_activity_id?: string | null
          project_status?: string | null
          stage_suggested?:
            | Database["public"]["Enums"]["opportunity_stage"]
            | null
          subject_contact_id?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "activities_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "activities_parent_activity_fk"
            columns: ["parent_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_subject_contact_id_fkey"
            columns: ["subject_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_impact: {
        Row: {
          activity_id: string
          attendance_count: number | null
          created_at: string
          created_by: string | null
          outcome_note: string | null
          people_helped: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          attendance_count?: number | null
          created_at?: string
          created_by?: string | null
          outcome_note?: string | null
          people_helped?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          attendance_count?: number | null
          created_at?: string
          created_by?: string | null
          outcome_note?: string | null
          people_helped?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_impact_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_impact_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activity_impact_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activity_impact_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_participants: {
        Row: {
          activity_id: string
          contact_id: string | null
          created_at: string
          created_by: string
          display_name: string
          id: string
          role: string
          tenant_id: string
          volunteer_id: string | null
        }
        Insert: {
          activity_id: string
          contact_id?: string | null
          created_at?: string
          created_by: string
          display_name: string
          id?: string
          role?: string
          tenant_id: string
          volunteer_id?: string | null
        }
        Update: {
          activity_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string
          display_name?: string
          id?: string
          role?: string
          tenant_id?: string
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activity_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "activity_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analysis_runs: {
        Row: {
          auto_approved_count: number | null
          completed_at: string | null
          emails_analyzed: number | null
          failed_emails: number | null
          id: string
          ocr_batch_id: string | null
          ocr_images_processed: number | null
          run_type: string
          started_at: string | null
          status: string | null
          suggestions_created: number | null
          user_id: string
        }
        Insert: {
          auto_approved_count?: number | null
          completed_at?: string | null
          emails_analyzed?: number | null
          failed_emails?: number | null
          id?: string
          ocr_batch_id?: string | null
          ocr_images_processed?: number | null
          run_type: string
          started_at?: string | null
          status?: string | null
          suggestions_created?: number | null
          user_id: string
        }
        Update: {
          auto_approved_count?: number | null
          completed_at?: string | null
          emails_analyzed?: number | null
          failed_emails?: number | null
          id?: string
          ocr_batch_id?: string | null
          ocr_images_processed?: number | null
          run_type?: string
          started_at?: string | null
          status?: string | null
          suggestions_created?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          id: string
          is_active: boolean | null
          last_message_at: string | null
          message_count: number | null
          started_at: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          started_at?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          started_at?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_knowledge_document_versions: {
        Row: {
          content_json: Json | null
          content_markdown: string
          created_at: string
          created_by: string
          document_id: string
          id: string
          source_urls: string[]
          version: number
        }
        Insert: {
          content_json?: Json | null
          content_markdown: string
          created_at?: string
          created_by: string
          document_id: string
          id?: string
          source_urls?: string[]
          version: number
        }
        Update: {
          content_json?: Json | null
          content_markdown?: string
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
          source_urls?: string[]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_documents: {
        Row: {
          active: boolean
          content_json: Json | null
          content_markdown: string
          created_at: string
          created_by: string
          id: string
          key: string
          source_urls: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          content_json?: Json | null
          content_markdown: string
          created_at?: string
          created_by: string
          id?: string
          key: string
          source_urls?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          content_json?: Json | null
          content_markdown?: string
          created_at?: string
          created_by?: string
          id?: string
          key?: string
          source_urls?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          body: string | null
          created_at: string
          id: string
          inputs_hash: string
          metadata: Json | null
          metro_id: string | null
          priority: string | null
          recommendation_type: string
          run_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          inputs_hash: string
          metadata?: Json | null
          metro_id?: string | null
          priority?: string | null
          recommendation_type: string
          run_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          inputs_hash?: string
          metadata?: Json | null
          metro_id?: string | null
          priority?: string | null
          recommendation_type?: string
          run_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "ai_recommendations_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      ai_sender_patterns: {
        Row: {
          approval_rate: number | null
          approved_count: number | null
          auto_approve_threshold: number | null
          created_at: string | null
          dismissed_count: number | null
          id: string
          pattern_type: string
          pattern_value: string
          total_suggestions: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approval_rate?: number | null
          approved_count?: number | null
          auto_approve_threshold?: number | null
          created_at?: string | null
          dismissed_count?: number | null
          id?: string
          pattern_type: string
          pattern_value: string
          total_suggestions?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approval_rate?: number | null
          approved_count?: number | null
          auto_approve_threshold?: number | null
          created_at?: string | null
          dismissed_count?: number | null
          id?: string
          pattern_type?: string
          pattern_value?: string
          total_suggestions?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_suggestions: {
        Row: {
          ai_reasoning: string | null
          confidence_score: number | null
          created_at: string | null
          created_entity_id: string | null
          created_entity_type: string | null
          days_since_contact: number | null
          depends_on_suggestion_id: string | null
          followup_contact_id: string | null
          followup_reason: string | null
          id: string
          is_backfill: boolean | null
          linked_contact_id: string | null
          ocr_batch_id: string | null
          processed_at: string | null
          sender_domain: string | null
          sender_email: string | null
          source: string
          source_id: string | null
          source_snippet: string | null
          status: string | null
          suggested_email: string | null
          suggested_name: string | null
          suggested_opportunity_id: string | null
          suggested_organization: string | null
          suggested_phone: string | null
          suggested_title: string | null
          suggestion_hash: string | null
          suggestion_type: string
          task_description: string | null
          task_due_date: string | null
          task_priority: string | null
          task_title: string | null
          updated_at: string | null
          user_id: string
          website_url: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string | null
          created_entity_id?: string | null
          created_entity_type?: string | null
          days_since_contact?: number | null
          depends_on_suggestion_id?: string | null
          followup_contact_id?: string | null
          followup_reason?: string | null
          id?: string
          is_backfill?: boolean | null
          linked_contact_id?: string | null
          ocr_batch_id?: string | null
          processed_at?: string | null
          sender_domain?: string | null
          sender_email?: string | null
          source: string
          source_id?: string | null
          source_snippet?: string | null
          status?: string | null
          suggested_email?: string | null
          suggested_name?: string | null
          suggested_opportunity_id?: string | null
          suggested_organization?: string | null
          suggested_phone?: string | null
          suggested_title?: string | null
          suggestion_hash?: string | null
          suggestion_type: string
          task_description?: string | null
          task_due_date?: string | null
          task_priority?: string | null
          task_title?: string | null
          updated_at?: string | null
          user_id: string
          website_url?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string | null
          created_entity_id?: string | null
          created_entity_type?: string | null
          days_since_contact?: number | null
          depends_on_suggestion_id?: string | null
          followup_contact_id?: string | null
          followup_reason?: string | null
          id?: string
          is_backfill?: boolean | null
          linked_contact_id?: string | null
          ocr_batch_id?: string | null
          processed_at?: string | null
          sender_domain?: string | null
          sender_email?: string | null
          source?: string
          source_id?: string | null
          source_snippet?: string | null
          status?: string | null
          suggested_email?: string | null
          suggested_name?: string | null
          suggested_opportunity_id?: string | null
          suggested_organization?: string | null
          suggested_phone?: string | null
          suggested_title?: string | null
          suggestion_hash?: string | null
          suggestion_type?: string
          task_description?: string | null
          task_due_date?: string | null
          task_priority?: string | null
          task_title?: string | null
          updated_at?: string | null
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_depends_on_suggestion_id_fkey"
            columns: ["depends_on_suggestion_id"]
            isOneToOne: false
            referencedRelation: "ai_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_linked_contact_id_fkey"
            columns: ["linked_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_user_settings: {
        Row: {
          auto_approve_threshold: number | null
          chat_context_window: number | null
          created_at: string | null
          gmail_ai_enabled: boolean | null
          gmail_ai_enabled_at: string | null
          gmail_ai_start_at: string | null
          gmail_connected_at: string | null
          gmail_last_token_refresh_at: string | null
          ignored_email_domains: string[]
          ocr_auto_followup_enabled: boolean | null
          ocr_followup_business_days: number | null
          readai_webhook_key: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_approve_threshold?: number | null
          chat_context_window?: number | null
          created_at?: string | null
          gmail_ai_enabled?: boolean | null
          gmail_ai_enabled_at?: string | null
          gmail_ai_start_at?: string | null
          gmail_connected_at?: string | null
          gmail_last_token_refresh_at?: string | null
          ignored_email_domains?: string[]
          ocr_auto_followup_enabled?: boolean | null
          ocr_followup_business_days?: number | null
          readai_webhook_key?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_approve_threshold?: number | null
          chat_context_window?: number | null
          created_at?: string | null
          gmail_ai_enabled?: boolean | null
          gmail_ai_enabled_at?: string | null
          gmail_ai_start_at?: string | null
          gmail_connected_at?: string | null
          gmail_last_token_refresh_at?: string | null
          ignored_email_domains?: string[]
          ocr_auto_followup_enabled?: boolean | null
          ocr_followup_business_days?: number | null
          readai_webhook_key?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_workflow_usage: {
        Row: {
          call_count: number
          created_at: string
          engine_used: string
          estimated_cost_usd: number
          estimated_tokens: number
          id: string
          intelligence_mode: string
          tenant_id: string
          workflow_key: string
        }
        Insert: {
          call_count?: number
          created_at?: string
          engine_used?: string
          estimated_cost_usd?: number
          estimated_tokens?: number
          id?: string
          intelligence_mode?: string
          tenant_id: string
          workflow_key: string
        }
        Update: {
          call_count?: number
          created_at?: string
          engine_used?: string
          estimated_cost_usd?: number
          estimated_tokens?: number
          id?: string
          intelligence_mode?: string
          tenant_id?: string
          workflow_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_workflow_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ai_workflow_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ai_workflow_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_pipeline: {
        Row: {
          anchor_pipeline_id: string
          created_at: string | null
          estimated_monthly_volume: number | null
          expected_anchor_yn: boolean | null
          id: string
          last_activity_date: string | null
          metro_id: string | null
          next_action: string | null
          next_action_due: string | null
          notes: string | null
          opportunity_id: string | null
          owner: string | null
          owner_id: string | null
          probability: number | null
          stage: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entry_date: string | null
          target_first_volume_date: string | null
          updated_at: string | null
        }
        Insert: {
          anchor_pipeline_id: string
          created_at?: string | null
          estimated_monthly_volume?: number | null
          expected_anchor_yn?: boolean | null
          id?: string
          last_activity_date?: string | null
          metro_id?: string | null
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          opportunity_id?: string | null
          owner?: string | null
          owner_id?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entry_date?: string | null
          target_first_volume_date?: string | null
          updated_at?: string | null
        }
        Update: {
          anchor_pipeline_id?: string
          created_at?: string | null
          estimated_monthly_volume?: number | null
          expected_anchor_yn?: boolean | null
          id?: string
          last_activity_date?: string | null
          metro_id?: string | null
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          opportunity_id?: string | null
          owner?: string | null
          owner_id?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          stage_entry_date?: string | null
          target_first_volume_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anchor_pipeline_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "anchor_pipeline_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_pipeline_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchor_pipeline_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      anchors: {
        Row: {
          agreement_signed_date: string | null
          anchor_id: string
          anchor_tier: Database["public"]["Enums"]["anchor_tier"] | null
          avg_monthly_volume: number | null
          created_at: string | null
          discovery_date: string | null
          first_contact_date: string | null
          first_volume_date: string | null
          growth_trend: Database["public"]["Enums"]["growth_trend"] | null
          id: string
          last_30_day_volume: number | null
          metro_id: string | null
          notes: string | null
          opportunity_id: string | null
          peak_monthly_volume: number | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          stable_producer_date: string | null
          strategic_value_1to5: number | null
          updated_at: string | null
        }
        Insert: {
          agreement_signed_date?: string | null
          anchor_id: string
          anchor_tier?: Database["public"]["Enums"]["anchor_tier"] | null
          avg_monthly_volume?: number | null
          created_at?: string | null
          discovery_date?: string | null
          first_contact_date?: string | null
          first_volume_date?: string | null
          growth_trend?: Database["public"]["Enums"]["growth_trend"] | null
          id?: string
          last_30_day_volume?: number | null
          metro_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          peak_monthly_volume?: number | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          stable_producer_date?: string | null
          strategic_value_1to5?: number | null
          updated_at?: string | null
        }
        Update: {
          agreement_signed_date?: string | null
          anchor_id?: string
          anchor_tier?: Database["public"]["Enums"]["anchor_tier"] | null
          avg_monthly_volume?: number | null
          created_at?: string | null
          discovery_date?: string | null
          first_contact_date?: string | null
          first_volume_date?: string | null
          growth_trend?: Database["public"]["Enums"]["growth_trend"] | null
          id?: string
          last_30_day_volume?: number | null
          metro_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          peak_monthly_volume?: number | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          stable_producer_date?: string | null
          strategic_value_1to5?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anchors_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "anchors_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchors_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anchors_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      app_event_stream: {
        Row: {
          created_at: string
          event_name: string
          id: string
          is_error: boolean
          metadata: Json | null
          page_path: string | null
          referrer: string | null
          session_hash: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          is_error?: boolean
          metadata?: Json | null
          page_path?: string | null
          referrer?: string | null
          session_hash?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          is_error?: boolean
          metadata?: Json | null
          page_path?: string | null
          referrer?: string | null
          session_hash?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_event_stream_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "app_event_stream_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "app_event_stream_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_defaults: {
        Row: {
          archetype: string
          config: Json
          config_key: string
          created_at: string
        }
        Insert: {
          archetype: string
          config?: Json
          config_key: string
          created_at?: string
        }
        Update: {
          archetype?: string
          config?: Json
          config_key?: string
          created_at?: string
        }
        Relationships: []
      }
      archetype_interest_signals: {
        Row: {
          archetype_key: string
          created_at: string
          id: string
          source: string
        }
        Insert: {
          archetype_key: string
          created_at?: string
          id?: string
          source?: string
        }
        Update: {
          archetype_key?: string
          created_at?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      archetype_profiles: {
        Row: {
          behavior_profile: Json
          communio_default: boolean
          created_at: string
          display_name: string
          key: string
          narrative_style: string
        }
        Insert: {
          behavior_profile?: Json
          communio_default?: boolean
          created_at?: string
          display_name: string
          key: string
          narrative_style?: string
        }
        Update: {
          behavior_profile?: Json
          communio_default?: boolean
          created_at?: string
          display_name?: string
          key?: string
          narrative_style?: string
        }
        Relationships: []
      }
      archetype_signal_rollups: {
        Row: {
          archetype_key: string
          event_presence: number
          generated_story: string | null
          id: string
          momentum_growth: number
          period_end: string
          period_start: string
          reflection_volume: number
          tenant_sample_size: number
          updated_at: string
          visit_activity: number
        }
        Insert: {
          archetype_key: string
          event_presence?: number
          generated_story?: string | null
          id?: string
          momentum_growth?: number
          period_end: string
          period_start: string
          reflection_volume?: number
          tenant_sample_size?: number
          updated_at?: string
          visit_activity?: number
        }
        Update: {
          archetype_key?: string
          event_presence?: number
          generated_story?: string | null
          id?: string
          momentum_growth?: number
          period_end?: string
          period_start?: string
          reflection_volume?: number
          tenant_sample_size?: number
          updated_at?: string
          visit_activity?: number
        }
        Relationships: []
      }
      archetype_simulation_runs: {
        Row: {
          archetype_key: string
          completed_at: string | null
          created_at: string
          error: Json | null
          id: string
          stats: Json
          status: string
          tenant_id: string
          tick_key: string
        }
        Insert: {
          archetype_key: string
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          stats?: Json
          status?: string
          tenant_id: string
          tick_key: string
        }
        Update: {
          archetype_key?: string
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          stats?: Json
          status?: string
          tenant_id?: string
          tick_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "archetype_simulation_runs_archetype_key_fkey"
            columns: ["archetype_key"]
            isOneToOne: false
            referencedRelation: "archetype_profiles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "archetype_simulation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "archetype_simulation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "archetype_simulation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archetypes: {
        Row: {
          created_at: string
          default_flags: Json
          default_journey_stages: Json
          default_keywords: Json
          default_tier: string
          description: string | null
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          default_flags?: Json
          default_journey_stages?: Json
          default_keywords?: Json
          default_tier?: string
          description?: string | null
          key: string
          name: string
        }
        Update: {
          created_at?: string
          default_flags?: Json
          default_journey_stages?: Json
          default_keywords?: Json
          default_tier?: string
          description?: string | null
          key?: string
          name?: string
        }
        Relationships: []
      }
      archive_reflections: {
        Row: {
          candidate_id: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          gratitude: string | null
          id: string
          invitation: string | null
          movement: string | null
          noticing: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          gratitude?: string | null
          id?: string
          invitation?: string | null
          movement?: string | null
          noticing?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          gratitude?: string | null
          id?: string
          invitation?: string | null
          movement?: string | null
          noticing?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_reflections_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "archive_suggestion_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_reflections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "archive_reflections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "archive_reflections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_suggestion_candidates: {
        Row: {
          confidence: number
          created_at: string
          dismissed: boolean
          entity_id: string
          entity_type: string
          id: string
          match_period: unknown
          pattern_key: string
          pattern_type: string
          source_period: unknown
          tenant_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          dismissed?: boolean
          entity_id: string
          entity_type: string
          id?: string
          match_period?: unknown
          pattern_key: string
          pattern_type: string
          source_period?: unknown
          tenant_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          dismissed?: boolean
          entity_id?: string
          entity_type?: string
          id?: string
          match_period?: unknown
          pattern_key?: string
          pattern_type?: string
          source_period?: unknown
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_suggestion_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "archive_suggestion_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "archive_suggestion_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          cooldown_seconds: number | null
          created_at: string
          dedupe_key: string | null
          dispatch_payload: Json | null
          error_message: string | null
          id: string
          inputs_hash: string | null
          metro_id: string | null
          org_id: string | null
          org_name: string | null
          parent_run_id: string | null
          payload: Json | null
          payload_fingerprint: string | null
          priority: number | null
          processed_at: string | null
          received_at: string
          requested_by: string | null
          retry_count: number | null
          run_id: string
          scope_json: Json | null
          status: string
          triggered_by: string | null
          workflow_key: string
        }
        Insert: {
          cooldown_seconds?: number | null
          created_at?: string
          dedupe_key?: string | null
          dispatch_payload?: Json | null
          error_message?: string | null
          id?: string
          inputs_hash?: string | null
          metro_id?: string | null
          org_id?: string | null
          org_name?: string | null
          parent_run_id?: string | null
          payload?: Json | null
          payload_fingerprint?: string | null
          priority?: number | null
          processed_at?: string | null
          received_at?: string
          requested_by?: string | null
          retry_count?: number | null
          run_id: string
          scope_json?: Json | null
          status?: string
          triggered_by?: string | null
          workflow_key: string
        }
        Update: {
          cooldown_seconds?: number | null
          created_at?: string
          dedupe_key?: string | null
          dispatch_payload?: Json | null
          error_message?: string | null
          id?: string
          inputs_hash?: string | null
          metro_id?: string | null
          org_id?: string | null
          org_name?: string | null
          parent_run_id?: string | null
          payload?: Json | null
          payload_fingerprint?: string | null
          priority?: number | null
          processed_at?: string | null
          received_at?: string
          requested_by?: string | null
          retry_count?: number | null
          run_id?: string
          scope_json?: Json | null
          status?: string
          triggered_by?: string | null
          workflow_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "automation_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_products: {
        Row: {
          base_price_cents: number
          billing_interval: string
          created_at: string
          id: string
          included_usage: Json
          included_users: number
          stripe_price_id: string
          stripe_product_id: string
          tier: string
        }
        Insert: {
          base_price_cents: number
          billing_interval: string
          created_at?: string
          id?: string
          included_usage?: Json
          included_users?: number
          stripe_price_id: string
          stripe_product_id: string
          tier: string
        }
        Update: {
          base_price_cents?: number
          billing_interval?: string
          created_at?: string
          id?: string
          included_usage?: Json
          included_users?: number
          stripe_price_id?: string
          stripe_product_id?: string
          tier?: string
        }
        Relationships: []
      }
      brevo_metro_lists: {
        Row: {
          brevo_list_id: string
          brevo_list_name: string
          created_at: string | null
          metro_id: string
          updated_at: string | null
        }
        Insert: {
          brevo_list_id: string
          brevo_list_name: string
          created_at?: string | null
          metro_id: string
          updated_at?: string | null
        }
        Update: {
          brevo_list_id?: string
          brevo_list_name?: string
          created_at?: string | null
          metro_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brevo_metro_lists_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: true
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "brevo_metro_lists_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: true
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_subject_stats: {
        Row: {
          created_at: string
          created_by: string
          failed_count: number
          id: string
          last_used_at: string
          sent_count: number
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          last_used_at?: string
          sent_count?: number
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          last_used_at?: string
          sent_count?: number
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_suggestion_decisions: {
        Row: {
          decision: string
          evaluated_at: string
          id: string
          reason: string
          suggestion_id: string
        }
        Insert: {
          decision: string
          evaluated_at?: string
          id?: string
          reason: string
          suggestion_id: string
        }
        Update: {
          decision?: string
          evaluated_at?: string
          id?: string
          reason?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_suggestion_decisions_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "campaign_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_suggestion_items: {
        Row: {
          created_at: string
          id: string
          signal_id: string
          suggestion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          signal_id: string
          suggestion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          signal_id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_suggestion_items_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "campaign_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_suggestions: {
        Row: {
          body_template: string
          confidence: number
          converted_campaign_id: string | null
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          reason: string
          snoozed_until: string | null
          source_id: string
          source_type: string
          status: string
          subject: string
          suggestion_type: string
          title: string
          updated_at: string
        }
        Insert: {
          body_template: string
          confidence?: number
          converted_campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          reason: string
          snoozed_until?: string | null
          source_id: string
          source_type?: string
          status?: string
          subject: string
          suggestion_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          confidence?: number
          converted_campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          reason?: string
          snoozed_until?: string | null
          source_id?: string
          source_type?: string
          status?: string
          subject?: string
          suggestion_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_suggestions_converted_campaign_id_fkey"
            columns: ["converted_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_unsubscribe_tokens: {
        Row: {
          campaign_id: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          tenant_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          tenant_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          tenant_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribe_tokens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribe_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_unsubscribe_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_unsubscribe_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_network_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          reported: boolean
          reported_reason: string | null
          request_id: string
          sender_user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          reported?: boolean
          reported_reason?: string | null
          request_id: string
          sender_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          reported?: boolean
          reported_reason?: string | null
          request_id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_network_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "caregiver_network_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_network_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_message_id: string | null
          reported_profile_id: string | null
          reported_request_id: string | null
          reporter_user_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_message_id?: string | null
          reported_profile_id?: string | null
          reported_request_id?: string | null
          reporter_user_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_message_id?: string | null
          reported_profile_id?: string | null
          reported_request_id?: string | null
          reporter_user_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_network_reports_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "caregiver_network_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_network_reports_reported_profile_id_fkey"
            columns: ["reported_profile_id"]
            isOneToOne: false
            referencedRelation: "caregiver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_network_reports_reported_request_id_fkey"
            columns: ["reported_request_id"]
            isOneToOne: false
            referencedRelation: "caregiver_network_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_network_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          message: string
          status: Database["public"]["Enums"]["caregiver_request_status"]
          to_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["caregiver_request_status"]
          to_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["caregiver_request_status"]
          to_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_network_requests_to_profile_id_fkey"
            columns: ["to_profile_id"]
            isOneToOne: false
            referencedRelation: "caregiver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_profiles: {
        Row: {
          availability_tags: string[]
          base_city: string | null
          base_country_code: string | null
          base_state_code: string | null
          bio_short: string | null
          contact_visibility: Database["public"]["Enums"]["caregiver_contact_visibility"]
          created_at: string
          display_name: string
          hidden_at: string | null
          id: string
          network_opt_in: boolean
          support_needs: string[]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_tags?: string[]
          base_city?: string | null
          base_country_code?: string | null
          base_state_code?: string | null
          bio_short?: string | null
          contact_visibility?: Database["public"]["Enums"]["caregiver_contact_visibility"]
          created_at?: string
          display_name?: string
          hidden_at?: string | null
          id?: string
          network_opt_in?: boolean
          support_needs?: string[]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_tags?: string[]
          base_city?: string | null
          base_country_code?: string | null
          base_state_code?: string | null
          bio_short?: string | null
          contact_visibility?: Database["public"]["Enums"]["caregiver_contact_visibility"]
          created_at?: string
          display_name?: string
          hidden_at?: string | null
          id?: string
          network_opt_in?: boolean
          support_needs?: string[]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "caregiver_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "caregiver_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_activity_log: {
        Row: {
          action_type: string
          created_at: string | null
          group_id: string
          id: string
          sharing_level: string | null
          tenant_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          group_id: string
          id?: string
          sharing_level?: string | null
          tenant_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          group_id?: string
          id?: string
          sharing_level?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      communio_awareness_signals: {
        Row: {
          anonymized_message: string
          archetype_scope: string | null
          created_at: string
          id: string
          is_hipaa_safe: boolean
          metro_scope: string | null
          role_scope: string
          source_signal_type: string
          suggested_action: string
          visibility: string
        }
        Insert: {
          anonymized_message: string
          archetype_scope?: string | null
          created_at?: string
          id?: string
          is_hipaa_safe?: boolean
          metro_scope?: string | null
          role_scope?: string
          source_signal_type: string
          suggested_action: string
          visibility?: string
        }
        Update: {
          anonymized_message?: string
          archetype_scope?: string | null
          created_at?: string
          id?: string
          is_hipaa_safe?: boolean
          metro_scope?: string | null
          role_scope?: string
          source_signal_type?: string
          suggested_action?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_awareness_signals_metro_scope_fkey"
            columns: ["metro_scope"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "communio_awareness_signals_metro_scope_fkey"
            columns: ["metro_scope"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_governance_flags: {
        Row: {
          created_at: string
          details: string | null
          flag_type: string
          group_id: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          flag_type: string
          group_id: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          flag_type?: string
          group_id?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_governance_flags_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_governance_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_governance_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_governance_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_group_metrics: {
        Row: {
          collaboration_levels: Json
          created_at: string | null
          events_shared_count: number
          group_id: string
          id: string
          signals_shared_count: number
          tenant_count: number
          week_start: string
        }
        Insert: {
          collaboration_levels?: Json
          created_at?: string | null
          events_shared_count?: number
          group_id: string
          id?: string
          signals_shared_count?: number
          tenant_count?: number
          week_start: string
        }
        Update: {
          collaboration_levels?: Json
          created_at?: string | null
          events_shared_count?: number
          group_id?: string
          id?: string
          signals_shared_count?: number
          tenant_count?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_group_metrics_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_group_settings: {
        Row: {
          allow_event_sharing: boolean
          allow_reflection_sharing: boolean
          allow_signal_sharing: boolean
          allow_story_heatmap: boolean
          created_at: string
          group_id: string
          visibility: string
        }
        Insert: {
          allow_event_sharing?: boolean
          allow_reflection_sharing?: boolean
          allow_signal_sharing?: boolean
          allow_story_heatmap?: boolean
          created_at?: string
          group_id: string
          visibility?: string
        }
        Update: {
          allow_event_sharing?: boolean
          allow_reflection_sharing?: boolean
          allow_signal_sharing?: boolean
          allow_story_heatmap?: boolean
          created_at?: string
          group_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_group_settings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_groups: {
        Row: {
          created_at: string
          created_by_tenant: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by_tenant: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by_tenant?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_groups_created_by_tenant_fkey"
            columns: ["created_by_tenant"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_groups_created_by_tenant_fkey"
            columns: ["created_by_tenant"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_groups_created_by_tenant_fkey"
            columns: ["created_by_tenant"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_invites: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invited_by: string
          invited_tenant_id: string
          status: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invited_by: string
          invited_tenant_id: string
          status?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invited_by?: string
          invited_tenant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_invites_invited_tenant_id_fkey"
            columns: ["invited_tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_invites_invited_tenant_id_fkey"
            columns: ["invited_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_invites_invited_tenant_id_fkey"
            columns: ["invited_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_memberships: {
        Row: {
          created_at: string
          group_id: string
          id: string
          sharing_level: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          sharing_level?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          sharing_level?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_public_profiles: {
        Row: {
          archetype: string | null
          auto_generated: boolean
          contact_email: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          metros: Json | null
          org_name: string
          presence_story: string | null
          tenant_id: string
          updated_at: string
          visibility: string
          website_url: string | null
        }
        Insert: {
          archetype?: string | null
          auto_generated?: boolean
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          metros?: Json | null
          org_name: string
          presence_story?: string | null
          tenant_id: string
          updated_at?: string
          visibility?: string
          website_url?: string | null
        }
        Update: {
          archetype?: string | null
          auto_generated?: boolean
          contact_email?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          metros?: Json | null
          org_name?: string
          presence_story?: string | null
          tenant_id?: string
          updated_at?: string
          visibility?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communio_public_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_public_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_public_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          request_id: string
          tenant_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          request_id: string
          tenant_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_replies_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "communio_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_requests: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          tenant_id: string
          title: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          tenant_id: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_resonance_snapshots: {
        Row: {
          archetype_key: string
          communio_participation_count: number
          computed_at: string
          created_at: string
          id: string
          metro_id: string | null
          resonant_keywords: string[]
          search_type: string
          signal_count: number
          tenant_count: number
          testimonium_themes: string[]
        }
        Insert: {
          archetype_key: string
          communio_participation_count?: number
          computed_at?: string
          created_at?: string
          id?: string
          metro_id?: string | null
          resonant_keywords?: string[]
          search_type: string
          signal_count?: number
          tenant_count?: number
          testimonium_themes?: string[]
        }
        Update: {
          archetype_key?: string
          communio_participation_count?: number
          computed_at?: string
          created_at?: string
          id?: string
          metro_id?: string | null
          resonant_keywords?: string[]
          search_type?: string
          signal_count?: number
          tenant_count?: number
          testimonium_themes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "communio_resonance_snapshots_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "communio_resonance_snapshots_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_shared_events: {
        Row: {
          created_at: string
          event_id: string
          group_id: string
          id: string
          tenant_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          event_id: string
          group_id: string
          id?: string
          tenant_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          group_id?: string
          id?: string
          tenant_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_shared_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_shared_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_shared_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_shared_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_shared_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_shared_signals: {
        Row: {
          created_at: string
          group_id: string
          id: string
          metro_id: string | null
          signal_summary: string
          signal_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          metro_id?: string | null
          signal_summary: string
          signal_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          metro_id?: string | null
          signal_summary?: string
          signal_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_shared_signals_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_shared_signals_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "communio_shared_signals_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_shared_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_shared_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communio_shared_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_signal_metrics: {
        Row: {
          drift_count: number
          group_id: string
          growth_count: number
          id: string
          momentum_count: number
          reconnection_count: number
          shared_event_count: number
          tenant_count: number
          week_start: string
        }
        Insert: {
          drift_count?: number
          group_id: string
          growth_count?: number
          id?: string
          momentum_count?: number
          reconnection_count?: number
          shared_event_count?: number
          tenant_count?: number
          week_start: string
        }
        Update: {
          drift_count?: number
          group_id?: string
          growth_count?: number
          id?: string
          momentum_count?: number
          reconnection_count?: number
          shared_event_count?: number
          tenant_count?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "communio_signal_metrics_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      communio_trend_rollups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          metro_id: string | null
          signal_type: string
          weekly_count: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          metro_id?: string | null
          signal_type: string
          weekly_count?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          metro_id?: string | null
          signal_type?: string
          weekly_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "communio_trend_rollups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "communio_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communio_trend_rollups_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "communio_trend_rollups_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_absorption_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          invite_id: string | null
          relationship_strategy: string
          selected_contact_ids: string[]
          selected_opportunity_ids: string[]
          source_tenant_id: string
          status: string
          target_tenant_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invite_id?: string | null
          relationship_strategy?: string
          selected_contact_ids?: string[]
          selected_opportunity_ids?: string[]
          source_tenant_id: string
          status?: string
          target_tenant_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invite_id?: string | null
          relationship_strategy?: string
          selected_contact_ids?: string[]
          selected_opportunity_ids?: string[]
          source_tenant_id?: string
          status?: string
          target_tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_absorption_requests_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "tenant_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companion_absorption_requests_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "companion_absorption_requests_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "companion_absorption_requests_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companion_absorption_requests_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "companion_absorption_requests_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "companion_absorption_requests_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compass_user_state: {
        Row: {
          dismissed_date: string
          dismissed_nudge_ids: Json
          guide_completed_at: string | null
          guide_sections_seen: string[] | null
          last_auto_open_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          dismissed_date?: string
          dismissed_nudge_ids?: Json
          guide_completed_at?: string | null
          guide_sections_seen?: string[] | null
          last_auto_open_at?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          dismissed_date?: string
          dismissed_nudge_ids?: Json
          guide_completed_at?: string | null
          guide_sections_seen?: string[] | null
          last_auto_open_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connector_simulation_profiles: {
        Row: {
          active: boolean
          behavior: Json
          connector_key: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          profile_key: string
          seed: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          behavior?: Json
          connector_key: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          profile_key: string
          seed?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          behavior?: Json
          connector_key?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          profile_key?: string
          seed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connector_simulation_profiles_connector_key_fkey"
            columns: ["connector_key"]
            isOneToOne: false
            referencedRelation: "integration_connectors"
            referencedColumns: ["key"]
          },
        ]
      }
      contact_household_members: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          linked_contact_id: string | null
          name: string
          notes: string | null
          relationship: string | null
          tenant_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          linked_contact_id?: string | null
          name: string
          notes?: string | null
          relationship?: string | null
          tenant_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          linked_contact_id?: string | null
          name?: string
          notes?: string | null
          relationship?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_household_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_household_members_linked_contact_id_fkey"
            columns: ["linked_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_suggestions: {
        Row: {
          applied_indices: number[]
          created_at: string
          dismissed_at: string | null
          entity_id: string
          entity_type: string
          id: string
          run_id: string
          source_url: string
          status: string
          suggestions: Json
          updated_at: string
        }
        Insert: {
          applied_indices?: number[]
          created_at?: string
          dismissed_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          run_id: string
          source_url: string
          status?: string
          suggestions?: Json
          updated_at?: string
        }
        Update: {
          applied_indices?: number[]
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          run_id?: string
          source_url?: string
          status?: string
          suggestions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      contact_tasks: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          source: string | null
          source_meeting_note_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          source?: string | null
          source_meeting_note_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          source?: string | null
          source_meeting_note_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tasks_source_meeting_note_id_fkey"
            columns: ["source_meeting_note_id"]
            isOneToOne: false
            referencedRelation: "meeting_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          bio: string | null
          care_status: string
          clifton_strengths: Json | null
          closing_reflection: string | null
          completion_date: string | null
          contact_id: string
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          date_of_passing: string | null
          deleted_at: string | null
          deleted_by: string | null
          disc_profile: string | null
          do_not_email: boolean
          email: string | null
          enneagram_confidence: number | null
          enneagram_scores: Json | null
          enneagram_source: string | null
          enneagram_type: number | null
          enneagram_wing: number | null
          external_ids: Json
          family_members: Json | null
          has_family: boolean
          has_given_financially: boolean
          id: string
          interests: Json | null
          is_person_in_need: boolean
          is_primary: boolean | null
          languages: Json | null
          met_at_event_id: string | null
          name: string
          notes: string | null
          opportunity_id: string | null
          origin_type: string
          person_type: string
          phone: string | null
          primary_metro_id: string | null
          priority_score: number | null
          skills: Json | null
          slug: string | null
          source_contact_id: string | null
          source_user_id: string | null
          tenant_id: string | null
          title: string | null
          updated_at: string | null
          zodiac_element: string | null
          zodiac_modality: string | null
          zodiac_sign: string | null
        }
        Insert: {
          bio?: string | null
          care_status?: string
          clifton_strengths?: Json | null
          closing_reflection?: string | null
          completion_date?: string | null
          contact_id?: string
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          date_of_passing?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          disc_profile?: string | null
          do_not_email?: boolean
          email?: string | null
          enneagram_confidence?: number | null
          enneagram_scores?: Json | null
          enneagram_source?: string | null
          enneagram_type?: number | null
          enneagram_wing?: number | null
          external_ids?: Json
          family_members?: Json | null
          has_family?: boolean
          has_given_financially?: boolean
          id?: string
          interests?: Json | null
          is_person_in_need?: boolean
          is_primary?: boolean | null
          languages?: Json | null
          met_at_event_id?: string | null
          name: string
          notes?: string | null
          opportunity_id?: string | null
          origin_type?: string
          person_type?: string
          phone?: string | null
          primary_metro_id?: string | null
          priority_score?: number | null
          skills?: Json | null
          slug?: string | null
          source_contact_id?: string | null
          source_user_id?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
          zodiac_element?: string | null
          zodiac_modality?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          bio?: string | null
          care_status?: string
          clifton_strengths?: Json | null
          closing_reflection?: string | null
          completion_date?: string | null
          contact_id?: string
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          date_of_passing?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          disc_profile?: string | null
          do_not_email?: boolean
          email?: string | null
          enneagram_confidence?: number | null
          enneagram_scores?: Json | null
          enneagram_source?: string | null
          enneagram_type?: number | null
          enneagram_wing?: number | null
          external_ids?: Json
          family_members?: Json | null
          has_family?: boolean
          has_given_financially?: boolean
          id?: string
          interests?: Json | null
          is_person_in_need?: boolean
          is_primary?: boolean | null
          languages?: Json | null
          met_at_event_id?: string | null
          name?: string
          notes?: string | null
          opportunity_id?: string | null
          origin_type?: string
          person_type?: string
          phone?: string | null
          primary_metro_id?: string | null
          priority_score?: number | null
          skills?: Json | null
          slug?: string | null
          source_contact_id?: string | null
          source_user_id?: string | null
          tenant_id?: string | null
          title?: string | null
          updated_at?: string | null
          zodiac_element?: string | null
          zodiac_modality?: string | null
          zodiac_sign?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_met_at_event_id_fkey"
            columns: ["met_at_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "contacts_primary_metro_id_fkey"
            columns: ["primary_metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "contacts_primary_metro_id_fkey"
            columns: ["primary_metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_source_contact_id_fkey"
            columns: ["source_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_approval_log: {
        Row: {
          actor: string | null
          draft_id: string
          from_status: string | null
          id: number
          notes: string | null
          occurred_at: string
          source_app: string
          to_status: string
        }
        Insert: {
          actor?: string | null
          draft_id: string
          from_status?: string | null
          id?: number
          notes?: string | null
          occurred_at?: string
          source_app: string
          to_status: string
        }
        Update: {
          actor?: string | null
          draft_id?: string
          from_status?: string | null
          id?: number
          notes?: string | null
          occurred_at?: string
          source_app?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_approval_log_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "operator_content_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      cros_import_mappings: {
        Row: {
          batch_id: string
          created_at: string
          entity: string
          id: string
          source_id: string
          target_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          entity: string
          id?: string
          source_id: string
          target_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          entity?: string
          id?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cros_import_mappings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_import_history: {
        Row: {
          created_count: number
          file_name: string | null
          id: string
          import_type: string
          imported_at: string
          imported_by: string | null
          is_rolled_back: boolean
          rolled_back_at: string | null
          rolled_back_by: string | null
          total_rows: number
          updated_count: number
        }
        Insert: {
          created_count?: number
          file_name?: string | null
          id?: string
          import_type: string
          imported_at?: string
          imported_by?: string | null
          is_rolled_back?: boolean
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          total_rows?: number
          updated_count?: number
        }
        Update: {
          created_count?: number
          file_name?: string | null
          id?: string
          import_type?: string
          imported_at?: string
          imported_by?: string | null
          is_rolled_back?: boolean
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          total_rows?: number
          updated_count?: number
        }
        Relationships: []
      }
      csv_import_records: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          import_id: string
          operation: string
          previous_data: Json | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          import_id: string
          operation: string
          previous_data?: Json | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          import_id?: string
          operation?: string
          previous_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "csv_import_records_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "csv_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_scenarios: {
        Row: {
          created_at: string
          default_seed_profile: string
          description: string
          display_name: string
          enabled: boolean
          key: string
        }
        Insert: {
          created_at?: string
          default_seed_profile: string
          description: string
          display_name: string
          enabled?: boolean
          key: string
        }
        Update: {
          created_at?: string
          default_seed_profile?: string
          description?: string
          display_name?: string
          enabled?: boolean
          key?: string
        }
        Relationships: []
      }
      demo_seed_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          demo_tenant_id: string
          error: Json | null
          id: string
          run_key: string
          stats: Json
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          demo_tenant_id: string
          error?: Json | null
          id?: string
          run_key: string
          stats?: Json
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          demo_tenant_id?: string
          error?: Json | null
          id?: string
          run_key?: string
          stats?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_seed_runs_demo_tenant_id_fkey"
            columns: ["demo_tenant_id"]
            isOneToOne: false
            referencedRelation: "demo_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_tenants: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          is_demo: boolean
          name: string
          seed_profile: string
          seed_version: number
          slug: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          is_demo?: boolean
          name: string
          seed_profile: string
          seed_version?: number
          slug: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          is_demo?: boolean
          name?: string
          seed_profile?: string
          seed_version?: number
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "demo_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "demo_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_items: {
        Row: {
          ai_processing_state: string | null
          canonical_url: string
          event_date: string | null
          extracted: Json
          fingerprints: Json
          first_seen_at: string
          id: string
          is_active: boolean
          last_run_id: string | null
          last_seen_at: string
          module: string
          organization_name: string | null
          published_date: string | null
          snippet: string | null
          source_url: string | null
          tenant_id: string | null
          title: string | null
        }
        Insert: {
          ai_processing_state?: string | null
          canonical_url: string
          event_date?: string | null
          extracted?: Json
          fingerprints?: Json
          first_seen_at?: string
          id?: string
          is_active?: boolean
          last_run_id?: string | null
          last_seen_at?: string
          module: string
          organization_name?: string | null
          published_date?: string | null
          snippet?: string | null
          source_url?: string | null
          tenant_id?: string | null
          title?: string | null
        }
        Update: {
          ai_processing_state?: string | null
          canonical_url?: string
          event_date?: string | null
          extracted?: Json
          fingerprints?: Json
          first_seen_at?: string
          id?: string
          is_active?: boolean
          last_run_id?: string | null
          last_seen_at?: string
          module?: string
          organization_name?: string | null
          published_date?: string | null
          snippet?: string | null
          source_url?: string | null
          tenant_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_items_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discovered_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discovered_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_briefings: {
        Row: {
          briefing_json: Json
          briefing_md: string
          created_at: string
          id: string
          metro_id: string | null
          module: string
          opportunity_id: string | null
          run_id: string
          scope: string
          tenant_id: string | null
        }
        Insert: {
          briefing_json?: Json
          briefing_md: string
          created_at?: string
          id?: string
          metro_id?: string | null
          module: string
          opportunity_id?: string | null
          run_id: string
          scope: string
          tenant_id?: string | null
        }
        Update: {
          briefing_json?: Json
          briefing_md?: string
          created_at?: string
          id?: string
          metro_id?: string | null
          module?: string
          opportunity_id?: string | null
          run_id?: string
          scope?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_briefings_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "discovery_briefings_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_briefings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_briefings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "discovery_briefings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_briefings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discovery_briefings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discovery_briefings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_highlights: {
        Row: {
          created_at: string
          id: string
          kind: string
          module: string
          payload: Json
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          module: string
          payload?: Json
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          module?: string
          payload?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_highlights_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_item_links: {
        Row: {
          created_at: string
          discovered_item_id: string
          id: string
          metro_id: string | null
          opportunity_id: string | null
          reason: string | null
          relevance_score: number
        }
        Insert: {
          created_at?: string
          discovered_item_id: string
          id?: string
          metro_id?: string | null
          opportunity_id?: string | null
          reason?: string | null
          relevance_score?: number
        }
        Update: {
          created_at?: string
          discovered_item_id?: string
          id?: string
          metro_id?: string | null
          opportunity_id?: string | null
          reason?: string | null
          relevance_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "discovery_item_links_discovered_item_id_fkey"
            columns: ["discovered_item_id"]
            isOneToOne: false
            referencedRelation: "discovered_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_item_links_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "discovery_item_links_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_item_links_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_item_links_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: Json | null
          id: string
          metro_id: string | null
          module: string
          opportunity_id: string | null
          query_profile: Json
          scope: string
          started_at: string | null
          stats: Json
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          metro_id?: string | null
          module: string
          opportunity_id?: string | null
          query_profile?: Json
          scope: string
          started_at?: string | null
          stats?: Json
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          metro_id?: string | null
          module?: string
          opportunity_id?: string | null
          query_profile?: Json
          scope?: string
          started_at?: string | null
          stats?: Json
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "discovery_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_runs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_runs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "discovery_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discovery_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discovery_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_signals: {
        Row: {
          content_key: string | null
          created_at: string
          id: string
          search_result_id: string
          search_type: string | null
          signal_type: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          content_key?: string | null
          created_at?: string
          id?: string
          search_result_id: string
          search_type?: string | null
          signal_type: string
          tenant_id: string
          user_id: string
        }
        Update: {
          content_key?: string | null
          created_at?: string
          id?: string
          search_result_id?: string
          search_type?: string | null
          signal_type?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_signals_search_result_id_fkey"
            columns: ["search_result_id"]
            isOneToOne: false
            referencedRelation: "search_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discovery_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discovery_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_attachments: {
        Row: {
          attached_by: string | null
          contact_id: string | null
          created_at: string
          document_id: string
          id: string
          opportunity_id: string | null
        }
        Insert: {
          attached_by?: string | null
          contact_id?: string | null
          created_at?: string
          document_id: string
          id?: string
          opportunity_id?: string | null
        }
        Update: {
          attached_by?: string | null
          contact_id?: string | null
          created_at?: string
          document_id?: string
          id?: string
          opportunity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_attachments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          name: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      ecosystem_edges: {
        Row: {
          created_at: string
          edge_type: string
          from_node: string
          id: string
          to_node: string
          weight: number
        }
        Insert: {
          created_at?: string
          edge_type: string
          from_node: string
          id?: string
          to_node: string
          weight?: number
        }
        Update: {
          created_at?: string
          edge_type?: string
          from_node?: string
          id?: string
          to_node?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_edges_from_node_fkey"
            columns: ["from_node"]
            isOneToOne: false
            referencedRelation: "ecosystem_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecosystem_edges_to_node_fkey"
            columns: ["to_node"]
            isOneToOne: false
            referencedRelation: "ecosystem_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      ecosystem_health_rollups: {
        Row: {
          archetype: string
          communio_shares: number
          created_at: string
          events_count: number
          id: string
          reflections_count: number
          tenant_id: string
          testimonium_flags: Json
          week_start: string
        }
        Insert: {
          archetype: string
          communio_shares?: number
          created_at?: string
          events_count?: number
          id?: string
          reflections_count?: number
          tenant_id: string
          testimonium_flags?: Json
          week_start: string
        }
        Update: {
          archetype?: string
          communio_shares?: number
          created_at?: string
          events_count?: number
          id?: string
          reflections_count?: number
          tenant_id?: string
          testimonium_flags?: Json
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_health_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ecosystem_health_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ecosystem_health_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ecosystem_nodes: {
        Row: {
          created_at: string
          id: string
          metro_id: string | null
          node_type: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metro_id?: string | null
          node_type: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metro_id?: string | null
          node_type?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_nodes_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "ecosystem_nodes_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecosystem_nodes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ecosystem_nodes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ecosystem_nodes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_metrics: {
        Row: {
          correlation_id: string | null
          created_at: string
          duration_ms: number
          error_message: string | null
          function_name: string
          id: string
          metadata: Json | null
          status_code: number | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          duration_ms: number
          error_message?: string | null
          function_name: string
          id?: string
          metadata?: Json | null
          status_code?: number | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          function_name?: string
          id?: string
          metadata?: Json | null
          status_code?: number | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      edge_function_rate_limits: {
        Row: {
          created_at: string | null
          function_name: string
          id: string
          request_count: number | null
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string | null
          function_name: string
          id?: string
          request_count?: number | null
          user_id: string
          window_start: string
        }
        Update: {
          created_at?: string | null
          function_name?: string
          id?: string
          request_count?: number | null
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      editor_ai_suggestions: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          ai_model: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          original_version_id: string | null
          prompt_type: string
          proposed_patch_json: Json
          reasoning_text: string | null
          rejected_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          ai_model?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          original_version_id?: string | null
          prompt_type: string
          proposed_patch_json: Json
          reasoning_text?: string | null
          rejected_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          ai_model?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          original_version_id?: string | null
          prompt_type?: string
          proposed_patch_json?: Json
          reasoning_text?: string | null
          rejected_at?: string | null
        }
        Relationships: []
      }
      editorial_recommendations: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          created_at: string
          created_draft_id: string | null
          editorial_mode: string
          id: string
          movement_sources: Json
          reason: string
          signal_strength: string
          status: string
          tenant_count: number
          title: string
          updated_at: string
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          created_at?: string
          created_draft_id?: string | null
          editorial_mode?: string
          id?: string
          movement_sources?: Json
          reason: string
          signal_strength?: string
          status?: string
          tenant_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          created_at?: string
          created_draft_id?: string | null
          editorial_mode?: string
          id?: string
          movement_sources?: Json
          reason?: string
          signal_strength?: string
          status?: string
          tenant_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_recommendations_created_draft_id_fkey"
            columns: ["created_draft_id"]
            isOneToOne: false
            referencedRelation: "operator_content_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_audience: {
        Row: {
          campaign_id: string
          contact_id: string | null
          created_at: string | null
          email: string
          error_message: string | null
          failure_category: string | null
          failure_code: string | null
          failure_raw: string | null
          fingerprint: string | null
          id: string
          name: string | null
          opportunity_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          source: string
          status: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          created_at?: string | null
          email: string
          error_message?: string | null
          failure_category?: string | null
          failure_code?: string | null
          failure_raw?: string | null
          fingerprint?: string | null
          id?: string
          name?: string | null
          opportunity_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          source: string
          status?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          created_at?: string | null
          email?: string
          error_message?: string | null
          failure_category?: string | null
          failure_code?: string | null
          failure_raw?: string | null
          fingerprint?: string | null
          id?: string
          name?: string | null
          opportunity_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_audience_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_audience_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_events: {
        Row: {
          audience_id: string | null
          campaign_id: string
          created_at: string | null
          event_type: string
          id: string
          message: string | null
          meta: Json | null
          provider: string | null
        }
        Insert: {
          audience_id?: string | null
          campaign_id: string
          created_at?: string | null
          event_type: string
          id?: string
          message?: string | null
          meta?: Json | null
          provider?: string | null
        }
        Update: {
          audience_id?: string | null
          campaign_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          message?: string | null
          meta?: Json | null
          provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_events_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_audience"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_events_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "resend_candidates_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_risk_eval: {
        Row: {
          audience_size: number
          campaign_id: string
          evaluated_at: string
          inputs_hash: string
          org_success_rate: number | null
          risk_level: string
          risk_reasons: string[]
          subject_reuse_count: number | null
          transient_failure_rate: number | null
        }
        Insert: {
          audience_size: number
          campaign_id: string
          evaluated_at?: string
          inputs_hash: string
          org_success_rate?: number | null
          risk_level: string
          risk_reasons: string[]
          subject_reuse_count?: number | null
          transient_failure_rate?: number | null
        }
        Update: {
          audience_size?: number
          campaign_id?: string
          evaluated_at?: string
          inputs_hash?: string
          org_success_rate?: number | null
          risk_level?: string
          risk_reasons?: string[]
          subject_reuse_count?: number | null
          transient_failure_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_risk_eval_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_send_intents: {
        Row: {
          acked_at: string | null
          campaign_id: string
          consumed_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          intent_status: string
          rationale: string | null
          requires_ack: boolean
          risk_level: string
          risk_reasons: string[]
        }
        Insert: {
          acked_at?: string | null
          campaign_id: string
          consumed_at?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          intent_status?: string
          rationale?: string | null
          requires_ack?: boolean
          risk_level?: string
          risk_reasons?: string[]
        }
        Update: {
          acked_at?: string | null
          campaign_id?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          intent_status?: string
          rationale?: string | null
          requires_ack?: boolean
          risk_level?: string
          risk_reasons?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_send_intents_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          audience_count: number
          created_at: string | null
          created_by: string
          failed_count: number
          federation_app_slug: string | null
          from_email: string | null
          from_name: string | null
          html_body: string | null
          id: string
          last_sent_at: string | null
          metadata: Json | null
          name: string
          preheader: string | null
          reply_to: string | null
          scheduled_at: string | null
          segment_id: string | null
          sent_count: number
          status: Database["public"]["Enums"]["email_campaign_status"]
          subject: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          audience_count?: number
          created_at?: string | null
          created_by: string
          failed_count?: number
          federation_app_slug?: string | null
          from_email?: string | null
          from_name?: string | null
          html_body?: string | null
          id?: string
          last_sent_at?: string | null
          metadata?: Json | null
          name: string
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["email_campaign_status"]
          subject: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          audience_count?: number
          created_at?: string | null
          created_by?: string
          failed_count?: number
          federation_app_slug?: string | null
          from_email?: string | null
          from_name?: string | null
          html_body?: string | null
          id?: string
          last_sent_at?: string | null
          metadata?: Json | null
          name?: string
          preheader?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["email_campaign_status"]
          subject?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_federation_app_slug_fkey"
            columns: ["federation_app_slug"]
            isOneToOne: false
            referencedRelation: "federation_apps"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "email_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "email_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_communications: {
        Row: {
          ai_analyzed_at: string | null
          ai_processing_state: string | null
          ai_run_id: string | null
          body_preview: string | null
          contact_id: string | null
          created_at: string
          gmail_message_id: string
          id: string
          is_in_inbox: boolean
          recipient_email: string
          sender_email: string
          sent_at: string
          snippet: string | null
          subject: string | null
          synced_at: string
          tenant_id: string | null
          thread_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_processing_state?: string | null
          ai_run_id?: string | null
          body_preview?: string | null
          contact_id?: string | null
          created_at?: string
          gmail_message_id: string
          id?: string
          is_in_inbox?: boolean
          recipient_email: string
          sender_email: string
          sent_at: string
          snippet?: string | null
          subject?: string | null
          synced_at?: string
          tenant_id?: string | null
          thread_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_processing_state?: string | null
          ai_run_id?: string | null
          body_preview?: string | null
          contact_id?: string | null
          created_at?: string
          gmail_message_id?: string
          id?: string
          is_in_inbox?: boolean
          recipient_email?: string
          sender_email?: string
          sent_at?: string
          snippet?: string | null
          subject?: string | null
          synced_at?: string
          tenant_id?: string | null
          thread_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_segments: {
        Row: {
          created_at: string | null
          created_by: string
          definition: Json
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          definition: Json
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          definition?: Json
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      email_send_limits: {
        Row: {
          created_at: string
          current_count: number
          daily_limit: number
          email_address: string
          hard_limit: number
          id: string
          provider: string
          soft_limit: number
          tenant_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          current_count?: number
          daily_limit?: number
          email_address: string
          hard_limit?: number
          id?: string
          provider: string
          soft_limit?: number
          tenant_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          current_count?: number
          daily_limit?: number
          email_address?: string
          hard_limit?: number
          id?: string
          provider?: string
          soft_limit?: number
          tenant_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_limits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_send_limits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_send_limits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_story_signals: {
        Row: {
          confidence: number | null
          created_at: string
          email_message_id: string
          id: string
          opportunity_id: string | null
          signal_type: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          email_message_id: string
          id?: string
          opportunity_id?: string | null
          signal_type: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          email_message_id?: string
          id?: string
          opportunity_id?: string | null
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_story_signals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_story_signals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          metadata: Json
          reason: string
          source: string
          source_connector: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          metadata?: Json
          reason?: string
          source?: string
          source_connector?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          metadata?: Json
          reason?: string
          source?: string
          source_connector?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_suppressions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_suppressions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_suppressions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_task_suggestions: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string
          dedupe_key: string
          email_id: string
          email_thread_id: string | null
          extracted_spans: Json
          id: string
          opportunity_id: string
          status: string
          suggested_description: string | null
          suggested_due_date: string | null
          suggested_title: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by: string
          dedupe_key: string
          email_id: string
          email_thread_id?: string | null
          extracted_spans?: Json
          id?: string
          opportunity_id: string
          status?: string
          suggested_description?: string | null
          suggested_due_date?: string | null
          suggested_title: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string
          dedupe_key?: string
          email_id?: string
          email_thread_id?: string | null
          extracted_spans?: Json
          id?: string
          opportunity_id?: string
          status?: string
          suggested_description?: string | null
          suggested_due_date?: string | null
          suggested_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_task_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_task_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      email_template_presets: {
        Row: {
          active: boolean
          created_at: string
          defaults: Json
          id: string
          key: string
          name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          defaults: Json
          id?: string
          key: string
          name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          defaults?: Json
          id?: string
          key?: string
          name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enrichment_jobs: {
        Row: {
          attempts: number
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_error: string | null
          lease_expires_at: string | null
          leased_by: string | null
          run_id: string
          source_url: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          leased_by?: string | null
          run_id: string
          source_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          leased_by?: string | null
          run_id?: string
          source_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrichment_results: {
        Row: {
          enrichment: Json
          entity_id: string
          entity_type: string
          error: Json | null
          id: string
          occurred_at: string
          received_at: string
          run_id: string
          scrape_bytes: number
          scrape_ok: boolean
          source_url: string
          status: string
          workflow: string
        }
        Insert: {
          enrichment?: Json
          entity_id: string
          entity_type: string
          error?: Json | null
          id?: string
          occurred_at: string
          received_at?: string
          run_id: string
          scrape_bytes?: number
          scrape_ok: boolean
          source_url: string
          status: string
          workflow: string
        }
        Update: {
          enrichment?: Json
          entity_id?: string
          entity_type?: string
          error?: Json | null
          id?: string
          occurred_at?: string
          received_at?: string
          run_id?: string
          scrape_bytes?: number
          scrape_ok?: boolean
          source_url?: string
          status?: string
          workflow?: string
        }
        Relationships: []
      }
      entity_richness_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          richness_level: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          richness_level: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          richness_level?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_richness_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "entity_richness_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "entity_richness_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          prompt: string
          seo_meta: Json
          source_app: string | null
          updated_at: string
          voice_notes: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          prompt: string
          seo_meta?: Json
          source_app?: string | null
          updated_at?: string
          voice_notes?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          prompt?: string
          seo_meta?: Json
          source_app?: string | null
          updated_at?: string
          voice_notes?: string | null
        }
        Relationships: []
      }
      event_attendance: {
        Row: {
          attendance_type: string
          created_at: string
          event_discovered_item_id: string
          evidence_snippet: string | null
          evidence_url: string | null
          id: string
          opportunity_id: string
          run_id: string
        }
        Insert: {
          attendance_type?: string
          created_at?: string
          event_discovered_item_id: string
          evidence_snippet?: string | null
          evidence_url?: string | null
          id?: string
          opportunity_id: string
          run_id: string
        }
        Update: {
          attendance_type?: string
          created_at?: string
          event_discovered_item_id?: string
          evidence_snippet?: string | null
          evidence_url?: string | null
          id?: string
          opportunity_id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_discovered_item_id_fkey"
            columns: ["event_discovered_item_id"]
            isOneToOne: false
            referencedRelation: "discovered_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "event_attendance_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          event_id: string
          id: string
          import_batch_id: string | null
          is_target: boolean | null
          linkedin_url: string | null
          match_status: string
          matched_contact_id: string | null
          matched_opportunity_id: string | null
          raw_email: string | null
          raw_full_name: string
          raw_org: string | null
          raw_phone: string | null
          raw_title: string | null
          tags: Json | null
          target_reasons: Json | null
          target_score: number | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          event_id: string
          id?: string
          import_batch_id?: string | null
          is_target?: boolean | null
          linkedin_url?: string | null
          match_status?: string
          matched_contact_id?: string | null
          matched_opportunity_id?: string | null
          raw_email?: string | null
          raw_full_name: string
          raw_org?: string | null
          raw_phone?: string | null
          raw_title?: string | null
          tags?: Json | null
          target_reasons?: Json | null
          target_score?: number | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          event_id?: string
          id?: string
          import_batch_id?: string | null
          is_target?: boolean | null
          linkedin_url?: string | null
          match_status?: string
          matched_contact_id?: string | null
          matched_opportunity_id?: string | null
          raw_email?: string | null
          raw_full_name?: string
          raw_org?: string | null
          raw_phone?: string | null
          raw_title?: string | null
          tags?: Json | null
          target_reasons?: Json | null
          target_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_matched_contact_id_fkey"
            columns: ["matched_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_matched_opportunity_id_fkey"
            columns: ["matched_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_matched_opportunity_id_fkey"
            columns: ["matched_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      event_pcs_goals: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_reflection_extractions: {
        Row: {
          created_at: string
          id: string
          model: string | null
          partner_mentions: string[]
          reflection_id: string
          signals: Json
          summary_safe: string
          topics: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          partner_mentions?: string[]
          reflection_id: string
          signals?: Json
          summary_safe?: string
          topics?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          partner_mentions?: string[]
          reflection_id?: string
          signals?: Json
          summary_safe?: string
          topics?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reflection_extractions_reflection_id_fkey"
            columns: ["reflection_id"]
            isOneToOne: true
            referencedRelation: "event_reflections"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reflections: {
        Row: {
          author_id: string
          body: string
          created_at: string
          event_id: string
          id: string
          opportunity_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          event_id: string
          id?: string
          opportunity_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          opportunity_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reflections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reflections_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reflections_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      event_registration_fields: {
        Row: {
          created_at: string
          event_id: string
          field_type: Database["public"]["Enums"]["registration_field_type"]
          id: string
          label: string
          options: Json | null
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          field_type?: Database["public"]["Enums"]["registration_field_type"]
          id?: string
          label: string
          options?: Json | null
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          field_type?: Database["public"]["Enums"]["registration_field_type"]
          id?: string
          label?: string
          options?: Json | null
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_fields_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "event_registration_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "event_registration_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          answers: Json | null
          contact_id: string | null
          created_at: string
          event_id: string
          guest_email: string
          guest_name: string
          guest_phone: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          answers?: Json | null
          contact_id?: string | null
          created_at?: string
          event_id: string
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          answers?: Json | null
          contact_id?: string | null
          created_at?: string
          event_id?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "event_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "event_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_strategic_lanes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_target_populations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          anchor_identified_yn: boolean | null
          anchor_potential: string | null
          attended: boolean | null
          attended_at: string | null
          attended_by: string | null
          attendee_count: number | null
          capacity: number | null
          city: string | null
          conference_plan_generated_at: string | null
          conference_plan_json: Json | null
          cost_estimated: number | null
          cover_image_url: string | null
          created_at: string | null
          date_confidence: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          devices_distributed: number | null
          end_date: string | null
          event_date: string | null
          event_id: string
          event_name: string
          event_type: string | null
          expected_households: string | null
          expected_referrals: string | null
          external_ids: Json
          extraction_status: string
          followup_meeting_yn: boolean | null
          google_calendar_event_id: string | null
          google_calendar_synced_at: string | null
          grant_narrative_value:
            | Database["public"]["Enums"]["grant_narrative_value"]
            | null
          host_opportunity_id: string | null
          host_organization: string | null
          households_served: number | null
          id: string
          internet_signups: number | null
          is_conference: boolean | null
          is_local_pulse: boolean
          is_paid: boolean
          is_recurring: boolean | null
          location: string | null
          metadata: Json | null
          metro_id: string | null
          needs_review: boolean
          notes: string | null
          payment_link_id: string | null
          pcs_goals: string[] | null
          price_cents: number | null
          priority: string | null
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          referrals_generated: number | null
          roi_calculated_at: string | null
          roi_score: number | null
          slug: string | null
          staff_deployed: number | null
          status: string | null
          strategic_lanes: string[] | null
          target_populations: string[] | null
          tenant_id: string | null
          travel_required: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          anchor_identified_yn?: boolean | null
          anchor_potential?: string | null
          attended?: boolean | null
          attended_at?: string | null
          attended_by?: string | null
          attendee_count?: number | null
          capacity?: number | null
          city?: string | null
          conference_plan_generated_at?: string | null
          conference_plan_json?: Json | null
          cost_estimated?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          date_confidence?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          devices_distributed?: number | null
          end_date?: string | null
          event_date?: string | null
          event_id: string
          event_name: string
          event_type?: string | null
          expected_households?: string | null
          expected_referrals?: string | null
          external_ids?: Json
          extraction_status?: string
          followup_meeting_yn?: boolean | null
          google_calendar_event_id?: string | null
          google_calendar_synced_at?: string | null
          grant_narrative_value?:
            | Database["public"]["Enums"]["grant_narrative_value"]
            | null
          host_opportunity_id?: string | null
          host_organization?: string | null
          households_served?: number | null
          id?: string
          internet_signups?: number | null
          is_conference?: boolean | null
          is_local_pulse?: boolean
          is_paid?: boolean
          is_recurring?: boolean | null
          location?: string | null
          metadata?: Json | null
          metro_id?: string | null
          needs_review?: boolean
          notes?: string | null
          payment_link_id?: string | null
          pcs_goals?: string[] | null
          price_cents?: number | null
          priority?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          referrals_generated?: number | null
          roi_calculated_at?: string | null
          roi_score?: number | null
          slug?: string | null
          staff_deployed?: number | null
          status?: string | null
          strategic_lanes?: string[] | null
          target_populations?: string[] | null
          tenant_id?: string | null
          travel_required?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          anchor_identified_yn?: boolean | null
          anchor_potential?: string | null
          attended?: boolean | null
          attended_at?: string | null
          attended_by?: string | null
          attendee_count?: number | null
          capacity?: number | null
          city?: string | null
          conference_plan_generated_at?: string | null
          conference_plan_json?: Json | null
          cost_estimated?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          date_confidence?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          devices_distributed?: number | null
          end_date?: string | null
          event_date?: string | null
          event_id?: string
          event_name?: string
          event_type?: string | null
          expected_households?: string | null
          expected_referrals?: string | null
          external_ids?: Json
          extraction_status?: string
          followup_meeting_yn?: boolean | null
          google_calendar_event_id?: string | null
          google_calendar_synced_at?: string | null
          grant_narrative_value?:
            | Database["public"]["Enums"]["grant_narrative_value"]
            | null
          host_opportunity_id?: string | null
          host_organization?: string | null
          households_served?: number | null
          id?: string
          internet_signups?: number | null
          is_conference?: boolean | null
          is_local_pulse?: boolean
          is_paid?: boolean
          is_recurring?: boolean | null
          location?: string | null
          metadata?: Json | null
          metro_id?: string | null
          needs_review?: boolean
          notes?: string | null
          payment_link_id?: string | null
          pcs_goals?: string[] | null
          price_cents?: number | null
          priority?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          referrals_generated?: number | null
          roi_calculated_at?: string | null
          roi_score?: number | null
          slug?: string | null
          staff_deployed?: number | null
          status?: string | null
          strategic_lanes?: string[] | null
          target_populations?: string[] | null
          tenant_id?: string | null
          travel_required?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_host_opportunity_id_fkey"
            columns: ["host_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_host_opportunity_id_fkey"
            columns: ["host_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "events_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "events_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "tenant_payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expansion_moments: {
        Row: {
          acknowledged: boolean | null
          detected_at: string | null
          id: string
          score: number
          suggested: boolean | null
          tenant_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          detected_at?: string | null
          id?: string
          score?: number
          suggested?: boolean | null
          tenant_id: string
        }
        Update: {
          acknowledged?: boolean | null
          detected_at?: string | null
          id?: string
          score?: number
          suggested?: boolean | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expansion_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "expansion_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "expansion_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expansion_signals: {
        Row: {
          created_at: string | null
          id: string
          metro_id: string
          signal_type: string
          source_module: string
          tenant_id: string
          weight: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          metro_id: string
          signal_type: string
          source_module: string
          tenant_id: string
          weight?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          metro_id?: string
          signal_type?: string
          source_module?: string
          tenant_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "expansion_signals_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "expansion_signals_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expansion_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "expansion_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "expansion_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      familia_memberships: {
        Row: {
          created_at: string
          familia_id: string
          id: string
          role: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          familia_id: string
          id?: string
          role?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          familia_id?: string
          id?: string
          role?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_memberships_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familia_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "familia_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "familia_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      familia_suggestions: {
        Row: {
          candidate_hint: string
          candidate_tenant_id: string | null
          created_at: string
          id: string
          kinship_score: number
          reasons: Json
          status: string
          tenant_id: string
        }
        Insert: {
          candidate_hint?: string
          candidate_tenant_id?: string | null
          created_at?: string
          id?: string
          kinship_score?: number
          reasons?: Json
          status?: string
          tenant_id: string
        }
        Update: {
          candidate_hint?: string
          candidate_tenant_id?: string | null
          created_at?: string
          id?: string
          kinship_score?: number
          reasons?: Json
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_suggestions_candidate_tenant_id_fkey"
            columns: ["candidate_tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "familia_suggestions_candidate_tenant_id_fkey"
            columns: ["candidate_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "familia_suggestions_candidate_tenant_id_fkey"
            columns: ["candidate_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familia_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "familia_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "familia_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      familias: {
        Row: {
          created_at: string
          created_by_tenant_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by_tenant_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by_tenant_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "familias_created_by_tenant_id_fkey"
            columns: ["created_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "familias_created_by_tenant_id_fkey"
            columns: ["created_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "familias_created_by_tenant_id_fkey"
            columns: ["created_by_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
        }
        Relationships: []
      }
      federated_apps: {
        Row: {
          accent_color: string
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          ingest_secret_name: string | null
          ingest_url: string | null
          is_active: boolean
          is_hub: boolean
          public_base_url: string | null
          satellite_service_key_secret_name: string | null
          satellite_supabase_url: string | null
          source_app: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          description?: string | null
          display_name: string
          display_order?: number
          ingest_secret_name?: string | null
          ingest_url?: string | null
          is_active?: boolean
          is_hub?: boolean
          public_base_url?: string | null
          satellite_service_key_secret_name?: string | null
          satellite_supabase_url?: string | null
          source_app: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          ingest_secret_name?: string | null
          ingest_url?: string | null
          is_active?: boolean
          is_hub?: boolean
          public_base_url?: string | null
          satellite_service_key_secret_name?: string | null
          satellite_supabase_url?: string | null
          source_app?: string
          updated_at?: string
        }
        Relationships: []
      }
      federated_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          id: number
          ip: unknown
          occurred_at: string
          payload: Json
          resource: string | null
          source_app: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          id?: number
          ip?: unknown
          occurred_at?: string
          payload?: Json
          resource?: string | null
          source_app: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          id?: number
          ip?: unknown
          occurred_at?: string
          payload?: Json
          resource?: string | null
          source_app?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      federation_apps: {
        Row: {
          content_publish_url: string | null
          created_at: string
          created_by: string | null
          display_name: string
          federation_phase: string | null
          ga4_stream_id: string | null
          github_repo: string | null
          has_connect: boolean
          has_constellation_node: boolean
          has_content_engine: boolean
          has_lead_intake: boolean
          has_metro_pages: boolean
          has_seo_module: boolean
          hosting_platform: string
          ingest_essay_url: string | null
          is_critical: boolean
          last_publish_at: string | null
          last_publish_error: string | null
          launched_at: string | null
          lovable_project_id: string | null
          lovable_url: string | null
          metadata: Json
          notes: string | null
          primary_domain: string | null
          sentry_org_slug: string | null
          sentry_project_slug: string | null
          seo_active: boolean
          seo_secret_name: string | null
          short_description: string | null
          slug: string
          staging_domain: string | null
          status: string
          supabase_project_ref: string | null
          supabase_ref: string | null
          tagline: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          content_publish_url?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          federation_phase?: string | null
          ga4_stream_id?: string | null
          github_repo?: string | null
          has_connect?: boolean
          has_constellation_node?: boolean
          has_content_engine?: boolean
          has_lead_intake?: boolean
          has_metro_pages?: boolean
          has_seo_module?: boolean
          hosting_platform?: string
          ingest_essay_url?: string | null
          is_critical?: boolean
          last_publish_at?: string | null
          last_publish_error?: string | null
          launched_at?: string | null
          lovable_project_id?: string | null
          lovable_url?: string | null
          metadata?: Json
          notes?: string | null
          primary_domain?: string | null
          sentry_org_slug?: string | null
          sentry_project_slug?: string | null
          seo_active?: boolean
          seo_secret_name?: string | null
          short_description?: string | null
          slug: string
          staging_domain?: string | null
          status?: string
          supabase_project_ref?: string | null
          supabase_ref?: string | null
          tagline?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          content_publish_url?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          federation_phase?: string | null
          ga4_stream_id?: string | null
          github_repo?: string | null
          has_connect?: boolean
          has_constellation_node?: boolean
          has_content_engine?: boolean
          has_lead_intake?: boolean
          has_metro_pages?: boolean
          has_seo_module?: boolean
          hosting_platform?: string
          ingest_essay_url?: string | null
          is_critical?: boolean
          last_publish_at?: string | null
          last_publish_error?: string | null
          launched_at?: string | null
          lovable_project_id?: string | null
          lovable_url?: string | null
          metadata?: Json
          notes?: string | null
          primary_domain?: string | null
          sentry_org_slug?: string | null
          sentry_project_slug?: string | null
          seo_active?: boolean
          seo_secret_name?: string | null
          short_description?: string | null
          slug?: string
          staging_domain?: string | null
          status?: string
          supabase_project_ref?: string | null
          supabase_ref?: string | null
          tagline?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      federation_ga_orphan_properties: {
        Row: {
          created_at: string
          display_label: string
          notes: string | null
          property_id: string
        }
        Insert: {
          created_at?: string
          display_label: string
          notes?: string | null
          property_id: string
        }
        Update: {
          created_at?: string
          display_label?: string
          notes?: string | null
          property_id?: string
        }
        Relationships: []
      }
      federation_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      feedback_attachments: {
        Row: {
          created_at: string
          feedback_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          feedback_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          feedback_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_attachments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_audit_log: {
        Row: {
          action: string
          created_at: string
          feedback_id: string
          id: string
          new_value: string | null
          performed_by: string
          previous_value: string | null
        }
        Insert: {
          action: string
          created_at?: string
          feedback_id: string
          id?: string
          new_value?: string | null
          performed_by: string
          previous_value?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          feedback_id?: string
          id?: string
          new_value?: string | null
          performed_by?: string
          previous_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_audit_log_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_notifications: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          is_read: boolean
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          is_read?: boolean
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          is_read?: boolean
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_notifications_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["feedback_priority"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["feedback_status"]
          title: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["feedback_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          title: string
          type: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["feedback_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          title?: string
          type?: Database["public"]["Enums"]["feedback_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      field_notes: {
        Row: {
          body: string
          created_at: string | null
          id: string
          metro_id: string | null
          tags: string[] | null
          tenant_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string | null
          id?: string
          metro_id?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          metro_id?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_notes_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "field_notes_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "field_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "field_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_events: {
        Row: {
          amount_cents: number
          completed_at: string | null
          contact_id: string | null
          created_at: string
          currency: string
          description: string | null
          event_id: string | null
          event_type: Database["public"]["Enums"]["financial_event_type"]
          id: string
          invoice_id: string | null
          note: string | null
          payer_email: string | null
          payer_name: string | null
          payment_link_id: string | null
          source_id: string | null
          source_type: string
          status: Database["public"]["Enums"]["financial_event_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          event_id?: string | null
          event_type: Database["public"]["Enums"]["financial_event_type"]
          id?: string
          invoice_id?: string | null
          note?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_link_id?: string | null
          source_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["financial_event_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          event_id?: string | null
          event_type?: Database["public"]["Enums"]["financial_event_type"]
          id?: string
          invoice_id?: string | null
          note?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_link_id?: string | null
          source_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["financial_event_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "tenant_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_events_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "tenant_payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "financial_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "financial_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_suggestions: {
        Row: {
          converted_campaign_id: string | null
          created_at: string
          id: string
          org_id: string
          reason: string
          snoozed_until: string | null
          source_id: string
          source_type: string
          status: string
          suggested_action_key: string
          suggested_audience_type: string | null
          suggested_template_key: string | null
          updated_at: string
        }
        Insert: {
          converted_campaign_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          reason: string
          snoozed_until?: string | null
          source_id: string
          source_type: string
          status?: string
          suggested_action_key: string
          suggested_audience_type?: string | null
          suggested_template_key?: string | null
          updated_at?: string
        }
        Update: {
          converted_campaign_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          reason?: string
          snoozed_until?: string | null
          source_id?: string
          source_type?: string
          status?: string
          suggested_action_key?: string
          suggested_audience_type?: string | null
          suggested_template_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_suggestions_converted_campaign_id_fkey"
            columns: ["converted_campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      form_intake_submissions: {
        Row: {
          created_at: string
          id: string
          intake_id: string
          parsed_email: string | null
          parsed_name: string | null
          parsed_notes: string | null
          parsed_phone: string | null
          promoted_contact_id: string | null
          raw_payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intake_id: string
          parsed_email?: string | null
          parsed_name?: string | null
          parsed_notes?: string | null
          parsed_phone?: string | null
          promoted_contact_id?: string | null
          raw_payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intake_id?: string
          parsed_email?: string | null
          parsed_name?: string | null
          parsed_notes?: string | null
          parsed_phone?: string | null
          promoted_contact_id?: string | null
          raw_payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_intake_submissions_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "tenant_form_intakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_intake_submissions_promoted_contact_id_fkey"
            columns: ["promoted_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_intake_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "form_intake_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "form_intake_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      formation_prompts: {
        Row: {
          content: string
          context: Json | null
          created_at: string | null
          expires_at: string | null
          id: string
          prompt_type: string
          role: string
          source: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          context?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          prompt_type: string
          role: string
          source: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          context?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          prompt_type?: string
          role?: string
          source?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formation_prompts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "formation_prompts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "formation_prompts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      founding_garden_events: {
        Row: {
          actor_user_id: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json
          program_key: string
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json
          program_key: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          program_key?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      founding_garden_program: {
        Row: {
          cap: number
          ends_at: string | null
          id: string
          is_active: boolean
          key: string
          purchased_count: number
          starts_at: string | null
          updated_at: string | null
        }
        Insert: {
          cap?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          key?: string
          purchased_count?: number
          starts_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cap?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          key?: string
          purchased_count?: number
          starts_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      friction_events: {
        Row: {
          created_at: string
          element_selector: string | null
          event_type: string
          id: string
          metadata: Json | null
          page_path: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          element_selector?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          element_selector?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friction_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "friction_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "friction_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gardener_audit_log: {
        Row: {
          action_type: string
          actor_id: string
          created_at: string
          diff_json: Json | null
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action_type: string
          actor_id: string
          created_at?: string
          diff_json?: Json | null
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action_type?: string
          actor_id?: string
          created_at?: string
          diff_json?: Json | null
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      gardener_feature_flags: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          enabled: boolean
          key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          enabled?: boolean
          key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          enabled?: boolean
          key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      gardener_federation_signup_orphans: {
        Row: {
          email: string | null
          email_hash: string | null
          event_type: string
          external_user_id: string | null
          federation_app_slug: string
          id: string
          metadata: Json
          received_at: string
        }
        Insert: {
          email?: string | null
          email_hash?: string | null
          event_type: string
          external_user_id?: string | null
          federation_app_slug: string
          id?: string
          metadata?: Json
          received_at?: string
        }
        Update: {
          email?: string | null
          email_hash?: string | null
          event_type?: string
          external_user_id?: string | null
          federation_app_slug?: string
          id?: string
          metadata?: Json
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gardener_federation_signup_orphans_federation_app_slug_fkey"
            columns: ["federation_app_slug"]
            isOneToOne: false
            referencedRelation: "federation_apps"
            referencedColumns: ["slug"]
          },
        ]
      }
      gardener_ga_connections: {
        Row: {
          access_token: string | null
          connected_email: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          property_id: string
          refresh_token: string | null
          token_expires_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_email?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          property_id: string
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_email?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          property_id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gardener_grants: {
        Row: {
          expires_at: string | null
          gardener_id: string
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          role: string
          source_app: string
        }
        Insert: {
          expires_at?: string | null
          gardener_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: string
          source_app: string
        }
        Update: {
          expires_at?: string | null
          gardener_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          role?: string
          source_app?: string
        }
        Relationships: []
      }
      gardener_insights: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          related_links: string[] | null
          severity: string
          snoozed_until: string | null
          source_refs: Json | null
          suggested_next_steps: Json | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          related_links?: string[] | null
          severity?: string
          snoozed_until?: string | null
          source_refs?: Json | null
          suggested_next_steps?: Json | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          related_links?: string[] | null
          severity?: string
          snoozed_until?: string | null
          source_refs?: Json | null
          suggested_next_steps?: Json | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      gardener_notification_settings: {
        Row: {
          created_at: string
          digest_enabled: boolean
          digest_time_local: string
          gardener_id: string
          notify_on_assignment_only: boolean
          notify_severity_min: string
          notify_ticket_types: string[]
          push_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          digest_enabled?: boolean
          digest_time_local?: string
          gardener_id: string
          notify_on_assignment_only?: boolean
          notify_severity_min?: string
          notify_ticket_types?: string[]
          push_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          digest_enabled?: boolean
          digest_time_local?: string
          gardener_id?: string
          notify_on_assignment_only?: boolean
          notify_severity_min?: string
          notify_ticket_types?: string[]
          push_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gardener_notification_settings_gardener_id_fkey"
            columns: ["gardener_id"]
            isOneToOne: true
            referencedRelation: "gardeners"
            referencedColumns: ["id"]
          },
        ]
      }
      gardener_scopes: {
        Row: {
          created_at: string
          gardener_id: string
          id: string
          scope_key: string
          scope_type: string
        }
        Insert: {
          created_at?: string
          gardener_id: string
          id?: string
          scope_key: string
          scope_type: string
        }
        Update: {
          created_at?: string
          gardener_id?: string
          id?: string
          scope_key?: string
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gardener_scopes_gardener_id_fkey"
            columns: ["gardener_id"]
            isOneToOne: false
            referencedRelation: "gardeners"
            referencedColumns: ["id"]
          },
        ]
      }
      gardener_tracked_campaigns: {
        Row: {
          campaign_id: string
          created_at: string
          csv_import_filename: string | null
          csv_row_count: number | null
          disclose_pixel: boolean
          federation_app_slug: string
          gardener_user_id: string
          id: string
          tracking_enabled: boolean
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          csv_import_filename?: string | null
          csv_row_count?: number | null
          disclose_pixel?: boolean
          federation_app_slug: string
          gardener_user_id: string
          id?: string
          tracking_enabled?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          csv_import_filename?: string | null
          csv_row_count?: number | null
          disclose_pixel?: boolean
          federation_app_slug?: string
          gardener_user_id?: string
          id?: string
          tracking_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gardener_tracked_campaigns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gardener_tracked_campaigns_federation_app_slug_fkey"
            columns: ["federation_app_slug"]
            isOneToOne: false
            referencedRelation: "federation_apps"
            referencedColumns: ["slug"]
          },
        ]
      }
      gardener_tracked_events: {
        Row: {
          event_type: string
          federation_app_slug: string | null
          id: string
          ip: unknown
          metadata: Json
          occurred_at: string
          send_id: string
          url: string | null
          user_agent: string | null
        }
        Insert: {
          event_type: string
          federation_app_slug?: string | null
          id?: string
          ip?: unknown
          metadata?: Json
          occurred_at?: string
          send_id: string
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          event_type?: string
          federation_app_slug?: string | null
          id?: string
          ip?: unknown
          metadata?: Json
          occurred_at?: string
          send_id?: string
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gardener_tracked_events_federation_app_slug_fkey"
            columns: ["federation_app_slug"]
            isOneToOne: false
            referencedRelation: "federation_apps"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gardener_tracked_events_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "gardener_tracked_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      gardener_tracked_sends: {
        Row: {
          audience_id: string | null
          click_count: number
          created_at: string
          customer_amount_cents: number | null
          customer_plan: string | null
          first_clicked_at: string | null
          first_customer_at: string | null
          first_opened_at: string | null
          first_signup_at: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          last_swept_at: string | null
          open_count: number
          recipient_email: string
          recipient_email_hash: string
          recipient_metadata: Json
          recipient_name: string | null
          replied_at: string | null
          reply_from_recipient: boolean | null
          reply_snippet: string | null
          sent_at: string | null
          subject: string | null
          tracked_campaign_id: string
          updated_at: string
        }
        Insert: {
          audience_id?: string | null
          click_count?: number
          created_at?: string
          customer_amount_cents?: number | null
          customer_plan?: string | null
          first_clicked_at?: string | null
          first_customer_at?: string | null
          first_opened_at?: string | null
          first_signup_at?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          last_swept_at?: string | null
          open_count?: number
          recipient_email: string
          recipient_email_hash: string
          recipient_metadata?: Json
          recipient_name?: string | null
          replied_at?: string | null
          reply_from_recipient?: boolean | null
          reply_snippet?: string | null
          sent_at?: string | null
          subject?: string | null
          tracked_campaign_id: string
          updated_at?: string
        }
        Update: {
          audience_id?: string | null
          click_count?: number
          created_at?: string
          customer_amount_cents?: number | null
          customer_plan?: string | null
          first_clicked_at?: string | null
          first_customer_at?: string | null
          first_opened_at?: string | null
          first_signup_at?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          last_swept_at?: string | null
          open_count?: number
          recipient_email?: string
          recipient_email_hash?: string
          recipient_metadata?: Json
          recipient_name?: string | null
          replied_at?: string | null
          reply_from_recipient?: boolean | null
          reply_snippet?: string | null
          sent_at?: string | null
          subject?: string | null
          tracked_campaign_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gardener_tracked_sends_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_audience"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gardener_tracked_sends_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "resend_candidates_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gardener_tracked_sends_tracked_campaign_id_fkey"
            columns: ["tracked_campaign_id"]
            isOneToOne: false
            referencedRelation: "gardener_tracked_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gardeners: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          is_on_call: boolean
          is_primary: boolean
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          is_on_call?: boolean
          is_primary?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          is_on_call?: boolean
          is_primary?: boolean
        }
        Relationships: []
      }
      generosity_records: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          created_by: string | null
          gift_date: string
          id: string
          is_recurring: boolean
          note: string | null
          recurring_frequency: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          created_by?: string | null
          gift_date: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          recurring_frequency?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          created_by?: string | null
          gift_date?: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          recurring_frequency?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generosity_records_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_group_metros: {
        Row: {
          created_at: string | null
          geo_group_id: string
          id: string
          metro_id: string
        }
        Insert: {
          created_at?: string | null
          geo_group_id: string
          id?: string
          metro_id: string
        }
        Update: {
          created_at?: string | null
          geo_group_id?: string
          id?: string
          metro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_group_metros_geo_group_id_fkey"
            columns: ["geo_group_id"]
            isOneToOne: false
            referencedRelation: "geo_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_group_metros_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "geo_group_metros_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_groups: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          created_at: string | null
          geo_group_id: string
          geo_group_type: string
          geojson_id: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string | null
          geo_group_id: string
          geo_group_type: string
          geojson_id?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string | null
          geo_group_id?: string
          geo_group_type?: string
          geojson_id?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      global_news_keywords: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          id: string
          keyword: string
          match_mode: string
          updated_at: string
          weight: number
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          keyword: string
          match_mode?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          keyword?: string
          match_mode?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      google_calendar_attendees: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          google_event_id: string
          id: string
          is_organizer: boolean | null
          response_status: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          google_event_id: string
          id?: string
          is_organizer?: boolean | null
          response_status?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          google_event_id?: string
          id?: string
          is_organizer?: boolean | null
          response_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_attendees_google_event_id_fkey"
            columns: ["google_event_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_events: {
        Row: {
          attended: boolean | null
          contact_id: string | null
          created_at: string | null
          description: string | null
          end_time: string | null
          google_event_id: string
          hidden: boolean
          id: string
          is_all_day: boolean | null
          location: string | null
          start_time: string
          synced_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          attended?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          google_event_id: string
          hidden?: boolean
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          start_time: string
          synced_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          attended?: boolean | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          google_event_id?: string
          hidden?: boolean
          id?: string
          is_all_day?: boolean | null
          location?: string | null
          start_time?: string
          synced_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_activities: {
        Row: {
          activity_date: string
          activity_id: string
          activity_type: Database["public"]["Enums"]["grant_activity_type"]
          created_at: string
          grant_id: string
          id: string
          next_action: string | null
          next_action_due: string | null
          notes: string | null
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          activity_date: string
          activity_id: string
          activity_type: Database["public"]["Enums"]["grant_activity_type"]
          created_at?: string
          grant_id: string
          id?: string
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_date?: string
          activity_id?: string
          activity_type?: Database["public"]["Enums"]["grant_activity_type"]
          created_at?: string
          grant_id?: string
          id?: string
          next_action?: string | null
          next_action_due?: string | null
          notes?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_activities_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_alignment: {
        Row: {
          created_at: string
          grant_id: string
          id: string
          org_id: string
          rationale: string | null
          run_id: string | null
          score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grant_id: string
          id?: string
          org_id: string
          rationale?: string | null
          run_id?: string | null
          score: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grant_id?: string
          id?: string
          org_id?: string
          rationale?: string | null
          run_id?: string | null
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grant_alignment_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_alignment_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_alignment_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      grant_alignments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      grant_anchor_links: {
        Row: {
          anchor_id: string
          created_at: string | null
          grant_id: string
          id: string
          link_type: string | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          anchor_id: string
          created_at?: string | null
          grant_id: string
          id?: string
          link_type?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          anchor_id?: string
          created_at?: string | null
          grant_id?: string
          id?: string
          link_type?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_anchor_links_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "anchors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_anchor_links_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_resources: {
        Row: {
          created_at: string
          description: string | null
          grant_id: string
          id: string
          label: string
          resource_date: string | null
          resource_date_end: string | null
          resource_type: string
          run_id: string | null
          source: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          grant_id: string
          id?: string
          label: string
          resource_date?: string | null
          resource_date_end?: string | null
          resource_type: string
          run_id?: string | null
          source?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          grant_id?: string
          id?: string
          label?: string
          resource_date?: string | null
          resource_date_end?: string | null
          resource_type?: string
          run_id?: string | null
          source?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_resources_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "grants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_types: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      grants: {
        Row: {
          amount_awarded: number | null
          amount_requested: number | null
          application_url: string | null
          available_funding: number | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          fiscal_year: number | null
          funder_name: string
          funder_type: Database["public"]["Enums"]["funder_type"]
          grant_id: string
          grant_name: string
          grant_term_end: string | null
          grant_term_start: string | null
          grant_types: string[] | null
          id: string
          internal_strategy_notes: string | null
          is_multiyear: boolean | null
          match_required: boolean | null
          metro_id: string | null
          notes: string | null
          opportunity_id: string | null
          owner_id: string
          reporting_frequency:
            | Database["public"]["Enums"]["reporting_frequency"]
            | null
          reporting_required: boolean | null
          source_url: string | null
          stage: Database["public"]["Enums"]["grant_stage"]
          stage_entry_date: string
          star_rating: number
          status: Database["public"]["Enums"]["grant_status"]
          strategic_focus: string[] | null
          updated_at: string
        }
        Insert: {
          amount_awarded?: number | null
          amount_requested?: number | null
          application_url?: string | null
          available_funding?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fiscal_year?: number | null
          funder_name: string
          funder_type?: Database["public"]["Enums"]["funder_type"]
          grant_id: string
          grant_name: string
          grant_term_end?: string | null
          grant_term_start?: string | null
          grant_types?: string[] | null
          id?: string
          internal_strategy_notes?: string | null
          is_multiyear?: boolean | null
          match_required?: boolean | null
          metro_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          owner_id: string
          reporting_frequency?:
            | Database["public"]["Enums"]["reporting_frequency"]
            | null
          reporting_required?: boolean | null
          source_url?: string | null
          stage?: Database["public"]["Enums"]["grant_stage"]
          stage_entry_date?: string
          star_rating?: number
          status?: Database["public"]["Enums"]["grant_status"]
          strategic_focus?: string[] | null
          updated_at?: string
        }
        Update: {
          amount_awarded?: number | null
          amount_requested?: number | null
          application_url?: string | null
          available_funding?: number | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fiscal_year?: number | null
          funder_name?: string
          funder_type?: Database["public"]["Enums"]["funder_type"]
          grant_id?: string
          grant_name?: string
          grant_term_end?: string | null
          grant_term_start?: string | null
          grant_types?: string[] | null
          id?: string
          internal_strategy_notes?: string | null
          is_multiyear?: boolean | null
          match_required?: boolean | null
          metro_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          owner_id?: string
          reporting_frequency?:
            | Database["public"]["Enums"]["reporting_frequency"]
            | null
          reporting_required?: boolean | null
          source_url?: string | null
          stage?: Database["public"]["Enums"]["grant_stage"]
          stage_entry_date?: string
          star_rating?: number
          status?: Database["public"]["Enums"]["grant_status"]
          strategic_focus?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "grants_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      hubspot_connections: {
        Row: {
          access_token: string | null
          created_at: string
          hubspot_mode: string
          hubspot_portal_id: string | null
          id: string
          pipeline_id: string | null
          refresh_token: string | null
          stage_mapping: Json
          status: string
          sync_direction: string
          sync_scope: Json
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          hubspot_mode?: string
          hubspot_portal_id?: string | null
          id?: string
          pipeline_id?: string | null
          refresh_token?: string | null
          stage_mapping?: Json
          status?: string
          sync_direction?: string
          sync_scope?: Json
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          hubspot_mode?: string
          hubspot_portal_id?: string | null
          id?: string
          pipeline_id?: string | null
          refresh_token?: string | null
          stage_mapping?: Json
          status?: string
          sync_direction?: string
          sync_scope?: Json
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hubspot_field_mappings: {
        Row: {
          active: boolean
          connection_id: string
          created_at: string
          direction: string
          hubspot_property: string
          id: string
          profunda_entity: string
          profunda_field: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          connection_id: string
          created_at?: string
          direction?: string
          hubspot_property: string
          id?: string
          profunda_entity: string
          profunda_field: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          connection_id?: string
          created_at?: string
          direction?: string
          hubspot_property?: string
          id?: string
          profunda_entity?: string
          profunda_field?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubspot_field_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "hubspot_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      hubspot_object_map: {
        Row: {
          connection_id: string
          contact_id: string | null
          created_at: string
          hubspot_company_id: string | null
          hubspot_contact_id: string | null
          hubspot_deal_id: string | null
          id: string
          last_hash: string | null
          last_synced_at: string | null
          opportunity_id: string | null
          provision_id: string | null
          updated_at: string
        }
        Insert: {
          connection_id: string
          contact_id?: string | null
          created_at?: string
          hubspot_company_id?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          last_hash?: string | null
          last_synced_at?: string | null
          opportunity_id?: string | null
          provision_id?: string | null
          updated_at?: string
        }
        Update: {
          connection_id?: string
          contact_id?: string | null
          created_at?: string
          hubspot_company_id?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          last_hash?: string | null
          last_synced_at?: string | null
          opportunity_id?: string | null
          provision_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubspot_object_map_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "hubspot_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hubspot_object_map_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hubspot_object_map_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hubspot_object_map_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      hubspot_sync_log: {
        Row: {
          connection_id: string
          created_at: string
          direction: string
          entity: string
          hubspot_id: string | null
          id: string
          message: string | null
          profunda_id: string | null
          stats: Json
          status: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          direction: string
          entity: string
          hubspot_id?: string | null
          id?: string
          message?: string | null
          profunda_id?: string | null
          stats?: Json
          status?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          direction?: string
          entity?: string
          hubspot_id?: string | null
          id?: string
          message?: string | null
          profunda_id?: string | null
          stats?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubspot_sync_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "hubspot_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_dimension_values: {
        Row: {
          created_at: string
          created_by: string | null
          dimension_id: string
          entity_id: string
          id: string
          tenant_id: string
          value_boolean: boolean | null
          value_numeric: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dimension_id: string
          entity_id: string
          id?: string
          tenant_id: string
          value_boolean?: boolean | null
          value_numeric?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dimension_id?: string
          entity_id?: string
          id?: string
          tenant_id?: string
          value_boolean?: boolean | null
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "impact_dimension_values_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "impact_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impact_dimension_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "impact_dimension_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "impact_dimension_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_dimensions: {
        Row: {
          aggregation_type: string
          created_at: string
          description: string | null
          entity_type: string
          id: string
          is_active: boolean
          is_public_eligible: boolean
          key: string
          label: string
          tenant_id: string
          value_type: string
        }
        Insert: {
          aggregation_type: string
          created_at?: string
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean
          is_public_eligible?: boolean
          key: string
          label: string
          tenant_id: string
          value_type: string
        }
        Update: {
          aggregation_type?: string
          created_at?: string
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean
          is_public_eligible?: boolean
          key?: string
          label?: string
          tenant_id?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_dimensions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "impact_dimensions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "impact_dimensions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          ended_at: string | null
          id: string
          ip_hash: string | null
          is_demo: boolean
          last_seen_at: string | null
          reason: string | null
          started_at: string
          status: string
          target_user_id: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          ended_at?: string | null
          id?: string
          ip_hash?: string | null
          is_demo?: boolean
          last_seen_at?: string | null
          reason?: string | null
          started_at?: string
          status?: string
          target_user_id: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          ended_at?: string | null
          id?: string
          ip_hash?: string | null
          is_demo?: boolean
          last_seen_at?: string | null
          reason?: string | null
          started_at?: string
          status?: string
          target_user_id?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          source_label: string | null
          source_system: string
          stats: Json
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          source_label?: string | null
          source_system: string
          stats?: Json
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          source_label?: string | null
          source_system?: string
          stats?: Json
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "import_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "import_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_files: {
        Row: {
          filename: string
          id: string
          run_id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          filename: string
          id?: string
          run_id: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          filename?: string
          id?: string
          run_id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_files_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mappings: {
        Row: {
          created_at: string
          id: string
          mapping: Json
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapping?: Json
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mapping?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_mappings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: Json | null
          id: string
          import_type: string
          source_system: string
          stats: Json
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          import_type: string
          source_system?: string
          stats?: Json
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          import_type?: string
          source_system?: string
          stats?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      impulsus_entries: {
        Row: {
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          metro_id: string | null
          narrative: string
          occurred_at: string
          opportunity_id: string | null
          source: Json
          tags: string[]
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          metro_id?: string | null
          narrative: string
          occurred_at?: string
          opportunity_id?: string | null
          source?: Json
          tags?: string[]
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          metro_id?: string | null
          narrative?: string
          occurred_at?: string
          opportunity_id?: string | null
          source?: Json
          tags?: string[]
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impulsus_entries_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "impulsus_entries_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impulsus_entries_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impulsus_entries_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      impulsus_settings: {
        Row: {
          capture_ai_suggestions: boolean
          capture_calendar_events: boolean
          capture_email_actions: boolean
          capture_reflections: boolean
          created_at: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          capture_ai_suggestions?: boolean
          capture_calendar_events?: boolean
          capture_email_actions?: boolean
          capture_reflections?: boolean
          created_at?: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          capture_ai_suggestions?: boolean
          capture_calendar_events?: boolean
          capture_email_actions?: boolean
          capture_reflections?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      inbound_leads: {
        Row: {
          archetype: string | null
          created_at: string
          dedupe_key: string | null
          email: string
          extra: Json | null
          form_variant: string | null
          honeypot: string | null
          id: string
          interest: string | null
          ip_hash: string | null
          lead_kind: string | null
          message: string | null
          name: string
          organization: string | null
          phone: string | null
          referrer: string | null
          source_app: string | null
          source_page: string | null
          source_url: string | null
          status: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          archetype?: string | null
          created_at?: string
          dedupe_key?: string | null
          email: string
          extra?: Json | null
          form_variant?: string | null
          honeypot?: string | null
          id?: string
          interest?: string | null
          ip_hash?: string | null
          lead_kind?: string | null
          message?: string | null
          name: string
          organization?: string | null
          phone?: string | null
          referrer?: string | null
          source_app?: string | null
          source_page?: string | null
          source_url?: string | null
          status?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          archetype?: string | null
          created_at?: string
          dedupe_key?: string | null
          email?: string
          extra?: Json | null
          form_variant?: string | null
          honeypot?: string | null
          id?: string
          interest?: string | null
          ip_hash?: string | null
          lead_kind?: string | null
          message?: string | null
          name?: string
          organization?: string | null
          phone?: string | null
          referrer?: string | null
          source_app?: string | null
          source_page?: string | null
          source_url?: string | null
          status?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      integration_connections: {
        Row: {
          auth_type: string
          connector_key: string
          created_at: string | null
          created_by: string
          environment: string
          external_account_label: string | null
          id: string
          settings: Json
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          auth_type: string
          connector_key: string
          created_at?: string | null
          created_by: string
          environment: string
          external_account_label?: string | null
          id?: string
          settings?: Json
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          auth_type?: string
          connector_key?: string
          created_at?: string | null
          created_by?: string
          environment?: string
          external_account_label?: string | null
          id?: string
          settings?: Json
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_connector_key_fkey"
            columns: ["connector_key"]
            isOneToOne: false
            referencedRelation: "integration_connectors"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "integration_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "integration_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "integration_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connectors: {
        Row: {
          active: boolean | null
          created_at: string | null
          direction: string
          display_name: string
          key: string
          notes: string | null
          supports_api: boolean
          supports_csv: boolean
          supports_oauth: boolean
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          direction: string
          display_name: string
          key: string
          notes?: string | null
          supports_api?: boolean
          supports_csv?: boolean
          supports_oauth?: boolean
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          direction?: string
          display_name?: string
          key?: string
          notes?: string | null
          supports_api?: boolean
          supports_csv?: boolean
          supports_oauth?: boolean
        }
        Relationships: []
      }
      integration_test_runs: {
        Row: {
          completed_at: string | null
          connector_key: string
          details: Json
          environment: string
          id: string
          simulation_profile_key: string | null
          started_at: string
          status: string
          tenant_id: string
          test_type: string
        }
        Insert: {
          completed_at?: string | null
          connector_key: string
          details?: Json
          environment: string
          id?: string
          simulation_profile_key?: string | null
          started_at?: string
          status: string
          tenant_id: string
          test_type: string
        }
        Update: {
          completed_at?: string | null
          connector_key?: string
          details?: Json
          environment?: string
          id?: string
          simulation_profile_key?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_test_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "integration_test_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "integration_test_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_feed_items: {
        Row: {
          created_at: string
          id: string
          priority_score: number
          signal_id: string | null
          summary: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority_score?: number
          signal_id?: string | null
          summary: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          priority_score?: number
          signal_id?: string | null
          summary?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_feed_items_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "opportunity_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          ai_processing_state: string | null
          anchor_key: string | null
          anchor_offset: number | null
          block_id: string | null
          created_at: string
          id: string
          metro_id: string | null
          narrative_id: string | null
          note_text: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          ai_processing_state?: string | null
          anchor_key?: string | null
          anchor_offset?: number | null
          block_id?: string | null
          created_at?: string
          id?: string
          metro_id?: string | null
          narrative_id?: string | null
          note_text: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          ai_processing_state?: string | null
          anchor_key?: string | null
          anchor_offset?: number | null
          block_id?: string | null
          created_at?: string
          id?: string
          metro_id?: string | null
          narrative_id?: string | null
          note_text?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "metro_narrative_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "journal_entries_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "metro_narratives"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_extractions: {
        Row: {
          created_at: string
          extracted_json: Json
          id: string
          journal_entry_id: string
        }
        Insert: {
          created_at?: string
          extracted_json?: Json
          id?: string
          journal_entry_id: string
        }
        Update: {
          created_at?: string
          extracted_json?: Json
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_extractions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      library_essay_signals: {
        Row: {
          archetype_key: string | null
          communio_opt_in: boolean | null
          communio_profile_strength: number | null
          created_at: string
          discovery_topics: string[] | null
          enrichment_keywords: string[] | null
          essay_id: string
          id: string
          relational_lens_notes: string | null
          tenant_slug: string | null
        }
        Insert: {
          archetype_key?: string | null
          communio_opt_in?: boolean | null
          communio_profile_strength?: number | null
          created_at?: string
          discovery_topics?: string[] | null
          enrichment_keywords?: string[] | null
          essay_id: string
          id?: string
          relational_lens_notes?: string | null
          tenant_slug?: string | null
        }
        Update: {
          archetype_key?: string | null
          communio_opt_in?: boolean | null
          communio_profile_strength?: number | null
          created_at?: string
          discovery_topics?: string[] | null
          enrichment_keywords?: string[] | null
          essay_id?: string
          id?: string
          relational_lens_notes?: string | null
          tenant_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_essay_signals_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "library_essays"
            referencedColumns: ["id"]
          },
        ]
      }
      library_essays: {
        Row: {
          approved_by: string | null
          canonical_url: string | null
          citations: Json | null
          content_markdown: string | null
          created_at: string
          excerpt: string | null
          generated_by: string
          hero_image_url: string | null
          id: string
          meta_robots: string
          month_key: string
          published_at: string | null
          schema_json: Json | null
          sector: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          source_type: string
          status: string
          sync_error: string | null
          synced_to_satellite_at: string | null
          tags: string[] | null
          target_app: string
          title: string
          updated_at: string
          voice_profile: string
        }
        Insert: {
          approved_by?: string | null
          canonical_url?: string | null
          citations?: Json | null
          content_markdown?: string | null
          created_at?: string
          excerpt?: string | null
          generated_by?: string
          hero_image_url?: string | null
          id?: string
          meta_robots?: string
          month_key?: string
          published_at?: string | null
          schema_json?: Json | null
          sector?: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          source_type?: string
          status?: string
          sync_error?: string | null
          synced_to_satellite_at?: string | null
          tags?: string[] | null
          target_app?: string
          title: string
          updated_at?: string
          voice_profile?: string
        }
        Update: {
          approved_by?: string | null
          canonical_url?: string | null
          citations?: Json | null
          content_markdown?: string | null
          created_at?: string
          excerpt?: string | null
          generated_by?: string
          hero_image_url?: string | null
          id?: string
          meta_robots?: string
          month_key?: string
          published_at?: string | null
          schema_json?: Json | null
          sector?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          source_type?: string
          status?: string
          sync_error?: string | null
          synced_to_satellite_at?: string | null
          tags?: string[] | null
          target_app?: string
          title?: string
          updated_at?: string
          voice_profile?: string
        }
        Relationships: []
      }
      life_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string
          entity_type: string
          event_date: string
          event_day: number | null
          event_month: number | null
          event_type: string
          event_year: number | null
          id: string
          last_reminded_at: string | null
          notify_enabled: boolean | null
          person_id: string | null
          remind_at: string | null
          remind_enabled: boolean | null
          remind_rule: string | null
          tenant_id: string
          title: string | null
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id: string
          entity_type?: string
          event_date: string
          event_day?: number | null
          event_month?: number | null
          event_type: string
          event_year?: number | null
          id?: string
          last_reminded_at?: string | null
          notify_enabled?: boolean | null
          person_id?: string | null
          remind_at?: string | null
          remind_enabled?: boolean | null
          remind_rule?: string | null
          tenant_id: string
          title?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          event_date?: string
          event_day?: number | null
          event_month?: number | null
          event_type?: string
          event_year?: number | null
          id?: string
          last_reminded_at?: string | null
          notify_enabled?: boolean | null
          person_id?: string | null
          remind_at?: string | null
          remind_enabled?: boolean | null
          remind_rule?: string | null
          tenant_id?: string
          title?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "life_events_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "life_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "life_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "life_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      living_system_signals: {
        Row: {
          anonymized_summary: string | null
          confidence_score: number
          context_json: Json
          created_at: string
          dismissed_by_user_ids: string[]
          id: string
          signal_type: string
          tenant_id: string
        }
        Insert: {
          anonymized_summary?: string | null
          confidence_score?: number
          context_json?: Json
          created_at?: string
          dismissed_by_user_ids?: string[]
          id?: string
          signal_type: string
          tenant_id: string
        }
        Update: {
          anonymized_summary?: string | null
          confidence_score?: number
          context_json?: Json
          created_at?: string
          dismissed_by_user_ids?: string[]
          id?: string
          signal_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "living_system_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "living_system_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "living_system_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      local_pulse_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: Json | null
          id: string
          metro_id: string
          run_kind: string
          started_at: string
          stats: Json
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          metro_id: string
          run_kind: string
          started_at?: string
          stats?: Json
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          metro_id?: string
          run_kind?: string
          started_at?: string
          stats?: Json
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_pulse_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "local_pulse_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      local_pulse_sources: {
        Row: {
          auto_disabled: boolean | null
          crawl_health_score: number | null
          created_at: string
          detected_feed_type: string | null
          enabled: boolean
          failure_count: number | null
          id: string
          label: string | null
          last_checked_at: string | null
          last_error: string | null
          last_retry_at: string | null
          last_status: string | null
          metro_id: string
          retry_after: string | null
          source_type: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          auto_disabled?: boolean | null
          crawl_health_score?: number | null
          created_at?: string
          detected_feed_type?: string | null
          enabled?: boolean
          failure_count?: number | null
          id?: string
          label?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_retry_at?: string | null
          last_status?: string | null
          metro_id: string
          retry_after?: string | null
          source_type: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          auto_disabled?: boolean | null
          crawl_health_score?: number | null
          created_at?: string
          detected_feed_type?: string | null
          enabled?: boolean
          failure_count?: number | null
          id?: string
          label?: string | null
          last_checked_at?: string | null
          last_error?: string | null
          last_retry_at?: string | null
          last_status?: string | null
          metro_id?: string
          retry_after?: string | null
          source_type?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_pulse_sources_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "local_pulse_sources_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      lumen_signals: {
        Row: {
          confidence: number
          first_detected_at: string
          id: string
          last_updated_at: string
          metro_id: string | null
          resolved: boolean
          severity: string
          signal_type: string
          source_summary: Json
          tenant_id: string
        }
        Insert: {
          confidence?: number
          first_detected_at?: string
          id?: string
          last_updated_at?: string
          metro_id?: string | null
          resolved?: boolean
          severity?: string
          signal_type: string
          source_summary?: Json
          tenant_id: string
        }
        Update: {
          confidence?: number
          first_detected_at?: string
          id?: string
          last_updated_at?: string
          metro_id?: string | null
          resolved?: boolean
          severity?: string
          signal_type?: string
          source_summary?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lumen_signals_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "lumen_signals_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lumen_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lumen_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lumen_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_discernment_signals: {
        Row: {
          content_key: string | null
          created_at: string
          event_key: string
          id: string
          page_key: string
        }
        Insert: {
          content_key?: string | null
          created_at?: string
          event_key: string
          id?: string
          page_key: string
        }
        Update: {
          content_key?: string | null
          created_at?: string
          event_key?: string
          id?: string
          page_key?: string
        }
        Relationships: []
      }
      meeting_note_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          meeting_note_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          meeting_note_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          meeting_note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_note_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_note_contacts_meeting_note_id_fkey"
            columns: ["meeting_note_id"]
            isOneToOne: false
            referencedRelation: "meeting_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          action_items: Json | null
          created_at: string
          google_calendar_event_id: string | null
          id: string
          matched_action_items: Json | null
          meet_link: string | null
          meeting_start_time: string | null
          meeting_title: string
          recording_url: string | null
          skipped_action_items: Json | null
          source: string
          source_meeting_id: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: Json | null
          created_at?: string
          google_calendar_event_id?: string | null
          id?: string
          matched_action_items?: Json | null
          meet_link?: string | null
          meeting_start_time?: string | null
          meeting_title: string
          recording_url?: string | null
          skipped_action_items?: Json | null
          source?: string
          source_meeting_id: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: Json | null
          created_at?: string
          google_calendar_event_id?: string | null
          id?: string
          matched_action_items?: Json | null
          meet_link?: string | null
          meeting_start_time?: string | null
          meeting_title?: string
          recording_url?: string | null
          skipped_action_items?: Json | null
          source?: string
          source_meeting_id?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_google_calendar_event_id_fkey"
            columns: ["google_calendar_event_id"]
            isOneToOne: false
            referencedRelation: "google_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_email_drafts: {
        Row: {
          body: string
          context: Json
          created_at: string
          id: string
          opportunity_id: string | null
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          context?: Json
          created_at?: string
          id?: string
          opportunity_id?: string | null
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          context?: Json
          created_at?: string
          id?: string
          opportunity_id?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_email_drafts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_email_drafts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      metro_activation_actions: {
        Row: {
          action_type: string
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string
          metro_id: string
          tenant_id: string
        }
        Insert: {
          action_type: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          metro_id: string
          tenant_id: string
        }
        Update: {
          action_type?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          metro_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_activation_actions_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_activation_actions_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_activation_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "metro_activation_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "metro_activation_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_activation_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          metro_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          metro_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          metro_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_activation_log_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_activation_log_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_activation_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "metro_activation_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "metro_activation_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_activation_states: {
        Row: {
          activated_at: string | null
          activation_stage: string
          created_at: string
          created_by: string
          id: string
          last_activity_at: string | null
          metro_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activation_stage?: string
          created_at?: string
          created_by: string
          id?: string
          last_activity_at?: string | null
          metro_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activation_stage?: string
          created_at?: string
          created_by?: string
          id?: string
          last_activity_at?: string | null
          metro_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_activation_states_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_activation_states_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_activation_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "metro_activation_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "metro_activation_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_drift_scores: {
        Row: {
          computed_at: string
          drift_delta: number
          drift_score: number
          id: string
          metro_id: string
          run_id: string | null
          signal_counts: Json | null
          topic_shifts: Json | null
        }
        Insert: {
          computed_at?: string
          drift_delta?: number
          drift_score?: number
          id?: string
          metro_id: string
          run_id?: string | null
          signal_counts?: Json | null
          topic_shifts?: Json | null
        }
        Update: {
          computed_at?: string
          drift_delta?: number
          drift_score?: number
          id?: string
          metro_id?: string
          run_id?: string | null
          signal_counts?: Json | null
          topic_shifts?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "metro_drift_scores_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_drift_scores_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_expansion_plans: {
        Row: {
          created_at: string
          id: string
          metro_id: string
          notes: string | null
          owner_user_id: string | null
          priority: number
          source_note_id: string | null
          status: string
          target_launch_date: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metro_id: string
          notes?: string | null
          owner_user_id?: string | null
          priority?: number
          source_note_id?: string | null
          status?: string
          target_launch_date?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metro_id?: string
          notes?: string | null
          owner_user_id?: string | null
          priority?: number
          source_note_id?: string | null
          status?: string
          target_launch_date?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_expansion_plans_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_expansion_plans_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_expansion_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "metro_expansion_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "metro_expansion_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_memory_threads: {
        Row: {
          computed_at: string
          created_at: string
          id: string
          memory_json: Json
          metro_id: string
          updated_at: string
          version: string
          window_end: string
          window_start: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          id?: string
          memory_json?: Json
          metro_id: string
          updated_at?: string
          version?: string
          window_end: string
          window_start: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          id?: string
          memory_json?: Json
          metro_id?: string
          updated_at?: string
          version?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_memory_threads_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_memory_threads_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_milestones: {
        Row: {
          achieved_at: string
          anchor_id: string | null
          created_at: string | null
          id: string
          metro_id: string
          milestone_type: string
        }
        Insert: {
          achieved_at: string
          anchor_id?: string | null
          created_at?: string | null
          id?: string
          metro_id: string
          milestone_type: string
        }
        Update: {
          achieved_at?: string
          anchor_id?: string | null
          created_at?: string | null
          id?: string
          metro_id?: string
          milestone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_milestones_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "anchors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_milestones_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_milestones_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_narrative_blocks: {
        Row: {
          block_key: string
          block_text: string
          created_at: string
          id: string
          narrative_id: string
          order_index: number
        }
        Insert: {
          block_key: string
          block_text?: string
          created_at?: string
          id?: string
          narrative_id: string
          order_index?: number
        }
        Update: {
          block_key?: string
          block_text?: string
          created_at?: string
          id?: string
          narrative_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "metro_narrative_blocks_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "metro_narratives"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_narrative_drifts: {
        Row: {
          accelerating_topics: Json
          created_at: string
          current_snapshot_id: string
          divergence: Json
          drift_score: number
          emerging_topics: Json
          fading_topics: Json
          id: string
          metro_id: string
          period_end: string
          period_start: string
          previous_snapshot_id: string | null
          stable_themes: Json
          summary_md: string
        }
        Insert: {
          accelerating_topics?: Json
          created_at?: string
          current_snapshot_id: string
          divergence?: Json
          drift_score?: number
          emerging_topics?: Json
          fading_topics?: Json
          id?: string
          metro_id: string
          period_end: string
          period_start: string
          previous_snapshot_id?: string | null
          stable_themes?: Json
          summary_md?: string
        }
        Update: {
          accelerating_topics?: Json
          created_at?: string
          current_snapshot_id?: string
          divergence?: Json
          drift_score?: number
          emerging_topics?: Json
          fading_topics?: Json
          id?: string
          metro_id?: string
          period_end?: string
          period_start?: string
          previous_snapshot_id?: string | null
          stable_themes?: Json
          summary_md?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_narrative_drifts_current_snapshot_id_fkey"
            columns: ["current_snapshot_id"]
            isOneToOne: false
            referencedRelation: "metro_narrative_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_narrative_drifts_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_narrative_drifts_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_narrative_drifts_previous_snapshot_id_fkey"
            columns: ["previous_snapshot_id"]
            isOneToOne: false
            referencedRelation: "metro_narrative_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_narrative_snapshots: {
        Row: {
          created_at: string
          id: string
          metro_id: string
          narrative_hash: string
          narrative_version: number
          period_end: string
          period_start: string
          signal_counts: Json
          source_mix: Json
          topic_counts: Json
        }
        Insert: {
          created_at?: string
          id?: string
          metro_id: string
          narrative_hash: string
          narrative_version?: number
          period_end: string
          period_start: string
          signal_counts?: Json
          source_mix?: Json
          topic_counts?: Json
        }
        Update: {
          created_at?: string
          id?: string
          metro_id?: string
          narrative_hash?: string
          narrative_version?: number
          period_end?: string
          period_start?: string
          signal_counts?: Json
          source_mix?: Json
          topic_counts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "metro_narrative_snapshots_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_narrative_snapshots_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_narratives: {
        Row: {
          ai_generated: boolean
          created_at: string
          created_by: string | null
          headline: string | null
          id: string
          inputs_summary: Json
          metro_id: string
          narrative_cache_hash: string | null
          narrative_json: Json | null
          narrative_md: string | null
          news_items_used_count: number
          news_run_id: string | null
          news_signal_strength: number
          news_topics_used_count: number
          period_end: string | null
          period_start: string | null
          source_summary: Json | null
          updated_at: string
          version: number
        }
        Insert: {
          ai_generated?: boolean
          created_at?: string
          created_by?: string | null
          headline?: string | null
          id?: string
          inputs_summary?: Json
          metro_id: string
          narrative_cache_hash?: string | null
          narrative_json?: Json | null
          narrative_md?: string | null
          news_items_used_count?: number
          news_run_id?: string | null
          news_signal_strength?: number
          news_topics_used_count?: number
          period_end?: string | null
          period_start?: string | null
          source_summary?: Json | null
          updated_at?: string
          version?: number
        }
        Update: {
          ai_generated?: boolean
          created_at?: string
          created_by?: string | null
          headline?: string | null
          id?: string
          inputs_summary?: Json
          metro_id?: string
          narrative_cache_hash?: string | null
          narrative_json?: Json | null
          narrative_md?: string | null
          news_items_used_count?: number
          news_run_id?: string | null
          news_signal_strength?: number
          news_topics_used_count?: number
          period_end?: string | null
          period_start?: string | null
          source_summary?: Json | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "metro_narratives_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_narratives_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_narratives_news_run_id_fkey"
            columns: ["news_run_id"]
            isOneToOne: false
            referencedRelation: "metro_news_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_news_keyword_sets: {
        Row: {
          created_at: string
          max_keywords: number
          metro_id: string
          radius_miles: number
          updated_at: string
          use_global_defaults: boolean
        }
        Insert: {
          created_at?: string
          max_keywords?: number
          metro_id: string
          radius_miles?: number
          updated_at?: string
          use_global_defaults?: boolean
        }
        Update: {
          created_at?: string
          max_keywords?: number
          metro_id?: string
          radius_miles?: number
          updated_at?: string
          use_global_defaults?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "metro_news_keyword_sets_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: true
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_news_keyword_sets_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: true
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_news_keywords: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          keyword: string
          match_mode: string
          metro_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          keyword: string
          match_mode?: string
          metro_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          keyword?: string
          match_mode?: string
          metro_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "metro_news_keywords_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_news_keywords_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_news_runs: {
        Row: {
          articles_deduped: number
          articles_found: number
          articles_persisted: number
          created_at: string
          duration_ms: number | null
          errors: Json
          id: string
          keyword_snapshot: Json
          metro_id: string
          period_end: string | null
          period_start: string | null
          queries_used: Json
          ran_at: string
          source_count: number
          status: string
          updated_at: string
        }
        Insert: {
          articles_deduped?: number
          articles_found?: number
          articles_persisted?: number
          created_at?: string
          duration_ms?: number | null
          errors?: Json
          id?: string
          keyword_snapshot?: Json
          metro_id: string
          period_end?: string | null
          period_start?: string | null
          queries_used?: Json
          ran_at?: string
          source_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          articles_deduped?: number
          articles_found?: number
          articles_persisted?: number
          created_at?: string
          duration_ms?: number | null
          errors?: Json
          id?: string
          keyword_snapshot?: Json
          metro_id?: string
          period_end?: string | null
          period_start?: string | null
          queries_used?: Json
          ran_at?: string
          source_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_news_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_news_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_news_sources: {
        Row: {
          auto_disabled: boolean
          created_at: string
          created_by: string | null
          detected_feed_type: string | null
          enabled: boolean
          failure_count: number
          id: string
          label: string | null
          last_crawled_at: string | null
          last_error: string | null
          last_status: string | null
          metro_id: string
          source_origin: string
          updated_at: string
          url: string
        }
        Insert: {
          auto_disabled?: boolean
          created_at?: string
          created_by?: string | null
          detected_feed_type?: string | null
          enabled?: boolean
          failure_count?: number
          id?: string
          label?: string | null
          last_crawled_at?: string | null
          last_error?: string | null
          last_status?: string | null
          metro_id: string
          source_origin?: string
          updated_at?: string
          url: string
        }
        Update: {
          auto_disabled?: boolean
          created_at?: string
          created_by?: string | null
          detected_feed_type?: string | null
          enabled?: boolean
          failure_count?: number
          id?: string
          label?: string | null
          last_crawled_at?: string | null
          last_error?: string | null
          last_status?: string | null
          metro_id?: string
          source_origin?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_news_sources_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "metro_news_sources_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      metros: {
        Row: {
          active: boolean
          city: string | null
          created_at: string | null
          default_radius_miles: number
          deleted_at: string | null
          deleted_by: string | null
          distribution_partner_yn: boolean | null
          ecosystem_status: string
          expansion_priority: number
          housing_refugee_partners: number | null
          id: string
          lat: number | null
          lng: number | null
          metro: string
          metro_id: string
          notes: string | null
          partner_inquiries_per_month: number | null
          quarterly_target: number | null
          recommendation: Database["public"]["Enums"]["recommendation"] | null
          referrals_per_month: number | null
          region_id: string | null
          schools_libraries: number | null
          staff_coverage_1to5: number | null
          state_code: string | null
          storage_ready_yn: boolean | null
          updated_at: string | null
          waitlist_size: number | null
          workforce_partners: number | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string | null
          default_radius_miles?: number
          deleted_at?: string | null
          deleted_by?: string | null
          distribution_partner_yn?: boolean | null
          ecosystem_status?: string
          expansion_priority?: number
          housing_refugee_partners?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          metro: string
          metro_id: string
          notes?: string | null
          partner_inquiries_per_month?: number | null
          quarterly_target?: number | null
          recommendation?: Database["public"]["Enums"]["recommendation"] | null
          referrals_per_month?: number | null
          region_id?: string | null
          schools_libraries?: number | null
          staff_coverage_1to5?: number | null
          state_code?: string | null
          storage_ready_yn?: boolean | null
          updated_at?: string | null
          waitlist_size?: number | null
          workforce_partners?: number | null
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string | null
          default_radius_miles?: number
          deleted_at?: string | null
          deleted_by?: string | null
          distribution_partner_yn?: boolean | null
          ecosystem_status?: string
          expansion_priority?: number
          housing_refugee_partners?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          metro?: string
          metro_id?: string
          notes?: string | null
          partner_inquiries_per_month?: number | null
          quarterly_target?: number | null
          recommendation?: Database["public"]["Enums"]["recommendation"] | null
          referrals_per_month?: number | null
          region_id?: string | null
          schools_libraries?: number | null
          staff_coverage_1to5?: number | null
          state_code?: string | null
          storage_ready_yn?: boolean | null
          updated_at?: string | null
          waitlist_size?: number | null
          workforce_partners?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metros_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_guidance_events: {
        Row: {
          action: string
          archetype_key: string | null
          context: Json
          created_at: string
          guide_key: string
          id: string
          role: string
          route: string
          tenant_id: string
          trigger_type: string
          user_id: string
        }
        Insert: {
          action: string
          archetype_key?: string | null
          context?: Json
          created_at?: string
          guide_key: string
          id?: string
          role: string
          route: string
          tenant_id: string
          trigger_type: string
          user_id: string
        }
        Update: {
          action?: string
          archetype_key?: string | null
          context?: Json
          created_at?: string
          guide_key?: string
          id?: string
          role?: string
          route?: string
          tenant_id?: string
          trigger_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_guidance_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "micro_guidance_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "micro_guidance_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_field_mappings: {
        Row: {
          connector_key: string
          created_at: string | null
          id: string
          mapping: Json
          object_type: string
          tenant_id: string
        }
        Insert: {
          connector_key: string
          created_at?: string | null
          id?: string
          mapping?: Json
          object_type: string
          tenant_id: string
        }
        Update: {
          connector_key?: string
          created_at?: string | null
          id?: string
          mapping?: Json
          object_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_field_mappings_connector_key_fkey"
            columns: ["connector_key"]
            isOneToOne: false
            referencedRelation: "integration_connectors"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "migration_field_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "migration_field_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "migration_field_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_fixture_packs: {
        Row: {
          connector_key: string
          created_at: string
          description: string
          display_name: string
          files: Json
          key: string
        }
        Insert: {
          connector_key: string
          created_at?: string
          description: string
          display_name: string
          files?: Json
          key: string
        }
        Update: {
          connector_key?: string
          created_at?: string
          description?: string
          display_name?: string
          files?: Json
          key?: string
        }
        Relationships: []
      }
      migration_review_queue: {
        Row: {
          ai_confidence: number | null
          ai_error_kind: string | null
          ai_proposed_payload: Json | null
          ai_reasoning: string | null
          created_at: string
          failure_reason: string
          id: string
          integration_key: string
          migration_id: string
          notification_sent_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_row: Json
          status: string
          target_entity: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_error_kind?: string | null
          ai_proposed_payload?: Json | null
          ai_reasoning?: string | null
          created_at?: string
          failure_reason: string
          id?: string
          integration_key: string
          migration_id: string
          notification_sent_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_row: Json
          status?: string
          target_entity: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_error_kind?: string | null
          ai_proposed_payload?: Json | null
          ai_reasoning?: string | null
          created_at?: string
          failure_reason?: string
          id?: string
          integration_key?: string
          migration_id?: string
          notification_sent_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_row?: Json
          status?: string
          target_entity?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_review_queue_migration_id_fkey"
            columns: ["migration_id"]
            isOneToOne: false
            referencedRelation: "relatio_migrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migration_review_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "migration_review_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "migration_review_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_run_items: {
        Row: {
          action: string
          created_at: string | null
          external_id: string | null
          id: string
          internal_id: string | null
          migration_run_id: string
          object_type: string
          sample: Json | null
          warnings: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          internal_id?: string | null
          migration_run_id: string
          object_type: string
          sample?: Json | null
          warnings?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          internal_id?: string | null
          migration_run_id?: string
          object_type?: string
          sample?: Json | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_run_items_migration_run_id_fkey"
            columns: ["migration_run_id"]
            isOneToOne: false
            referencedRelation: "migration_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_runs: {
        Row: {
          completed_at: string | null
          connector_key: string
          environment: string
          error: Json | null
          id: string
          mapping_summary: Json
          mode: string
          results_summary: Json
          source_summary: Json
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          connector_key: string
          environment: string
          error?: Json | null
          id?: string
          mapping_summary?: Json
          mode: string
          results_summary?: Json
          source_summary?: Json
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          connector_key?: string
          environment?: string
          error?: Json | null
          id?: string
          mapping_summary?: Json
          mode?: string
          results_summary?: Json
          source_summary?: Json
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_runs_connector_key_fkey"
            columns: ["connector_key"]
            isOneToOne: false
            referencedRelation: "integration_connectors"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "migration_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "migration_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "migration_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_atlas_drafts: {
        Row: {
          archetype: string
          created_at: string
          generated_by: string
          id: string
          metro_type: string
          narrative: string
          research_context: Json | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          roles: string[]
          signals: string[]
          status: string
          themes: string[]
          updated_at: string
          week_link: string | null
        }
        Insert: {
          archetype: string
          created_at?: string
          generated_by?: string
          id?: string
          metro_type: string
          narrative?: string
          research_context?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          roles?: string[]
          signals?: string[]
          status?: string
          themes?: string[]
          updated_at?: string
          week_link?: string | null
        }
        Update: {
          archetype?: string
          created_at?: string
          generated_by?: string
          id?: string
          metro_type?: string
          narrative?: string
          research_context?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          roles?: string[]
          signals?: string[]
          status?: string
          themes?: string[]
          updated_at?: string
          week_link?: string | null
        }
        Relationships: []
      }
      mission_snapshots: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      narrative_influence_events: {
        Row: {
          confidence: number
          created_at: string
          id: string
          influence_type: string
          source_id: string | null
          target_surface: string
          tenant_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          influence_type: string
          source_id?: string | null
          target_surface: string
          tenant_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          influence_type?: string
          source_id?: string | null
          target_surface?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_influence_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_influence_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_influence_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_moments: {
        Row: {
          created_at: string | null
          excerpt: string
          id: string
          metadata: Json | null
          metro_id: string | null
          moment_type: string
          occurred_at: string
          opportunity_id: string | null
          source_id: string
          source_table: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          excerpt: string
          id?: string
          metadata?: Json | null
          metro_id?: string | null
          moment_type: string
          occurred_at: string
          opportunity_id?: string | null
          source_id: string
          source_table: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          excerpt?: string
          id?: string
          metadata?: Json | null
          metro_id?: string | null
          moment_type?: string
          occurred_at?: string
          opportunity_id?: string | null
          source_id?: string
          source_table?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_moments_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "narrative_moments_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_moments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_moments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "narrative_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_partner_suggestions: {
        Row: {
          ai_confidence: number
          created_at: string
          dismissed: boolean
          id: string
          metro_id: string
          narrative_id: string
          opportunity_id: string
          reasoning: string
          suggested_message_md: string | null
          suggestion_type: string
        }
        Insert: {
          ai_confidence?: number
          created_at?: string
          dismissed?: boolean
          id?: string
          metro_id: string
          narrative_id: string
          opportunity_id: string
          reasoning: string
          suggested_message_md?: string | null
          suggestion_type: string
        }
        Update: {
          ai_confidence?: number
          created_at?: string
          dismissed?: boolean
          id?: string
          metro_id?: string
          narrative_id?: string
          opportunity_id?: string
          reasoning?: string
          suggested_message_md?: string | null
          suggestion_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_partner_suggestions_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "narrative_partner_suggestions_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_partner_suggestions_narrative_id_fkey"
            columns: ["narrative_id"]
            isOneToOne: false
            referencedRelation: "metro_narratives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_partner_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_partner_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      narrative_stories: {
        Row: {
          archetype: string | null
          body: string
          created_at: string
          created_by: string | null
          id: string
          pattern_source: Json | null
          role: string | null
          slug: string
          source_app: string
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          archetype?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pattern_source?: Json | null
          role?: string | null
          slug: string
          source_app?: string
          status?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          archetype?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pattern_source?: Json | null
          role?: string | null
          slug?: string
          source_app?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      narrative_story_drafts: {
        Row: {
          created_at: string
          id: string
          outline: Json
          sources: Json
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          outline?: Json
          sources?: Json
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          outline?: Json
          sources?: Json
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_story_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_story_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_story_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_thread_moments: {
        Row: {
          id: string
          moment_id: string
          rank: number
          thread_id: string
          used_excerpt: string
        }
        Insert: {
          id?: string
          moment_id: string
          rank: number
          thread_id: string
          used_excerpt: string
        }
        Update: {
          id?: string
          moment_id?: string
          rank?: number
          thread_id?: string
          used_excerpt?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_thread_moments_moment_id_fkey"
            columns: ["moment_id"]
            isOneToOne: false
            referencedRelation: "narrative_moments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_thread_moments_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "narrative_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_threads: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          metro_id: string | null
          open_loops: Json | null
          opportunity_id: string | null
          scope: string
          signals: Json | null
          status: string
          summary: string
          tenant_id: string
          title: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          metro_id?: string | null
          open_loops?: Json | null
          opportunity_id?: string | null
          scope: string
          signals?: Json | null
          status?: string
          summary: string
          tenant_id: string
          title: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          metro_id?: string | null
          open_loops?: Json | null
          opportunity_id?: string | null
          scope?: string
          signals?: Json | null
          status?: string
          summary?: string
          tenant_id?: string
          title?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_threads_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "narrative_threads_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_threads_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narrative_threads_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "narrative_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_value_moments: {
        Row: {
          created_at: string
          id: string
          metro_id: string | null
          moment_type: string
          occurred_at: string
          opportunity_id: string | null
          source: string
          summary: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metro_id?: string | null
          moment_type: string
          occurred_at?: string
          opportunity_id?: string | null
          source: string
          summary: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metro_id?: string | null
          moment_type?: string
          occurred_at?: string
          opportunity_id?: string | null
          source?: string
          summary?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_value_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_value_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "narrative_value_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      note_history: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          created_at: string
          error: string | null
          event_id: string | null
          id: string
          push_subscription_id: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          push_subscription_id?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          id?: string
          push_subscription_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          body: string
          bundle_id: string | null
          bundle_key: string | null
          created_at: string
          deep_link: string | null
          delivered_at: string | null
          event_type: string
          fingerprint: string
          id: string
          metadata: Json | null
          org_id: string | null
          priority: string
          status: string
          tier: string
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          bundle_id?: string | null
          bundle_key?: string | null
          created_at?: string
          deep_link?: string | null
          delivered_at?: string | null
          event_type: string
          fingerprint: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
          priority?: string
          status?: string
          tier?: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          bundle_id?: string | null
          bundle_key?: string | null
          created_at?: string
          deep_link?: string | null
          delivered_at?: string | null
          event_type?: string
          fingerprint?: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
          priority?: string
          status?: string
          tier?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          body: string
          bundle_key: string
          created_at: string
          deep_link: string | null
          deliver_after: string
          delivered_at: string | null
          event_ids: string[]
          event_type: string
          id: string
          priority: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          bundle_key: string
          created_at?: string
          deep_link?: string | null
          deliver_after?: string
          delivered_at?: string | null
          event_ids?: string[]
          event_type: string
          id?: string
          priority?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          bundle_key?: string
          created_at?: string
          deep_link?: string | null
          deliver_after?: string
          delivered_at?: string | null
          event_ids?: string[]
          event_type?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          enabled: boolean
          event_type: string
          filter_jsonb: Json
          id: string
          recipient: string
          source_app: string | null
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_type: string
          filter_jsonb?: Json
          id?: string
          recipient: string
          source_app?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_type?: string
          filter_jsonb?: Json
          id?: string
          recipient?: string
          source_app?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_type_config: {
        Row: {
          admin_only: boolean
          created_at: string
          default_on: boolean
          description: string | null
          enabled: boolean
          event_type: string
          updated_at: string
        }
        Insert: {
          admin_only?: boolean
          created_at?: string
          default_on?: boolean
          description?: string | null
          enabled?: boolean
          event_type: string
          updated_at?: string
        }
        Update: {
          admin_only?: boolean
          created_at?: string
          default_on?: boolean
          description?: string | null
          enabled?: boolean
          event_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      nri_design_suggestions: {
        Row: {
          affected_routes: string[]
          created_at: string
          evidence: Json
          id: string
          narrative_detail: string
          pattern_key: string
          reviewed_at: string | null
          reviewed_by: string | null
          roles_affected: string[]
          severity: string
          status: string
          suggestion_summary: string
          tenant_id: string | null
        }
        Insert: {
          affected_routes?: string[]
          created_at?: string
          evidence?: Json
          id?: string
          narrative_detail: string
          pattern_key: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          roles_affected?: string[]
          severity?: string
          status?: string
          suggestion_summary: string
          tenant_id?: string | null
        }
        Update: {
          affected_routes?: string[]
          created_at?: string
          evidence?: Json
          id?: string
          narrative_detail?: string
          pattern_key?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          roles_affected?: string[]
          severity?: string
          status?: string
          suggestion_summary?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nri_design_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_design_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_design_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nri_playbook_drafts: {
        Row: {
          created_at: string
          draft_markdown: string
          evidence: Json
          id: string
          pattern_key: string
          published_at: string | null
          published_by: string | null
          related_feature_key: string | null
          role: string | null
          status: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          draft_markdown: string
          evidence?: Json
          id?: string
          pattern_key: string
          published_at?: string | null
          published_by?: string | null
          related_feature_key?: string | null
          role?: string | null
          status?: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          draft_markdown?: string
          evidence?: Json
          id?: string
          pattern_key?: string
          published_at?: string | null
          published_by?: string | null
          related_feature_key?: string | null
          role?: string | null
          status?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "nri_playbook_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_playbook_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_playbook_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nri_signals: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          occurred_at: string
          reference_id: string | null
          signal_strength: number
          signal_type: string
          source: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          occurred_at: string
          reference_id?: string | null
          signal_strength?: number
          signal_type: string
          source: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          occurred_at?: string
          reference_id?: string | null
          signal_strength?: number
          signal_type?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nri_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nri_story_signals: {
        Row: {
          created_at: string
          dedupe_key: string | null
          evidence: Json
          id: string
          kind: string
          metro_id: string | null
          opportunity_id: string | null
          summary: string
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          evidence?: Json
          id?: string
          kind: string
          metro_id?: string | null
          opportunity_id?: string | null
          summary: string
          tenant_id: string
          title: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          evidence?: Json
          id?: string
          kind?: string
          metro_id?: string | null
          opportunity_id?: string | null
          summary?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "nri_story_signals_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "nri_story_signals_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nri_story_signals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nri_story_signals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "nri_story_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_story_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_story_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nri_support_sessions: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nri_support_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_support_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "nri_support_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nri_usage_metrics: {
        Row: {
          created_at: string | null
          reflections_triggered: number
          signals_generated: number
          signals_shared_to_communio: number
          tenant_id: string
          testimonium_flags_generated: number
          week_start: string
        }
        Insert: {
          created_at?: string | null
          reflections_triggered?: number
          signals_generated?: number
          signals_shared_to_communio?: number
          tenant_id: string
          testimonium_flags_generated?: number
          week_start: string
        }
        Update: {
          created_at?: string | null
          reflections_triggered?: number
          signals_generated?: number
          signals_shared_to_communio?: number
          tenant_id?: string
          testimonium_flags_generated?: number
          week_start?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          origin: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          origin: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          origin?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          id: string
          status: string
          step_key: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          status?: string
          step_key: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          status?: string
          step_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "onboarding_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "onboarding_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sessions: {
        Row: {
          archetype: string
          completed_at: string | null
          current_step: string | null
          id: string
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          archetype: string
          completed_at?: string | null
          current_step?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          archetype?: string
          completed_at?: string | null
          current_step?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "onboarding_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "onboarding_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          action_type: string
          archetype: string
          description: string
          key: string
          optional: boolean | null
          order_index: number
          title: string
        }
        Insert: {
          action_type: string
          archetype: string
          description: string
          key: string
          optional?: boolean | null
          order_index: number
          title: string
        }
        Update: {
          action_type?: string
          archetype?: string
          description?: string
          key?: string
          optional?: boolean | null
          order_index?: number
          title?: string
        }
        Relationships: []
      }
      operator_adoption_daily: {
        Row: {
          actions_logged: number
          campaign_touches: number
          communio_shared_signals: number
          created_at: string
          date: string
          emails_synced: number
          events_added: number
          id: string
          nri_suggestions_accepted: number
          nri_suggestions_created: number
          provisio_created: number
          reflections_created: number
          signum_articles_ingested: number
          tenant_id: string
          users_active: number
          voluntarium_hours_logged: number
        }
        Insert: {
          actions_logged?: number
          campaign_touches?: number
          communio_shared_signals?: number
          created_at?: string
          date: string
          emails_synced?: number
          events_added?: number
          id?: string
          nri_suggestions_accepted?: number
          nri_suggestions_created?: number
          provisio_created?: number
          reflections_created?: number
          signum_articles_ingested?: number
          tenant_id: string
          users_active?: number
          voluntarium_hours_logged?: number
        }
        Update: {
          actions_logged?: number
          campaign_touches?: number
          communio_shared_signals?: number
          created_at?: string
          date?: string
          emails_synced?: number
          events_added?: number
          id?: string
          nri_suggestions_accepted?: number
          nri_suggestions_created?: number
          provisio_created?: number
          reflections_created?: number
          signum_articles_ingested?: number
          tenant_id?: string
          users_active?: number
          voluntarium_hours_logged?: number
        }
        Relationships: [
          {
            foreignKeyName: "operator_adoption_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_adoption_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_adoption_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_adoption_weekly: {
        Row: {
          adoption_label: string
          adoption_score: number
          created_at: string
          id: string
          narrative: Json
          tenant_id: string
          week_start: string
        }
        Insert: {
          adoption_label?: string
          adoption_score?: number
          created_at?: string
          id?: string
          narrative?: Json
          tenant_id: string
          week_start: string
        }
        Update: {
          adoption_label?: string
          adoption_score?: number
          created_at?: string
          id?: string
          narrative?: Json
          tenant_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_adoption_weekly_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_adoption_weekly_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_adoption_weekly_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_ai_budget: {
        Row: {
          calls_per_user_core: number
          calls_per_user_insight: number
          calls_per_user_story: number
          deep_allowance_core: number
          deep_allowance_insight: number
          deep_allowance_story: number
          firecrawl_estimated_cost: number
          force_essential_mode: boolean
          global_nri_monthly_ceiling: number
          id: string
          lovable_cloud_estimated_cost: number
          monthly_call_cap: number
          monthly_token_cap: number
          nri_guard_core: number
          nri_guard_insight: number
          nri_guard_story: number
          pause_drift_detection: boolean
          pause_territory_crawls: boolean
          perplexity_api_estimated_cost: number
          projected_cost_envelope_usd: number
          tokens_per_user_core: number
          tokens_per_user_insight: number
          tokens_per_user_story: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          calls_per_user_core?: number
          calls_per_user_insight?: number
          calls_per_user_story?: number
          deep_allowance_core?: number
          deep_allowance_insight?: number
          deep_allowance_story?: number
          firecrawl_estimated_cost?: number
          force_essential_mode?: boolean
          global_nri_monthly_ceiling?: number
          id?: string
          lovable_cloud_estimated_cost?: number
          monthly_call_cap?: number
          monthly_token_cap?: number
          nri_guard_core?: number
          nri_guard_insight?: number
          nri_guard_story?: number
          pause_drift_detection?: boolean
          pause_territory_crawls?: boolean
          perplexity_api_estimated_cost?: number
          projected_cost_envelope_usd?: number
          tokens_per_user_core?: number
          tokens_per_user_insight?: number
          tokens_per_user_story?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          calls_per_user_core?: number
          calls_per_user_insight?: number
          calls_per_user_story?: number
          deep_allowance_core?: number
          deep_allowance_insight?: number
          deep_allowance_story?: number
          firecrawl_estimated_cost?: number
          force_essential_mode?: boolean
          global_nri_monthly_ceiling?: number
          id?: string
          lovable_cloud_estimated_cost?: number
          monthly_call_cap?: number
          monthly_token_cap?: number
          nri_guard_core?: number
          nri_guard_insight?: number
          nri_guard_story?: number
          pause_drift_detection?: boolean
          pause_territory_crawls?: boolean
          perplexity_api_estimated_cost?: number
          projected_cost_envelope_usd?: number
          tokens_per_user_core?: number
          tokens_per_user_insight?: number
          tokens_per_user_story?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      operator_ai_cost_model: {
        Row: {
          avg_perplexity_cost_per_call: number
          avg_tokens_per_nri_call: number
          firecrawl_monthly_credit_pool: number
          firecrawl_monthly_plan_cost: number
          id: string
          lovable_cost_per_1k_tokens: number
          smoothing_window_days: number
          updated_at: string
        }
        Insert: {
          avg_perplexity_cost_per_call?: number
          avg_tokens_per_nri_call?: number
          firecrawl_monthly_credit_pool?: number
          firecrawl_monthly_plan_cost?: number
          id?: string
          lovable_cost_per_1k_tokens?: number
          smoothing_window_days?: number
          updated_at?: string
        }
        Update: {
          avg_perplexity_cost_per_call?: number
          avg_tokens_per_nri_call?: number
          firecrawl_monthly_credit_pool?: number
          firecrawl_monthly_plan_cost?: number
          id?: string
          lovable_cost_per_1k_tokens?: number
          smoothing_window_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      operator_ai_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_ai_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_ai_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_ai_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_analytics_rollups: {
        Row: {
          created_at: string
          day: string
          id: string
          metadata: Json
          metric_key: string
          metric_value: number
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          metadata?: Json
          metric_key: string
          metric_value?: number
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          metadata?: Json
          metric_key?: string
          metric_value?: number
        }
        Relationships: []
      }
      operator_announcements: {
        Row: {
          active_until: string | null
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          active_until?: string | null
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          active_until?: string | null
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      operator_app_errors: {
        Row: {
          alerted_at: string | null
          context: Json
          count: number
          expected: string | null
          fingerprint: string
          first_seen_at: string
          id: string
          last_seen_at: string
          lovable_prompt: string | null
          message: string
          owner_notes: string | null
          repro_steps: string | null
          severity: string
          source: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          alerted_at?: string | null
          context?: Json
          count?: number
          expected?: string | null
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          lovable_prompt?: string | null
          message: string
          owner_notes?: string | null
          repro_steps?: string | null
          severity?: string
          source: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          alerted_at?: string | null
          context?: Json
          count?: number
          expected?: string | null
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          lovable_prompt?: string | null
          message?: string
          owner_notes?: string | null
          repro_steps?: string | null
          severity?: string
          source?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_app_errors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_app_errors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_app_errors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_archetype_metrics: {
        Row: {
          addon_adoption_rate: number | null
          archetype: string
          avg_days_to_first_event: number | null
          avg_days_to_first_reflection: number | null
          avg_days_to_first_signal: number | null
          avg_impulsus_per_week: number | null
          conversion_rate: number | null
          drift_rate: number | null
          id: string
          tenant_count: number
          updated_at: string
        }
        Insert: {
          addon_adoption_rate?: number | null
          archetype: string
          avg_days_to_first_event?: number | null
          avg_days_to_first_reflection?: number | null
          avg_days_to_first_signal?: number | null
          avg_impulsus_per_week?: number | null
          conversion_rate?: number | null
          drift_rate?: number | null
          id?: string
          tenant_count?: number
          updated_at?: string
        }
        Update: {
          addon_adoption_rate?: number | null
          archetype?: string
          avg_days_to_first_event?: number | null
          avg_days_to_first_reflection?: number | null
          avg_days_to_first_signal?: number | null
          avg_impulsus_per_week?: number | null
          conversion_rate?: number | null
          drift_rate?: number | null
          id?: string
          tenant_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      operator_awareness_events: {
        Row: {
          category: string
          created_at: string
          dedupe_key: string | null
          id: string
          metadata: Json
          metro_id: string | null
          resolved: boolean
          signal_strength: number
          source: string
          summary: string
          tenant_id: string | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          metadata?: Json
          metro_id?: string | null
          resolved?: boolean
          signal_strength?: number
          source: string
          summary: string
          tenant_id?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          metadata?: Json
          metro_id?: string | null
          resolved?: boolean
          signal_strength?: number
          source?: string
          summary?: string
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_awareness_events_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "operator_awareness_events_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_awareness_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_awareness_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_awareness_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_contacts: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          id: string
          name: string
          notes: string | null
          opportunity_id: string | null
          organization: string | null
          phone: string | null
          source: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          opportunity_id?: string | null
          organization?: string | null
          phone?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          opportunity_id?: string | null
          organization?: string | null
          phone?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_contacts_opportunity_fk"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "operator_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      operator_content_drafts: {
        Row: {
          anchor_archetypes: string[] | null
          anchor_reason: string | null
          approved_at: string | null
          approved_by: string | null
          body: string
          collection: string | null
          created_at: string | null
          created_by: string
          disclaimer: string
          draft_type: string
          editorial_mode: string
          essay_type: string
          generator: string | null
          gravity_score: number
          hero_image_url: string | null
          id: string
          is_anchor: boolean
          is_interim_content: boolean
          month_tag: string | null
          movement_source: string | null
          narrative_source: string
          og_image: string | null
          public_url: string | null
          published_at: string | null
          reflection_cycle: string | null
          review_notes: string | null
          scheduled_for: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          slug_locked: boolean
          source_app: string
          source_item_ids: string[]
          status: string
          template_id: string | null
          title: string
          unpublished_at: string | null
          updated_at: string | null
          voice_calibrated: boolean
          voice_calibrated_at: string | null
          voice_origin: string
          voice_profile: string
        }
        Insert: {
          anchor_archetypes?: string[] | null
          anchor_reason?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body: string
          collection?: string | null
          created_at?: string | null
          created_by: string
          disclaimer?: string
          draft_type: string
          editorial_mode?: string
          essay_type?: string
          generator?: string | null
          gravity_score?: number
          hero_image_url?: string | null
          id?: string
          is_anchor?: boolean
          is_interim_content?: boolean
          month_tag?: string | null
          movement_source?: string | null
          narrative_source?: string
          og_image?: string | null
          public_url?: string | null
          published_at?: string | null
          reflection_cycle?: string | null
          review_notes?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          slug_locked?: boolean
          source_app?: string
          source_item_ids?: string[]
          status?: string
          template_id?: string | null
          title: string
          unpublished_at?: string | null
          updated_at?: string | null
          voice_calibrated?: boolean
          voice_calibrated_at?: string | null
          voice_origin?: string
          voice_profile?: string
        }
        Update: {
          anchor_archetypes?: string[] | null
          anchor_reason?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          collection?: string | null
          created_at?: string | null
          created_by?: string
          disclaimer?: string
          draft_type?: string
          editorial_mode?: string
          essay_type?: string
          generator?: string | null
          gravity_score?: number
          hero_image_url?: string | null
          id?: string
          is_anchor?: boolean
          is_interim_content?: boolean
          month_tag?: string | null
          movement_source?: string | null
          narrative_source?: string
          og_image?: string | null
          public_url?: string | null
          published_at?: string | null
          reflection_cycle?: string | null
          review_notes?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          slug_locked?: boolean
          source_app?: string
          source_item_ids?: string[]
          status?: string
          template_id?: string | null
          title?: string
          unpublished_at?: string | null
          updated_at?: string | null
          voice_calibrated?: boolean
          voice_calibrated_at?: string | null
          voice_origin?: string
          voice_profile?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_content_drafts_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "essay_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_content_settings: {
        Row: {
          allow_publish_to_public_site: boolean | null
          created_at: string | null
          created_by: string
          enabled: boolean | null
          id: string
          publish_target: string | null
        }
        Insert: {
          allow_publish_to_public_site?: boolean | null
          created_at?: string | null
          created_by: string
          enabled?: boolean | null
          id?: string
          publish_target?: string | null
        }
        Update: {
          allow_publish_to_public_site?: boolean | null
          created_at?: string | null
          created_by?: string
          enabled?: boolean | null
          id?: string
          publish_target?: string | null
        }
        Relationships: []
      }
      operator_expansion_watch: {
        Row: {
          created_at: string
          id: string
          metro_id: string
          notes: string | null
          phase: string
          risk_level: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metro_id: string
          notes?: string | null
          phase?: string
          risk_level?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metro_id?: string
          notes?: string | null
          phase?: string
          risk_level?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_expansion_watch_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "operator_expansion_watch_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_expansion_watch_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_expansion_watch_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_expansion_watch_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_feature_overrides: {
        Row: {
          enabled: boolean
          feature_key: string
          reason: string | null
          set_at: string
          set_by: string | null
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          reason?: string | null
          set_at?: string
          set_by?: string | null
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          reason?: string | null
          set_at?: string
          set_by?: string | null
        }
        Relationships: []
      }
      operator_focus_tenant: {
        Row: {
          created_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_focus_tenant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_focus_tenant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_focus_tenant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_import_notices: {
        Row: {
          adoption_momentum_score: number
          contact_count: number
          coverage_mode: string
          created_at: string
          has_activities: boolean
          has_events: boolean
          has_notes: boolean
          household_count: number
          id: string
          narrative_summary: string
          partner_count: number
          source_connector: string | null
          suggested_playbooks: string[]
          tenant_id: string
        }
        Insert: {
          adoption_momentum_score?: number
          contact_count?: number
          coverage_mode?: string
          created_at?: string
          has_activities?: boolean
          has_events?: boolean
          has_notes?: boolean
          household_count?: number
          id?: string
          narrative_summary?: string
          partner_count?: number
          source_connector?: string | null
          suggested_playbooks?: string[]
          tenant_id: string
        }
        Update: {
          adoption_momentum_score?: number
          contact_count?: number
          coverage_mode?: string
          created_at?: string
          has_activities?: boolean
          has_events?: boolean
          has_notes?: boolean
          household_count?: number
          id?: string
          narrative_summary?: string
          partner_count?: number
          source_connector?: string | null
          suggested_playbooks?: string[]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_import_notices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_import_notices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_import_notices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_insight_notes: {
        Row: {
          created_at: string
          deep_link: string | null
          evidence: Json
          id: string
          narrative: string
          status: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          deep_link?: string | null
          evidence?: Json
          id?: string
          narrative: string
          status?: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          deep_link?: string | null
          evidence?: Json
          id?: string
          narrative?: string
          status?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      operator_intake: {
        Row: {
          attachments: Json
          body: string
          client_meta: Json
          created_at: string
          id: string
          intake_type: string
          module_key: string | null
          operator_notes: string | null
          page_path: string | null
          resolved_at: string | null
          status: string
          submitted_by: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body: string
          client_meta?: Json
          created_at?: string
          id?: string
          intake_type: string
          module_key?: string | null
          operator_notes?: string | null
          page_path?: string | null
          resolved_at?: string | null
          status?: string
          submitted_by: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string
          client_meta?: Json
          created_at?: string
          id?: string
          intake_type?: string
          module_key?: string | null
          operator_notes?: string | null
          page_path?: string | null
          resolved_at?: string | null
          status?: string
          submitted_by?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_intake_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_intake_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_intake_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_integration_health: {
        Row: {
          connector_key: string
          environment: string
          error_count: number
          id: string
          last_checked_at: string | null
          last_error_code: string | null
          last_status: string
          last_sync_at: string | null
          real_runs_failed: number
          real_runs_passed: number
          simulated_runs_failed: number
          simulated_runs_passed: number
          success_rate: number
          success_rate_30d: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          connector_key: string
          environment: string
          error_count?: number
          id?: string
          last_checked_at?: string | null
          last_error_code?: string | null
          last_status?: string
          last_sync_at?: string | null
          real_runs_failed?: number
          real_runs_passed?: number
          simulated_runs_failed?: number
          simulated_runs_passed?: number
          success_rate?: number
          success_rate_30d?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          connector_key?: string
          environment?: string
          error_count?: number
          id?: string
          last_checked_at?: string | null
          last_error_code?: string | null
          last_status?: string
          last_sync_at?: string | null
          real_runs_failed?: number
          real_runs_passed?: number
          simulated_runs_failed?: number
          simulated_runs_passed?: number
          success_rate?: number
          success_rate_30d?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_integration_health_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_integration_health_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_integration_health_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_job_health: {
        Row: {
          cadence: string
          created_at: string
          id: string
          job_key: string
          last_error: Json | null
          last_ok_at: string | null
          last_run_at: string | null
          last_stats: Json
          last_status: string
          tenant_id: string | null
        }
        Insert: {
          cadence: string
          created_at?: string
          id?: string
          job_key: string
          last_error?: Json | null
          last_ok_at?: string | null
          last_run_at?: string | null
          last_stats?: Json
          last_status?: string
          tenant_id?: string | null
        }
        Update: {
          cadence?: string
          created_at?: string
          id?: string
          job_key?: string
          last_error?: Json | null
          last_ok_at?: string | null
          last_run_at?: string | null
          last_stats?: Json
          last_status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_job_health_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_job_health_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_job_health_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_journey_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          opportunity_id: string
          stage: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          opportunity_id: string
          stage: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          opportunity_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_journey_notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "operator_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_metro_metrics: {
        Row: {
          communio_overlap_score: number
          expansion_interest_count: number
          growth_velocity: number
          metro_id: string
          tenant_count: number
          updated_at: string
        }
        Insert: {
          communio_overlap_score?: number
          expansion_interest_count?: number
          growth_velocity?: number
          metro_id: string
          tenant_count?: number
          updated_at?: string
        }
        Update: {
          communio_overlap_score?: number
          expansion_interest_count?: number
          growth_velocity?: number
          metro_id?: string
          tenant_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_metro_metrics_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: true
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "operator_metro_metrics_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: true
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_narrative_metrics: {
        Row: {
          assistant_intervention_count: number
          assistant_resolution_count: number
          drift_events: number
          drift_risk_count: number | null
          expansion_ready_count: number | null
          friction_abandon_count: number
          friction_idle_count: number
          friction_repeat_nav_count: number
          heatmap_updates: number
          id: string
          lumen_signal_count: number | null
          signal_count: number
          tenant_id: string
          testimonium_runs: number
          top_friction_pages: Json
          updated_at: string
        }
        Insert: {
          assistant_intervention_count?: number
          assistant_resolution_count?: number
          drift_events?: number
          drift_risk_count?: number | null
          expansion_ready_count?: number | null
          friction_abandon_count?: number
          friction_idle_count?: number
          friction_repeat_nav_count?: number
          heatmap_updates?: number
          id?: string
          lumen_signal_count?: number | null
          signal_count?: number
          tenant_id: string
          testimonium_runs?: number
          top_friction_pages?: Json
          updated_at?: string
        }
        Update: {
          assistant_intervention_count?: number
          assistant_resolution_count?: number
          drift_events?: number
          drift_risk_count?: number | null
          expansion_ready_count?: number | null
          friction_abandon_count?: number
          friction_idle_count?: number
          friction_repeat_nav_count?: number
          heatmap_updates?: number
          id?: string
          lumen_signal_count?: number | null
          signal_count?: number
          tenant_id?: string
          testimonium_runs?: number
          top_friction_pages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_narrative_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_narrative_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_narrative_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_notification_settings: {
        Row: {
          created_at: string
          daily_digest_time: string
          email_enabled: boolean
          notify_on_activation_stuck: boolean
          notify_on_critical_error: boolean
          notify_on_draft_ready: boolean
          notify_on_error_spike: boolean
          notify_on_qa_fail: boolean
          operator_user_id: string
          push_enabled: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_digest_time?: string
          email_enabled?: boolean
          notify_on_activation_stuck?: boolean
          notify_on_critical_error?: boolean
          notify_on_draft_ready?: boolean
          notify_on_error_spike?: boolean
          notify_on_qa_fail?: boolean
          operator_user_id: string
          push_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_digest_time?: string
          email_enabled?: boolean
          notify_on_activation_stuck?: boolean
          notify_on_critical_error?: boolean
          notify_on_draft_ready?: boolean
          notify_on_error_spike?: boolean
          notify_on_qa_fail?: boolean
          operator_user_id?: string
          push_enabled?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      operator_notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          deep_link: string | null
          id: string
          is_read: boolean
          metadata: Json
          operator_user_id: string
          routed_gardener_id: string | null
          routing_reason: string | null
          sent_at: string | null
          severity: string
          tenant_id: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key?: string | null
          deep_link?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json
          operator_user_id: string
          routed_gardener_id?: string | null
          routing_reason?: string | null
          sent_at?: string | null
          severity?: string
          tenant_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          deep_link?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json
          operator_user_id?: string
          routed_gardener_id?: string | null
          routing_reason?: string | null
          sent_at?: string | null
          severity?: string
          tenant_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_notifications_routed_gardener_id_fkey"
            columns: ["routed_gardener_id"]
            isOneToOne: false
            referencedRelation: "gardeners"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_nri_observations: {
        Row: {
          body: string
          created_at: string
          id: string
          metadata: Json
          observation_type: string
          period_end: string
          period_start: string
          signal_count: number
          suggested_action: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          observation_type?: string
          period_end: string
          period_start: string
          signal_count?: number
          suggested_action?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          observation_type?: string
          period_end?: string
          period_start?: string
          signal_count?: number
          suggested_action?: string | null
          title?: string
        }
        Relationships: []
      }
      operator_opportunities: {
        Row: {
          best_partnership_angle: string[] | null
          city: string | null
          created_at: string
          created_by: string
          description: string | null
          enrichment_run_id: string | null
          grant_alignment: string[] | null
          id: string
          metro: string | null
          mission_snapshot: string[] | null
          neighborhood_status: string | null
          notes: string | null
          org_enrichment_status: string | null
          org_knowledge_status: string | null
          organization: string
          partner_tier: string | null
          partner_tiers: string[] | null
          primary_contact_id: string | null
          source: string | null
          stage: string
          state: string | null
          status: string
          updated_at: string
          website: string | null
          website_url: string | null
          zip: string | null
        }
        Insert: {
          best_partnership_angle?: string[] | null
          city?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          enrichment_run_id?: string | null
          grant_alignment?: string[] | null
          id?: string
          metro?: string | null
          mission_snapshot?: string[] | null
          neighborhood_status?: string | null
          notes?: string | null
          org_enrichment_status?: string | null
          org_knowledge_status?: string | null
          organization: string
          partner_tier?: string | null
          partner_tiers?: string[] | null
          primary_contact_id?: string | null
          source?: string | null
          stage?: string
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          website_url?: string | null
          zip?: string | null
        }
        Update: {
          best_partnership_angle?: string[] | null
          city?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          enrichment_run_id?: string | null
          grant_alignment?: string[] | null
          id?: string
          metro?: string | null
          mission_snapshot?: string[] | null
          neighborhood_status?: string | null
          notes?: string | null
          org_enrichment_status?: string | null
          org_knowledge_status?: string | null
          organization?: string
          partner_tier?: string | null
          partner_tiers?: string[] | null
          primary_contact_id?: string | null
          source?: string | null
          stage?: string
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          website_url?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_opportunities_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "operator_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_opportunity_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          opportunity_id: string
          role: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          opportunity_id: string
          role?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_opportunity_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "operator_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_opportunity_contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "operator_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_playbooks: {
        Row: {
          category: string
          content_md: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      operator_preferences: {
        Row: {
          calm_mode: boolean
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calm_mode?: boolean
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calm_mode?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operator_presence_rollups: {
        Row: {
          created_at: string
          id: string
          last_activity_at: string | null
          metro_id: string | null
          tenant_id: string
          unique_opportunities_touched: number
          unique_users_contributed: number
          visit_notes_count: number
          visit_notes_typed_count: number
          visit_notes_voice_count: number
          visit_notes_with_audio_retained_count: number
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_activity_at?: string | null
          metro_id?: string | null
          tenant_id: string
          unique_opportunities_touched?: number
          unique_users_contributed?: number
          visit_notes_count?: number
          visit_notes_typed_count?: number
          visit_notes_voice_count?: number
          visit_notes_with_audio_retained_count?: number
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          last_activity_at?: string | null
          metro_id?: string | null
          tenant_id?: string
          unique_opportunities_touched?: number
          unique_users_contributed?: number
          visit_notes_count?: number
          visit_notes_typed_count?: number
          visit_notes_voice_count?: number
          visit_notes_with_audio_retained_count?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_presence_rollups_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "operator_presence_rollups_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_presence_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_presence_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_presence_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_presence_signals: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          severity: string
          signal_type: string
          summary: string
          tenant_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          severity?: string
          signal_type: string
          summary: string
          tenant_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          severity?: string
          signal_type?: string
          summary?: string
          tenant_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_presence_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_presence_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_presence_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          operator_user_id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          operator_user_id: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          operator_user_id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      operator_referrals: {
        Row: {
          campaign_label: string | null
          code: string
          created_at: string
          operator_user_id: string
        }
        Insert: {
          campaign_label?: string | null
          code: string
          created_at?: string
          operator_user_id: string
        }
        Update: {
          campaign_label?: string | null
          code?: string
          created_at?: string
          operator_user_id?: string
        }
        Relationships: []
      }
      operator_rollups_daily: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          rollup_date: string
          rollup_key: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          rollup_date: string
          rollup_key: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          rollup_date?: string
          rollup_key?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_rollups_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_rollups_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_rollups_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_rss_items: {
        Row: {
          author: string | null
          content: string | null
          fetched_at: string | null
          guid: string
          id: string
          link: string
          published_at: string | null
          source_app: string
          source_id: string | null
          summary: string | null
          title: string
        }
        Insert: {
          author?: string | null
          content?: string | null
          fetched_at?: string | null
          guid: string
          id?: string
          link: string
          published_at?: string | null
          source_app?: string
          source_id?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          author?: string | null
          content?: string | null
          fetched_at?: string | null
          guid?: string
          id?: string
          link?: string
          published_at?: string | null
          source_app?: string
          source_id?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_rss_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "operator_rss_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_rss_sources: {
        Row: {
          category: string
          created_at: string | null
          created_by: string
          enabled: boolean
          id: string
          name: string
          source_app: string
          url: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          created_by: string
          enabled?: boolean
          id?: string
          name: string
          source_app?: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string
          enabled?: boolean
          id?: string
          name?: string
          source_app?: string
          url?: string
        }
        Relationships: []
      }
      operator_schedules: {
        Row: {
          cadence: string
          enabled: boolean
          id: string
          key: string
          last_error: Json | null
          last_run_at: string | null
          last_stats: Json
          last_status: string | null
          updated_at: string
        }
        Insert: {
          cadence: string
          enabled?: boolean
          id?: string
          key: string
          last_error?: Json | null
          last_run_at?: string | null
          last_stats?: Json
          last_status?: string | null
          updated_at?: string
        }
        Update: {
          cadence?: string
          enabled?: boolean
          id?: string
          key?: string
          last_error?: Json | null
          last_run_at?: string | null
          last_stats?: Json
          last_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      operator_security_settings: {
        Row: {
          allow_demo_impersonation: boolean
          allow_production_impersonation: boolean
          id: string
          max_impersonation_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_demo_impersonation?: boolean
          allow_production_impersonation?: boolean
          id?: string
          max_impersonation_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_demo_impersonation?: boolean
          allow_production_impersonation?: boolean
          id?: string
          max_impersonation_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      operator_signup_links: {
        Row: {
          campaign_name: string
          created_at: string | null
          created_by: string | null
          default_archetype: string | null
          id: string
          slug: string
        }
        Insert: {
          campaign_name: string
          created_at?: string | null
          created_by?: string | null
          default_archetype?: string | null
          id?: string
          slug: string
        }
        Update: {
          campaign_name?: string
          created_at?: string | null
          created_by?: string | null
          default_archetype?: string | null
          id?: string
          slug?: string
        }
        Relationships: []
      }
      operator_simulation_settings: {
        Row: {
          allow_demo_only: boolean
          allowed_tenant_ids: string[]
          created_at: string | null
          created_by: string
          enabled: boolean
          id: string
          intensity: string
          simulate_events: boolean
          simulate_outreach: boolean
          simulate_provisio: boolean
          simulate_reflections: boolean
          simulate_visits: boolean
          simulate_voice_notes: boolean
          simulate_voluntarium: boolean
          updated_at: string | null
        }
        Insert: {
          allow_demo_only?: boolean
          allowed_tenant_ids?: string[]
          created_at?: string | null
          created_by: string
          enabled?: boolean
          id?: string
          intensity?: string
          simulate_events?: boolean
          simulate_outreach?: boolean
          simulate_provisio?: boolean
          simulate_reflections?: boolean
          simulate_visits?: boolean
          simulate_voice_notes?: boolean
          simulate_voluntarium?: boolean
          updated_at?: string | null
        }
        Update: {
          allow_demo_only?: boolean
          allowed_tenant_ids?: string[]
          created_at?: string | null
          created_by?: string
          enabled?: boolean
          id?: string
          intensity?: string
          simulate_events?: boolean
          simulate_outreach?: boolean
          simulate_provisio?: boolean
          simulate_reflections?: boolean
          simulate_visits?: boolean
          simulate_voice_notes?: boolean
          simulate_voluntarium?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      operator_tenant_stats: {
        Row: {
          active_users: number
          addon_count: number | null
          adoption_momentum: number | null
          archetype: string
          communio_opt_in: boolean
          events_count: number
          expansion_count: number | null
          guided_activation_count: number | null
          id: string
          last_activity_at: string | null
          monthly_revenue_cents: number | null
          narrative_signals_count: number
          opportunities_count: number
          reflections_count: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active_users?: number
          addon_count?: number | null
          adoption_momentum?: number | null
          archetype?: string
          communio_opt_in?: boolean
          events_count?: number
          expansion_count?: number | null
          guided_activation_count?: number | null
          id?: string
          last_activity_at?: string | null
          monthly_revenue_cents?: number | null
          narrative_signals_count?: number
          opportunities_count?: number
          reflections_count?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active_users?: number
          addon_count?: number | null
          adoption_momentum?: number | null
          archetype?: string
          communio_opt_in?: boolean
          events_count?: number
          expansion_count?: number | null
          guided_activation_count?: number | null
          id?: string
          last_activity_at?: string | null
          monthly_revenue_cents?: number | null
          narrative_signals_count?: number
          opportunities_count?: number
          reflections_count?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_tenant_stats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_tenant_stats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_tenant_stats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_test_run_steps: {
        Row: {
          created_at: string
          details: Json
          id: string
          label: string
          status: string
          step_key: string
          test_run_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          label: string
          status: string
          step_key: string
          test_run_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          label?: string
          status?: string
          step_key?: string
          test_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_test_run_steps_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "operator_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_test_runs: {
        Row: {
          completed_at: string | null
          environment: string
          error: Json | null
          id: string
          started_at: string
          started_by: string
          status: string
          suite_key: string
          summary: Json
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          environment: string
          error?: Json | null
          id?: string
          started_at?: string
          started_by: string
          status: string
          suite_key: string
          summary?: Json
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          environment?: string
          error?: Json | null
          id?: string
          started_at?: string
          started_by?: string
          status?: string
          suite_key?: string
          summary?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_test_runs_suite_key_fkey"
            columns: ["suite_key"]
            isOneToOne: false
            referencedRelation: "operator_test_suites"
            referencedColumns: ["key"]
          },
        ]
      }
      operator_test_suites: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      operator_value_moments: {
        Row: {
          created_at: string
          id: string
          moment_type: string
          occurred_at: string
          pointers: Json
          summary: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          moment_type: string
          occurred_at?: string
          pointers?: Json
          summary: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          moment_type?: string
          occurred_at?: string
          pointers?: Json
          summary?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_value_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_value_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_value_moments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_work_queue: {
        Row: {
          created_at: string
          id: string
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          summary: string
          tenant_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          summary: string
          tenant_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          summary?: string
          tenant_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_work_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_work_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "operator_work_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          address_line1: string | null
          best_partnership_angle: string[] | null
          city: string | null
          conversion_source: string | null
          county: string | null
          county_fips: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          enrichment_run_id: string | null
          external_ids: Json
          grant_alignment: string[] | null
          id: string
          is_tenant_partner: boolean
          last_activity_at: string | null
          last_contact_date: string | null
          last_enriched_at: string | null
          metro_id: string | null
          mission_snapshot: string[] | null
          neighborhood_status: string
          next_action_due: string | null
          next_step: string | null
          notes: string | null
          onboarding_state: string | null
          opportunity_id: string
          org_enrichment_status: string
          org_knowledge_status: string
          organization: string
          origin_type: string
          owner_id: string | null
          partner_tier: string | null
          partner_tiers: string[] | null
          place_fips: string | null
          plan_tier: string | null
          primary_contact_email: string | null
          primary_contact_id: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_title: string | null
          seats_allocated: number | null
          seats_used: number | null
          slug: string | null
          source_opportunity_id: string | null
          source_user_id: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          stale_flagged: boolean | null
          stale_flagged_at: string | null
          state: string | null
          state_code: string | null
          state_fips: string | null
          status: Database["public"]["Enums"]["opportunity_status"] | null
          stripe_customer_id: string | null
          subscription_status: string | null
          tenant_id: string | null
          tenant_slug: string | null
          updated_at: string | null
          website_domain: string | null
          website_url: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          best_partnership_angle?: string[] | null
          city?: string | null
          conversion_source?: string | null
          county?: string | null
          county_fips?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enrichment_run_id?: string | null
          external_ids?: Json
          grant_alignment?: string[] | null
          id?: string
          is_tenant_partner?: boolean
          last_activity_at?: string | null
          last_contact_date?: string | null
          last_enriched_at?: string | null
          metro_id?: string | null
          mission_snapshot?: string[] | null
          neighborhood_status?: string
          next_action_due?: string | null
          next_step?: string | null
          notes?: string | null
          onboarding_state?: string | null
          opportunity_id: string
          org_enrichment_status?: string
          org_knowledge_status?: string
          organization: string
          origin_type?: string
          owner_id?: string | null
          partner_tier?: string | null
          partner_tiers?: string[] | null
          place_fips?: string | null
          plan_tier?: string | null
          primary_contact_email?: string | null
          primary_contact_id?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_title?: string | null
          seats_allocated?: number | null
          seats_used?: number | null
          slug?: string | null
          source_opportunity_id?: string | null
          source_user_id?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          stale_flagged?: boolean | null
          stale_flagged_at?: string | null
          state?: string | null
          state_code?: string | null
          state_fips?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"] | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tenant_id?: string | null
          tenant_slug?: string | null
          updated_at?: string | null
          website_domain?: string | null
          website_url?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          best_partnership_angle?: string[] | null
          city?: string | null
          conversion_source?: string | null
          county?: string | null
          county_fips?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enrichment_run_id?: string | null
          external_ids?: Json
          grant_alignment?: string[] | null
          id?: string
          is_tenant_partner?: boolean
          last_activity_at?: string | null
          last_contact_date?: string | null
          last_enriched_at?: string | null
          metro_id?: string | null
          mission_snapshot?: string[] | null
          neighborhood_status?: string
          next_action_due?: string | null
          next_step?: string | null
          notes?: string | null
          onboarding_state?: string | null
          opportunity_id?: string
          org_enrichment_status?: string
          org_knowledge_status?: string
          organization?: string
          origin_type?: string
          owner_id?: string | null
          partner_tier?: string | null
          partner_tiers?: string[] | null
          place_fips?: string | null
          plan_tier?: string | null
          primary_contact_email?: string | null
          primary_contact_id?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_title?: string | null
          seats_allocated?: number | null
          seats_used?: number | null
          slug?: string | null
          source_opportunity_id?: string | null
          source_user_id?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          stale_flagged?: boolean | null
          stale_flagged_at?: string | null
          state?: string | null
          state_code?: string | null
          state_fips?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"] | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tenant_id?: string | null
          tenant_slug?: string | null
          updated_at?: string | null
          website_domain?: string | null
          website_url?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "opportunities_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_source_opportunity_id_fkey"
            columns: ["source_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_source_opportunity_id_fkey"
            columns: ["source_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_memory_threads: {
        Row: {
          computed_at: string
          created_at: string
          id: string
          memory_json: Json
          opportunity_id: string
          updated_at: string
          version: string
          window_end: string
          window_start: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          id?: string
          memory_json?: Json
          opportunity_id: string
          updated_at?: string
          version?: string
          window_end: string
          window_start: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          id?: string
          memory_json?: Json
          opportunity_id?: string
          updated_at?: string
          version?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_memory_threads_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_memory_threads_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      opportunity_order_items: {
        Row: {
          catalog_item_id: string | null
          created_at: string
          id: string
          order_id: string
          product_name: string | null
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_name?: string | null
          quantity?: number
          unit_price_cents?: number
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
          product_name?: string | null
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_order_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "provision_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "opportunity_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_orders: {
        Row: {
          created_at: string
          entered_by: string
          id: string
          notes: string | null
          opportunity_id: string
          order_count: number
          order_date: string
          tenant_id: string | null
          total_cents: number
          total_quantity: number
        }
        Insert: {
          created_at?: string
          entered_by: string
          id?: string
          notes?: string | null
          opportunity_id: string
          order_count: number
          order_date?: string
          tenant_id?: string | null
          total_cents?: number
          total_quantity?: number
        }
        Update: {
          created_at?: string
          entered_by?: string
          id?: string
          notes?: string | null
          opportunity_id?: string
          order_count?: number
          order_date?: string
          tenant_id?: string | null
          total_cents?: number
          total_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_orders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_orders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "opportunity_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "opportunity_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_reflections: {
        Row: {
          author_id: string
          body: string
          created_at: string
          follow_up_date: string | null
          id: string
          opportunity_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          opportunity_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          opportunity_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_reflections_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_reflections_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      opportunity_signals: {
        Row: {
          confidence: number | null
          contact_id: string | null
          created_at: string
          detected_at: string
          id: string
          opportunity_id: string | null
          run_id: string
          signal_fingerprint: string | null
          signal_reason: string | null
          signal_type: string
          signal_value: string | null
          source_id: string | null
          source_type: string | null
          source_url: string | null
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          contact_id?: string | null
          created_at?: string
          detected_at?: string
          id?: string
          opportunity_id?: string | null
          run_id: string
          signal_fingerprint?: string | null
          signal_reason?: string | null
          signal_type: string
          signal_value?: string | null
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          contact_id?: string | null
          created_at?: string
          detected_at?: string
          id?: string
          opportunity_id?: string | null
          run_id?: string
          signal_fingerprint?: string | null
          signal_reason?: string | null
          signal_type?: string
          signal_value?: string | null
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_signals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_signals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_signals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_signals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      org_action_feedback: {
        Row: {
          action_type: string
          created_at: string
          id: string
          org_id: string
          outcome: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          org_id: string
          outcome: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          org_id?: string
          outcome?: string
        }
        Relationships: []
      }
      org_action_outcomes: {
        Row: {
          action_id: string
          created_at: string
          id: string
          notes: string | null
          org_id: string
          outcome_type: string
          recorded_by: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          outcome_type: string
          recorded_by?: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          outcome_type?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_action_outcomes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "org_recommended_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_actions: {
        Row: {
          action_type: string
          created_at: string
          executed_at: string | null
          hypothesis: string | null
          id: string
          org_id: string
          source: string
          source_ref_id: string | null
          status: string
        }
        Insert: {
          action_type: string
          created_at?: string
          executed_at?: string | null
          hypothesis?: string | null
          id?: string
          org_id: string
          source: string
          source_ref_id?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          executed_at?: string | null
          hypothesis?: string | null
          id?: string
          org_id?: string
          source?: string
          source_ref_id?: string | null
          status?: string
        }
        Relationships: []
      }
      org_campaign_outcomes: {
        Row: {
          action_id: string
          confidence: number
          created_at: string
          id: string
          metadata: Json
          observed_at: string
          outcome_type: string
        }
        Insert: {
          action_id: string
          confidence?: number
          created_at?: string
          id?: string
          metadata?: Json
          observed_at?: string
          outcome_type: string
        }
        Update: {
          action_id?: string
          confidence?: number
          created_at?: string
          id?: string
          metadata?: Json
          observed_at?: string
          outcome_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_campaign_outcomes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "org_action_history_v"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "org_campaign_outcomes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "org_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      org_enrichment_facts: {
        Row: {
          created_at: string
          extraction_id: string
          funding_signals: string[] | null
          geographies: string[] | null
          id: string
          keywords: string[] | null
          mission_summary: string | null
          org_name: string
          populations_served: string[] | null
          programs: string[] | null
          run_id: string
        }
        Insert: {
          created_at?: string
          extraction_id: string
          funding_signals?: string[] | null
          geographies?: string[] | null
          id?: string
          keywords?: string[] | null
          mission_summary?: string | null
          org_name: string
          populations_served?: string[] | null
          programs?: string[] | null
          run_id: string
        }
        Update: {
          created_at?: string
          extraction_id?: string
          funding_signals?: string[] | null
          geographies?: string[] | null
          id?: string
          keywords?: string[] | null
          mission_summary?: string | null
          org_name?: string
          populations_served?: string[] | null
          programs?: string[] | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_enrichment_facts_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "org_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_enrichment_facts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      org_extractions: {
        Row: {
          created_at: string
          id: string
          org_name: string
          raw_extraction: Json | null
          run_id: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          org_name: string
          raw_extraction?: Json | null
          run_id: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          org_name?: string
          raw_extraction?: Json | null
          run_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_extractions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      org_insight_generation_locks: {
        Row: {
          last_inputs_hash: string | null
          last_triggered_at: string
          lock_until: string
          org_id: string
          updated_at: string
        }
        Insert: {
          last_inputs_hash?: string | null
          last_triggered_at?: string
          lock_until?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          last_inputs_hash?: string | null
          last_triggered_at?: string
          lock_until?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_insight_generation_locks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_insight_generation_locks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      org_insights: {
        Row: {
          confidence: number
          created_by: string | null
          explanation: string | null
          explanation_model: string | null
          explanation_tokens_in: number | null
          explanation_tokens_out: number | null
          generated_at: string
          generated_date: string
          id: string
          insight_type: string
          org_id: string
          severity: string
          source: Json
          status: string
          summary: string
          title: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          confidence?: number
          created_by?: string | null
          explanation?: string | null
          explanation_model?: string | null
          explanation_tokens_in?: number | null
          explanation_tokens_out?: number | null
          generated_at?: string
          generated_date?: string
          id?: string
          insight_type: string
          org_id: string
          severity: string
          source?: Json
          status?: string
          summary: string
          title: string
          updated_at?: string
          valid_until?: string
        }
        Update: {
          confidence?: number
          created_by?: string | null
          explanation?: string | null
          explanation_model?: string | null
          explanation_tokens_in?: number | null
          explanation_tokens_out?: number | null
          generated_at?: string
          generated_date?: string
          id?: string
          insight_type?: string
          org_id?: string
          severity?: string
          source?: Json
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      org_knowledge_profiles: {
        Row: {
          created_at: string
          ecosystem_scope: Json
          event_targeting_profile: Json
          geo_reach_profile: Json
          grant_alignment_vectors: Json
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ecosystem_scope?: Json
          event_targeting_profile?: Json
          geo_reach_profile?: Json
          grant_alignment_vectors?: Json
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ecosystem_scope?: Json
          event_targeting_profile?: Json
          geo_reach_profile?: Json
          grant_alignment_vectors?: Json
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_knowledge_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_knowledge_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      org_knowledge_snapshots: {
        Row: {
          active: boolean
          captured_at: string
          content_hash: string
          created_at: string
          created_by: string
          external_org_key: string | null
          fresh_until: string | null
          id: string
          is_authoritative: boolean
          model: string
          notes: string | null
          org_id: string | null
          raw_excerpt: string
          replaced_by: string | null
          source_type: string
          source_url: string
          structured_json: Json
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          captured_at?: string
          content_hash: string
          created_at?: string
          created_by: string
          external_org_key?: string | null
          fresh_until?: string | null
          id?: string
          is_authoritative?: boolean
          model: string
          notes?: string | null
          org_id?: string | null
          raw_excerpt: string
          replaced_by?: string | null
          source_type?: string
          source_url: string
          structured_json?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          captured_at?: string
          content_hash?: string
          created_at?: string
          created_by?: string
          external_org_key?: string | null
          fresh_until?: string | null
          id?: string
          is_authoritative?: boolean
          model?: string
          notes?: string | null
          org_id?: string | null
          raw_excerpt?: string
          replaced_by?: string | null
          source_type?: string
          source_url?: string
          structured_json?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_knowledge_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_knowledge_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "org_knowledge_snapshots_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "org_knowledge_current_v"
            referencedColumns: ["snapshot_id"]
          },
          {
            foreignKeyName: "org_knowledge_snapshots_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "org_knowledge_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      org_knowledge_sources: {
        Row: {
          content_hash: string
          id: string
          retrieved_at: string
          snapshot_id: string
          snippet: string | null
          title: string | null
          url: string
        }
        Insert: {
          content_hash: string
          id?: string
          retrieved_at?: string
          snapshot_id: string
          snippet?: string | null
          title?: string | null
          url: string
        }
        Update: {
          content_hash?: string
          id?: string
          retrieved_at?: string
          snapshot_id?: string
          snippet?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_knowledge_sources_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "org_knowledge_current_v"
            referencedColumns: ["snapshot_id"]
          },
          {
            foreignKeyName: "org_knowledge_sources_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "org_knowledge_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      org_neighborhood_insight_sources: {
        Row: {
          content_hash: string
          id: string
          insight_id: string
          retrieved_at: string
          snippet: string | null
          title: string | null
          url: string
        }
        Insert: {
          content_hash: string
          id?: string
          insight_id: string
          retrieved_at?: string
          snippet?: string | null
          title?: string | null
          url: string
        }
        Update: {
          content_hash?: string
          id?: string
          insight_id?: string
          retrieved_at?: string
          snippet?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_neighborhood_insight_sources_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "org_neighborhood_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      org_neighborhood_insights: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string
          fresh_until: string
          generated_at: string
          id: string
          insights_json: Json
          location_key: string
          model: string
          org_id: string
          summary: string
          updated_at: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by: string
          fresh_until: string
          generated_at?: string
          id?: string
          insights_json?: Json
          location_key: string
          model: string
          org_id: string
          summary: string
          updated_at?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string
          fresh_until?: string
          generated_at?: string
          id?: string
          insights_json?: Json
          location_key?: string
          model?: string
          org_id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_next_actions: {
        Row: {
          action_type: string
          confidence: number
          contact_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_evaluated_at: string
          org_id: string | null
          predicted_success_rate: number | null
          reasoning: string
          score: number
          severity: number
          snoozed_until: string | null
          source_id: string | null
          source_type: string
          status: string
          summary: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          confidence?: number
          contact_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_evaluated_at?: string
          org_id?: string | null
          predicted_success_rate?: number | null
          reasoning: string
          score?: number
          severity?: number
          snoozed_until?: string | null
          source_id?: string | null
          source_type: string
          status?: string
          summary: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          confidence?: number
          contact_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_evaluated_at?: string
          org_id?: string | null
          predicted_success_rate?: number | null
          reasoning?: string
          score?: number
          severity?: number
          snoozed_until?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          summary?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_next_actions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_next_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_next_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      org_recommended_actions: {
        Row: {
          action_type: string
          created_at: string
          cta_context: Json
          cta_label: string
          description: string
          id: string
          insight_id: string
          org_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          cta_context?: Json
          cta_label: string
          description: string
          id?: string
          insight_id: string
          org_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          cta_context?: Json
          cta_label?: string
          description?: string
          id?: string
          insight_id?: string
          org_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_recommended_actions_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "org_insight_effectiveness_v"
            referencedColumns: ["insight_id"]
          },
          {
            foreignKeyName: "org_recommended_actions_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "org_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_recommended_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_recommended_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      org_snapshot_diffs: {
        Row: {
          created_at: string
          diff: Json
          from_snapshot_id: string | null
          id: string
          org_id: string
          run_id: string | null
          to_snapshot_id: string
        }
        Insert: {
          created_at?: string
          diff?: Json
          from_snapshot_id?: string | null
          id?: string
          org_id: string
          run_id?: string | null
          to_snapshot_id: string
        }
        Update: {
          created_at?: string
          diff?: Json
          from_snapshot_id?: string | null
          id?: string
          org_id?: string
          run_id?: string | null
          to_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_snapshot_diffs_from_snapshot_id_fkey"
            columns: ["from_snapshot_id"]
            isOneToOne: false
            referencedRelation: "org_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_snapshot_diffs_to_snapshot_id_fkey"
            columns: ["to_snapshot_id"]
            isOneToOne: false
            referencedRelation: "org_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      org_snapshot_facts: {
        Row: {
          created_at: string
          facts: Json
          id: string
          model_version: string | null
          org_id: string
          run_id: string | null
          snapshot_id: string
        }
        Insert: {
          created_at?: string
          facts?: Json
          id?: string
          model_version?: string | null
          org_id: string
          run_id?: string | null
          snapshot_id: string
        }
        Update: {
          created_at?: string
          facts?: Json
          id?: string
          model_version?: string | null
          org_id?: string
          run_id?: string | null
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_snapshot_facts_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "org_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      org_snapshots: {
        Row: {
          content_hash: string
          crawled_at: string
          created_at: string
          id: string
          meta: Json
          org_id: string
          raw_text: string
          run_id: string | null
          url: string
        }
        Insert: {
          content_hash: string
          crawled_at?: string
          created_at?: string
          id?: string
          meta?: Json
          org_id: string
          raw_text?: string
          run_id?: string | null
          url: string
        }
        Update: {
          content_hash?: string
          crawled_at?: string
          created_at?: string
          id?: string
          meta?: Json
          org_id?: string
          raw_text?: string
          run_id?: string | null
          url?: string
        }
        Relationships: []
      }
      org_tasks: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          id: string
          org_id: string
          source: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          id?: string
          org_id: string
          source?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          id?: string
          org_id?: string
          source?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      org_watchlist: {
        Row: {
          cadence: string
          created_at: string
          enabled: boolean
          id: string
          last_crawled_at: string | null
          org_id: string
          tags: Json
          updated_at: string
          website_url: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_crawled_at?: string | null
          org_id: string
          tags?: Json
          updated_at?: string
          website_url: string
        }
        Update: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_crawled_at?: string | null
          org_id?: string
          tags?: Json
          updated_at?: string
          website_url?: string
        }
        Relationships: []
      }
      org_watchlist_signals: {
        Row: {
          confidence: number
          created_at: string
          diff_id: string | null
          escalation_reason: string | null
          fingerprint: string
          id: string
          llm_used: boolean | null
          org_id: string
          signal_type: string
          snapshot_id: string | null
          summary: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          diff_id?: string | null
          escalation_reason?: string | null
          fingerprint: string
          id?: string
          llm_used?: boolean | null
          org_id: string
          signal_type?: string
          snapshot_id?: string | null
          summary: string
        }
        Update: {
          confidence?: number
          created_at?: string
          diff_id?: string | null
          escalation_reason?: string | null
          fingerprint?: string
          id?: string
          llm_used?: boolean | null
          org_id?: string
          signal_type?: string
          snapshot_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_watchlist_signals_diff_id_fkey"
            columns: ["diff_id"]
            isOneToOne: false
            referencedRelation: "org_snapshot_diffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_watchlist_signals_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "org_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      outlook_connections: {
        Row: {
          access_token: string | null
          connection_status: string
          created_at: string
          email_address: string
          id: string
          last_sync_at: string | null
          refresh_token: string | null
          scopes: string[]
          tenant_domain: string | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connection_status?: string
          created_at?: string
          email_address: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          scopes?: string[]
          tenant_domain?: string | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connection_status?: string
          created_at?: string
          email_address?: string
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          scopes?: string[]
          tenant_domain?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlook_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "outlook_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "outlook_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_drafts: {
        Row: {
          alternates: Json
          body_html: string
          campaign_id: string | null
          context_json: Json | null
          created_at: string
          created_by: string
          id: string
          opportunity_id: string | null
          outreach_mode: string
          run_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          alternates?: Json
          body_html: string
          campaign_id?: string | null
          context_json?: Json | null
          created_at?: string
          created_by: string
          id?: string
          opportunity_id?: string | null
          outreach_mode: string
          run_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          alternates?: Json
          body_html?: string
          campaign_id?: string | null
          context_json?: Json | null
          created_at?: string
          created_by?: string
          id?: string
          opportunity_id?: string | null
          outreach_mode?: string
          run_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_drafts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_drafts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_drafts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      outreach_replies: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          audience_id: string | null
          campaign_id: string
          contact_id: string | null
          created_at: string
          direction: string
          gmail_message_id: string
          id: string
          outcome: string | null
          received_at: string
          thread_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          audience_id?: string | null
          campaign_id: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          gmail_message_id: string
          id?: string
          outcome?: string | null
          received_at: string
          thread_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          audience_id?: string | null
          campaign_id?: string
          contact_id?: string | null
          created_at?: string
          direction?: string
          gmail_message_id?: string
          id?: string
          outcome?: string | null
          received_at?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_replies_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_audience"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_replies_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "resend_candidates_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_replies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_replies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      page_render_cache: {
        Row: {
          error: string | null
          expires_at: string
          html_description: string | null
          html_title: string | null
          markdown_content: string
          path: string
          render_source: string | null
          rendered_at: string
        }
        Insert: {
          error?: string | null
          expires_at?: string
          html_description?: string | null
          html_title?: string | null
          markdown_content: string
          path: string
          render_source?: string | null
          rendered_at?: string
        }
        Update: {
          error?: string | null
          expires_at?: string
          html_description?: string | null
          html_title?: string | null
          markdown_content?: string
          path?: string
          render_source?: string | null
          rendered_at?: string
        }
        Relationships: []
      }
      partnership_angles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      people_group_memberships: {
        Row: {
          contact_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_group_memberships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "people_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      people_groups: {
        Row: {
          created_at: string
          group_name: string
          id: string
          source_connector: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_name: string
          id?: string
          source_connector?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_name?: string
          id?: string
          source_connector?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_roster_diffs: {
        Row: {
          created_at: string
          current_snapshot_id: string
          diff: Json
          id: string
          opportunity_id: string
          previous_snapshot_id: string | null
          run_id: string
        }
        Insert: {
          created_at?: string
          current_snapshot_id: string
          diff?: Json
          id?: string
          opportunity_id: string
          previous_snapshot_id?: string | null
          run_id: string
        }
        Update: {
          created_at?: string
          current_snapshot_id?: string
          diff?: Json
          id?: string
          opportunity_id?: string
          previous_snapshot_id?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_roster_diffs_current_snapshot_id_fkey"
            columns: ["current_snapshot_id"]
            isOneToOne: false
            referencedRelation: "people_roster_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_roster_diffs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_roster_diffs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "people_roster_diffs_previous_snapshot_id_fkey"
            columns: ["previous_snapshot_id"]
            isOneToOne: false
            referencedRelation: "people_roster_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_roster_diffs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      people_roster_snapshots: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          roster: Json
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          roster?: Json
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          roster?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_roster_snapshots_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_roster_snapshots_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
          {
            foreignKeyName: "people_roster_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          anchor_tier: string | null
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          description: string | null
          grant_type: string | null
          id: string
          is_published: boolean | null
          metro_id: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          anchor_tier?: string | null
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          grant_type?: string | null
          id?: string
          is_published?: boolean | null
          metro_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          anchor_tier?: string | null
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          grant_type?: string | null
          id?: string
          is_published?: boolean | null
          metro_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "playbooks_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      praeceptum_guidance_memory: {
        Row: {
          archetype_key: string | null
          confidence_score: number
          context: string
          created_at: string
          friction_after_count: number
          id: string
          intervention_count: number
          last_seen_at: string
          prompt_key: string
          resolution_count: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archetype_key?: string | null
          confidence_score?: number
          context: string
          created_at?: string
          friction_after_count?: number
          id?: string
          intervention_count?: number
          last_seen_at?: string
          prompt_key: string
          resolution_count?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archetype_key?: string | null
          confidence_score?: number
          context?: string
          created_at?: string
          friction_after_count?: number
          id?: string
          intervention_count?: number
          last_seen_at?: string
          prompt_key?: string
          resolution_count?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "praeceptum_guidance_memory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "praeceptum_guidance_memory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "praeceptum_guidance_memory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          display_order: number
          id: string
          name: string
          network_type: string | null
          product_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          display_order?: number
          id?: string
          name: string
          network_type?: string | null
          product_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          network_type?: string | null
          product_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_subscription_terms: {
        Row: {
          bundle_price_cents: number | null
          created_at: string
          id: string
          months: number
          product_id: string
          service_price_cents: number
        }
        Insert: {
          bundle_price_cents?: number | null
          created_at?: string
          id?: string
          months: number
          product_id: string
          service_price_cents: number
        }
        Update: {
          bundle_price_cents?: number | null
          created_at?: string
          id?: string
          months?: number
          product_id?: string
          service_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_subscription_terms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pricing_products"
            referencedColumns: ["id"]
          },
        ]
      }
      proactive_notifications: {
        Row: {
          created_at: string
          id: string
          notification_type: string
          org_id: string | null
          payload: Json
          read: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_type: string
          org_id?: string | null
          payload?: Json
          read?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_type?: string
          org_id?: string | null
          payload?: Json
          read?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proactive_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bio: string | null
          clifton_strengths: Json | null
          created_at: string | null
          dashboard_mode: string
          date_of_birth: string | null
          disc_profile: string | null
          display_name: string | null
          enneagram_confidence: number | null
          enneagram_scores: Json | null
          enneagram_source: string | null
          enneagram_type: number | null
          enneagram_wing: number | null
          gmail_email_address: string | null
          gmail_last_sync_at: string | null
          gmail_sync_enabled: boolean | null
          google_access_token: string | null
          google_calendar_enabled: boolean | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          home_metro_id: string | null
          id: string
          interests: Json | null
          is_approved: boolean
          languages: Json | null
          ministry_role: string | null
          name_aliases: string[] | null
          nickname: string | null
          personality_visibility: string | null
          skills: Json | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          welcome_dismissed_at: string | null
          zodiac_element: string | null
          zodiac_modality: string | null
          zodiac_sign: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          clifton_strengths?: Json | null
          created_at?: string | null
          dashboard_mode?: string
          date_of_birth?: string | null
          disc_profile?: string | null
          display_name?: string | null
          enneagram_confidence?: number | null
          enneagram_scores?: Json | null
          enneagram_source?: string | null
          enneagram_type?: number | null
          enneagram_wing?: number | null
          gmail_email_address?: string | null
          gmail_last_sync_at?: string | null
          gmail_sync_enabled?: boolean | null
          google_access_token?: string | null
          google_calendar_enabled?: boolean | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          home_metro_id?: string | null
          id?: string
          interests?: Json | null
          is_approved?: boolean
          languages?: Json | null
          ministry_role?: string | null
          name_aliases?: string[] | null
          nickname?: string | null
          personality_visibility?: string | null
          skills?: Json | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          welcome_dismissed_at?: string | null
          zodiac_element?: string | null
          zodiac_modality?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          clifton_strengths?: Json | null
          created_at?: string | null
          dashboard_mode?: string
          date_of_birth?: string | null
          disc_profile?: string | null
          display_name?: string | null
          enneagram_confidence?: number | null
          enneagram_scores?: Json | null
          enneagram_source?: string | null
          enneagram_type?: number | null
          enneagram_wing?: number | null
          gmail_email_address?: string | null
          gmail_last_sync_at?: string | null
          gmail_sync_enabled?: boolean | null
          google_access_token?: string | null
          google_calendar_enabled?: boolean | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          home_metro_id?: string | null
          id?: string
          interests?: Json | null
          is_approved?: boolean
          languages?: Json | null
          ministry_role?: string | null
          name_aliases?: string[] | null
          nickname?: string | null
          personality_visibility?: string | null
          skills?: Json | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          welcome_dismissed_at?: string | null
          zodiac_element?: string | null
          zodiac_modality?: string | null
          zodiac_sign?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_metro_id_fkey"
            columns: ["home_metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "profiles_home_metro_id_fkey"
            columns: ["home_metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_packs: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          pack_json: Json
          run_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type?: string
          id?: string
          pack_json?: Json
          run_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          pack_json?: Json
          run_id?: string
        }
        Relationships: []
      }
      providence_constellation_signals: {
        Row: {
          archetype: string
          classification: string
          dominant_direction: string
          generated_at: string
          id: string
          intensity: number
          region_key: string
        }
        Insert: {
          archetype: string
          classification: string
          dominant_direction: string
          generated_at?: string
          id?: string
          intensity?: number
          region_key: string
        }
        Update: {
          archetype?: string
          classification?: string
          dominant_direction?: string
          generated_at?: string
          id?: string
          intensity?: number
          region_key?: string
        }
        Relationships: []
      }
      providence_reports: {
        Row: {
          arc_summary_json: Json
          classification: string
          created_by: string | null
          dominant_direction: string
          foundational: boolean
          generated_at: string
          id: string
          narrative_private: string
          narrative_shareable: string
          period_end: string
          period_start: string
          revelation_end: string | null
          revelation_start: string | null
          revelation_type: string | null
          season_label: string
          tenant_id: string
          trigger_type: string
          version: number
        }
        Insert: {
          arc_summary_json?: Json
          classification: string
          created_by?: string | null
          dominant_direction: string
          foundational?: boolean
          generated_at?: string
          id?: string
          narrative_private?: string
          narrative_shareable?: string
          period_end: string
          period_start: string
          revelation_end?: string | null
          revelation_start?: string | null
          revelation_type?: string | null
          season_label: string
          tenant_id: string
          trigger_type: string
          version?: number
        }
        Update: {
          arc_summary_json?: Json
          classification?: string
          created_by?: string | null
          dominant_direction?: string
          foundational?: boolean
          generated_at?: string
          id?: string
          narrative_private?: string
          narrative_shareable?: string
          period_end?: string
          period_start?: string
          revelation_end?: string | null
          revelation_start?: string | null
          revelation_type?: string | null
          season_label?: string
          tenant_id?: string
          trigger_type?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "providence_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "providence_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "providence_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provision_catalog_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          default_gl_account: string | null
          description: string | null
          id: string
          name: string
          tier: string | null
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          default_gl_account?: string | null
          description?: string | null
          id?: string
          name: string
          tier?: string | null
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          default_gl_account?: string | null
          description?: string | null
          id?: string
          name?: string
          tier?: string | null
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      provision_imports: {
        Row: {
          created_at: string
          created_by: string
          id: string
          model: string | null
          parse_warnings: Json
          parsed_json: Json | null
          provision_id: string | null
          raw_text: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          model?: string | null
          parse_warnings?: Json
          parsed_json?: Json | null
          provision_id?: string | null
          raw_text: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          model?: string | null
          parse_warnings?: Json
          parsed_json?: Json | null
          provision_id?: string | null
          raw_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "provision_imports_provision_id_fkey"
            columns: ["provision_id"]
            isOneToOne: false
            referencedRelation: "provisions"
            referencedColumns: ["id"]
          },
        ]
      }
      provision_items: {
        Row: {
          catalog_item_id: string | null
          created_at: string
          gl_account: string | null
          id: string
          item_name: string
          line_total_cents: number
          metadata: Json
          product_name: string | null
          provision_id: string
          quantity: number
          tier: string | null
          unit_price_cents: number
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string
          gl_account?: string | null
          id?: string
          item_name: string
          line_total_cents?: number
          metadata?: Json
          product_name?: string | null
          provision_id: string
          quantity?: number
          tier?: string | null
          unit_price_cents: number
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string
          gl_account?: string | null
          id?: string
          item_name?: string
          line_total_cents?: number
          metadata?: Json
          product_name?: string | null
          provision_id?: string
          quantity?: number
          tier?: string | null
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "provision_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "provision_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provision_items_provision_id_fkey"
            columns: ["provision_id"]
            isOneToOne: false
            referencedRelation: "provisions"
            referencedColumns: ["id"]
          },
        ]
      }
      provision_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          provision_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          provision_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          provision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provision_messages_provision_id_fkey"
            columns: ["provision_id"]
            isOneToOne: false
            referencedRelation: "provisions"
            referencedColumns: ["id"]
          },
        ]
      }
      provisions: {
        Row: {
          assigned_to: string | null
          business_address: string | null
          business_city: string | null
          business_name: string | null
          business_state: string | null
          business_unit: string | null
          business_zip: string | null
          canceled_at: string | null
          client_id: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          date_paid: string | null
          delivered_at: string | null
          delivery_status: string | null
          export_count: number
          exported_at: string | null
          external_order_ref: string | null
          id: string
          invoice_date: string | null
          invoice_type: string
          metro_id: string | null
          notes: string | null
          opportunity_id: string
          ordered_at: string | null
          paid: boolean
          payment_due_date: string | null
          requested_at: string
          requested_by: string
          shipped_at: string | null
          source: string
          status: string
          submitted_at: string | null
          total_cents: number
          total_quantity: number
          tracking_carrier: string | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          business_address?: string | null
          business_city?: string | null
          business_name?: string | null
          business_state?: string | null
          business_unit?: string | null
          business_zip?: string | null
          canceled_at?: string | null
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          date_paid?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          export_count?: number
          exported_at?: string | null
          external_order_ref?: string | null
          id?: string
          invoice_date?: string | null
          invoice_type?: string
          metro_id?: string | null
          notes?: string | null
          opportunity_id: string
          ordered_at?: string | null
          paid?: boolean
          payment_due_date?: string | null
          requested_at?: string
          requested_by: string
          shipped_at?: string | null
          source?: string
          status?: string
          submitted_at?: string | null
          total_cents?: number
          total_quantity?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          business_address?: string | null
          business_city?: string | null
          business_name?: string | null
          business_state?: string | null
          business_unit?: string | null
          business_zip?: string | null
          canceled_at?: string | null
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          date_paid?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          export_count?: number
          exported_at?: string | null
          external_order_ref?: string | null
          id?: string
          invoice_date?: string | null
          invoice_type?: string
          metro_id?: string | null
          notes?: string | null
          opportunity_id?: string
          ordered_at?: string | null
          paid?: boolean
          payment_due_date?: string | null
          requested_at?: string
          requested_by?: string
          shipped_at?: string | null
          source?: string
          status?: string
          submitted_at?: string | null
          total_cents?: number
          total_quantity?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provisions_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "provisions_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      public_metro_pages: {
        Row: {
          archetypes_active: Json | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          metro_id: string
          momentum_summary: string
          narrative_summary: string
          reflection_block: string
          slug: string
          source_app: string
          status: string
          summary: string
          updated_at: string
          volunteer_patterns: string
        }
        Insert: {
          archetypes_active?: Json | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          metro_id: string
          momentum_summary?: string
          narrative_summary?: string
          reflection_block?: string
          slug: string
          source_app?: string
          status?: string
          summary?: string
          updated_at?: string
          volunteer_patterns?: string
        }
        Update: {
          archetypes_active?: Json | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          metro_id?: string
          momentum_summary?: string
          narrative_summary?: string
          reflection_block?: string
          slug?: string
          source_app?: string
          status?: string
          summary?: string
          updated_at?: string
          volunteer_patterns?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_metro_pages_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "public_metro_pages_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      qa_batch_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_index: number
          delay_seconds: number
          id: string
          results: Json
          run_ids: string[]
          started_at: string | null
          status: string
          suite_keys: string[]
          tenant_id: string
          triggered_by: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_index?: number
          delay_seconds?: number
          id?: string
          results?: Json
          run_ids?: string[]
          started_at?: string | null
          status?: string
          suite_keys?: string[]
          tenant_id: string
          triggered_by: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_index?: number
          delay_seconds?: number
          id?: string
          results?: Json
          run_ids?: string[]
          started_at?: string | null
          status?: string
          suite_keys?: string[]
          tenant_id?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_batch_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "qa_batch_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "qa_batch_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_fix_prompts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          prompt_text: string
          redactions: Json
          root_cause_hypotheses: Json
          run_id: string
          status: string
          suggested_files: Json
          suite_key: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          prompt_text: string
          redactions?: Json
          root_cause_hypotheses?: Json
          run_id: string
          status?: string
          suggested_files?: Json
          suite_key: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          prompt_text?: string
          redactions?: Json
          root_cause_hypotheses?: Json
          run_id?: string
          status?: string
          suggested_files?: Json
          suite_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_fix_prompts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_known_issues: {
        Row: {
          created_at: string
          description: string
          fingerprint: string
          id: string
          suggested_fix: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          fingerprint: string
          id?: string
          suggested_fix?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          fingerprint?: string
          id?: string
          suggested_fix?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      qa_run_failures: {
        Row: {
          artifact_refs: Json
          console_errors: Json
          created_at: string
          failure_type: string
          id: string
          last_step: Json
          network_errors: Json
          primary_message: string
          run_id: string
          stack_trace: string | null
          suite_key: string
        }
        Insert: {
          artifact_refs?: Json
          console_errors?: Json
          created_at?: string
          failure_type: string
          id?: string
          last_step?: Json
          network_errors?: Json
          primary_message: string
          run_id: string
          stack_trace?: string | null
          suite_key: string
        }
        Update: {
          artifact_refs?: Json
          console_errors?: Json
          created_at?: string
          failure_type?: string
          id?: string
          last_step?: Json
          network_errors?: Json
          primary_message?: string
          run_id?: string
          stack_trace?: string | null
          suite_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_run_failures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_run_results: {
        Row: {
          batch_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          metadata: Json | null
          screenshot_url: string | null
          status: string
          step_count: number | null
          suite_id: string | null
          test_name: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          screenshot_url?: string | null
          status?: string
          step_count?: number | null
          suite_id?: string | null
          test_name: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          screenshot_url?: string | null
          status?: string
          step_count?: number | null
          suite_id?: string | null
          test_name?: string
        }
        Relationships: []
      }
      qa_test_run_artifacts: {
        Row: {
          created_at: string
          id: string
          kind: string
          run_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          run_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          run_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_run_artifacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_run_steps: {
        Row: {
          completed_at: string | null
          console_errors: Json
          id: string
          label: string
          network_failures: Json
          notes: string | null
          page_errors: Json
          run_id: string
          screenshot_path: string | null
          started_at: string | null
          status: string
          step_index: number
          step_key: string
          url: string | null
        }
        Insert: {
          completed_at?: string | null
          console_errors?: Json
          id?: string
          label: string
          network_failures?: Json
          notes?: string | null
          page_errors?: Json
          run_id: string
          screenshot_path?: string | null
          started_at?: string | null
          status?: string
          step_index: number
          step_key: string
          url?: string | null
        }
        Update: {
          completed_at?: string | null
          console_errors?: Json
          id?: string
          label?: string
          network_failures?: Json
          notes?: string | null
          page_errors?: Json
          run_id?: string
          screenshot_path?: string | null
          started_at?: string | null
          status?: string
          step_index?: number
          step_key?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "qa_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_runs: {
        Row: {
          batch_id: string | null
          browserbase_session_id: string | null
          completed_at: string | null
          environment: string
          error: Json | null
          github_run_id: string | null
          id: string
          started_at: string
          status: string
          suite_key: string
          summary: Json
          tenant_id: string | null
          triggered_by: string
        }
        Insert: {
          batch_id?: string | null
          browserbase_session_id?: string | null
          completed_at?: string | null
          environment?: string
          error?: Json | null
          github_run_id?: string | null
          id?: string
          started_at?: string
          status?: string
          suite_key: string
          summary?: Json
          tenant_id?: string | null
          triggered_by: string
        }
        Update: {
          batch_id?: string | null
          browserbase_session_id?: string | null
          completed_at?: string | null
          environment?: string
          error?: Json | null
          github_run_id?: string | null
          id?: string
          started_at?: string
          status?: string
          suite_key?: string
          summary?: Json
          tenant_id?: string | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_test_runs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "qa_batch_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_test_runs_suite_key_fkey"
            columns: ["suite_key"]
            isOneToOne: false
            referencedRelation: "qa_test_suites"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "qa_test_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "qa_test_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "qa_test_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_test_suites: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          name: string
          requires_tenant: boolean
          spec_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          name: string
          requires_tenant?: boolean
          spec_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          requires_tenant?: boolean
          spec_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recovery_tickets: {
        Row: {
          created_at: string
          current_route: string | null
          description: string | null
          id: string
          recent_actions: Json | null
          resolved_at: string | null
          resolved_by: string | null
          routed_at: string | null
          routed_to_gardener_ids: string[] | null
          routing_reason: string | null
          status: string
          subject: string
          suspected_entity_id: string | null
          suspected_entity_type: string | null
          tenant_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_route?: string | null
          description?: string | null
          id?: string
          recent_actions?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          routed_at?: string | null
          routed_to_gardener_ids?: string[] | null
          routing_reason?: string | null
          status?: string
          subject: string
          suspected_entity_id?: string | null
          suspected_entity_type?: string | null
          tenant_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_route?: string | null
          description?: string | null
          id?: string
          recent_actions?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          routed_at?: string | null
          routed_to_gardener_ids?: string[] | null
          routing_reason?: string | null
          status?: string
          subject?: string
          suspected_entity_id?: string | null
          suspected_entity_type?: string | null
          tenant_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "recovery_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "recovery_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recycle_bin: {
        Row: {
          created_at: string
          deleted_at: string
          deleted_by: string | null
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          purged_at: string | null
          restored_at: string | null
          restored_by: string | null
          snapshot: Json
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string
          deleted_by?: string | null
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          purged_at?: string | null
          restored_at?: string | null
          restored_by?: string | null
          snapshot: Json
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string
          deleted_by?: string | null
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          purged_at?: string | null
          restored_at?: string | null
          restored_by?: string | null
          snapshot?: Json
          tenant_id?: string | null
        }
        Relationships: []
      }
      recycle_bin_payloads: {
        Row: {
          created_at: string
          entity_name: string | null
          id: string
          recycle_bin_id: string
          snapshot: Json | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity_name?: string | null
          id?: string
          recycle_bin_id: string
          snapshot?: Json | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity_name?: string | null
          id?: string
          recycle_bin_id?: string
          snapshot?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recycle_bin_payloads_recycle_bin_id_fkey"
            columns: ["recycle_bin_id"]
            isOneToOne: true
            referencedRelation: "recycle_bin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recycle_bin_payloads_recycle_bin_id_fkey"
            columns: ["recycle_bin_id"]
            isOneToOne: true
            referencedRelation: "recycle_bin_tenant_v"
            referencedColumns: ["id"]
          },
        ]
      }
      reflection_extractions: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          model: string | null
          reflection_id: string
          relationship_signals: Json
          sentiment: string | null
          topics: Json
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          reflection_id: string
          relationship_signals?: Json
          sentiment?: string | null
          topics?: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          model?: string | null
          reflection_id?: string
          relationship_signals?: Json
          sentiment?: string | null
          topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reflection_extractions_reflection_id_fkey"
            columns: ["reflection_id"]
            isOneToOne: true
            referencedRelation: "opportunity_reflections"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          lead_user_id: string | null
          name: string
          notes: string | null
          region_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          lead_user_id?: string | null
          name: string
          notes?: string | null
          region_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          lead_user_id?: string | null
          name?: string
          notes?: string | null
          region_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      relatio_companion_connections: {
        Row: {
          auth_method: string
          config: Json
          connector_key: string
          created_at: string
          created_by: string
          id: string
          last_poll_at: string | null
          last_poll_status: string | null
          records_ingested: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auth_method?: string
          config?: Json
          connector_key: string
          created_at?: string
          created_by: string
          id?: string
          last_poll_at?: string | null
          last_poll_status?: string | null
          records_ingested?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auth_method?: string
          config?: Json
          connector_key?: string
          created_at?: string
          created_by?: string
          id?: string
          last_poll_at?: string | null
          last_poll_status?: string | null
          records_ingested?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatio_companion_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_companion_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_companion_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_connections: {
        Row: {
          connector_key: string
          created_at: string
          id: string
          oauth_json: Json | null
          settings: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          connector_key: string
          created_at?: string
          id?: string
          oauth_json?: Json | null
          settings?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          connector_key?: string
          created_at?: string
          id?: string
          oauth_json?: Json | null
          settings?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatio_connections_connector_key_fkey"
            columns: ["connector_key"]
            isOneToOne: false
            referencedRelation: "relatio_connectors"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "relatio_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_connectors: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          direction: string | null
          icon: string | null
          id: string
          key: string
          mode: string
          name: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          direction?: string | null
          icon?: string | null
          id?: string
          key: string
          mode: string
          name: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          direction?: string | null
          icon?: string | null
          id?: string
          key?: string
          mode?: string
          name?: string
        }
        Relationships: []
      }
      relatio_field_maps: {
        Row: {
          direction: string
          id: string
          integration_key: string
          source_field: string
          target_field: string
        }
        Insert: {
          direction?: string
          id?: string
          integration_key: string
          source_field: string
          target_field: string
        }
        Update: {
          direction?: string
          id?: string
          integration_key?: string
          source_field?: string
          target_field?: string
        }
        Relationships: []
      }
      relatio_import_events: {
        Row: {
          created_at: string
          id: string
          job_id: string
          level: string
          message: string
          meta: Json
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          level: string
          message: string
          meta?: Json
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          level?: string
          message?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "relatio_import_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "relatio_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_import_jobs: {
        Row: {
          completed_at: string | null
          connector_key: string
          created_at: string
          error: Json | null
          id: string
          progress: Json
          scope: Json
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          connector_key: string
          created_at?: string
          error?: Json | null
          id?: string
          progress?: Json
          scope?: Json
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          connector_key?: string
          created_at?: string
          error?: Json | null
          id?: string
          progress?: Json
          scope?: Json
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatio_import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_installations: {
        Row: {
          auth_type: string | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          environment: string | null
          id: string
          integration_key: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          auth_type?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          environment?: string | null
          id?: string
          integration_key: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          auth_type?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          environment?: string | null
          id?: string
          integration_key?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatio_installations_integration_key_fkey"
            columns: ["integration_key"]
            isOneToOne: false
            referencedRelation: "relatio_integrations"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "relatio_installations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_installations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_installations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_integrations: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_two_way: boolean | null
          key: string
          name: string
        }
        Insert: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_two_way?: boolean | null
          key: string
          name: string
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_two_way?: boolean | null
          key?: string
          name?: string
        }
        Relationships: []
      }
      relatio_migrations: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          integration_key: string
          migration_status: string
          records_imported: number | null
          started_at: string | null
          tenant_id: string
          warnings: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          integration_key: string
          migration_status?: string
          records_imported?: number | null
          started_at?: string | null
          tenant_id: string
          warnings?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          integration_key?: string
          migration_status?: string
          records_imported?: number | null
          started_at?: string | null
          tenant_id?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "relatio_migrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_migrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_migrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_object_map: {
        Row: {
          connector_key: string
          created_at: string
          external_id: string
          external_type: string
          id: string
          internal_id: string
          internal_table: string
          tenant_id: string
        }
        Insert: {
          connector_key: string
          created_at?: string
          external_id: string
          external_type: string
          id?: string
          internal_id: string
          internal_table: string
          tenant_id: string
        }
        Update: {
          connector_key?: string
          created_at?: string
          external_id?: string
          external_type?: string
          id?: string
          internal_id?: string
          internal_table?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatio_object_map_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_object_map_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_object_map_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_staging_records: {
        Row: {
          connection_id: string
          external_data: Json
          external_id: string
          external_type: string
          id: string
          ingested_at: string
          narrative_signal_emitted: boolean
          tenant_id: string
        }
        Insert: {
          connection_id: string
          external_data?: Json
          external_id: string
          external_type: string
          id?: string
          ingested_at?: string
          narrative_signal_emitted?: boolean
          tenant_id: string
        }
        Update: {
          connection_id?: string
          external_data?: Json
          external_id?: string
          external_type?: string
          id?: string
          ingested_at?: string
          narrative_signal_emitted?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatio_staging_records_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "relatio_companion_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatio_staging_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_staging_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_staging_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_sync_config: {
        Row: {
          auto_sync_enabled: boolean
          conflict_resolution: string
          connector_key: string
          created_at: string
          id: string
          last_synced_at: string | null
          sync_direction: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_sync_enabled?: boolean
          conflict_resolution?: string
          connector_key: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          sync_direction?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_sync_enabled?: boolean
          conflict_resolution?: string
          connector_key?: string
          created_at?: string
          id?: string
          last_synced_at?: string | null
          sync_direction?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatio_sync_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_sync_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_sync_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_sync_items: {
        Row: {
          action: string
          created_at: string | null
          external_id: string | null
          id: string
          internal_id: string | null
          object_type: string
          sample: Json | null
          sync_job_id: string
          warnings: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          internal_id?: string | null
          object_type: string
          sample?: Json | null
          sync_job_id: string
          warnings?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          external_id?: string | null
          id?: string
          internal_id?: string | null
          object_type?: string
          sample?: Json | null
          sync_job_id?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "relatio_sync_items_sync_job_id_fkey"
            columns: ["sync_job_id"]
            isOneToOne: false
            referencedRelation: "relatio_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      relatio_sync_jobs: {
        Row: {
          completed_at: string | null
          connector_key: string
          direction: string
          error: Json | null
          id: string
          mode: string
          started_at: string | null
          status: string
          summary: Json | null
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          connector_key: string
          direction?: string
          error?: Json | null
          id?: string
          mode?: string
          started_at?: string | null
          status?: string
          summary?: Json | null
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          connector_key?: string
          direction?: string
          error?: Json | null
          id?: string
          mode?: string
          started_at?: string | null
          status?: string
          summary?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatio_sync_jobs_connector_key_fkey"
            columns: ["connector_key"]
            isOneToOne: false
            referencedRelation: "relatio_connectors"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "relatio_sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "relatio_sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_actions: {
        Row: {
          action_type: string
          created_at: string
          created_by_run_id: string | null
          drivers: Json
          due_date: string | null
          evidence: Json
          id: string
          opportunity_id: string
          priority_label: string
          priority_score: number
          status: string
          suggested_timing: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by_run_id?: string | null
          drivers?: Json
          due_date?: string | null
          evidence?: Json
          id?: string
          opportunity_id: string
          priority_label?: string
          priority_score?: number
          status?: string
          suggested_timing?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by_run_id?: string | null
          drivers?: Json
          due_date?: string | null
          evidence?: Json
          id?: string
          opportunity_id?: string
          priority_label?: string
          priority_score?: number
          status?: string
          suggested_timing?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_actions_created_by_run_id_fkey"
            columns: ["created_by_run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_actions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_actions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      relationship_briefings: {
        Row: {
          briefing_json: Json
          briefing_md: string
          created_at: string
          id: string
          metro_id: string | null
          opportunity_id: string | null
          scope: string
          stats: Json
          week_end: string
          week_start: string
        }
        Insert: {
          briefing_json?: Json
          briefing_md?: string
          created_at?: string
          id?: string
          metro_id?: string | null
          opportunity_id?: string | null
          scope: string
          stats?: Json
          week_end: string
          week_start: string
        }
        Update: {
          briefing_json?: Json
          briefing_md?: string
          created_at?: string
          id?: string
          metro_id?: string | null
          opportunity_id?: string | null
          scope?: string
          stats?: Json
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_briefings_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "relationship_briefings_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_briefings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_briefings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      relationship_edges: {
        Row: {
          created_at: string
          edge_reason: string
          id: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          edge_reason: string
          id?: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          edge_reason?: string
          id?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      relationship_momentum: {
        Row: {
          computed_at: string
          created_at: string
          drivers: Json
          last_alert_score: number | null
          last_alerted_at: string | null
          last_score: number
          last_trend: string
          opportunity_id: string
          score: number
          score_delta: number
          trend: string
          updated_at: string
          version: string
          window_end: string
          window_start: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          drivers?: Json
          last_alert_score?: number | null
          last_alerted_at?: string | null
          last_score?: number
          last_trend?: string
          opportunity_id: string
          score?: number
          score_delta?: number
          trend?: string
          updated_at?: string
          version?: string
          window_end?: string
          window_start?: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          drivers?: Json
          last_alert_score?: number | null
          last_alerted_at?: string | null
          last_score?: number
          last_trend?: string
          opportunity_id?: string
          score?: number
          score_delta?: number
          trend?: string
          updated_at?: string
          version?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_momentum_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_momentum_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      relationship_story_chapters: {
        Row: {
          chapter_order: number
          chapter_title: string
          created_at: string
          family: string
          id: string
          is_active: boolean
          opportunity_id: string
          updated_at: string
        }
        Insert: {
          chapter_order?: number
          chapter_title: string
          created_at?: string
          family: string
          id?: string
          is_active?: boolean
          opportunity_id: string
          updated_at?: string
        }
        Update: {
          chapter_order?: number
          chapter_title?: string
          created_at?: string
          family?: string
          id?: string
          is_active?: boolean
          opportunity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_story_chapters_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_story_chapters_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      relationship_story_suggestions: {
        Row: {
          acted_at: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          inputs_hash: string | null
          metro_id: string
          opportunity_id: string
          run_id: string | null
          source_context: Json
          status: string
          suggestion_type: string
          summary: string
          updated_at: string
        }
        Insert: {
          acted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          inputs_hash?: string | null
          metro_id: string
          opportunity_id: string
          run_id?: string | null
          source_context?: Json
          status?: string
          suggestion_type: string
          summary: string
          updated_at?: string
        }
        Update: {
          acted_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          inputs_hash?: string | null
          metro_id?: string
          opportunity_id?: string
          run_id?: string | null
          source_context?: Json
          status?: string
          suggestion_type?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_story_suggestions_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "relationship_story_suggestions_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_story_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_story_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      relationship_story_updates: {
        Row: {
          ai_used: boolean
          chapter_id: string
          confidence: number
          created_at: string
          delta_type: string
          evidence: Json
          generated_at: string
          id: string
          opportunity_id: string
          summary_md: string
          version: string
          window_end: string
          window_start: string
        }
        Insert: {
          ai_used?: boolean
          chapter_id: string
          confidence?: number
          created_at?: string
          delta_type: string
          evidence?: Json
          generated_at?: string
          id?: string
          opportunity_id: string
          summary_md: string
          version?: string
          window_end: string
          window_start: string
        }
        Update: {
          ai_used?: boolean
          chapter_id?: string
          confidence?: number
          created_at?: string
          delta_type?: string
          evidence?: Json
          generated_at?: string
          id?: string
          opportunity_id?: string
          summary_md?: string
          version?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_story_updates_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "relationship_story_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_story_updates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_story_updates_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      relationship_suggestions: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          opportunity_id: string | null
          source: string
          suggestion_type: string
          summary: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          opportunity_id?: string | null
          source: string
          suggestion_type: string
          summary: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          opportunity_id?: string | null
          source?: string
          suggestion_type?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_suggestions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          metro_id: string | null
          name: string
          recipients: Json
          region_id: string | null
          template_id: string | null
          time_of_day: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          metro_id?: string | null
          name: string
          recipients?: Json
          region_id?: string | null
          template_id?: string | null
          time_of_day?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          metro_id?: string | null
          name?: string
          recipients?: Json
          region_id?: string | null
          template_id?: string | null
          time_of_day?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "report_schedules_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json | null
          id: string
          is_default: boolean
          name: string
          report_type: string
          sections: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean
          name: string
          report_type?: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean
          name?: string
          report_type?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: []
      }
      restoration_signals: {
        Row: {
          created_at: string
          created_by_system: boolean
          id: string
          narrative_weight: string
          restoration_type: string
          source_entity_type: string
          source_event_ids: string[] | null
          tenant_id: string | null
          visible_scope: string
        }
        Insert: {
          created_at?: string
          created_by_system?: boolean
          id?: string
          narrative_weight?: string
          restoration_type: string
          source_entity_type: string
          source_event_ids?: string[] | null
          tenant_id?: string | null
          visible_scope?: string
        }
        Update: {
          created_at?: string
          created_by_system?: boolean
          id?: string
          narrative_weight?: string
          restoration_type?: string
          source_entity_type?: string
          source_event_ids?: string[] | null
          tenant_id?: string | null
          visible_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "restoration_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "restoration_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "restoration_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      result_seen_urls: {
        Row: {
          first_seen_at: string
          first_seen_run_id: string
          id: string
          saved_search_id: string
          url_normalized: string
        }
        Insert: {
          first_seen_at?: string
          first_seen_run_id: string
          id?: string
          saved_search_id: string
          url_normalized: string
        }
        Update: {
          first_seen_at?: string
          first_seen_run_id?: string
          id?: string
          saved_search_id?: string
          url_normalized?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_seen_urls_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_filter_views: {
        Row: {
          created_at: string
          entity_type: string
          filters: Json
          id: string
          is_default: boolean | null
          sort_config: Json | null
          tenant_id: string
          updated_at: string
          user_id: string
          view_name: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          filters?: Json
          id?: string
          is_default?: boolean | null
          sort_config?: Json | null
          tenant_id: string
          updated_at?: string
          user_id: string
          view_name: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          filters?: Json
          id?: string
          is_default?: boolean | null
          sort_config?: Json | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          view_name?: string
        }
        Relationships: []
      }
      saved_search_runs: {
        Row: {
          created_at: string
          id: string
          run_id: string
          saved_search_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          run_id: string
          saved_search_id: string
        }
        Update: {
          created_at?: string
          id?: string
          run_id?: string
          saved_search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_search_runs_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          enforced_query_template: string
          id: string
          last_ran_at: string | null
          last_run_id: string | null
          max_results: number
          metro_id: string | null
          module: string
          name: string
          raw_query: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enforced_query_template: string
          id?: string
          last_ran_at?: string | null
          last_run_id?: string | null
          max_results?: number
          metro_id?: string | null
          module: string
          name: string
          raw_query: string
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enforced_query_template?: string
          id?: string
          last_ran_at?: string | null
          last_run_id?: string | null
          max_results?: number
          metro_id?: string | null
          module?: string
          name?: string
          raw_query?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "saved_searches_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_versions: {
        Row: {
          applied_at: string
          applied_by: string | null
          description: string
          id: string
          version: string
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          description: string
          id?: string
          version: string
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          description?: string
          id?: string
          version?: string
        }
        Relationships: []
      }
      search_intent_profiles: {
        Row: {
          active: boolean
          blocked_patterns: string[]
          created_at: string
          enforced_suffix: string
          id: string
          module: string
          required_all: string[]
          required_any: string[]
          scope_mode: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          blocked_patterns?: string[]
          created_at?: string
          enforced_suffix?: string
          id?: string
          module: string
          required_all?: string[]
          required_any?: string[]
          scope_mode?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          blocked_patterns?: string[]
          created_at?: string
          enforced_suffix?: string
          id?: string
          module?: string
          required_all?: string[]
          required_any?: string[]
          scope_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_results: {
        Row: {
          confidence: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_entity_id: string | null
          created_entity_type: string | null
          date_info: string | null
          description: string | null
          entity_created: boolean
          id: string
          location: string | null
          organization: string | null
          raw_data: Json
          result_index: number
          search_run_id: string
          source: string | null
          title: string
          url: string | null
        }
        Insert: {
          confidence?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_entity_id?: string | null
          created_entity_type?: string | null
          date_info?: string | null
          description?: string | null
          entity_created?: boolean
          id?: string
          location?: string | null
          organization?: string | null
          raw_data?: Json
          result_index: number
          search_run_id: string
          source?: string | null
          title: string
          url?: string | null
        }
        Update: {
          confidence?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_entity_id?: string | null
          created_entity_type?: string | null
          date_info?: string | null
          description?: string | null
          entity_created?: boolean
          id?: string
          location?: string | null
          organization?: string | null
          raw_data?: Json
          result_index?: number
          search_run_id?: string
          source?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_results_search_run_id_fkey"
            columns: ["search_run_id"]
            isOneToOne: false
            referencedRelation: "search_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      search_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          enforced_query: string | null
          error_message: string | null
          firecrawl_ms: number | null
          id: string
          intent_keywords: string[]
          merged_results_count: number | null
          metro_id: string | null
          opportunities_created_count: number
          people_added_count: number
          prior_runs_merged: number | null
          query: string
          raw_query: string | null
          requested_by: string
          result_count: number
          results_rejected: number
          results_returned: number
          results_saved: number
          run_id: string
          search_brief: Json | null
          search_type: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enforced_query?: string | null
          error_message?: string | null
          firecrawl_ms?: number | null
          id?: string
          intent_keywords?: string[]
          merged_results_count?: number | null
          metro_id?: string | null
          opportunities_created_count?: number
          people_added_count?: number
          prior_runs_merged?: number | null
          query: string
          raw_query?: string | null
          requested_by: string
          result_count?: number
          results_rejected?: number
          results_returned?: number
          results_saved?: number
          run_id: string
          search_brief?: Json | null
          search_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enforced_query?: string | null
          error_message?: string | null
          firecrawl_ms?: number | null
          id?: string
          intent_keywords?: string[]
          merged_results_count?: number | null
          metro_id?: string | null
          opportunities_created_count?: number
          people_added_count?: number
          prior_runs_merged?: number | null
          query?: string
          raw_query?: string | null
          requested_by?: string
          result_count?: number
          results_rejected?: number
          results_returned?: number
          results_saved?: number
          run_id?: string
          search_brief?: Json | null
          search_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "search_runs_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      season_summaries: {
        Row: {
          care_log_count: number
          contact_id: string
          created_at: string
          created_by: string | null
          date_range_end: string
          date_range_start: string
          excerpts: string | null
          gratitude_line: string | null
          id: string
          published_at: string | null
          tenant_id: string
          themes: string | null
          total_hours: number | null
          version: number
          visibility: string
        }
        Insert: {
          care_log_count?: number
          contact_id: string
          created_at?: string
          created_by?: string | null
          date_range_end: string
          date_range_start: string
          excerpts?: string | null
          gratitude_line?: string | null
          id?: string
          published_at?: string | null
          tenant_id: string
          themes?: string | null
          total_hours?: number | null
          version?: number
          visibility?: string
        }
        Update: {
          care_log_count?: number
          contact_id?: string
          created_at?: string
          created_by?: string | null
          date_range_end?: string
          date_range_start?: string
          excerpts?: string | null
          gratitude_line?: string | null
          id?: string
          published_at?: string | null
          tenant_id?: string
          themes?: string | null
          total_hours?: number | null
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_summaries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_summaries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "season_summaries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "season_summaries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      simulation_events: {
        Row: {
          action: string
          actor_type: string
          created_at: string
          id: string
          internal_refs: Json
          module: string
          occurred_at: string
          outcome: string
          simulation_run_id: string
          warnings: Json
        }
        Insert: {
          action: string
          actor_type: string
          created_at?: string
          id?: string
          internal_refs?: Json
          module: string
          occurred_at: string
          outcome: string
          simulation_run_id: string
          warnings?: Json
        }
        Update: {
          action?: string
          actor_type?: string
          created_at?: string
          id?: string
          internal_refs?: Json
          module?: string
          occurred_at?: string
          outcome?: string
          simulation_run_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "simulation_events_simulation_run_id_fkey"
            columns: ["simulation_run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_markers: {
        Row: {
          created_at: string | null
          id: string
          kind: string
          record_id: string
          record_table: string
          run_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          kind: string
          record_id: string
          record_table: string
          run_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          kind?: string
          record_id?: string
          record_table?: string
          run_id?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      simulation_runs: {
        Row: {
          completed_at: string | null
          days: number
          demo_tenant_id: string | null
          error: Json | null
          id: string
          intensity: string
          run_key: string
          scenario_key: string
          started_at: string
          stats: Json
          status: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          days?: number
          demo_tenant_id?: string | null
          error?: Json | null
          id?: string
          intensity: string
          run_key: string
          scenario_key: string
          started_at?: string
          stats?: Json
          status: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          days?: number
          demo_tenant_id?: string | null
          error?: Json | null
          id?: string
          intensity?: string
          run_key?: string
          scenario_key?: string
          started_at?: string
          stats?: Json
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_runs_demo_tenant_id_fkey"
            columns: ["demo_tenant_id"]
            isOneToOne: false
            referencedRelation: "demo_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_runs_scenario_key_fkey"
            columns: ["scenario_key"]
            isOneToOne: false
            referencedRelation: "demo_scenarios"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "simulation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "simulation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "simulation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          region: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          region?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          region?: string | null
        }
        Relationships: []
      }
      stripe_account_routing: {
        Row: {
          active: boolean
          connected_account_id: string
          created_at: string
          federation_secret_env: string
          notes: string | null
          satellite_app: string
          supabase_project_id: string | null
          target_url_override: string | null
          tenant_id: string | null
          updated_at: string
          webhook_path: string
        }
        Insert: {
          active?: boolean
          connected_account_id: string
          created_at?: string
          federation_secret_env: string
          notes?: string | null
          satellite_app: string
          supabase_project_id?: string | null
          target_url_override?: string | null
          tenant_id?: string | null
          updated_at?: string
          webhook_path?: string
        }
        Update: {
          active?: boolean
          connected_account_id?: string
          created_at?: string
          federation_secret_env?: string
          notes?: string | null
          satellite_app?: string
          supabase_project_id?: string | null
          target_url_override?: string | null
          tenant_id?: string | null
          updated_at?: string
          webhook_path?: string
        }
        Relationships: []
      }
      stripe_catalog_cache: {
        Row: {
          active: boolean | null
          lookup_key: string
          price_id: string
          product_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          lookup_key: string
          price_id: string
          product_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          lookup_key?: string
          price_id?: string
          product_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_checkout_routing: {
        Row: {
          active: boolean
          created_at: string
          satellite_app: string
          stripe_customer_id: string
          supabase_project_id: string
          tenant_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          satellite_app: string
          stripe_customer_id: string
          supabase_project_id: string
          tenant_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          satellite_app?: string
          stripe_customer_id?: string
          supabase_project_id?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      stripe_connect_webhook_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      stripe_hub_dlq: {
        Row: {
          connected_account_id: string | null
          created_at: string
          event_id: string
          event_payload: Json | null
          event_type: string
          failure_reason: string | null
          id: string
          next_retry_at: string | null
          resolved: boolean
          resolved_at: string | null
          retry_count: number
          target_url: string | null
        }
        Insert: {
          connected_account_id?: string | null
          created_at?: string
          event_id: string
          event_payload?: Json | null
          event_type: string
          failure_reason?: string | null
          id?: string
          next_retry_at?: string | null
          resolved?: boolean
          resolved_at?: string | null
          retry_count?: number
          target_url?: string | null
        }
        Update: {
          connected_account_id?: string | null
          created_at?: string
          event_id?: string
          event_payload?: Json | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          next_retry_at?: string | null
          resolved?: boolean
          resolved_at?: string | null
          retry_count?: number
          target_url?: string | null
        }
        Relationships: []
      }
      stripe_hub_events: {
        Row: {
          connected_account_id: string | null
          event_id: string
          event_type: string
          forwarded_response: string | null
          forwarded_status_code: number | null
          processed_ok: boolean
          routed_at: string
          satellite_app: string | null
        }
        Insert: {
          connected_account_id?: string | null
          event_id: string
          event_type: string
          forwarded_response?: string | null
          forwarded_status_code?: number | null
          processed_ok?: boolean
          routed_at?: string
          satellite_app?: string | null
        }
        Update: {
          connected_account_id?: string | null
          event_id?: string
          event_type?: string
          forwarded_response?: string | null
          forwarded_status_code?: number | null
          processed_ok?: boolean
          routed_at?: string
          satellite_app?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          processed_at: string | null
        }
        Insert: {
          event_id: string
          processed_at?: string | null
        }
        Update: {
          event_id?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sync_conflicts: {
        Row: {
          conflicting_fields: string[]
          connector_key: string
          created_at: string
          cros_data: Json
          entity_id: string | null
          entity_type: string
          external_id: string
          id: string
          remote_data: Json
          resolution: string
          resolved_at: string | null
          resolved_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          conflicting_fields?: string[]
          connector_key: string
          created_at?: string
          cros_data?: Json
          entity_id?: string | null
          entity_type: string
          external_id: string
          id?: string
          remote_data?: Json
          resolution?: string
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          conflicting_fields?: string[]
          connector_key?: string
          created_at?: string
          cros_data?: Json
          entity_id?: string | null
          entity_type?: string
          external_id?: string
          id?: string
          remote_data?: Json
          resolution?: string
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sync_conflicts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sync_conflicts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_direction_config: {
        Row: {
          connector_key: string
          created_at: string
          delta_token: string | null
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          outbound_entities: string[]
          sync_direction: string
          tenant_id: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          connector_key: string
          created_at?: string
          delta_token?: string | null
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          outbound_entities?: string[]
          sync_direction?: string
          tenant_id: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          connector_key?: string
          created_at?: string
          delta_token?: string | null
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          outbound_entities?: string[]
          sync_direction?: string
          tenant_id?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_direction_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sync_direction_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "sync_direction_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_error_events: {
        Row: {
          component: string
          created_at: string
          error_type: string
          id: string
          route: string
          stack_excerpt: string | null
          tenant_id: string | null
          user_role: string | null
        }
        Insert: {
          component?: string
          created_at?: string
          error_type?: string
          id?: string
          route?: string
          stack_excerpt?: string | null
          tenant_id?: string | null
          user_role?: string | null
        }
        Update: {
          component?: string
          created_at?: string
          error_type?: string
          id?: string
          route?: string
          stack_excerpt?: string | null
          tenant_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_error_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "system_error_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "system_error_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_events: {
        Row: {
          error: Json | null
          id: string
          metro_id: string | null
          occurred_at: string
          schedule_key: string
          stats: Json
          status: string
          tenant_id: string | null
        }
        Insert: {
          error?: Json | null
          id?: string
          metro_id?: string | null
          occurred_at?: string
          schedule_key: string
          stats?: Json
          status: string
          tenant_id?: string | null
        }
        Update: {
          error?: Json | null
          id?: string
          metro_id?: string | null
          occurred_at?: string
          schedule_key?: string
          stats?: Json
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_health_events_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "system_health_events_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_health_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "system_health_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "system_health_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_job_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          errors: Json
          id: string
          job_key: string
          metro_id: string | null
          opportunity_id: string | null
          outputs: Json
          scope: string
          started_at: string
          stats: Json
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          errors?: Json
          id?: string
          job_key: string
          metro_id?: string | null
          opportunity_id?: string | null
          outputs?: Json
          scope: string
          started_at?: string
          stats?: Json
          status: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          errors?: Json
          id?: string
          job_key?: string
          metro_id?: string | null
          opportunity_id?: string | null
          outputs?: Json
          scope?: string
          started_at?: string
          stats?: Json
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_job_runs_job_key_fkey"
            columns: ["job_key"]
            isOneToOne: false
            referencedRelation: "system_jobs"
            referencedColumns: ["key"]
          },
        ]
      }
      system_jobs: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          id: string
          key: string
          name: string
          owner: string
          rrule: string | null
          schedule: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          id?: string
          key: string
          name: string
          owner?: string
          rrule?: string | null
          schedule: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          owner?: string
          rrule?: string | null
          schedule?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_suggestions: {
        Row: {
          acted_at: string | null
          action_taken: string | null
          audience: Json
          confidence: number
          created_at: string
          dedupe_key: string | null
          delivered_at: string | null
          dismissed_at: string | null
          id: string
          metro_id: string | null
          opportunity_id: string | null
          person_id: string | null
          rationale: Json
          scope: string
          source_refs: Json
          suggestion_type: string
          summary: string
          title: string
        }
        Insert: {
          acted_at?: string | null
          action_taken?: string | null
          audience?: Json
          confidence?: number
          created_at?: string
          dedupe_key?: string | null
          delivered_at?: string | null
          dismissed_at?: string | null
          id?: string
          metro_id?: string | null
          opportunity_id?: string | null
          person_id?: string | null
          rationale?: Json
          scope: string
          source_refs?: Json
          suggestion_type: string
          summary: string
          title: string
        }
        Update: {
          acted_at?: string | null
          action_taken?: string | null
          audience?: Json
          confidence?: number
          created_at?: string
          dedupe_key?: string | null
          delivered_at?: string | null
          dismissed_at?: string | null
          id?: string
          metro_id?: string | null
          opportunity_id?: string | null
          person_id?: string | null
          rationale?: Json
          scope?: string
          source_refs?: Json
          suggestion_type?: string
          summary?: string
          title?: string
        }
        Relationships: []
      }
      system_sweep_log: {
        Row: {
          created_at: string
          id: string
          kind: string
          last_run_at: string | null
          metrics: Json
          period_end: string | null
          period_start: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          last_run_at?: string | null
          metrics?: Json
          period_end?: string | null
          period_start?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          last_run_at?: string | null
          metrics?: Json
          period_end?: string | null
          period_start?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_sweep_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "system_sweep_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "system_sweep_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_sweeps: {
        Row: {
          completed_at: string | null
          demo_tenant_id: string | null
          error: Json | null
          id: string
          scoreboard: Json
          started_at: string
          stats: Json
          status: string
          steps: Json
          sweep_key: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          demo_tenant_id?: string | null
          error?: Json | null
          id?: string
          scoreboard?: Json
          started_at?: string
          stats?: Json
          status: string
          steps?: Json
          sweep_key: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          demo_tenant_id?: string | null
          error?: Json | null
          id?: string
          scoreboard?: Json
          started_at?: string
          stats?: Json
          status?: string
          steps?: Json
          sweep_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_sweeps_demo_tenant_id_fkey"
            columns: ["demo_tenant_id"]
            isOneToOne: false
            referencedRelation: "demo_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_sweeps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "system_sweeps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "system_sweeps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_add_ons: {
        Row: {
          activated_at: string
          add_on_key: string
          created_at: string
          deactivated_at: string | null
          id: string
          metadata: Json | null
          status: string
          stripe_subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          activated_at?: string
          add_on_key: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          activated_at?: string
          add_on_key?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          stripe_subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_add_ons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_add_ons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_add_ons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_archetype_settings: {
        Row: {
          archetype: string
          created_at: string | null
          settings_json: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          archetype: string
          created_at?: string | null
          settings_json?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          archetype?: string
          created_at?: string | null
          settings_json?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_archetype_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_archetype_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_archetype_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          tenant_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          tenant_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          tenant_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_entitlement_audit: {
        Row: {
          actor: string
          after: Json
          before: Json
          created_at: string | null
          event_type: string
          id: string
          stripe_event_id: string | null
          tenant_id: string | null
        }
        Insert: {
          actor?: string
          after?: Json
          before?: Json
          created_at?: string | null
          event_type: string
          id?: string
          stripe_event_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          actor?: string
          after?: Json
          before?: Json
          created_at?: string | null
          event_type?: string
          id?: string
          stripe_event_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_entitlement_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_entitlement_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_entitlement_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_entitlements: {
        Row: {
          addon_users: number
          ai_bonus_calls: number
          ai_bonus_tokens: number
          ai_tier: string
          campaigns_enabled: boolean
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          included_users: number
          is_stale: boolean
          last_synced_at: string
          local_pulse_tier: string
          nri_tier: string
          plan_key: string
          stripe_customer_id: string | null
          stripe_status: string
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          addon_users?: number
          ai_bonus_calls?: number
          ai_bonus_tokens?: number
          ai_tier?: string
          campaigns_enabled?: boolean
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          included_users?: number
          is_stale?: boolean
          last_synced_at?: string
          local_pulse_tier?: string
          nri_tier?: string
          plan_key?: string
          stripe_customer_id?: string | null
          stripe_status?: string
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          addon_users?: number
          ai_bonus_calls?: number
          ai_bonus_tokens?: number
          ai_tier?: string
          campaigns_enabled?: boolean
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          included_users?: number
          is_stale?: boolean
          last_synced_at?: string
          local_pulse_tier?: string
          nri_tier?: string
          plan_key?: string
          stripe_customer_id?: string | null
          stripe_status?: string
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_flags: {
        Row: {
          config: Json
          enabled: boolean
          key: string
          tenant_id: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          key: string
          tenant_id: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_flags_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_feature_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_form_intakes: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          id: string
          label: string
          last_seen_at: string | null
          settings: Json
          source: string
          submission_count: number
          tenant_id: string
          token: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          label: string
          last_seen_at?: string | null
          settings?: Json
          source?: string
          submission_count?: number
          tenant_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          last_seen_at?: string | null
          settings?: Json
          source?: string
          submission_count?: number
          tenant_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_form_intakes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_form_intakes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_form_intakes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_gardener_assignments: {
        Row: {
          assignment_type: string
          created_at: string
          ends_at: string | null
          gardener_id: string
          id: string
          reason: string | null
          starts_at: string | null
          tenant_id: string
        }
        Insert: {
          assignment_type?: string
          created_at?: string
          ends_at?: string | null
          gardener_id: string
          id?: string
          reason?: string | null
          starts_at?: string | null
          tenant_id: string
        }
        Update: {
          assignment_type?: string
          created_at?: string
          ends_at?: string | null
          gardener_id?: string
          id?: string
          reason?: string | null
          starts_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_gardener_assignments_gardener_id_fkey"
            columns: ["gardener_id"]
            isOneToOne: false
            referencedRelation: "gardeners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_gardener_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_gardener_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_gardener_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          ministry_role: string
          revoked_at: string | null
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          ministry_role?: string
          revoked_at?: string | null
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          ministry_role?: string
          revoked_at?: string | null
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invoices: {
        Row: {
          amount_cents: number
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string
          description: string
          due_date: string | null
          id: string
          note: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["financial_event_status"]
          stripe_hosted_url: string | null
          stripe_invoice_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          contact_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description: string
          due_date?: string | null
          id?: string
          note?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["financial_event_status"]
          stripe_hosted_url?: string | null
          stripe_invoice_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          due_date?: string | null
          id?: string
          note?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["financial_event_status"]
          stripe_hosted_url?: string | null
          stripe_invoice_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_journey_stages: {
        Row: {
          created_at: string
          id: string
          stage_label: string
          stage_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stage_label: string
          stage_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stage_label?: string
          stage_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_journey_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_journey_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_journey_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_life_event_settings: {
        Row: {
          birthday_notify_roles: string[]
          default_notify_roles: string[]
          enable_life_event_notifications: boolean
          enable_life_event_reminders: boolean
          reminder_window_days: number
          sensitive_event_visibility_lock: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          birthday_notify_roles?: string[]
          default_notify_roles?: string[]
          enable_life_event_notifications?: boolean
          enable_life_event_reminders?: boolean
          reminder_window_days?: number
          sensitive_event_visibility_lock?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          birthday_notify_roles?: string[]
          default_notify_roles?: string[]
          enable_life_event_notifications?: boolean
          enable_life_event_reminders?: boolean
          reminder_window_days?: number
          sensitive_event_visibility_lock?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_life_event_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_life_event_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_life_event_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_metros: {
        Row: {
          created_at: string
          metro_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          metro_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          metro_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_metros_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "tenant_metros_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_metros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_metros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_metros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_onboarding_state: {
        Row: {
          completed: boolean
          created_at: string
          data: Json
          step: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          data?: Json
          step?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          data?: Json
          step?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_onboarding_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_onboarding_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_onboarding_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_orientation_audit: {
        Row: {
          actor_id: string
          auto_manage_after: boolean | null
          auto_manage_before: boolean | null
          created_at: string
          id: string
          new_orientation: string
          new_partner_richness: number | null
          new_people_richness: number | null
          old_orientation: string | null
          old_partner_richness: number | null
          old_people_richness: number | null
          tenant_id: string
        }
        Insert: {
          actor_id: string
          auto_manage_after?: boolean | null
          auto_manage_before?: boolean | null
          created_at?: string
          id?: string
          new_orientation: string
          new_partner_richness?: number | null
          new_people_richness?: number | null
          old_orientation?: string | null
          old_partner_richness?: number | null
          old_people_richness?: number | null
          tenant_id: string
        }
        Update: {
          actor_id?: string
          auto_manage_after?: boolean | null
          auto_manage_before?: boolean | null
          created_at?: string
          id?: string
          new_orientation?: string
          new_partner_richness?: number | null
          new_people_richness?: number | null
          old_orientation?: string | null
          old_partner_richness?: number | null
          old_people_richness?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_orientation_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_orientation_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_orientation_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_links: {
        Row: {
          active: boolean
          amount_cents: number
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string
          description: string | null
          event_id: string | null
          event_type: Database["public"]["Enums"]["financial_event_type"]
          id: string
          max_quantity: number | null
          note: string | null
          stripe_payment_link_id: string | null
          stripe_payment_link_url: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          contact_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          event_id?: string | null
          event_type?: Database["public"]["Enums"]["financial_event_type"]
          id?: string
          max_quantity?: number | null
          note?: string | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          event_id?: string | null
          event_type?: Database["public"]["Enums"]["financial_event_type"]
          id?: string
          max_quantity?: number | null
          note?: string | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_payment_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_payment_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_payment_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_praeceptum_settings: {
        Row: {
          adaptive_prompting: boolean
          created_at: string
          enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adaptive_prompting?: boolean
          created_at?: string
          enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adaptive_prompting?: boolean
          created_at?: string
          enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_praeceptum_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_praeceptum_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_praeceptum_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_privacy_settings: {
        Row: {
          action_retention_days: number
          created_at: string
          enable_recent_actions_for_assistant: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_retention_days?: number
          created_at?: string
          enable_recent_actions_for_assistant?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_retention_days?: number
          created_at?: string
          enable_recent_actions_for_assistant?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_privacy_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_privacy_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_privacy_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_provision_settings: {
        Row: {
          catalog_enabled: boolean
          created_at: string
          familia_sharing_enabled: boolean
          mode: string
          pricing_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          catalog_enabled?: boolean
          created_at?: string
          familia_sharing_enabled?: boolean
          mode?: string
          pricing_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          catalog_enabled?: boolean
          created_at?: string
          familia_sharing_enabled?: boolean
          mode?: string
          pricing_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_provision_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_provision_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_provision_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_public_profiles: {
        Row: {
          archetype_selected: string | null
          archetype_suggested: string | null
          city: string | null
          communio_opt_in: boolean
          created_at: string
          display_name: string | null
          enriched_at: string | null
          enrichment_coverage: string | null
          enrichment_source: string | null
          id: string
          keywords: Json | null
          logo_url: string | null
          metro_hint: string | null
          mission_summary: string | null
          populations_served: Json | null
          programs: Json | null
          published_at: string | null
          source_url: string | null
          state: string | null
          status: string
          tagline: string | null
          tenant_id: string
          updated_at: string
          visibility_level: string
          website_url: string | null
        }
        Insert: {
          archetype_selected?: string | null
          archetype_suggested?: string | null
          city?: string | null
          communio_opt_in?: boolean
          created_at?: string
          display_name?: string | null
          enriched_at?: string | null
          enrichment_coverage?: string | null
          enrichment_source?: string | null
          id?: string
          keywords?: Json | null
          logo_url?: string | null
          metro_hint?: string | null
          mission_summary?: string | null
          populations_served?: Json | null
          programs?: Json | null
          published_at?: string | null
          source_url?: string | null
          state?: string | null
          status?: string
          tagline?: string | null
          tenant_id: string
          updated_at?: string
          visibility_level?: string
          website_url?: string | null
        }
        Update: {
          archetype_selected?: string | null
          archetype_suggested?: string | null
          city?: string | null
          communio_opt_in?: boolean
          created_at?: string
          display_name?: string | null
          enriched_at?: string | null
          enrichment_coverage?: string | null
          enrichment_source?: string | null
          id?: string
          keywords?: Json | null
          logo_url?: string | null
          metro_hint?: string | null
          mission_summary?: string | null
          populations_served?: Json | null
          programs?: Json | null
          published_at?: string | null
          source_url?: string | null
          state?: string | null
          status?: string
          tagline?: string | null
          tenant_id?: string
          updated_at?: string
          visibility_level?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_public_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_public_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_public_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_referral_attribution: {
        Row: {
          attribution: Json | null
          first_touch_at: string
          id: string
          last_touch_at: string
          referral_code: string
          tenant_id: string
        }
        Insert: {
          attribution?: Json | null
          first_touch_at?: string
          id?: string
          last_touch_at?: string
          referral_code: string
          tenant_id: string
        }
        Update: {
          attribution?: Json | null
          first_touch_at?: string
          id?: string
          last_touch_at?: string
          referral_code?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_referral_attribution_referral_code_fkey"
            columns: ["referral_code"]
            isOneToOne: false
            referencedRelation: "operator_referrals"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "tenant_referral_attribution_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_referral_attribution_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_referral_attribution_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_sectors: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          sector_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          sector_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          sector_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_sectors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_sectors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_sectors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          allow_full_workspace_toggle: boolean
          calm_mode_default: boolean
          communio_awareness_enabled: boolean
          companion_mode_allow_users: boolean
          companion_mode_default: boolean
          compliance_posture: string
          created_at: string
          default_lens: string
          default_view_mode: string
          narrative_companion_enabled: boolean
          seasonal_echoes_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_full_workspace_toggle?: boolean
          calm_mode_default?: boolean
          communio_awareness_enabled?: boolean
          companion_mode_allow_users?: boolean
          companion_mode_default?: boolean
          compliance_posture?: string
          created_at?: string
          default_lens?: string
          default_view_mode?: string
          narrative_companion_enabled?: boolean
          seasonal_echoes_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_full_workspace_toggle?: boolean
          calm_mode_default?: boolean
          communio_awareness_enabled?: boolean
          companion_mode_allow_users?: boolean
          companion_mode_default?: boolean
          compliance_posture?: string
          created_at?: string
          default_lens?: string
          default_view_mode?: string
          narrative_companion_enabled?: boolean
          seasonal_echoes_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_signum_settings: {
        Row: {
          assistant_micro_prompts: boolean
          created_at: string
          enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assistant_micro_prompts?: boolean
          created_at?: string
          enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assistant_micro_prompts?: boolean
          created_at?: string
          enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_signum_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_signum_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_signum_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_slug_redirects: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          old_slug: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          old_slug: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          old_slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_slug_redirects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_slug_redirects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_slug_redirects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_stripe_connect: {
        Row: {
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          id: string
          last_payout_failure_at: string | null
          last_payout_failure_code: string | null
          last_payout_failure_message: string | null
          onboarding_completed_at: string | null
          payouts_enabled: boolean
          platform_fee_percent: number
          stripe_account_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          last_payout_failure_at?: string | null
          last_payout_failure_code?: string | null
          last_payout_failure_message?: string | null
          onboarding_completed_at?: string | null
          payouts_enabled?: boolean
          platform_fee_percent?: number
          stripe_account_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          id?: string
          last_payout_failure_at?: string | null
          last_payout_failure_code?: string | null
          last_payout_failure_message?: string | null
          onboarding_completed_at?: string | null
          payouts_enabled?: boolean
          platform_fee_percent?: number
          stripe_account_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_stripe_connect_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_stripe_connect_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_stripe_connect_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          seats: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
          usage_addons: Json
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
          usage_addons?: Json
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
          usage_addons?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_territories: {
        Row: {
          activation_slots: number
          bundle_id: string | null
          created_at: string
          id: string
          is_home: boolean
          tenant_id: string
          territory_id: string
        }
        Insert: {
          activation_slots?: number
          bundle_id?: string | null
          created_at?: string
          id?: string
          is_home?: boolean
          tenant_id: string
          territory_id: string
        }
        Update: {
          activation_slots?: number
          bundle_id?: string | null
          created_at?: string
          id?: string
          is_home?: boolean
          tenant_id?: string
          territory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_territories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_territories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_territories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_territories_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage_counters: {
        Row: {
          ai_calls: number
          ai_calls_firecrawl: number
          ai_calls_gemini: number
          ai_calls_lovable: number
          ai_calls_perplexity: number
          ai_cost_estimated_usd: number
          ai_tokens: number
          created_at: string | null
          deep_mode_calls: number
          essential_mode_calls: number
          id: string
          nri_flags_emitted: number
          nri_rollups_run: number
          period_end: string
          period_start: string
          pulse_articles_ingested: number
          pulse_runs: number
          tenant_id: string
        }
        Insert: {
          ai_calls?: number
          ai_calls_firecrawl?: number
          ai_calls_gemini?: number
          ai_calls_lovable?: number
          ai_calls_perplexity?: number
          ai_cost_estimated_usd?: number
          ai_tokens?: number
          created_at?: string | null
          deep_mode_calls?: number
          essential_mode_calls?: number
          id?: string
          nri_flags_emitted?: number
          nri_rollups_run?: number
          period_end: string
          period_start: string
          pulse_articles_ingested?: number
          pulse_runs?: number
          tenant_id: string
        }
        Update: {
          ai_calls?: number
          ai_calls_firecrawl?: number
          ai_calls_gemini?: number
          ai_calls_lovable?: number
          ai_calls_perplexity?: number
          ai_cost_estimated_usd?: number
          ai_tokens?: number
          created_at?: string | null
          deep_mode_calls?: number
          essential_mode_calls?: number
          id?: string
          nri_flags_emitted?: number
          nri_rollups_run?: number
          period_end?: string
          period_start?: string
          pulse_articles_ingested?: number
          pulse_runs?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_user_lenses: {
        Row: {
          created_at: string
          full_workspace_enabled: boolean
          id: string
          lens: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_workspace_enabled?: boolean
          id?: string
          lens?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_workspace_enabled?: boolean
          id?: string
          lens?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_user_lenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_user_lenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_user_lenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_user_preferences: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          ui_lens: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          ui_lens?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          ui_lens?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          absorption_request_id: string | null
          created_at: string
          home_metro_id: string | null
          joined_from_companion: boolean
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          absorption_request_id?: string | null
          created_at?: string
          home_metro_id?: string | null
          joined_from_companion?: boolean
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          absorption_request_id?: string | null
          created_at?: string
          home_metro_id?: string | null
          joined_from_companion?: boolean
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_absorption_request_id_fkey"
            columns: ["absorption_request_id"]
            isOneToOne: false
            referencedRelation: "companion_absorption_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_home_metro_id_fkey"
            columns: ["home_metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "tenant_users_home_metro_id_fkey"
            columns: ["home_metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_voice_settings: {
        Row: {
          created_at: string
          enable_voice_notes: boolean
          max_audio_mb: number
          max_audio_seconds: number
          store_audio: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enable_voice_notes?: boolean
          max_audio_mb?: number
          max_audio_seconds?: number
          store_audio?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enable_voice_notes?: boolean
          max_audio_mb?: number
          max_audio_seconds?: number
          store_audio?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_voice_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_voice_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_voice_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          archetype: string | null
          auto_manage_richness: boolean
          base_city: string | null
          base_country_code: string | null
          base_state_code: string | null
          billing_mode: string
          brand_color: string | null
          brief_lookback_days: number
          brief_report_day: number
          caregiver_network_opt_in: boolean
          civitas_enabled: boolean
          created_at: string
          familia_id: string | null
          founding_garden_joined_at: string | null
          founding_garden_program_key: string | null
          founding_garden_status: boolean
          home_metro_id: string | null
          id: string
          is_founding_garden: boolean
          is_operator_granted: boolean
          logo_url: string | null
          name: string
          operator_grant_reason: string | null
          operator_granted_at: string | null
          operator_granted_by: string | null
          partner_richness_level: number
          people_richness_level: number
          relational_orientation: string
          search_keywords: string[] | null
          search_keywords_source: string | null
          settings: Json
          slug: string
          source_app: string | null
          status: string
          stripe_connect_account_id: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          archetype?: string | null
          auto_manage_richness?: boolean
          base_city?: string | null
          base_country_code?: string | null
          base_state_code?: string | null
          billing_mode?: string
          brand_color?: string | null
          brief_lookback_days?: number
          brief_report_day?: number
          caregiver_network_opt_in?: boolean
          civitas_enabled?: boolean
          created_at?: string
          familia_id?: string | null
          founding_garden_joined_at?: string | null
          founding_garden_program_key?: string | null
          founding_garden_status?: boolean
          home_metro_id?: string | null
          id?: string
          is_founding_garden?: boolean
          is_operator_granted?: boolean
          logo_url?: string | null
          name: string
          operator_grant_reason?: string | null
          operator_granted_at?: string | null
          operator_granted_by?: string | null
          partner_richness_level?: number
          people_richness_level?: number
          relational_orientation?: string
          search_keywords?: string[] | null
          search_keywords_source?: string | null
          settings?: Json
          slug: string
          source_app?: string | null
          status?: string
          stripe_connect_account_id?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          archetype?: string | null
          auto_manage_richness?: boolean
          base_city?: string | null
          base_country_code?: string | null
          base_state_code?: string | null
          billing_mode?: string
          brand_color?: string | null
          brief_lookback_days?: number
          brief_report_day?: number
          caregiver_network_opt_in?: boolean
          civitas_enabled?: boolean
          created_at?: string
          familia_id?: string | null
          founding_garden_joined_at?: string | null
          founding_garden_program_key?: string | null
          founding_garden_status?: boolean
          home_metro_id?: string | null
          id?: string
          is_founding_garden?: boolean
          is_operator_granted?: boolean
          logo_url?: string | null
          name?: string
          operator_grant_reason?: string | null
          operator_granted_at?: string | null
          operator_granted_by?: string | null
          partner_richness_level?: number
          people_richness_level?: number
          relational_orientation?: string
          search_keywords?: string[] | null
          search_keywords_source?: string | null
          settings?: Json
          slug?: string
          source_app?: string | null
          status?: string
          stripe_connect_account_id?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_home_metro_id_fkey"
            columns: ["home_metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "tenants_home_metro_id_fkey"
            columns: ["home_metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      territories: {
        Row: {
          active: boolean
          centroid_lat: number | null
          centroid_lng: number | null
          country_code: string | null
          created_at: string
          id: string
          metro_id: string | null
          name: string
          parent_id: string | null
          population_estimate: number | null
          state_code: string | null
          territory_type: Database["public"]["Enums"]["territory_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          centroid_lat?: number | null
          centroid_lng?: number | null
          country_code?: string | null
          created_at?: string
          id?: string
          metro_id?: string | null
          name: string
          parent_id?: string | null
          population_estimate?: number | null
          state_code?: string | null
          territory_type: Database["public"]["Enums"]["territory_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          centroid_lat?: number | null
          centroid_lng?: number | null
          country_code?: string | null
          created_at?: string
          id?: string
          metro_id?: string | null
          name?: string
          parent_id?: string | null
          population_estimate?: number | null
          state_code?: string | null
          territory_type?: Database["public"]["Enums"]["territory_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "territories_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "territories_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonium_events: {
        Row: {
          created_at: string | null
          event_kind: string
          id: string
          metadata: Json
          metro_id: string | null
          occurred_at: string
          opportunity_id: string | null
          signal_weight: number
          source_module: string
          summary: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_kind: string
          id?: string
          metadata?: Json
          metro_id?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          signal_weight?: number
          source_module: string
          summary: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_kind?: string
          id?: string
          metadata?: Json
          metro_id?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          signal_weight?: number
          source_module?: string
          summary?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonium_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonium_export_sections: {
        Row: {
          body: Json
          export_id: string
          id: string
          order_index: number
          section_key: string
          title: string
        }
        Insert: {
          body?: Json
          export_id: string
          id?: string
          order_index?: number
          section_key: string
          title: string
        }
        Update: {
          body?: Json
          export_id?: string
          id?: string
          order_index?: number
          section_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonium_export_sections_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "testimonium_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonium_exports: {
        Row: {
          created_at: string
          export_type: string
          generated_by: string | null
          id: string
          metrics_snapshot: Json
          narrative_outline: Json
          period_end: string
          period_start: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          export_type: string
          generated_by?: string | null
          id?: string
          metrics_snapshot?: Json
          narrative_outline?: Json
          period_end: string
          period_start: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          export_type?: string
          generated_by?: string | null
          id?: string
          metrics_snapshot?: Json
          narrative_outline?: Json
          period_end?: string
          period_start?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonium_exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonium_flags: {
        Row: {
          created_at: string | null
          description: string
          flag_type: string
          id: string
          metro_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          flag_type: string
          id?: string
          metro_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          flag_type?: string
          id?: string
          metro_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonium_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonium_generation_runs: {
        Row: {
          created_at: string
          error: Json | null
          id: string
          period_end: string | null
          period_start: string | null
          stats: Json | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          error?: Json | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          stats?: Json | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          error?: Json | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          stats?: Json | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonium_generation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_generation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_generation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonium_reports: {
        Row: {
          ai_generated: boolean
          created_at: string
          generated_by: string
          id: string
          metro_id: string | null
          narrative_json: Json
          period_end: string
          period_start: string
          scope: Json
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          created_at?: string
          generated_by: string
          id?: string
          metro_id?: string | null
          narrative_json?: Json
          period_end: string
          period_start: string
          scope?: Json
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          created_at?: string
          generated_by?: string
          id?: string
          metro_id?: string | null
          narrative_json?: Json
          period_end?: string
          period_start?: string
          scope?: Json
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonium_reports_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "testimonium_reports_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonium_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonium_rollups: {
        Row: {
          email_touch_count: number
          event_presence_count: number
          helpers_involved_count: number
          id: string
          journey_moves: number
          metro_id: string | null
          migration_activity: number
          people_helped_sum: number
          project_notes_count: number
          projects_count: number
          provisions_created: number
          reflection_count: number
          tenant_id: string
          volunteer_activity: number
          week_start: string
        }
        Insert: {
          email_touch_count?: number
          event_presence_count?: number
          helpers_involved_count?: number
          id?: string
          journey_moves?: number
          metro_id?: string | null
          migration_activity?: number
          people_helped_sum?: number
          project_notes_count?: number
          projects_count?: number
          provisions_created?: number
          reflection_count?: number
          tenant_id: string
          volunteer_activity?: number
          week_start: string
        }
        Update: {
          email_touch_count?: number
          event_presence_count?: number
          helpers_involved_count?: number
          id?: string
          journey_moves?: number
          metro_id?: string | null
          migration_activity?: number
          people_helped_sum?: number
          project_notes_count?: number
          projects_count?: number
          provisions_created?: number
          reflection_count?: number
          tenant_id?: string
          volunteer_activity?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonium_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testimonium_rollups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonium_sections: {
        Row: {
          content: Json
          created_at: string
          id: string
          order_index: number
          report_id: string
          section_key: string
          title: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          order_index: number
          report_id: string
          section_key: string
          title: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          order_index?: number
          report_id?: string
          section_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonium_sections_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "testimonium_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_runs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          steps: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          steps?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          steps?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tour_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tour_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_screenshots: {
        Row: {
          created_at: string
          filename: string
          id: string
          step_key: string
          tour_run_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          step_key: string
          tour_run_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          step_key?: string
          tour_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_screenshots_tour_run_id_fkey"
            columns: ["tour_run_id"]
            isOneToOne: false
            referencedRelation: "tour_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          created_at: string
          firecrawl_pages: number
          id: string
          n8n_runs: number
          openai_tokens: number
          period_end: string
          period_start: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          firecrawl_pages?: number
          id?: string
          n8n_runs?: number
          openai_tokens?: number
          period_end: string
          period_start: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          firecrawl_pages?: number
          id?: string
          n8n_runs?: number
          openai_tokens?: number
          period_end?: string
          period_start?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          org_id: string | null
          quantity: number
          run_id: string
          unit: string
          workflow_key: string
        }
        Insert: {
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          org_id?: string | null
          quantity?: number
          run_id: string
          unit?: string
          workflow_key: string
        }
        Update: {
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          org_id?: string | null
          quantity?: number
          run_id?: string
          unit?: string
          workflow_key?: string
        }
        Relationships: []
      }
      user_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          ref_id: string | null
          ref_type: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          ref_id?: string | null
          ref_type?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_digest_preferences: {
        Row: {
          created_at: string
          frequency: string
          include_essays: boolean
          include_living_pulse: boolean
          include_narratives: boolean
          include_network: boolean
          include_projects: boolean
          include_system: boolean
          include_visits: boolean
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          include_essays?: boolean
          include_living_pulse?: boolean
          include_narratives?: boolean
          include_network?: boolean
          include_projects?: boolean
          include_system?: boolean
          include_visits?: boolean
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          frequency?: string
          include_essays?: boolean
          include_living_pulse?: boolean
          include_narratives?: boolean
          include_network?: boolean
          include_projects?: boolean
          include_system?: boolean
          include_visits?: boolean
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_digest_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_digest_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_digest_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_overrides: {
        Row: {
          enabled: boolean
          key: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          enabled: boolean
          key: string
          tenant_id: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          key?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_overrides_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_metro_assignments: {
        Row: {
          created_at: string | null
          id: string
          metro_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metro_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metro_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_metro_assignments_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "user_metro_assignments_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          created_at: string | null
          daily_push_count: number | null
          daily_push_reset_at: string | null
          hourly_push_count: number | null
          hourly_push_reset_at: string | null
          last_ai_bundles_notified_at: string | null
          last_events_notified_at: string | null
          last_overdue_tasks_notified_at: string | null
          last_post_event_notified_at: string | null
          last_weekly_plan_notified_at: string | null
          notify_ai_bundles: boolean | null
          notify_automation_health: boolean | null
          notify_campaign_suggestions: boolean | null
          notify_campaign_summary: boolean | null
          notify_daily_digest: boolean | null
          notify_event_enrichment: boolean | null
          notify_events: boolean | null
          notify_meeting_notes: boolean
          notify_overdue_tasks: boolean
          notify_post_event: boolean | null
          notify_watchlist_signals: boolean | null
          notify_weekly_plan: boolean | null
          notify_weekly_summary: boolean | null
          push_enabled: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_push_count?: number | null
          daily_push_reset_at?: string | null
          hourly_push_count?: number | null
          hourly_push_reset_at?: string | null
          last_ai_bundles_notified_at?: string | null
          last_events_notified_at?: string | null
          last_overdue_tasks_notified_at?: string | null
          last_post_event_notified_at?: string | null
          last_weekly_plan_notified_at?: string | null
          notify_ai_bundles?: boolean | null
          notify_automation_health?: boolean | null
          notify_campaign_suggestions?: boolean | null
          notify_campaign_summary?: boolean | null
          notify_daily_digest?: boolean | null
          notify_event_enrichment?: boolean | null
          notify_events?: boolean | null
          notify_meeting_notes?: boolean
          notify_overdue_tasks?: boolean
          notify_post_event?: boolean | null
          notify_watchlist_signals?: boolean | null
          notify_weekly_plan?: boolean | null
          notify_weekly_summary?: boolean | null
          push_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_push_count?: number | null
          daily_push_reset_at?: string | null
          hourly_push_count?: number | null
          hourly_push_reset_at?: string | null
          last_ai_bundles_notified_at?: string | null
          last_events_notified_at?: string | null
          last_overdue_tasks_notified_at?: string | null
          last_post_event_notified_at?: string | null
          last_weekly_plan_notified_at?: string | null
          notify_ai_bundles?: boolean | null
          notify_automation_health?: boolean | null
          notify_campaign_suggestions?: boolean | null
          notify_campaign_summary?: boolean | null
          notify_daily_digest?: boolean | null
          notify_event_enrichment?: boolean | null
          notify_events?: boolean | null
          notify_meeting_notes?: boolean
          notify_overdue_tasks?: boolean
          notify_post_event?: boolean | null
          notify_watchlist_signals?: boolean | null
          notify_weekly_plan?: boolean | null
          notify_weekly_summary?: boolean | null
          push_enabled?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          companion_mode_dismissed_until: string | null
          companion_mode_enabled: boolean
          created_at: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          companion_mode_dismissed_until?: string | null
          companion_mode_enabled?: boolean
          created_at?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          companion_mode_dismissed_until?: string | null
          companion_mode_enabled?: boolean
          created_at?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_region_assignments: {
        Row: {
          created_at: string | null
          id: string
          region_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          region_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          region_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_region_assignments_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vendor_credit_snapshots: {
        Row: {
          created_at: string
          id: string
          raw_response: Json | null
          snapshot_at: string
          vendor: string
          vendor_remaining: number | null
          vendor_total: number | null
          vendor_used: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          raw_response?: Json | null
          snapshot_at?: string
          vendor: string
          vendor_remaining?: number | null
          vendor_total?: number | null
          vendor_used?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          raw_response?: Json | null
          snapshot_at?: string
          vendor?: string
          vendor_remaining?: number | null
          vendor_total?: number | null
          vendor_used?: number | null
        }
        Relationships: []
      }
      vigilia_signals: {
        Row: {
          context_ref: string | null
          created_at: string
          id: string
          is_hipaa_sensitive: boolean
          role_scope: string
          severity: string
          status: string
          suggested_action: string
          tenant_id: string
          type: string
        }
        Insert: {
          context_ref?: string | null
          created_at?: string
          id?: string
          is_hipaa_sensitive?: boolean
          role_scope?: string
          severity?: string
          status?: string
          suggested_action: string
          tenant_id: string
          type: string
        }
        Update: {
          context_ref?: string | null
          created_at?: string
          id?: string
          is_hipaa_sensitive?: boolean
          role_scope?: string
          severity?: string
          status?: string
          suggested_action?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vigilia_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "vigilia_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "vigilia_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_assignments: {
        Row: {
          created_at: string
          id: string
          subject_id: string
          subject_type: string
          tenant_id: string
          visitor_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id: string
          subject_type: string
          tenant_id: string
          visitor_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string
          subject_type?: string
          tenant_id?: string
          visitor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "visit_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "visit_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_calibration_examples: {
        Row: {
          after_text: string
          before_text: string
          created_at: string
          id: string
          notes: string | null
          profile_id: string
        }
        Insert: {
          after_text: string
          before_text: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
        }
        Update: {
          after_text?: string
          before_text?: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_calibration_examples_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "voice_calibration_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_calibration_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          do_rules: string[]
          dont_rules: string[]
          id: string
          ignatian_mode: boolean
          profile_key: string
          sector: string
          tone_description: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          do_rules?: string[]
          dont_rules?: string[]
          id?: string
          ignatian_mode?: boolean
          profile_key: string
          sector?: string
          tone_description?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          do_rules?: string[]
          dont_rules?: string[]
          id?: string
          ignatian_mode?: boolean
          profile_key?: string
          sector?: string
          tone_description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      voice_notes: {
        Row: {
          audio_mime: string | null
          audio_path: string | null
          audio_seconds: number | null
          author_volunteer_id: string | null
          contact_id: string | null
          created_at: string
          error: Json | null
          id: string
          recorded_at: string
          recorded_by_user_id: string | null
          recording_mode: string
          source_activity_id: string | null
          subject_id: string
          subject_type: string
          tenant_id: string
          transcript: string | null
          transcript_confidence: number | null
          transcript_provider: string | null
          transcript_status: string
          user_id: string
        }
        Insert: {
          audio_mime?: string | null
          audio_path?: string | null
          audio_seconds?: number | null
          author_volunteer_id?: string | null
          contact_id?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          recorded_at?: string
          recorded_by_user_id?: string | null
          recording_mode?: string
          source_activity_id?: string | null
          subject_id: string
          subject_type: string
          tenant_id: string
          transcript?: string | null
          transcript_confidence?: number | null
          transcript_provider?: string | null
          transcript_status?: string
          user_id: string
        }
        Update: {
          audio_mime?: string | null
          audio_path?: string | null
          audio_seconds?: number | null
          author_volunteer_id?: string | null
          contact_id?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          recorded_at?: string
          recorded_by_user_id?: string | null
          recording_mode?: string
          source_activity_id?: string | null
          subject_id?: string
          subject_type?: string
          tenant_id?: string
          transcript?: string | null
          transcript_confidence?: number | null
          transcript_provider?: string | null
          transcript_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_notes_author_volunteer_id_fkey"
            columns: ["author_volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "voice_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "voice_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_hours_inbox: {
        Row: {
          created_at: string
          from_email: string
          gmail_message_id: string
          id: string
          parse_status: string
          parsed_json: Json
          raw_text: string
          reason: string | null
          received_at: string
          snippet: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          from_email: string
          gmail_message_id: string
          id?: string
          parse_status?: string
          parsed_json?: Json
          raw_text: string
          reason?: string | null
          received_at: string
          snippet?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          from_email?: string
          gmail_message_id?: string
          id?: string
          parse_status?: string
          parsed_json?: Json
          raw_text?: string
          reason?: string | null
          received_at?: string
          snippet?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      volunteer_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          kind: string
          minutes: number
          raw_text: string | null
          shift_date: string
          source: string
          source_email_message_id: string | null
          tenant_id: string | null
          volunteer_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          kind: string
          minutes: number
          raw_text?: string | null
          shift_date: string
          source?: string
          source_email_message_id?: string | null
          tenant_id?: string | null
          volunteer_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          minutes?: number
          raw_text?: string | null
          shift_date?: string
          source?: string
          source_email_message_id?: string | null
          tenant_id?: string | null
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_shifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "volunteer_shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "volunteer_shifts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_shifts_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_tag_links: {
        Row: {
          tag_id: string
          volunteer_id: string
        }
        Insert: {
          tag_id: string
          volunteer_id: string
        }
        Update: {
          tag_id?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "volunteer_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_tag_links_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "volunteer_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "volunteer_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteers: {
        Row: {
          address: string | null
          availability_notes: string | null
          bio: string | null
          city: string | null
          clifton_strengths: Json | null
          comfort_areas: Json | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          deleted_by: string | null
          disc_profile: string | null
          email: string
          enneagram_confidence: number | null
          enneagram_scores: Json | null
          enneagram_source: string | null
          enneagram_type: number | null
          enneagram_wing: number | null
          first_name: string
          id: string
          languages: Json | null
          last_name: string
          last_volunteered_at: string | null
          lifetime_minutes: number
          notes: string | null
          phone: string | null
          skills: Json | null
          state: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          zip: string | null
          zodiac_element: string | null
          zodiac_modality: string | null
          zodiac_sign: string | null
        }
        Insert: {
          address?: string | null
          availability_notes?: string | null
          bio?: string | null
          city?: string | null
          clifton_strengths?: Json | null
          comfort_areas?: Json | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          disc_profile?: string | null
          email: string
          enneagram_confidence?: number | null
          enneagram_scores?: Json | null
          enneagram_source?: string | null
          enneagram_type?: number | null
          enneagram_wing?: number | null
          first_name: string
          id?: string
          languages?: Json | null
          last_name: string
          last_volunteered_at?: string | null
          lifetime_minutes?: number
          notes?: string | null
          phone?: string | null
          skills?: Json | null
          state?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          zip?: string | null
          zodiac_element?: string | null
          zodiac_modality?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          address?: string | null
          availability_notes?: string | null
          bio?: string | null
          city?: string | null
          clifton_strengths?: Json | null
          comfort_areas?: Json | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          disc_profile?: string | null
          email?: string
          enneagram_confidence?: number | null
          enneagram_scores?: Json | null
          enneagram_source?: string | null
          enneagram_type?: number | null
          enneagram_wing?: number | null
          first_name?: string
          id?: string
          languages?: Json | null
          last_name?: string
          last_volunteered_at?: string | null
          lifetime_minutes?: number
          notes?: string | null
          phone?: string | null
          skills?: Json | null
          state?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          zip?: string | null
          zodiac_element?: string | null
          zodiac_modality?: string | null
          zodiac_sign?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "volunteers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "volunteers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_keys: {
        Row: {
          created_at: string | null
          id: string
          readai_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          readai_key?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          readai_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_plans: {
        Row: {
          created_at: string | null
          generated_at: string
          id: string
          plan_json: Json
          source_snapshot_hash: string | null
          updated_at: string | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          generated_at?: string
          id?: string
          plan_json?: Json
          source_snapshot_hash?: string | null
          updated_at?: string | null
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          generated_at?: string
          id?: string
          plan_json?: Json
          source_snapshot_hash?: string | null
          updated_at?: string | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          created_at: string
          id: string
          report_json: Json
          user_id: string
          week_of_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_json?: Json
          user_id: string
          week_of_date: string
        }
        Update: {
          created_at?: string
          id?: string
          report_json?: Json
          user_id?: string
          week_of_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      automation_health_summary: {
        Row: {
          failed_24h: number | null
          processed_24h: number | null
          rate_limited_24h: number | null
          runs_24h: number | null
          skipped_24h: number | null
          stuck_runs: number | null
        }
        Relationships: []
      }
      ecosystem_garden_pulse_view: {
        Row: {
          archetype: string | null
          familia_id: string | null
          home_metro_id: string | null
          metro_name: string | null
          metro_state: string | null
          recent_activity_count: number | null
          recent_event_count: number | null
          recent_signal_count: number | null
          status: string | null
          tenant_id: string | null
          tenant_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_home_metro_id_fkey"
            columns: ["home_metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "tenants_home_metro_id_fkey"
            columns: ["home_metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
        ]
      }
      email_do_not_email: {
        Row: {
          email: string | null
          suppressed_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_suppressions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_suppressions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "email_suppressions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      familia_provision_rollups: {
        Row: {
          care_count: number | null
          familia_id: string | null
          metro_id: string | null
          participants_count: number | null
          period: string | null
          resource_category: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metro_momentum_signals"
            referencedColumns: ["metro_id"]
          },
          {
            foreignKeyName: "activities_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      federated_apps_active: {
        Row: {
          accent_color: string | null
          created_at: string | null
          display_name: string | null
          display_order: number | null
          ingest_secret_name: string | null
          ingest_url: string | null
          is_active: boolean | null
          public_base_url: string | null
          satellite_service_key_secret_name: string | null
          satellite_supabase_url: string | null
          source_app: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string | null
          display_name?: string | null
          display_order?: number | null
          ingest_secret_name?: string | null
          ingest_url?: string | null
          is_active?: boolean | null
          public_base_url?: string | null
          satellite_service_key_secret_name?: string | null
          satellite_supabase_url?: string | null
          source_app?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string | null
          display_name?: string | null
          display_order?: number | null
          ingest_secret_name?: string | null
          ingest_url?: string | null
          is_active?: boolean | null
          public_base_url?: string | null
          satellite_service_key_secret_name?: string | null
          satellite_supabase_url?: string | null
          source_app?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      federation_ga_properties: {
        Row: {
          display_name: string | null
          ga_property_id: string | null
          has_lead_intake: boolean | null
          has_seo_module: boolean | null
          link_status: string | null
          primary_domain: string | null
          slug: string | null
          status: string | null
        }
        Relationships: []
      }
      metro_momentum_signals: {
        Row: {
          anchors_90d: number | null
          baseline_momentum: number | null
          computed_at: string | null
          events_this_quarter: number | null
          metro_id: string | null
          metro_name: string | null
          momentum_status: string | null
          normalized_momentum: number | null
          orders_30d: number | null
          raw_momentum: number | null
          region_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metros_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_health_summary: {
        Row: {
          cached_metros: number | null
          rebuilt_this_week: number | null
          total_metros_with_narratives: number | null
        }
        Relationships: []
      }
      operator_vigilia_summary: {
        Row: {
          count_last_30d: number | null
          count_last_7d: number | null
          signal_type: string | null
          tenant_id: string | null
          trend_direction: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vigilia_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_garden_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "vigilia_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_local_pulse_view"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "vigilia_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_order_signals: {
        Row: {
          last_order_date: string | null
          opportunity_id: string | null
          orders_last_30: number | null
          orders_last_90: number | null
        }
        Relationships: []
      }
      org_action_effectiveness_mv: {
        Row: {
          action_type: string | null
          avg_confidence: number | null
          last_success_at: string | null
          org_id: string | null
          source: string | null
          success_rate: number | null
          successful_actions: number | null
          total_actions: number | null
        }
        Relationships: []
      }
      org_action_history_v: {
        Row: {
          action_created_at: string | null
          action_id: string | null
          action_status: string | null
          action_summary: string | null
          action_type: string | null
          executed_at: string | null
          observed_at: string | null
          org_id: string | null
          outcome_confidence: number | null
          outcome_type: string | null
          source: string | null
        }
        Relationships: []
      }
      org_insight_effectiveness_v: {
        Row: {
          actions_completed: number | null
          actions_created: number | null
          actions_successful: number | null
          actions_unsuccessful: number | null
          insight_id: string | null
          insight_type: string | null
          org_id: string | null
          success_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      org_knowledge_current_v: {
        Row: {
          created_at: string | null
          created_by: string | null
          org_id: string | null
          raw_excerpt: string | null
          snapshot_id: string | null
          source_type: string | null
          source_url: string | null
          structured_json: Json | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          org_id?: string | null
          raw_excerpt?: string | null
          snapshot_id?: string | null
          source_type?: string | null
          source_url?: string | null
          structured_json?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          org_id?: string | null
          raw_excerpt?: string | null
          snapshot_id?: string | null
          source_type?: string | null
          source_url?: string | null
          structured_json?: Json | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_knowledge_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_knowledge_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "opportunity_order_signals"
            referencedColumns: ["opportunity_id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          created_at: string | null
          display_name: string | null
          google_calendar_enabled: boolean | null
          id: string | null
          is_approved: boolean | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          google_calendar_enabled?: boolean | null
          id?: string | null
          is_approved?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          google_calendar_enabled?: boolean | null
          id?: string | null
          is_approved?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pulse_health_summary: {
        Row: {
          checked_this_week: number | null
          total_metros_with_sources: number | null
          total_sources: number | null
        }
        Relationships: []
      }
      recycle_bin_tenant_v: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string | null
          purged_at: string | null
          restored_at: string | null
          restored_by: string | null
          snapshot: Json | null
          tenant_id: string | null
        }
        Relationships: []
      }
      resend_candidates_v1: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          created_at: string | null
          email: string | null
          error_message: string | null
          failure_category: string | null
          failure_code: string | null
          id: string | null
          name: string | null
          opportunity_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email?: string | null
          error_message?: string | null
          failure_category?: string | null
          failure_code?: string | null
          id?: string | null
          name?: string | null
          opportunity_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email?: string | null
          error_message?: string | null
          failure_category?: string | null
          failure_code?: string | null
          id?: string | null
          name?: string | null
          opportunity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_audience_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_audience_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      story_events_cache: {
        Row: {
          author_id: string | null
          id: string | null
          kind: string | null
          occurred_at: string | null
          opportunity_id: string | null
          privacy_scope: string | null
          summary: string | null
          title: string | null
        }
        Relationships: []
      }
      story_events_view: {
        Row: {
          author_id: string | null
          id: string | null
          kind: string | null
          occurred_at: string | null
          opportunity_id: string | null
          privacy_scope: string | null
          summary: string | null
          title: string | null
        }
        Relationships: []
      }
      tenant_local_pulse_view: {
        Row: {
          narrative_signals_last_30d: number | null
          new_people_last_30d: number | null
          projects_active: number | null
          tenant_id: string | null
          tenant_name: string | null
          visits_last_7d: number | null
          voice_notes_last_7d: number | null
        }
        Relationships: []
      }
      usage_by_unit: {
        Row: {
          event_count: number | null
          event_type: string | null
          total_quantity: number | null
          unit: string | null
          usage_date: string | null
        }
        Relationships: []
      }
      usage_by_workflow: {
        Row: {
          event_count: number | null
          event_type: string | null
          first_event: string | null
          last_event: string | null
          total_quantity: number | null
          unit: string | null
          workflow_key: string | null
        }
        Relationships: []
      }
      usage_daily_by_org: {
        Row: {
          event_count: number | null
          event_type: string | null
          org_id: string | null
          total_quantity: number | null
          unit: string | null
          usage_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      approve_user: { Args: { target_user_id: string }; Returns: boolean }
      archive_old_automation_runs: { Args: never; Returns: Json }
      archive_old_living_signals: { Args: never; Returns: Json }
      bulk_create_invites: {
        Args: { p_invites: Json; p_tenant_id: string }
        Returns: Json
      }
      bulk_soft_delete: {
        Args: {
          p_ids: string[]
          p_table: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: Json
      }
      bulk_update_field: {
        Args: {
          p_field: string
          p_ids: string[]
          p_table: string
          p_tenant_id: string
          p_user_id: string
          p_value: string
        }
        Returns: Json
      }
      calculate_territory_slots: {
        Args: {
          p_count?: number
          p_territory_type: Database["public"]["Enums"]["territory_type"]
        }
        Returns: number
      }
      can_access_email_features: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_access_opportunity_order: {
        Args: { _opportunity_id: string; _user_id: string }
        Returns: boolean
      }
      check_and_increment_rate_limit: {
        Args: {
          p_function_name: string
          p_max_requests: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: boolean
      }
      check_automation_cooldown: {
        Args: {
          p_cooldown_seconds?: number
          p_dedupe_key?: string
          p_workflow_key: string
        }
        Returns: Json
      }
      check_notification_hourly_cap: {
        Args: { p_hard_cap?: number; p_soft_cap?: number; p_user_id: string }
        Returns: Json
      }
      check_notification_throttle: {
        Args: { p_max_per_hour?: number; p_user_id: string }
        Returns: boolean
      }
      check_usage_cap: {
        Args: { p_daily_cap?: number; p_org_id: string; p_unit?: string }
        Returns: boolean
      }
      claim_emails_for_analysis: {
        Args: {
          p_cutoff: string
          p_limit?: number
          p_run_id: string
          p_user_id: string
        }
        Returns: {
          ai_analyzed_at: string | null
          ai_processing_state: string | null
          ai_run_id: string | null
          body_preview: string | null
          contact_id: string | null
          created_at: string
          gmail_message_id: string
          id: string
          is_in_inbox: boolean
          recipient_email: string
          sender_email: string
          sent_at: string
          snippet: string | null
          subject: string | null
          synced_at: string
          tenant_id: string | null
          thread_id: string | null
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_communications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_invites: { Args: never; Returns: Json }
      cleanup_old_app_events: { Args: never; Returns: Json }
      cleanup_old_restoration_signals: { Args: never; Returns: Json }
      cleanup_vigilia_signals: { Args: never; Returns: Json }
      compute_narrative_cache_hash: {
        Args: { p_metro_id: string }
        Returns: string
      }
      compute_tenant_ai_quota: { Args: { p_tenant_id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_duplicate_contacts: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      dismiss_expired_actions: { Args: never; Returns: undefined }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enable_gmail_ai: { Args: { p_user_id: string }; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enrichment_job_next: {
        Args: {
          p_lease_seconds: number
          p_max_attempts: number
          p_worker_id: string
        }
        Returns: Json
      }
      ensure_story_chapters: {
        Args: { p_opportunity_id: string }
        Returns: undefined
      }
      flag_stale_opportunities: { Args: never; Returns: undefined }
      generate_slug: { Args: { input_text: string }; Returns: string }
      get_automation_health: {
        Args: { p_window_hours?: number; p_workflow_key?: string }
        Returns: Json
      }
      get_communio_sharing_level: {
        Args: { _group_id: string; _user_id: string }
        Returns: string
      }
      get_due_watchlist: {
        Args: { p_daily_cap?: number; p_limit?: number }
        Returns: {
          cadence: string
          id: string
          last_crawled_at: string
          org_id: string
          tags: Json
          website_url: string
        }[]
      }
      get_email_insights_stats: {
        Args: { p_user_id: string }
        Returns: {
          count: number
          status: string
        }[]
      }
      get_metro_momentum_data: {
        Args: never
        Returns: {
          anchors_90d: number
          computed_at: string
          events_this_quarter: number
          has_milestone: boolean
          lat: number
          lng: number
          metro_id: string
          metro_name: string
          milestone_achieved_at: string
          momentum_status: string
          normalized_momentum: number
          orders_30d: number
          region_id: string
        }[]
      }
      get_recent_watchlist_signals: {
        Args: { p_limit?: number; p_window_hours?: number }
        Returns: {
          confidence: number
          created_at: string
          diff_id: string
          id: string
          org_id: string
          signal_type: string
          snapshot_id: string
          summary: string
        }[]
      }
      get_system_health: { Args: never; Returns: Json }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      grant_founding_garden_if_available: {
        Args: {
          p_program_key: string
          p_stripe_session_id?: string
          p_stripe_subscription_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_any_tenant_role: {
        Args: { _roles: string[]; _tenant_id: string }
        Returns: boolean
      }
      has_gardener_grant: { Args: { p_source_app: string }; Returns: boolean }
      has_metro_access: {
        Args: { _metro_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: { _role: string; _tenant_id: string }
        Returns: boolean
      }
      has_webhook_key: { Args: { p_user_id: string }; Returns: boolean }
      increment_notification_push_count: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      increment_usage_counter:
        | {
            Args: {
              p_cost?: number
              p_engine_field: string
              p_field: string
              p_period_start: string
              p_tenant_id: string
              p_tokens?: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_cost?: number
              p_engine_field?: string
              p_field?: string
              p_period_end?: string
              p_period_start: string
              p_tenant_id: string
              p_tokens?: number
            }
            Returns: undefined
          }
      is_demo_tenant: { Args: { p_tenant_id: string }; Returns: boolean }
      is_familia_member: {
        Args: { _familia_id: string; _user_id: string }
        Returns: boolean
      }
      is_network_request_participant: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      is_simulated_record: {
        Args: { p_record_id: string; p_table: string; p_tenant_id: string }
        Returns: boolean
      }
      is_tenant_admin: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: boolean
      }
      jsonb_contains_forbidden_keys: {
        Args: { forbidden: string[]; j: Json }
        Returns: boolean
      }
      leave_tenant: { Args: { p_tenant_id: string }; Returns: Json }
      log_audit_entry: {
        Args: {
          p_action: string
          p_changes?: Json
          p_entity_id: string
          p_entity_name?: string
          p_entity_type: string
        }
        Returns: string
      }
      mark_stuck_qa_runs_failed: {
        Args: { p_threshold_minutes?: number }
        Returns: {
          run_id: string
          stuck_since: string
          suite_key: string
        }[]
      }
      mark_stuck_runs_failed: {
        Args: { p_threshold_minutes?: number }
        Returns: {
          run_id: string
          stuck_since: string
          workflow_key: string
        }[]
      }
      merge_app_metadata: {
        Args: { p_patch: Json; p_slug: string }
        Returns: undefined
      }
      metro_news_source_record_failure: {
        Args: { p_error?: string; p_source_id: string }
        Returns: undefined
      }
      metro_news_source_record_success: {
        Args: { p_source_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      owns_campaign: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      pulse_source_record_failure: {
        Args: { p_error?: string; p_source_id: string }
        Returns: undefined
      }
      pulse_source_record_success: {
        Args: { p_source_id: string }
        Returns: undefined
      }
      purge_old_app_events: { Args: never; Returns: Json }
      purge_recycle_bin: { Args: never; Returns: Json }
      reactivate_snoozed_actions: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      refresh_action_effectiveness: { Args: never; Returns: undefined }
      refresh_metro_momentum: { Args: never; Returns: undefined }
      refresh_story_events_cache: { Args: never; Returns: undefined }
      regenerate_webhook_key: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      remove_tenant_user: {
        Args: { p_target_user_id: string; p_tenant_id: string }
        Returns: Json
      }
      replace_tenant_sectors: {
        Args: {
          p_max_sectors?: number
          p_sector_ids: string[]
          p_tenant_id: string
        }
        Returns: undefined
      }
      reset_stale_email_claims: { Args: { p_user_id: string }; Returns: number }
      reset_stale_processing_suggestions: {
        Args: { p_user_id: string }
        Returns: number
      }
      restore_from_recycle_bin: {
        Args: { p_recycle_id: string }
        Returns: Json
      }
      revoke_user_approval: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      route_to_gardener: {
        Args: { p_tenant_id: string; p_ticket_type?: string }
        Returns: Json
      }
      score_data_completeness: { Args: { p_tenant_id: string }; Returns: Json }
      set_relational_orientation: {
        Args: {
          p_auto_manage?: boolean
          p_orientation: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      sweep_orphan_foreign_keys: { Args: never; Returns: Json }
      tenant_has_feature: {
        Args: { p_feature_key: string; p_tenant_id: string }
        Returns: boolean
      }
      tenant_is_communio_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      tenants_share_communio_group: {
        Args: { _tenant_a: string; _tenant_b: string }
        Returns: boolean
      }
      toggle_auth_trigger: { Args: { p_enable: boolean }; Returns: undefined }
      upsert_operator_error: {
        Args: {
          p_context?: Json
          p_fingerprint: string
          p_message: string
          p_severity: string
          p_source: string
          p_tenant_id: string
        }
        Returns: string
      }
      user_belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_in_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      user_tenant_ids: { Args: never; Returns: string[] }
      validate_invite_token: { Args: { p_token: string }; Returns: Json }
      validate_webhook_key: { Args: { p_key: string }; Returns: string }
    }
    Enums: {
      activity_outcome:
        | "Connected"
        | "No Response"
        | "Follow-up Needed"
        | "Moved Stage"
        | "Not a Fit"
        | "Left a Voicemail"
        | "Bad Number"
      activity_type:
        | "Call"
        | "Email"
        | "Meeting"
        | "Event"
        | "Site Visit"
        | "Intro"
        | "Other"
        | "Visit Note"
        | "Visit"
        | "Project"
        | "Project Note"
        | "Care Visit"
        | "Care Check-in"
        | "Home Support"
        | "Transport"
        | "Appointment Support"
        | "Respite"
      anchor_tier: "Strategic" | "Standard" | "Pilot"
      app_role:
        | "admin"
        | "regional_lead"
        | "staff"
        | "leadership"
        | "warehouse_manager"
        | "steward"
        | "visitor"
      caregiver_contact_visibility:
        | "relay_only"
        | "reveal_on_request"
        | "public_email_optional"
      caregiver_request_status: "pending" | "accepted" | "declined" | "blocked"
      email_campaign_status:
        | "draft"
        | "syncing"
        | "scheduled"
        | "sending"
        | "sent"
        | "failed"
        | "canceled"
        | "audience_ready"
        | "paused"
      feedback_priority: "low" | "medium" | "high"
      feedback_status: "open" | "in_progress" | "resolved" | "declined"
      feedback_type: "bug" | "feature"
      financial_event_status:
        | "pending"
        | "completed"
        | "failed"
        | "cancelled"
        | "refunded"
      financial_event_type:
        | "generosity"
        | "participation"
        | "collaboration"
        | "support"
        | "invoice"
        | "membership"
      funder_type:
        | "Foundation"
        | "Government - Federal"
        | "Government - State"
        | "Government - Local"
        | "Corporate"
        | "Other"
      grant_activity_type:
        | "Research"
        | "Call"
        | "Meeting"
        | "Writing"
        | "Submission"
        | "Reporting"
      grant_narrative_value: "High" | "Medium" | "Low"
      grant_stage:
        | "Researching"
        | "Eligible"
        | "Cultivating"
        | "LOI Submitted"
        | "Full Proposal Submitted"
        | "Awarded"
        | "Declined"
        | "Closed"
      grant_status: "Active" | "Closed"
      growth_trend: "Up" | "Flat" | "Down"
      metro_status: "Expansion Ready" | "Anchor Build" | "Ecosystem Dev"
      opportunity_stage:
        | "Target Identified"
        | "Contacted"
        | "Discovery Scheduled"
        | "Discovery Held"
        | "Proposal Sent"
        | "Agreement Pending"
        | "Agreement Signed"
        | "First Volume"
        | "Stable Producer"
        | "Closed - Not a Fit"
        | "Found"
        | "First Conversation"
        | "Discovery"
        | "Pricing Shared"
        | "Account Setup"
        | "First Devices"
        | "Growing Together"
        | "Not the Right Time"
      opportunity_status:
        | "Active"
        | "On Hold"
        | "Closed - Won"
        | "Closed - Lost"
      partner_tier:
        | "Anchor"
        | "Distribution"
        | "Referral"
        | "Workforce"
        | "Housing"
        | "Education"
        | "Other"
      pipeline_stage:
        | "Target Identified"
        | "Contacted"
        | "Discovery Held"
        | "Proposal Sent"
        | "Agreement Pending"
        | "Agreement Signed"
        | "First Volume"
      production_status: "Pre-Production" | "Ramp" | "Stable" | "Scale"
      recommendation: "Invest" | "Build Anchors" | "Hold" | "Triage"
      registration_field_type: "text" | "select" | "checkbox" | "note"
      reporting_frequency: "Quarterly" | "Annual" | "End of Grant"
      risk_level: "Low" | "Medium" | "High"
      territory_type:
        | "metro"
        | "county"
        | "state"
        | "country"
        | "mission_field"
        | "custom_region"
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
      activity_outcome: [
        "Connected",
        "No Response",
        "Follow-up Needed",
        "Moved Stage",
        "Not a Fit",
        "Left a Voicemail",
        "Bad Number",
      ],
      activity_type: [
        "Call",
        "Email",
        "Meeting",
        "Event",
        "Site Visit",
        "Intro",
        "Other",
        "Visit Note",
        "Visit",
        "Project",
        "Project Note",
        "Care Visit",
        "Care Check-in",
        "Home Support",
        "Transport",
        "Appointment Support",
        "Respite",
      ],
      anchor_tier: ["Strategic", "Standard", "Pilot"],
      app_role: [
        "admin",
        "regional_lead",
        "staff",
        "leadership",
        "warehouse_manager",
        "steward",
        "visitor",
      ],
      caregiver_contact_visibility: [
        "relay_only",
        "reveal_on_request",
        "public_email_optional",
      ],
      caregiver_request_status: ["pending", "accepted", "declined", "blocked"],
      email_campaign_status: [
        "draft",
        "syncing",
        "scheduled",
        "sending",
        "sent",
        "failed",
        "canceled",
        "audience_ready",
        "paused",
      ],
      feedback_priority: ["low", "medium", "high"],
      feedback_status: ["open", "in_progress", "resolved", "declined"],
      feedback_type: ["bug", "feature"],
      financial_event_status: [
        "pending",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ],
      financial_event_type: [
        "generosity",
        "participation",
        "collaboration",
        "support",
        "invoice",
        "membership",
      ],
      funder_type: [
        "Foundation",
        "Government - Federal",
        "Government - State",
        "Government - Local",
        "Corporate",
        "Other",
      ],
      grant_activity_type: [
        "Research",
        "Call",
        "Meeting",
        "Writing",
        "Submission",
        "Reporting",
      ],
      grant_narrative_value: ["High", "Medium", "Low"],
      grant_stage: [
        "Researching",
        "Eligible",
        "Cultivating",
        "LOI Submitted",
        "Full Proposal Submitted",
        "Awarded",
        "Declined",
        "Closed",
      ],
      grant_status: ["Active", "Closed"],
      growth_trend: ["Up", "Flat", "Down"],
      metro_status: ["Expansion Ready", "Anchor Build", "Ecosystem Dev"],
      opportunity_stage: [
        "Target Identified",
        "Contacted",
        "Discovery Scheduled",
        "Discovery Held",
        "Proposal Sent",
        "Agreement Pending",
        "Agreement Signed",
        "First Volume",
        "Stable Producer",
        "Closed - Not a Fit",
        "Found",
        "First Conversation",
        "Discovery",
        "Pricing Shared",
        "Account Setup",
        "First Devices",
        "Growing Together",
        "Not the Right Time",
      ],
      opportunity_status: [
        "Active",
        "On Hold",
        "Closed - Won",
        "Closed - Lost",
      ],
      partner_tier: [
        "Anchor",
        "Distribution",
        "Referral",
        "Workforce",
        "Housing",
        "Education",
        "Other",
      ],
      pipeline_stage: [
        "Target Identified",
        "Contacted",
        "Discovery Held",
        "Proposal Sent",
        "Agreement Pending",
        "Agreement Signed",
        "First Volume",
      ],
      production_status: ["Pre-Production", "Ramp", "Stable", "Scale"],
      recommendation: ["Invest", "Build Anchors", "Hold", "Triage"],
      registration_field_type: ["text", "select", "checkbox", "note"],
      reporting_frequency: ["Quarterly", "Annual", "End of Grant"],
      risk_level: ["Low", "Medium", "High"],
      territory_type: [
        "metro",
        "county",
        "state",
        "country",
        "mission_field",
        "custom_region",
      ],
    },
  },
} as const
