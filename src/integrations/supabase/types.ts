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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_conversations: {
        Row: {
          agent_id: string | null
          collaborator_id: string
          conversation_type: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          collaborator_id: string
          conversation_type?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          collaborator_id?: string
          conversation_type?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "agent_conversations_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_definitions: {
        Row: {
          active: boolean | null
          agent_type: string | null
          channel: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          emoji: string | null
          icon: string | null
          id: string
          max_tokens: number | null
          model: string | null
          name: string
          sector_id: string | null
          slug: string
          system_prompt: string | null
          temperature: number | null
          voice_key: string | null
        }
        Insert: {
          active?: boolean | null
          agent_type?: string | null
          channel?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          icon?: string | null
          id?: string
          max_tokens?: number | null
          model?: string | null
          name: string
          sector_id?: string | null
          slug: string
          system_prompt?: string | null
          temperature?: number | null
          voice_key?: string | null
        }
        Update: {
          active?: boolean | null
          agent_type?: string | null
          channel?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          icon?: string | null
          id?: string
          max_tokens?: number | null
          model?: string | null
          name?: string
          sector_id?: string | null
          slug?: string
          system_prompt?: string | null
          temperature?: number | null
          voice_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "agent_definitions_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge: {
        Row: {
          active: boolean | null
          agent_id: string | null
          category: string | null
          company_id: string | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          agent_id?: string | null
          category?: string | null
          company_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          agent_id?: string | null
          category?: string | null
          company_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_agent_performance"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          category: string
          consultant_id: string
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          lead_phone: string | null
          metadata: Json | null
        }
        Insert: {
          category: string
          consultant_id: string
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          lead_phone?: string | null
          metadata?: Json | null
        }
        Update: {
          category?: string
          consultant_id?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          lead_phone?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_usage_logs: {
        Row: {
          agent_id: string | null
          collaborator_id: string | null
          company_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          response_time_ms: number | null
          success: boolean | null
          tools_used: string[] | null
        }
        Insert: {
          agent_id?: string | null
          collaborator_id?: string | null
          company_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          response_time_ms?: number | null
          success?: boolean | null
          tools_used?: string[] | null
        }
        Update: {
          agent_id?: string | null
          collaborator_id?: string | null
          company_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          response_time_ms?: number | null
          success?: boolean | null
          tools_used?: string[] | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          calls_today: number | null
          company_id: string
          created_at: string | null
          current_call_id: string | null
          email: string
          extension: string | null
          id: string
          is_active: boolean | null
          name: string
          role: string | null
          status: string | null
          talk_time_today: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          calls_today?: number | null
          company_id: string
          created_at?: string | null
          current_call_id?: string | null
          email: string
          extension?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          role?: string | null
          status?: string | null
          talk_time_today?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          calls_today?: number | null
          company_id?: string
          created_at?: string | null
          current_call_id?: string | null
          email?: string
          extension?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          role?: string | null
          status?: string | null
          talk_time_today?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ai_call_analytics: {
        Row: {
          analytics_date: string
          avg_duration_sec: number | null
          avg_quality_score: number | null
          avg_sentiment_score: number | null
          busy_calls: number | null
          campaign_id: string | null
          cold_leads: number | null
          company_id: string
          completed_calls: number | null
          compliance_violation_count: number | null
          cost_per_call_brl: number | null
          cost_per_lead_brl: number | null
          cost_total_brl: number | null
          created_at: string
          dead_leads: number | null
          failed_calls: number | null
          goal_achievement_rate: number | null
          hangup_by_contact_rate: number | null
          hot_leads: number | null
          id: string
          max_duration_sec: number | null
          min_duration_sec: number | null
          no_answer_calls: number | null
          script_id: string | null
          stt_seconds_total: number | null
          tokens_total: number | null
          top_entities: Json | null
          top_intents: Json | null
          top_objections: Json | null
          total_calls: number | null
          total_duration_sec: number | null
          transfer_count: number | null
          transfer_rate: number | null
          tts_characters_total: number | null
          warm_leads: number | null
        }
        Insert: {
          analytics_date: string
          avg_duration_sec?: number | null
          avg_quality_score?: number | null
          avg_sentiment_score?: number | null
          busy_calls?: number | null
          campaign_id?: string | null
          cold_leads?: number | null
          company_id: string
          completed_calls?: number | null
          compliance_violation_count?: number | null
          cost_per_call_brl?: number | null
          cost_per_lead_brl?: number | null
          cost_total_brl?: number | null
          created_at?: string
          dead_leads?: number | null
          failed_calls?: number | null
          goal_achievement_rate?: number | null
          hangup_by_contact_rate?: number | null
          hot_leads?: number | null
          id?: string
          max_duration_sec?: number | null
          min_duration_sec?: number | null
          no_answer_calls?: number | null
          script_id?: string | null
          stt_seconds_total?: number | null
          tokens_total?: number | null
          top_entities?: Json | null
          top_intents?: Json | null
          top_objections?: Json | null
          total_calls?: number | null
          total_duration_sec?: number | null
          transfer_count?: number | null
          transfer_rate?: number | null
          tts_characters_total?: number | null
          warm_leads?: number | null
        }
        Update: {
          analytics_date?: string
          avg_duration_sec?: number | null
          avg_quality_score?: number | null
          avg_sentiment_score?: number | null
          busy_calls?: number | null
          campaign_id?: string | null
          cold_leads?: number | null
          company_id?: string
          completed_calls?: number | null
          compliance_violation_count?: number | null
          cost_per_call_brl?: number | null
          cost_per_lead_brl?: number | null
          cost_total_brl?: number | null
          created_at?: string
          dead_leads?: number | null
          failed_calls?: number | null
          goal_achievement_rate?: number | null
          hangup_by_contact_rate?: number | null
          hot_leads?: number | null
          id?: string
          max_duration_sec?: number | null
          min_duration_sec?: number | null
          no_answer_calls?: number | null
          script_id?: string | null
          stt_seconds_total?: number | null
          tokens_total?: number | null
          top_entities?: Json | null
          top_intents?: Json | null
          top_objections?: Json | null
          total_calls?: number | null
          total_duration_sec?: number | null
          transfer_count?: number | null
          transfer_rate?: number | null
          tts_characters_total?: number | null
          warm_leads?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_call_analytics_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "ai_call_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_compliance: {
        Row: {
          added_by: string | null
          company_id: string
          compliance_type: string
          created_at: string
          id: string
          is_active: boolean | null
          metadata: Json | null
          notes: string | null
          phone_number: string | null
          phone_number_normalized: string | null
          reason: string | null
          reference_number: string | null
          source: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          added_by?: string | null
          company_id: string
          compliance_type: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          notes?: string | null
          phone_number?: string | null
          phone_number_normalized?: string | null
          reason?: string | null
          reference_number?: string | null
          source?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          added_by?: string | null
          company_id?: string
          compliance_type?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          notes?: string | null
          phone_number?: string | null
          phone_number_normalized?: string | null
          reason?: string | null
          reference_number?: string | null
          source?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_compliance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_compliance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ai_call_scripts: {
        Row: {
          avg_duration_sec: number | null
          closing_message: string | null
          company_id: string
          compliance_disclaimers: string[] | null
          conversation_examples: Json | null
          created_at: string
          description: string | null
          fallback_action: string | null
          fallback_target: string | null
          flow: Json
          forbidden_words: string[] | null
          id: string
          is_active: boolean | null
          knowledge_base: string | null
          max_duration_sec: number | null
          name: string
          objection_handlers: Json | null
          opening_message: string | null
          parent_script_id: string | null
          personality: string | null
          qualification_criteria: Json | null
          qualifying_questions: string | null
          sales_techniques: string | null
          script_type: string | null
          silence_timeout_sec: number | null
          success_rate: number | null
          system_prompt: string | null
          tone: string | null
          total_calls: number | null
          updated_at: string
          variables: Json | null
          version: number | null
          voice_profile_id: string | null
        }
        Insert: {
          avg_duration_sec?: number | null
          closing_message?: string | null
          company_id: string
          compliance_disclaimers?: string[] | null
          conversation_examples?: Json | null
          created_at?: string
          description?: string | null
          fallback_action?: string | null
          fallback_target?: string | null
          flow?: Json
          forbidden_words?: string[] | null
          id?: string
          is_active?: boolean | null
          knowledge_base?: string | null
          max_duration_sec?: number | null
          name: string
          objection_handlers?: Json | null
          opening_message?: string | null
          parent_script_id?: string | null
          personality?: string | null
          qualification_criteria?: Json | null
          qualifying_questions?: string | null
          sales_techniques?: string | null
          script_type?: string | null
          silence_timeout_sec?: number | null
          success_rate?: number | null
          system_prompt?: string | null
          tone?: string | null
          total_calls?: number | null
          updated_at?: string
          variables?: Json | null
          version?: number | null
          voice_profile_id?: string | null
        }
        Update: {
          avg_duration_sec?: number | null
          closing_message?: string | null
          company_id?: string
          compliance_disclaimers?: string[] | null
          conversation_examples?: Json | null
          created_at?: string
          description?: string | null
          fallback_action?: string | null
          fallback_target?: string | null
          flow?: Json
          forbidden_words?: string[] | null
          id?: string
          is_active?: boolean | null
          knowledge_base?: string | null
          max_duration_sec?: number | null
          name?: string
          objection_handlers?: Json | null
          opening_message?: string | null
          parent_script_id?: string | null
          personality?: string | null
          qualification_criteria?: Json | null
          qualifying_questions?: string | null
          sales_techniques?: string | null
          script_type?: string | null
          silence_timeout_sec?: number | null
          success_rate?: number | null
          system_prompt?: string | null
          tone?: string | null
          total_calls?: number | null
          updated_at?: string
          variables?: Json | null
          version?: number | null
          voice_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_scripts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_scripts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_call_scripts_parent_script_id_fkey"
            columns: ["parent_script_id"]
            isOneToOne: false
            referencedRelation: "ai_call_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_scripts_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_training: {
        Row: {
          company_id: string
          created_at: string
          data: Json
          description: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          name: string
          processing_error: string | null
          script_id: string | null
          source_call_ids: string[] | null
          status: string | null
          token_count: number | null
          training_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data: Json
          description?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          name: string
          processing_error?: string | null
          script_id?: string | null
          source_call_ids?: string[] | null
          status?: string | null
          token_count?: number | null
          training_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data?: Json
          description?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          processing_error?: string | null
          script_id?: string | null
          source_call_ids?: string[] | null
          status?: string | null
          token_count?: number | null
          training_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_training_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_training_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_call_training_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "ai_call_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_voice_clones: {
        Row: {
          accent: string | null
          age_range: string | null
          company_id: string
          consent_document_url: string
          consent_obtained_at: string
          consent_purpose: string | null
          consenting_person_document: string | null
          consenting_person_name: string
          created_at: string
          description: string | null
          gender: string | null
          id: string
          is_active: boolean | null
          language: string | null
          name: string
          provider: string
          provider_voice_id: string | null
          sample_audio_url: string | null
          source_audio_urls: string[] | null
          source_recording_ids: string[] | null
          training_completed_at: string | null
          training_error: string | null
          training_started_at: string | null
          training_status: string | null
          updated_at: string
          voice_profile_id: string | null
        }
        Insert: {
          accent?: string | null
          age_range?: string | null
          company_id: string
          consent_document_url: string
          consent_obtained_at: string
          consent_purpose?: string | null
          consenting_person_document?: string | null
          consenting_person_name: string
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name: string
          provider?: string
          provider_voice_id?: string | null
          sample_audio_url?: string | null
          source_audio_urls?: string[] | null
          source_recording_ids?: string[] | null
          training_completed_at?: string | null
          training_error?: string | null
          training_started_at?: string | null
          training_status?: string | null
          updated_at?: string
          voice_profile_id?: string | null
        }
        Update: {
          accent?: string | null
          age_range?: string | null
          company_id?: string
          consent_document_url?: string
          consent_obtained_at?: string
          consent_purpose?: string | null
          consenting_person_document?: string | null
          consenting_person_name?: string
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name?: string
          provider?: string
          provider_voice_id?: string | null
          sample_audio_url?: string | null
          source_audio_urls?: string[] | null
          source_recording_ids?: string[] | null
          training_completed_at?: string | null
          training_error?: string | null
          training_started_at?: string | null
          training_status?: string | null
          updated_at?: string
          voice_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_voice_clones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_voice_clones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_voice_clones_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_pool: {
        Row: {
          active: boolean | null
          api_key: string
          created_at: string | null
          id: string
          last_used_at: string | null
          max_bots: number | null
          max_requests_per_min: number | null
          max_tokens_per_day: number | null
          name: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          api_key: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          max_bots?: number | null
          max_requests_per_min?: number | null
          max_tokens_per_day?: number | null
          name: string
          provider?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          api_key?: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          max_bots?: number | null
          max_requests_per_min?: number | null
          max_tokens_per_day?: number | null
          name?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          company_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          company_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          company_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      billing_usage: {
        Row: {
          billing_period_end: string | null
          billing_period_start: string | null
          channel: string
          company_id: string
          created_at: string
          currency: string | null
          description: string | null
          id: string
          meta_conversation_id: string | null
          quantity: number
          reference_id: string | null
          reference_table: string | null
          total_cost_brl: number | null
          unit_cost_brl: number | null
          usage_type: string
        }
        Insert: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          channel: string
          company_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          meta_conversation_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_table?: string | null
          total_cost_brl?: number | null
          unit_cost_brl?: number | null
          usage_type: string
        }
        Update: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          channel?: string
          company_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          meta_conversation_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_table?: string | null
          total_cost_brl?: number | null
          unit_cost_brl?: number | null
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      blast_config: {
        Row: {
          active: boolean | null
          collaborator_id: string
          created_at: string | null
          erro_digitacao_a_cada: number | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          intervalo_max_sec: number | null
          intervalo_min_sec: number | null
          max_msgs_dia_por_chip: number | null
          pausa_padrao_1_min: number | null
          pausa_padrao_1_offline_min: number | null
          pausa_padrao_2_min: number | null
          pausa_padrao_2_offline_min: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          collaborator_id: string
          created_at?: string | null
          erro_digitacao_a_cada?: number | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          intervalo_max_sec?: number | null
          intervalo_min_sec?: number | null
          max_msgs_dia_por_chip?: number | null
          pausa_padrao_1_min?: number | null
          pausa_padrao_1_offline_min?: number | null
          pausa_padrao_2_min?: number | null
          pausa_padrao_2_offline_min?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          collaborator_id?: string
          created_at?: string | null
          erro_digitacao_a_cada?: number | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          intervalo_max_sec?: number | null
          intervalo_min_sec?: number | null
          max_msgs_dia_por_chip?: number | null
          pausa_padrao_1_min?: number | null
          pausa_padrao_1_offline_min?: number | null
          pausa_padrao_2_min?: number | null
          pausa_padrao_2_offline_min?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blast_config_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: true
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      blast_jobs: {
        Row: {
          auto_refill_enabled: boolean | null
          campaign_tag: string | null
          category_filter: string | null
          collaborator_id: string
          created_at: string | null
          daily_limit: number | null
          ddd_filter: string | null
          error_count: number | null
          id: string
          interval_max_sec: number | null
          interval_min_sec: number | null
          last_sent_at: string | null
          lead_ids: Json | null
          message_template: string
          message_templates: string[] | null
          name: string
          next_send_at: string | null
          refill_count: number | null
          refill_threshold: number | null
          reply_count: number | null
          sent_count: number | null
          started_at: string | null
          status: string | null
          total_leads: number | null
          updated_at: string | null
        }
        Insert: {
          auto_refill_enabled?: boolean | null
          campaign_tag?: string | null
          category_filter?: string | null
          collaborator_id: string
          created_at?: string | null
          daily_limit?: number | null
          ddd_filter?: string | null
          error_count?: number | null
          id?: string
          interval_max_sec?: number | null
          interval_min_sec?: number | null
          last_sent_at?: string | null
          lead_ids?: Json | null
          message_template?: string
          message_templates?: string[] | null
          name?: string
          next_send_at?: string | null
          refill_count?: number | null
          refill_threshold?: number | null
          reply_count?: number | null
          sent_count?: number | null
          started_at?: string | null
          status?: string | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_refill_enabled?: boolean | null
          campaign_tag?: string | null
          category_filter?: string | null
          collaborator_id?: string
          created_at?: string | null
          daily_limit?: number | null
          ddd_filter?: string | null
          error_count?: number | null
          id?: string
          interval_max_sec?: number | null
          interval_min_sec?: number | null
          last_sent_at?: string | null
          lead_ids?: Json | null
          message_template?: string
          message_templates?: string[] | null
          name?: string
          next_send_at?: string | null
          refill_count?: number | null
          refill_threshold?: number | null
          reply_count?: number | null
          sent_count?: number | null
          started_at?: string | null
          status?: string | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blast_jobs_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      blast_logs: {
        Row: {
          chip_id: string | null
          collaborator_id: string
          error_message: string | null
          id: string
          job_id: string
          lead_id: string | null
          phone_normalized: string | null
          phone_raw: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          chip_id?: string | null
          collaborator_id: string
          error_message?: string | null
          id?: string
          job_id: string
          lead_id?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          chip_id?: string | null
          collaborator_id?: string
          error_message?: string | null
          id?: string
          job_id?: string
          lead_id?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blast_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "blast_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      blast_messages: {
        Row: {
          collaborator_id: string
          created_at: string | null
          id: string
          message_1: string | null
          message_2: string | null
          message_3: string | null
          message_4: string | null
          message_5: string | null
          updated_at: string | null
        }
        Insert: {
          collaborator_id: string
          created_at?: string | null
          id?: string
          message_1?: string | null
          message_2?: string | null
          message_3?: string | null
          message_4?: string | null
          message_5?: string | null
          updated_at?: string | null
        }
        Update: {
          collaborator_id?: string
          created_at?: string | null
          id?: string
          message_1?: string | null
          message_2?: string | null
          message_3?: string | null
          message_4?: string | null
          message_5?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blast_messages_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: true
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      blasted_phones: {
        Row: {
          blast_job_id: string | null
          blasted_at: string | null
          campaign_tag: string | null
          collaborator_id: string | null
          converted: boolean | null
          id: string
          phone: string
          responded: boolean | null
        }
        Insert: {
          blast_job_id?: string | null
          blasted_at?: string | null
          campaign_tag?: string | null
          collaborator_id?: string | null
          converted?: boolean | null
          id?: string
          phone: string
          responded?: boolean | null
        }
        Update: {
          blast_job_id?: string | null
          blasted_at?: string | null
          campaign_tag?: string | null
          collaborator_id?: string | null
          converted?: boolean | null
          id?: string
          phone?: string
          responded?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "blasted_phones_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_numbers: {
        Row: {
          created_at: string | null
          id: string
          phone: string
          reason: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          phone: string
          reason?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
      bot_instances: {
        Row: {
          active: boolean | null
          active_hours_end: number | null
          active_hours_start: number | null
          agent_ids: Json | null
          api_key_id: string | null
          bot_type: string
          chips: Json | null
          collaborator_id: string | null
          company_id: string | null
          config: Json | null
          created_at: string | null
          id: string
          last_seen_at: string | null
          max_msgs_per_day: number | null
          msg_interval_max: number | null
          msg_interval_min: number | null
          name: string
          uazapi_instance_id: string | null
          uazapi_token: string | null
          updated_at: string | null
          whatsapp_number: string | null
          whatsapp_status: string | null
        }
        Insert: {
          active?: boolean | null
          active_hours_end?: number | null
          active_hours_start?: number | null
          agent_ids?: Json | null
          api_key_id?: string | null
          bot_type?: string
          chips?: Json | null
          collaborator_id?: string | null
          company_id?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          max_msgs_per_day?: number | null
          msg_interval_max?: number | null
          msg_interval_min?: number | null
          name: string
          uazapi_instance_id?: string | null
          uazapi_token?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          active?: boolean | null
          active_hours_end?: number | null
          active_hours_start?: number | null
          agent_ids?: Json | null
          api_key_id?: string | null
          bot_type?: string
          chips?: Json | null
          collaborator_id?: string | null
          company_id?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          max_msgs_per_day?: number | null
          msg_interval_max?: number | null
          msg_interval_min?: number | null
          name?: string
          uazapi_instance_id?: string | null
          uazapi_token?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          whatsapp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_instances_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_key_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_instances_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      bot_messages: {
        Row: {
          consultant_id: string | null
          content: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          consultant_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          consultant_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_messages_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          daily_limit: number
          greeting_text: string
          id: string
          max_duration_sec: number
          name: string
          product: string
          status: string
          system_prompt: string | null
          updated_at: string
          voice_key: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          greeting_text: string
          id?: string
          max_duration_sec?: number
          name: string
          product: string
          status?: string
          system_prompt?: string | null
          updated_at?: string
          voice_key: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          greeting_text?: string
          id?: string
          max_duration_sec?: number
          name?: string
          product?: string
          status?: string
          system_prompt?: string | null
          updated_at?: string
          voice_key?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          campaign_id: string | null
          chip_instance: string | null
          company_id: string | null
          compliance_flags: Json | null
          compliance_review_status: string | null
          conversation_quality_score: number | null
          cost_brl: number | null
          created_at: string
          detected_intents: string[] | null
          duration_sec: number | null
          ended_at: string | null
          extracted_entities: Json | null
          goal_achieved: boolean | null
          goal_details: Json | null
          id: string
          is_compliant: boolean | null
          lead_name: string | null
          lead_phone: string
          lead_temperature: string | null
          next_action: string | null
          next_action_scheduled_at: string | null
          recording_url: string | null
          result: string | null
          script_id: string | null
          sentiment_overall: string | null
          sentiment_scores: Json | null
          started_at: string | null
          status: string
          stt_seconds: number | null
          tokens_used: number | null
          transcript: Json | null
          tts_characters: number | null
          voice_key: string
        }
        Insert: {
          campaign_id?: string | null
          chip_instance?: string | null
          company_id?: string | null
          compliance_flags?: Json | null
          compliance_review_status?: string | null
          conversation_quality_score?: number | null
          cost_brl?: number | null
          created_at?: string
          detected_intents?: string[] | null
          duration_sec?: number | null
          ended_at?: string | null
          extracted_entities?: Json | null
          goal_achieved?: boolean | null
          goal_details?: Json | null
          id?: string
          is_compliant?: boolean | null
          lead_name?: string | null
          lead_phone: string
          lead_temperature?: string | null
          next_action?: string | null
          next_action_scheduled_at?: string | null
          recording_url?: string | null
          result?: string | null
          script_id?: string | null
          sentiment_overall?: string | null
          sentiment_scores?: Json | null
          started_at?: string | null
          status?: string
          stt_seconds?: number | null
          tokens_used?: number | null
          transcript?: Json | null
          tts_characters?: number | null
          voice_key: string
        }
        Update: {
          campaign_id?: string | null
          chip_instance?: string | null
          company_id?: string | null
          compliance_flags?: Json | null
          compliance_review_status?: string | null
          conversation_quality_score?: number | null
          cost_brl?: number | null
          created_at?: string
          detected_intents?: string[] | null
          duration_sec?: number | null
          ended_at?: string | null
          extracted_entities?: Json | null
          goal_achieved?: boolean | null
          goal_details?: Json | null
          id?: string
          is_compliant?: boolean | null
          lead_name?: string | null
          lead_phone?: string
          lead_temperature?: string | null
          next_action?: string | null
          next_action_scheduled_at?: string | null
          recording_url?: string | null
          result?: string | null
          script_id?: string | null
          sentiment_overall?: string | null
          sentiment_scores?: Json | null
          started_at?: string | null
          status?: string
          stt_seconds?: number | null
          tokens_used?: number | null
          transcript?: Json | null
          tts_characters?: number | null
          voice_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "call_logs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "ai_call_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_quality_metrics: {
        Row: {
          bytes_received: number | null
          bytes_sent: number | null
          call_id: string
          codec: string | null
          company_id: string
          created_at: string
          direction: string | null
          id: string
          jitter_ms: number | null
          measured_at: string
          mos_score: number | null
          network_type: string | null
          packet_loss_percent: number | null
          packets_received: number | null
          packets_sent: number | null
          r_factor: number | null
          round_trip_latency_ms: number | null
        }
        Insert: {
          bytes_received?: number | null
          bytes_sent?: number | null
          call_id: string
          codec?: string | null
          company_id: string
          created_at?: string
          direction?: string | null
          id?: string
          jitter_ms?: number | null
          measured_at?: string
          mos_score?: number | null
          network_type?: string | null
          packet_loss_percent?: number | null
          packets_received?: number | null
          packets_sent?: number | null
          r_factor?: number | null
          round_trip_latency_ms?: number | null
        }
        Update: {
          bytes_received?: number | null
          bytes_sent?: number | null
          call_id?: string
          codec?: string | null
          company_id?: string
          created_at?: string
          direction?: string | null
          id?: string
          jitter_ms?: number | null
          measured_at?: string
          mos_score?: number | null
          network_type?: string | null
          packet_loss_percent?: number | null
          packets_received?: number | null
          packets_sent?: number | null
          r_factor?: number | null
          round_trip_latency_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_quality_metrics_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_metrics_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_recorded_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      call_queues: {
        Row: {
          active_days: number[] | null
          calls_per_hour: number
          company_id: string
          created_at: string | null
          daily_limit: number
          filter_tags: string[] | null
          id: string
          leads_answered: number | null
          leads_called: number | null
          leads_converted: number | null
          leads_opted_in: number | null
          max_attempts: number
          name: string
          opening_script: string | null
          priority_max: number | null
          priority_min: number | null
          retry_busy_min: number | null
          retry_no_answer_min: number | null
          schedule_end: string | null
          schedule_start: string | null
          segment: string | null
          status: string
          system_prompt: string | null
          total_leads: number | null
          updated_at: string | null
          voice_config: Json | null
          voice_key: string | null
        }
        Insert: {
          active_days?: number[] | null
          calls_per_hour?: number
          company_id: string
          created_at?: string | null
          daily_limit?: number
          filter_tags?: string[] | null
          id?: string
          leads_answered?: number | null
          leads_called?: number | null
          leads_converted?: number | null
          leads_opted_in?: number | null
          max_attempts?: number
          name: string
          opening_script?: string | null
          priority_max?: number | null
          priority_min?: number | null
          retry_busy_min?: number | null
          retry_no_answer_min?: number | null
          schedule_end?: string | null
          schedule_start?: string | null
          segment?: string | null
          status?: string
          system_prompt?: string | null
          total_leads?: number | null
          updated_at?: string | null
          voice_config?: Json | null
          voice_key?: string | null
        }
        Update: {
          active_days?: number[] | null
          calls_per_hour?: number
          company_id?: string
          created_at?: string | null
          daily_limit?: number
          filter_tags?: string[] | null
          id?: string
          leads_answered?: number | null
          leads_called?: number | null
          leads_converted?: number | null
          leads_opted_in?: number | null
          max_attempts?: number
          name?: string
          opening_script?: string | null
          priority_max?: number | null
          priority_min?: number | null
          retry_busy_min?: number | null
          retry_no_answer_min?: number | null
          schedule_end?: string | null
          schedule_start?: string | null
          segment?: string | null
          status?: string
          system_prompt?: string | null
          total_leads?: number | null
          updated_at?: string | null
          voice_config?: Json | null
          voice_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_queues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          call_id: string | null
          channels: number | null
          company_id: string
          consent_obtained: boolean | null
          consent_timestamp: string | null
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          format: string | null
          id: string
          recording_url: string
          retention_expires_at: string | null
          retention_policy_days: number | null
          sample_rate: number | null
          storage_bucket: string | null
          storage_path: string | null
          transcription_confidence: number | null
          transcription_language: string | null
          transcription_provider: string | null
          transcription_segments: Json | null
          transcription_status: string | null
          transcription_text: string | null
        }
        Insert: {
          call_id?: string | null
          channels?: number | null
          company_id: string
          consent_obtained?: boolean | null
          consent_timestamp?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          format?: string | null
          id?: string
          recording_url: string
          retention_expires_at?: string | null
          retention_policy_days?: number | null
          sample_rate?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          transcription_confidence?: number | null
          transcription_language?: string | null
          transcription_provider?: string | null
          transcription_segments?: Json | null
          transcription_status?: string | null
          transcription_text?: string | null
        }
        Update: {
          call_id?: string | null
          channels?: number | null
          company_id?: string
          consent_obtained?: boolean | null
          consent_timestamp?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          format?: string | null
          id?: string
          recording_url?: string
          retention_expires_at?: string | null
          retention_policy_days?: number | null
          sample_rate?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          transcription_confidence?: number | null
          transcription_language?: string | null
          transcription_provider?: string | null
          transcription_segments?: Json | null
          transcription_status?: string | null
          transcription_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_recorded_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          call_id: string | null
          created_at: string | null
          id: string
          role: string
          text: string
          timestamp: string | null
        }
        Insert: {
          call_id?: string | null
          created_at?: string | null
          id?: string
          role: string
          text: string
          timestamp?: string | null
        }
        Update: {
          call_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          text?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_recorded_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transfers: {
        Row: {
          answered_at: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          from_agent_name: string | null
          from_extension_id: string | null
          id: string
          initiated_at: string | null
          new_call_id: string | null
          original_call_id: string
          to_extension_id: string | null
          to_external_number: string | null
          to_queue_name: string | null
          transfer_reason: string | null
          transfer_status: string | null
          transfer_type: string
        }
        Insert: {
          answered_at?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_agent_name?: string | null
          from_extension_id?: string | null
          id?: string
          initiated_at?: string | null
          new_call_id?: string | null
          original_call_id: string
          to_extension_id?: string | null
          to_external_number?: string | null
          to_queue_name?: string | null
          transfer_reason?: string | null
          transfer_status?: string | null
          transfer_type: string
        }
        Update: {
          answered_at?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          from_agent_name?: string | null
          from_extension_id?: string | null
          id?: string
          initiated_at?: string | null
          new_call_id?: string | null
          original_call_id?: string
          to_extension_id?: string | null
          to_external_number?: string | null
          to_queue_name?: string | null
          transfer_reason?: string | null
          transfer_status?: string | null
          transfer_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "call_transfers_from_extension_id_fkey"
            columns: ["from_extension_id"]
            isOneToOne: false
            referencedRelation: "sip_extensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_new_call_id_fkey"
            columns: ["new_call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_new_call_id_fkey"
            columns: ["new_call_id"]
            isOneToOne: false
            referencedRelation: "v_recorded_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_original_call_id_fkey"
            columns: ["original_call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_original_call_id_fkey"
            columns: ["original_call_id"]
            isOneToOne: false
            referencedRelation: "v_recorded_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_transfers_to_extension_id_fkey"
            columns: ["to_extension_id"]
            isOneToOne: false
            referencedRelation: "sip_extensions"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_id: string | null
          ai_analysis: Json | null
          ai_cost: number | null
          ai_handled: boolean | null
          ai_qualification: string | null
          ai_qualification_data: Json | null
          ai_summary: string | null
          ai_transcript: string | null
          answered_at: string | null
          billable_duration_sec: number | null
          call_context: Json | null
          call_summary: string | null
          caller_number: string | null
          campaign_id: string | null
          codec: string | null
          company_id: string
          cost_brl: number | null
          created_at: string | null
          destination_number: string
          direction: string | null
          dispatch_id: string | null
          duration_seconds: number | null
          eligible_for_whatsapp: boolean | null
          ended_at: string | null
          extension_id: string | null
          extracted_data: Json | null
          freeswitch_uuid: string | null
          greeting_audio_url: string | null
          greeting_text: string | null
          hangup_cause: string | null
          hangup_source: string | null
          hold_duration_sec: number | null
          id: string
          interest_detected: boolean | null
          is_internal: boolean | null
          is_recorded: boolean | null
          ivr_path: Json | null
          lead_id: string | null
          lead_name: string | null
          lifecycle_id: string | null
          opt_in_id: string | null
          previous_call_id: string | null
          quality_mos: number | null
          recording_file_path: string | null
          recording_file_size_bytes: number | null
          recording_id: string | null
          recording_started_at: string | null
          recording_stopped_at: string | null
          recording_url: string | null
          result: string | null
          ring_duration_sec: number | null
          ring_time_seconds: number | null
          sentiment: string | null
          sip_call_id: string | null
          sip_response_code: number | null
          started_at: string | null
          status: string | null
          suggested_template_slot: string | null
          suggested_template_variables: Json | null
          system_prompt: string | null
          talk_duration_sec: number | null
          talk_time_seconds: number | null
          telnyx_call_control_id: string | null
          telnyx_call_session_id: string | null
          transcript: string | null
          transfer_count: number | null
          trunk_id: string | null
          voice_key: string | null
          whatsapp_authorized: boolean | null
          whatsapp_sent: boolean | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          agent_id?: string | null
          ai_analysis?: Json | null
          ai_cost?: number | null
          ai_handled?: boolean | null
          ai_qualification?: string | null
          ai_qualification_data?: Json | null
          ai_summary?: string | null
          ai_transcript?: string | null
          answered_at?: string | null
          billable_duration_sec?: number | null
          call_context?: Json | null
          call_summary?: string | null
          caller_number?: string | null
          campaign_id?: string | null
          codec?: string | null
          company_id: string
          cost_brl?: number | null
          created_at?: string | null
          destination_number: string
          direction?: string | null
          dispatch_id?: string | null
          duration_seconds?: number | null
          eligible_for_whatsapp?: boolean | null
          ended_at?: string | null
          extension_id?: string | null
          extracted_data?: Json | null
          freeswitch_uuid?: string | null
          greeting_audio_url?: string | null
          greeting_text?: string | null
          hangup_cause?: string | null
          hangup_source?: string | null
          hold_duration_sec?: number | null
          id?: string
          interest_detected?: boolean | null
          is_internal?: boolean | null
          is_recorded?: boolean | null
          ivr_path?: Json | null
          lead_id?: string | null
          lead_name?: string | null
          lifecycle_id?: string | null
          opt_in_id?: string | null
          previous_call_id?: string | null
          quality_mos?: number | null
          recording_file_path?: string | null
          recording_file_size_bytes?: number | null
          recording_id?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          recording_url?: string | null
          result?: string | null
          ring_duration_sec?: number | null
          ring_time_seconds?: number | null
          sentiment?: string | null
          sip_call_id?: string | null
          sip_response_code?: number | null
          started_at?: string | null
          status?: string | null
          suggested_template_slot?: string | null
          suggested_template_variables?: Json | null
          system_prompt?: string | null
          talk_duration_sec?: number | null
          talk_time_seconds?: number | null
          telnyx_call_control_id?: string | null
          telnyx_call_session_id?: string | null
          transcript?: string | null
          transfer_count?: number | null
          trunk_id?: string | null
          voice_key?: string | null
          whatsapp_authorized?: boolean | null
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          agent_id?: string | null
          ai_analysis?: Json | null
          ai_cost?: number | null
          ai_handled?: boolean | null
          ai_qualification?: string | null
          ai_qualification_data?: Json | null
          ai_summary?: string | null
          ai_transcript?: string | null
          answered_at?: string | null
          billable_duration_sec?: number | null
          call_context?: Json | null
          call_summary?: string | null
          caller_number?: string | null
          campaign_id?: string | null
          codec?: string | null
          company_id?: string
          cost_brl?: number | null
          created_at?: string | null
          destination_number?: string
          direction?: string | null
          dispatch_id?: string | null
          duration_seconds?: number | null
          eligible_for_whatsapp?: boolean | null
          ended_at?: string | null
          extension_id?: string | null
          extracted_data?: Json | null
          freeswitch_uuid?: string | null
          greeting_audio_url?: string | null
          greeting_text?: string | null
          hangup_cause?: string | null
          hangup_source?: string | null
          hold_duration_sec?: number | null
          id?: string
          interest_detected?: boolean | null
          is_internal?: boolean | null
          is_recorded?: boolean | null
          ivr_path?: Json | null
          lead_id?: string | null
          lead_name?: string | null
          lifecycle_id?: string | null
          opt_in_id?: string | null
          previous_call_id?: string | null
          quality_mos?: number | null
          recording_file_path?: string | null
          recording_file_size_bytes?: number | null
          recording_id?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          recording_url?: string | null
          result?: string | null
          ring_duration_sec?: number | null
          ring_time_seconds?: number | null
          sentiment?: string | null
          sip_call_id?: string | null
          sip_response_code?: number | null
          started_at?: string | null
          status?: string | null
          suggested_template_slot?: string | null
          suggested_template_variables?: Json | null
          system_prompt?: string | null
          talk_duration_sec?: number | null
          talk_time_seconds?: number | null
          telnyx_call_control_id?: string | null
          telnyx_call_session_id?: string | null
          transcript?: string | null
          transfer_count?: number | null
          trunk_id?: string | null
          voice_key?: string | null
          whatsapp_authorized?: boolean | null
          whatsapp_sent?: boolean | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "calls_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "sip_extensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_trunk_id_fkey"
            columns: ["trunk_id"]
            isOneToOne: false
            referencedRelation: "sip_trunks"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_jobs: {
        Row: {
          auto_refill_enabled: boolean | null
          batch_id: string | null
          campaign_tag: string | null
          category_filter: string | null
          chip_rotation: boolean | null
          collaborator_id: string
          company_id: string | null
          created_at: string | null
          daily_limit: number | null
          ddd_filter: string | null
          end_hour: number | null
          error_count: number | null
          id: string
          interval_max_sec: number | null
          interval_min_sec: number | null
          last_sent_at: string | null
          lead_ids: Json | null
          message_template: string
          message_templates: Json | null
          messages: Json | null
          name: string
          next_send_at: string | null
          pause_max: number | null
          pause_min: number | null
          refill_count: number | null
          refill_threshold: number | null
          reply_count: number | null
          sent_count: number | null
          start_hour: number | null
          started_at: string | null
          status: string | null
          total_leads: number | null
          updated_at: string | null
        }
        Insert: {
          auto_refill_enabled?: boolean | null
          batch_id?: string | null
          campaign_tag?: string | null
          category_filter?: string | null
          chip_rotation?: boolean | null
          collaborator_id: string
          company_id?: string | null
          created_at?: string | null
          daily_limit?: number | null
          ddd_filter?: string | null
          end_hour?: number | null
          error_count?: number | null
          id?: string
          interval_max_sec?: number | null
          interval_min_sec?: number | null
          last_sent_at?: string | null
          lead_ids?: Json | null
          message_template?: string
          message_templates?: Json | null
          messages?: Json | null
          name?: string
          next_send_at?: string | null
          pause_max?: number | null
          pause_min?: number | null
          refill_count?: number | null
          refill_threshold?: number | null
          reply_count?: number | null
          sent_count?: number | null
          start_hour?: number | null
          started_at?: string | null
          status?: string | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_refill_enabled?: boolean | null
          batch_id?: string | null
          campaign_tag?: string | null
          category_filter?: string | null
          chip_rotation?: boolean | null
          collaborator_id?: string
          company_id?: string | null
          created_at?: string | null
          daily_limit?: number | null
          ddd_filter?: string | null
          end_hour?: number | null
          error_count?: number | null
          id?: string
          interval_max_sec?: number | null
          interval_min_sec?: number | null
          last_sent_at?: string | null
          lead_ids?: Json | null
          message_template?: string
          message_templates?: Json | null
          messages?: Json | null
          name?: string
          next_send_at?: string | null
          pause_max?: number | null
          pause_min?: number | null
          refill_count?: number | null
          refill_threshold?: number | null
          reply_count?: number | null
          sent_count?: number | null
          start_hour?: number | null
          started_at?: string | null
          status?: string | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_jobs_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_logs: {
        Row: {
          chip_id: string | null
          collaborator_id: string
          created_at: string | null
          error_message: string | null
          id: string
          job_id: string
          lead_id: string | null
          phone_normalized: string | null
          phone_raw: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          chip_id?: string | null
          collaborator_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          lead_id?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          chip_id?: string | null
          collaborator_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          lead_id?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "campaign_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ai_enabled: boolean | null
          ai_model: string | null
          ai_prompt: string | null
          ai_qualification_criteria: Json | null
          ai_voice_id: string | null
          allowed_days: number[] | null
          calls_per_agent: number | null
          company_id: string
          created_at: string | null
          description: string | null
          dialer_mode: string | null
          id: string
          max_retry: number | null
          name: string
          retry_interval_minutes: number | null
          schedule_end: string | null
          schedule_start: string | null
          schedule_timezone: string | null
          status: string | null
          total_answered: number | null
          total_called: number | null
          total_leads: number | null
          total_qualified: number | null
          type: string | null
          updated_at: string | null
          whatsapp_delay_seconds: number | null
          whatsapp_followup: boolean | null
          whatsapp_template: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          ai_model?: string | null
          ai_prompt?: string | null
          ai_qualification_criteria?: Json | null
          ai_voice_id?: string | null
          allowed_days?: number[] | null
          calls_per_agent?: number | null
          company_id: string
          created_at?: string | null
          description?: string | null
          dialer_mode?: string | null
          id?: string
          max_retry?: number | null
          name: string
          retry_interval_minutes?: number | null
          schedule_end?: string | null
          schedule_start?: string | null
          schedule_timezone?: string | null
          status?: string | null
          total_answered?: number | null
          total_called?: number | null
          total_leads?: number | null
          total_qualified?: number | null
          type?: string | null
          updated_at?: string | null
          whatsapp_delay_seconds?: number | null
          whatsapp_followup?: boolean | null
          whatsapp_template?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          ai_model?: string | null
          ai_prompt?: string | null
          ai_qualification_criteria?: Json | null
          ai_voice_id?: string | null
          allowed_days?: number[] | null
          calls_per_agent?: number | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          dialer_mode?: string | null
          id?: string
          max_retry?: number | null
          name?: string
          retry_interval_minutes?: number | null
          schedule_end?: string | null
          schedule_start?: string | null
          schedule_timezone?: string | null
          status?: string | null
          total_answered?: number | null
          total_called?: number | null
          total_leads?: number | null
          total_qualified?: number | null
          type?: string | null
          updated_at?: string | null
          whatsapp_delay_seconds?: number | null
          whatsapp_followup?: boolean | null
          whatsapp_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      carousel_creations: {
        Row: {
          audience: string | null
          best_time: string | null
          caption: string | null
          company_slug: string | null
          created_at: string | null
          created_by: string | null
          hashtags: Json | null
          id: string
          images: Json | null
          objective: string | null
          platform: string | null
          slides: Json | null
          status: string | null
          style: string | null
          topic: string | null
        }
        Insert: {
          audience?: string | null
          best_time?: string | null
          caption?: string | null
          company_slug?: string | null
          created_at?: string | null
          created_by?: string | null
          hashtags?: Json | null
          id?: string
          images?: Json | null
          objective?: string | null
          platform?: string | null
          slides?: Json | null
          status?: string | null
          style?: string | null
          topic?: string | null
        }
        Update: {
          audience?: string | null
          best_time?: string | null
          caption?: string | null
          company_slug?: string | null
          created_at?: string | null
          created_by?: string | null
          hashtags?: Json | null
          id?: string
          images?: Json | null
          objective?: string | null
          platform?: string | null
          slides?: Json | null
          status?: string | null
          style?: string | null
          topic?: string | null
        }
        Relationships: []
      }
      carrosseis: {
        Row: {
          created_at: string | null
          id: string
          instagram_post_id: string | null
          legenda: string | null
          perfil: string
          published_at: string | null
          slides: Json | null
          status: string | null
          tema: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instagram_post_id?: string | null
          legenda?: string | null
          perfil: string
          published_at?: string | null
          slides?: Json | null
          status?: string | null
          tema: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instagram_post_id?: string | null
          legenda?: string | null
          perfil?: string
          published_at?: string | null
          slides?: Json | null
          status?: string | null
          tema?: string
        }
        Relationships: []
      }
      channel_routing: {
        Row: {
          business_hours: Json | null
          business_hours_only: boolean | null
          company_id: string
          created_at: string
          current_daily_routes: number | null
          description: string | null
          excluded_tags: string[] | null
          fallback_routing_id: string | null
          id: string
          is_active: boolean | null
          last_route_reset_at: string | null
          last_routed_at: string | null
          max_daily_routes: number | null
          min_lead_score: number | null
          name: string
          priority: number | null
          required_tags: string[] | null
          source_channel: string
          target_channel: string
          target_config: Json | null
          target_id: string | null
          target_type: string
          total_routed: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          business_hours?: Json | null
          business_hours_only?: boolean | null
          company_id: string
          created_at?: string
          current_daily_routes?: number | null
          description?: string | null
          excluded_tags?: string[] | null
          fallback_routing_id?: string | null
          id?: string
          is_active?: boolean | null
          last_route_reset_at?: string | null
          last_routed_at?: string | null
          max_daily_routes?: number | null
          min_lead_score?: number | null
          name: string
          priority?: number | null
          required_tags?: string[] | null
          source_channel: string
          target_channel: string
          target_config?: Json | null
          target_id?: string | null
          target_type: string
          total_routed?: number | null
          trigger_config: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          business_hours?: Json | null
          business_hours_only?: boolean | null
          company_id?: string
          created_at?: string
          current_daily_routes?: number | null
          description?: string | null
          excluded_tags?: string[] | null
          fallback_routing_id?: string | null
          id?: string
          is_active?: boolean | null
          last_route_reset_at?: string | null
          last_routed_at?: string | null
          max_daily_routes?: number | null
          min_lead_score?: number | null
          name?: string
          priority?: number | null
          required_tags?: string[] | null
          source_channel?: string
          target_channel?: string
          target_config?: Json | null
          target_id?: string | null
          target_type?: string
          total_routed?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_routing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_routing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "channel_routing_fallback_routing_id_fkey"
            columns: ["fallback_routing_id"]
            isOneToOne: false
            referencedRelation: "channel_routing"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          consultant_id: string | null
          created_at: string | null
          daily_msg_count: number | null
          id: string
          instance_name: string | null
          instance_token: string | null
          last_msg_at: string | null
          phone_number: string | null
          status: string | null
          total_msg_count: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          consultant_id?: string | null
          created_at?: string | null
          daily_msg_count?: number | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          last_msg_at?: string | null
          phone_number?: string | null
          status?: string | null
          total_msg_count?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          consultant_id?: string | null
          created_at?: string | null
          daily_msg_count?: number | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          last_msg_at?: string | null
          phone_number?: string | null
          status?: string | null
          total_msg_count?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_monitor_logs: {
        Row: {
          duration_ms: number | null
          id: string
          logs: Json | null
          ran_at: string | null
          stats: Json | null
        }
        Insert: {
          duration_ms?: number | null
          id?: string
          logs?: Json | null
          ran_at?: string | null
          stats?: Json | null
        }
        Update: {
          duration_ms?: number | null
          id?: string
          logs?: Json | null
          ran_at?: string | null
          stats?: Json | null
        }
        Relationships: []
      }
      city_analysis: {
        Row: {
          ai_reasoning: string | null
          ai_recommendation: string | null
          city: string
          created_at: string | null
          estimated_travel_cost: number | null
          id: string
          last_analyzed_at: string | null
          nearest_technician_distance_km: number | null
          nearest_technician_id: string | null
          state: string
          theft_index: number | null
          theft_risk_level: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          city: string
          created_at?: string | null
          estimated_travel_cost?: number | null
          id?: string
          last_analyzed_at?: string | null
          nearest_technician_distance_km?: number | null
          nearest_technician_id?: string | null
          state: string
          theft_index?: number | null
          theft_risk_level?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          city?: string
          created_at?: string | null
          estimated_travel_cost?: number | null
          id?: string
          last_analyzed_at?: string | null
          nearest_technician_distance_km?: number | null
          nearest_technician_id?: string | null
          state?: string
          theft_index?: number | null
          theft_risk_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_analysis_nearest_technician_id_fkey"
            columns: ["nearest_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cnpj_leads: {
        Row: {
          attempts: number | null
          bairro: string | null
          call_id: string | null
          cep: string | null
          cnae_descricao: string | null
          cnae_fiscal: string | null
          cnpj: string | null
          email: string | null
          id: string
          imported_at: string | null
          is_blocked: boolean | null
          last_attempt_at: string | null
          logradouro: string | null
          municipio: string | null
          nome_fantasia: string | null
          numero: string | null
          porte_empresa: string | null
          priority: number | null
          razao_social: string | null
          situacao_cadastral: string | null
          status: string | null
          telefone1: string | null
          telefone2: string | null
          uf: string | null
          whatsapp_opt_in: boolean | null
        }
        Insert: {
          attempts?: number | null
          bairro?: string | null
          call_id?: string | null
          cep?: string | null
          cnae_descricao?: string | null
          cnae_fiscal?: string | null
          cnpj?: string | null
          email?: string | null
          id?: string
          imported_at?: string | null
          is_blocked?: boolean | null
          last_attempt_at?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          porte_empresa?: string | null
          priority?: number | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          status?: string | null
          telefone1?: string | null
          telefone2?: string | null
          uf?: string | null
          whatsapp_opt_in?: boolean | null
        }
        Update: {
          attempts?: number | null
          bairro?: string | null
          call_id?: string | null
          cep?: string | null
          cnae_descricao?: string | null
          cnae_fiscal?: string | null
          cnpj?: string | null
          email?: string | null
          id?: string
          imported_at?: string | null
          is_blocked?: boolean | null
          last_attempt_at?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          porte_empresa?: string | null
          priority?: number | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          status?: string | null
          telefone1?: string | null
          telefone2?: string | null
          uf?: string | null
          whatsapp_opt_in?: boolean | null
        }
        Relationships: []
      }
      collaborator_agent_access: {
        Row: {
          agent_id: string
          collaborator_id: string
          created_at: string | null
          granted: boolean | null
          id: string
        }
        Insert: {
          agent_id: string
          collaborator_id: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
        }
        Update: {
          agent_id?: string
          collaborator_id?: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_agent_access_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_agent_access_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "collaborator_agent_access_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_metrics: {
        Row: {
          agent_interactions: number | null
          collaborator_id: string
          created_at: string | null
          custom_metrics: Json | null
          id: string
          leads_contacted: number | null
          leads_converted: number | null
          leads_qualified: number | null
          leads_received: number | null
          metric_date: string
        }
        Insert: {
          agent_interactions?: number | null
          collaborator_id: string
          created_at?: string | null
          custom_metrics?: Json | null
          id?: string
          leads_contacted?: number | null
          leads_converted?: number | null
          leads_qualified?: number | null
          leads_received?: number | null
          metric_date?: string
        }
        Update: {
          agent_interactions?: number | null
          collaborator_id?: string
          created_at?: string | null
          custom_metrics?: Json | null
          id?: string
          leads_contacted?: number | null
          leads_converted?: number | null
          leads_qualified?: number | null
          leads_received?: number | null
          metric_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_metrics_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          active: boolean | null
          auth_user_id: string | null
          bot_memory: string | null
          bot_training: string | null
          company_id: string
          company_ids: Json | null
          created_at: string | null
          deactivated_at: string | null
          email: string | null
          id: string
          is_super_admin: boolean | null
          last_agent_id: string | null
          name: string
          parent_id: string | null
          phone: string | null
          reports_to: string | null
          role_id: string
          sector_id: string | null
          telegram_id: string | null
          uazapi_instance_name: string | null
          unit_id: string | null
          unit_ids: Json | null
          user_id: string | null
          whatsapp: string | null
          whatsapp_comercial: string | null
        }
        Insert: {
          active?: boolean | null
          auth_user_id?: string | null
          bot_memory?: string | null
          bot_training?: string | null
          company_id: string
          company_ids?: Json | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          id?: string
          is_super_admin?: boolean | null
          last_agent_id?: string | null
          name: string
          parent_id?: string | null
          phone?: string | null
          reports_to?: string | null
          role_id: string
          sector_id?: string | null
          telegram_id?: string | null
          uazapi_instance_name?: string | null
          unit_id?: string | null
          unit_ids?: Json | null
          user_id?: string | null
          whatsapp?: string | null
          whatsapp_comercial?: string | null
        }
        Update: {
          active?: boolean | null
          auth_user_id?: string | null
          bot_memory?: string | null
          bot_training?: string | null
          company_id?: string
          company_ids?: Json | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          id?: string
          is_super_admin?: boolean | null
          last_agent_id?: string | null
          name?: string
          parent_id?: string | null
          phone?: string | null
          reports_to?: string | null
          role_id?: string
          sector_id?: string | null
          telegram_id?: string | null
          uazapi_instance_name?: string | null
          unit_id?: string | null
          unit_ids?: Json | null
          user_id?: string | null
          whatsapp?: string | null
          whatsapp_comercial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "collaborators_last_agent_id_fkey"
            columns: ["last_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_last_agent_id_fkey"
            columns: ["last_agent_id"]
            isOneToOne: false
            referencedRelation: "v_agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "collaborators_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborators_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean | null
          brand_identity: Json | null
          cnpj: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          is_active: boolean | null
          lgpd_dpo_email: string | null
          lgpd_dpo_name: string | null
          logo_url: string | null
          max_agents: number | null
          max_monthly_minutes: number | null
          messaging_tier: string | null
          meta_app_id: string | null
          meta_business_id: string | null
          name: string
          phone: string | null
          plan: string | null
          plan_tier: string | null
          sip_host: string | null
          sip_max_channels: number | null
          sip_password: string | null
          sip_port: number | null
          sip_username: string | null
          slug: string
          updated_at: string | null
          whatsapp_api_key: string | null
          whatsapp_instance_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          active?: boolean | null
          brand_identity?: Json | null
          cnpj?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          lgpd_dpo_email?: string | null
          lgpd_dpo_name?: string | null
          logo_url?: string | null
          max_agents?: number | null
          max_monthly_minutes?: number | null
          messaging_tier?: string | null
          meta_app_id?: string | null
          meta_business_id?: string | null
          name: string
          phone?: string | null
          plan?: string | null
          plan_tier?: string | null
          sip_host?: string | null
          sip_max_channels?: number | null
          sip_password?: string | null
          sip_port?: number | null
          sip_username?: string | null
          slug: string
          updated_at?: string | null
          whatsapp_api_key?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          active?: boolean | null
          brand_identity?: Json | null
          cnpj?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          lgpd_dpo_email?: string | null
          lgpd_dpo_name?: string | null
          logo_url?: string | null
          max_agents?: number | null
          max_monthly_minutes?: number | null
          messaging_tier?: string | null
          meta_app_id?: string | null
          meta_business_id?: string | null
          name?: string
          phone?: string | null
          plan?: string | null
          plan_tier?: string | null
          sip_host?: string | null
          sip_max_channels?: number | null
          sip_password?: string | null
          sip_port?: number | null
          sip_username?: string | null
          slug?: string
          updated_at?: string | null
          whatsapp_api_key?: string | null
          whatsapp_instance_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      company_config: {
        Row: {
          allowed_words: Json | null
          call_system_prompt: string | null
          company_id: string
          company_name: string
          created_at: string | null
          extraction_schema: Json
          followup_hours_call: number | null
          followup_hours_first: number | null
          forbidden_words: Json | null
          id: string
          is_active: boolean | null
          max_templates_before_call: number | null
          persona_company: string | null
          persona_name: string
          persona_role: string | null
          persona_tone: string | null
          product_data: Json | null
          segment: string
          segment_display_name: string | null
          summary_prompt: string | null
          updated_at: string | null
          whatsapp_system_prompt: string | null
        }
        Insert: {
          allowed_words?: Json | null
          call_system_prompt?: string | null
          company_id: string
          company_name: string
          created_at?: string | null
          extraction_schema?: Json
          followup_hours_call?: number | null
          followup_hours_first?: number | null
          forbidden_words?: Json | null
          id?: string
          is_active?: boolean | null
          max_templates_before_call?: number | null
          persona_company?: string | null
          persona_name: string
          persona_role?: string | null
          persona_tone?: string | null
          product_data?: Json | null
          segment: string
          segment_display_name?: string | null
          summary_prompt?: string | null
          updated_at?: string | null
          whatsapp_system_prompt?: string | null
        }
        Update: {
          allowed_words?: Json | null
          call_system_prompt?: string | null
          company_id?: string
          company_name?: string
          created_at?: string | null
          extraction_schema?: Json
          followup_hours_call?: number | null
          followup_hours_first?: number | null
          forbidden_words?: Json | null
          id?: string
          is_active?: boolean | null
          max_templates_before_call?: number | null
          persona_company?: string | null
          persona_name?: string
          persona_role?: string | null
          persona_tone?: string | null
          product_data?: Json | null
          segment?: string
          segment_display_name?: string | null
          summary_prompt?: string | null
          updated_at?: string | null
          whatsapp_system_prompt?: string | null
        }
        Relationships: []
      }
      consultant_lead_pool: {
        Row: {
          assigned_at: string | null
          campaign_tag: string | null
          collaborator_id: string
          converted_at: string | null
          id: string
          lead_category: string | null
          lead_city: string | null
          lead_ddd: string | null
          lead_name: string | null
          phone: string
          responded_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          assigned_at?: string | null
          campaign_tag?: string | null
          collaborator_id: string
          converted_at?: string | null
          id?: string
          lead_category?: string | null
          lead_city?: string | null
          lead_ddd?: string | null
          lead_name?: string | null
          phone: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          assigned_at?: string | null
          campaign_tag?: string | null
          collaborator_id?: string
          converted_at?: string | null
          id?: string
          lead_category?: string | null
          lead_city?: string | null
          lead_ddd?: string | null
          lead_name?: string | null
          phone?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_lead_pool_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_metrics: {
        Row: {
          closings: number | null
          consultant_id: string | null
          created_at: string | null
          date: string
          hot_leads: number | null
          id: string
          messages_sent: number | null
          quotes: number | null
          response_rate: number | null
          responses: number | null
          revenue: number | null
        }
        Insert: {
          closings?: number | null
          consultant_id?: string | null
          created_at?: string | null
          date?: string
          hot_leads?: number | null
          id?: string
          messages_sent?: number | null
          quotes?: number | null
          response_rate?: number | null
          responses?: number | null
          revenue?: number | null
        }
        Update: {
          closings?: number | null
          consultant_id?: string | null
          created_at?: string | null
          date?: string
          hot_leads?: number | null
          id?: string
          messages_sent?: number | null
          quotes?: number | null
          response_rate?: number | null
          responses?: number | null
          revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_metrics_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      consultants: {
        Row: {
          activated_at: string | null
          auth_user_id: string | null
          company: string | null
          created_at: string | null
          deactivated_at: string | null
          email: string | null
          id: string
          name: string
          notification_instance_token: string | null
          permissions: string[] | null
          personal_phone: string | null
          region: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: string | null
          tone: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          auth_user_id?: string | null
          company?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          id?: string
          name: string
          notification_instance_token?: string | null
          permissions?: string[] | null
          personal_phone?: string | null
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: string | null
          tone?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          auth_user_id?: string | null
          company?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notification_instance_token?: string | null
          permissions?: string[] | null
          personal_phone?: string | null
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: string | null
          tone?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_leads: {
        Row: {
          address: string | null
          assigned_at: string | null
          assigned_to: string | null
          category: string | null
          city: string | null
          cnae_code: string | null
          company_target: string | null
          created_at: string | null
          document: string | null
          email: string | null
          extracted_at: string | null
          id: string
          lat: number | null
          lon: number | null
          name: string | null
          notes: string | null
          phone: string | null
          region: string | null
          score: number | null
          source: string | null
          state: string | null
          status: string | null
          subcategory: string | null
          tags: string[] | null
          tipo_pessoa: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          category?: string | null
          city?: string | null
          cnae_code?: string | null
          company_target?: string | null
          created_at?: string | null
          document?: string | null
          email?: string | null
          extracted_at?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          region?: string | null
          score?: number | null
          source?: string | null
          state?: string | null
          status?: string | null
          subcategory?: string | null
          tags?: string[] | null
          tipo_pessoa?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          category?: string | null
          city?: string | null
          cnae_code?: string | null
          company_target?: string | null
          created_at?: string | null
          document?: string | null
          email?: string | null
          extracted_at?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          region?: string | null
          score?: number | null
          source?: string | null
          state?: string | null
          status?: string | null
          subcategory?: string | null
          tags?: string[] | null
          tipo_pessoa?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      contacted_phones: {
        Row: {
          campaign_tag: string | null
          chip_used: string | null
          collaborator_id: string | null
          contacted_at: string | null
          created_at: string | null
          id: string
          phone: string
          response_received: boolean | null
          response_text: string | null
        }
        Insert: {
          campaign_tag?: string | null
          chip_used?: string | null
          collaborator_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          id?: string
          phone: string
          response_received?: boolean | null
          response_text?: string | null
        }
        Update: {
          campaign_tag?: string | null
          chip_used?: string | null
          collaborator_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          id?: string
          phone?: string
          response_received?: boolean | null
          response_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacted_phones_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          chip_id: string | null
          chip_instance_token: string | null
          chip_server_url: string | null
          chip_type: string | null
          collaborator_id: string | null
          consultant_id: string | null
          created_at: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          lead_id: string | null
          lead_name: string | null
          lead_phone: string
          lead_profile_pic: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          chip_id?: string | null
          chip_instance_token?: string | null
          chip_server_url?: string | null
          chip_type?: string | null
          collaborator_id?: string | null
          consultant_id?: string | null
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          lead_name?: string | null
          lead_phone: string
          lead_profile_pic?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          chip_id?: string | null
          chip_instance_token?: string | null
          chip_server_url?: string | null
          chip_type?: string | null
          collaborator_id?: string | null
          consultant_id?: string | null
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          lead_name?: string | null
          lead_phone?: string
          lead_profile_pic?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          agent_id: string | null
          ai_voice_cost: number | null
          answered_calls: number | null
          avg_talk_time: number | null
          campaign_id: string | null
          company_id: string
          created_at: string | null
          id: string
          metric_date: string
          total_calls: number | null
          total_leads_qualified: number | null
          total_talk_time: number | null
          total_whatsapp_replied: number | null
          total_whatsapp_sent: number | null
          whatsapp_cost: number | null
        }
        Insert: {
          agent_id?: string | null
          ai_voice_cost?: number | null
          answered_calls?: number | null
          avg_talk_time?: number | null
          campaign_id?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          metric_date?: string
          total_calls?: number | null
          total_leads_qualified?: number | null
          total_talk_time?: number | null
          total_whatsapp_replied?: number | null
          total_whatsapp_sent?: number | null
          whatsapp_cost?: number | null
        }
        Update: {
          agent_id?: string | null
          ai_voice_cost?: number | null
          answered_calls?: number | null
          avg_talk_time?: number | null
          campaign_id?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          metric_date?: string
          total_calls?: number | null
          total_leads_qualified?: number | null
          total_talk_time?: number | null
          total_whatsapp_replied?: number | null
          total_whatsapp_sent?: number | null
          whatsapp_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      dial_queue: {
        Row: {
          assigned_agent_id: string | null
          campaign_id: string
          company_id: string
          created_at: string | null
          id: string
          lead_id: string
          priority: number | null
          scheduled_at: string | null
          status: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          campaign_id: string
          company_id: string
          created_at?: string | null
          id?: string
          lead_id: string
          priority?: number | null
          scheduled_at?: string | null
          status?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          campaign_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          priority?: number | null
          scheduled_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dial_queue_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dial_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dial_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dial_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "dial_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_permissions: {
        Row: {
          active: boolean
          allowed_templates: Json | null
          can_create_templates: boolean | null
          can_dispatch: boolean | null
          can_distribute_leads: boolean | null
          can_edit_templates: boolean | null
          can_manage_opt_ins: boolean | null
          can_view_config: boolean | null
          can_view_quality: boolean | null
          collaborator_id: string
          company_id: string | null
          created_at: string
          daily_dispatch_limit: number | null
          daily_dispatches_used: number | null
          daily_limit: number
          dispatches_today: number
          id: string
          is_active: boolean | null
          last_reset_at: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_templates?: Json | null
          can_create_templates?: boolean | null
          can_dispatch?: boolean | null
          can_distribute_leads?: boolean | null
          can_edit_templates?: boolean | null
          can_manage_opt_ins?: boolean | null
          can_view_config?: boolean | null
          can_view_quality?: boolean | null
          collaborator_id: string
          company_id?: string | null
          created_at?: string
          daily_dispatch_limit?: number | null
          daily_dispatches_used?: number | null
          daily_limit?: number
          dispatches_today?: number
          id?: string
          is_active?: boolean | null
          last_reset_at?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_templates?: Json | null
          can_create_templates?: boolean | null
          can_dispatch?: boolean | null
          can_distribute_leads?: boolean | null
          can_edit_templates?: boolean | null
          can_manage_opt_ins?: boolean | null
          can_view_config?: boolean | null
          can_view_quality?: boolean | null
          collaborator_id?: string
          company_id?: string | null
          created_at?: string
          daily_dispatch_limit?: number | null
          daily_dispatches_used?: number | null
          daily_limit?: number
          dispatches_today?: number
          id?: string
          is_active?: boolean | null
          last_reset_at?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      dispatch_queues: {
        Row: {
          active_days: number[] | null
          attachment_url: string | null
          auto_trigger: Json | null
          company_id: string
          created_at: string | null
          daily_limit: number
          filter_tags: string[] | null
          filter_temperatures: string[] | null
          id: string
          leads_delivered: number | null
          leads_dispatched: number | null
          leads_read: number | null
          leads_replied: number | null
          max_per_hour: number
          name: string
          respect_tier_limit: boolean | null
          safety_pct: number | null
          schedule_end: string | null
          schedule_start: string | null
          segment: string | null
          status: string
          template_name: string | null
          template_slot: string | null
          total_leads: number | null
          updated_at: string | null
        }
        Insert: {
          active_days?: number[] | null
          attachment_url?: string | null
          auto_trigger?: Json | null
          company_id: string
          created_at?: string | null
          daily_limit?: number
          filter_tags?: string[] | null
          filter_temperatures?: string[] | null
          id?: string
          leads_delivered?: number | null
          leads_dispatched?: number | null
          leads_read?: number | null
          leads_replied?: number | null
          max_per_hour?: number
          name: string
          respect_tier_limit?: boolean | null
          safety_pct?: number | null
          schedule_end?: string | null
          schedule_start?: string | null
          segment?: string | null
          status?: string
          template_name?: string | null
          template_slot?: string | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Update: {
          active_days?: number[] | null
          attachment_url?: string | null
          auto_trigger?: Json | null
          company_id?: string
          created_at?: string | null
          daily_limit?: number
          filter_tags?: string[] | null
          filter_temperatures?: string[] | null
          id?: string
          leads_delivered?: number | null
          leads_dispatched?: number | null
          leads_read?: number | null
          leads_replied?: number | null
          max_per_hour?: number
          name?: string
          respect_tier_limit?: boolean | null
          safety_pct?: number | null
          schedule_end?: string | null
          schedule_start?: string | null
          segment?: string | null
          status?: string
          template_name?: string | null
          template_slot?: string | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_queues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_queues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      extraction_logs: {
        Row: {
          company_target: string | null
          completed_at: string | null
          created_by: string | null
          error_message: string | null
          extraction_type: string | null
          id: string
          leads_found: number | null
          leads_with_email: number | null
          leads_with_phone: number | null
          parameters: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          company_target?: string | null
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          extraction_type?: string | null
          id?: string
          leads_found?: number | null
          leads_with_email?: number | null
          leads_with_phone?: number | null
          parameters?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          company_target?: string | null
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          extraction_type?: string | null
          id?: string
          leads_found?: number | null
          leads_with_email?: number | null
          leads_with_phone?: number | null
          parameters?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_closing_items: {
        Row: {
          amount: number
          closing_id: string | null
          id: string
          service_order_id: string | null
        }
        Insert: {
          amount: number
          closing_id?: string | null
          id?: string
          service_order_id?: string | null
        }
        Update: {
          amount?: number
          closing_id?: string | null
          id?: string
          service_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_closing_items_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "financial_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_closing_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_closings: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          period_type: string
          status: string
          technician_id: string | null
          total_amount: number
          total_services: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          period_type: string
          status?: string
          technician_id?: string | null
          total_amount?: number
          total_services?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          period_type?: string
          status?: string
          technician_id?: string | null
          total_amount?: number
          total_services?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_closings_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      freeswitch_events: {
        Row: {
          call_id: string | null
          company_id: string
          created_at: string | null
          event_data: Json | null
          event_name: string
          id: string
        }
        Insert: {
          call_id?: string | null
          company_id: string
          created_at?: string | null
          event_data?: Json | null
          event_name: string
          id?: string
        }
        Update: {
          call_id?: string | null
          company_id?: string
          created_at?: string | null
          event_data?: Json | null
          event_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freeswitch_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freeswitch_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "v_recorded_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_leads: {
        Row: {
          bio: string | null
          category: string | null
          company_target: string | null
          created_at: string | null
          email: string | null
          follower_count: number | null
          full_name: string | null
          id: string
          is_business: boolean | null
          phone: string | null
          status: string | null
          target_id: string | null
          username: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          category?: string | null
          company_target?: string | null
          created_at?: string | null
          email?: string | null
          follower_count?: number | null
          full_name?: string | null
          id?: string
          is_business?: boolean | null
          phone?: string | null
          status?: string | null
          target_id?: string | null
          username: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          category?: string | null
          company_target?: string | null
          created_at?: string | null
          email?: string | null
          follower_count?: number | null
          full_name?: string | null
          id?: string
          is_business?: boolean | null
          phone?: string | null
          status?: string | null
          target_id?: string | null
          username?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_leads_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "instagram_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_sessions: {
        Row: {
          created_at: string | null
          id: string
          last_used_at: string | null
          session_data: Json | null
          status: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          session_data?: Json | null
          status?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          session_data?: Json | null
          status?: string | null
          username?: string
        }
        Relationships: []
      }
      instagram_targets: {
        Row: {
          category: string | null
          company_target: string
          created_at: string | null
          created_by: string | null
          followers_count: number | null
          id: string
          last_extracted_at: string | null
          status: string | null
          total_extracted: number | null
          username: string
        }
        Insert: {
          category?: string | null
          company_target?: string
          created_at?: string | null
          created_by?: string | null
          followers_count?: number | null
          id?: string
          last_extracted_at?: string | null
          status?: string | null
          total_extracted?: number | null
          username: string
        }
        Update: {
          category?: string | null
          company_target?: string
          created_at?: string | null
          created_by?: string | null
          followers_count?: number | null
          id?: string
          last_extracted_at?: string | null
          status?: string | null
          total_extracted?: number | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          id: string
          product_id: string | null
          quantity_available: number
          quantity_in_field: number
          quantity_reserved: number
          quantity_total: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          quantity_available?: number
          quantity_in_field?: number
          quantity_reserved?: number
          quantity_total?: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          quantity_available?: number
          quantity_in_field?: number
          quantity_reserved?: number
          quantity_total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_links: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number
          role_id: string | null
          token: string
          unit_id: string | null
          used_count: number
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          max_uses?: number
          role_id?: string | null
          token?: string
          unit_id?: string | null
          used_count?: number
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number
          role_id?: string | null
          token?: string
          unit_id?: string | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invite_links_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_links_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ivr_menus: {
        Row: {
          after_hours_action: Json | null
          business_hours: Json | null
          company_id: string
          created_at: string
          greeting_audio_url: string | null
          greeting_tts_text: string | null
          greeting_voice_key: string | null
          id: string
          invalid_input_message: string | null
          is_active: boolean | null
          max_retries: number | null
          name: string
          options: Json
          parent_menu_id: string | null
          timeout_message: string | null
          timeout_seconds: number | null
          trunk_id: string | null
          updated_at: string
        }
        Insert: {
          after_hours_action?: Json | null
          business_hours?: Json | null
          company_id: string
          created_at?: string
          greeting_audio_url?: string | null
          greeting_tts_text?: string | null
          greeting_voice_key?: string | null
          id?: string
          invalid_input_message?: string | null
          is_active?: boolean | null
          max_retries?: number | null
          name: string
          options?: Json
          parent_menu_id?: string | null
          timeout_message?: string | null
          timeout_seconds?: number | null
          trunk_id?: string | null
          updated_at?: string
        }
        Update: {
          after_hours_action?: Json | null
          business_hours?: Json | null
          company_id?: string
          created_at?: string
          greeting_audio_url?: string | null
          greeting_tts_text?: string | null
          greeting_voice_key?: string | null
          id?: string
          invalid_input_message?: string | null
          is_active?: boolean | null
          max_retries?: number | null
          name?: string
          options?: Json
          parent_menu_id?: string | null
          timeout_message?: string | null
          timeout_seconds?: number | null
          trunk_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ivr_menus_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ivr_menus_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ivr_menus_parent_menu_id_fkey"
            columns: ["parent_menu_id"]
            isOneToOne: false
            referencedRelation: "ivr_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ivr_menus_trunk_id_fkey"
            columns: ["trunk_id"]
            isOneToOne: false
            referencedRelation: "sip_trunks"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_batches: {
        Row: {
          assigned_to: string
          company_id: string
          created_at: string
          created_by: string
          filtro_cidade: string | null
          filtro_ddd: string | null
          filtro_fonte: string | null
          id: string
          is_auto_refill: boolean
          quantidade: number
          status: string
          total_convertidos: number
          total_enviados: number
          total_responderam: number
        }
        Insert: {
          assigned_to: string
          company_id: string
          created_at?: string
          created_by: string
          filtro_cidade?: string | null
          filtro_ddd?: string | null
          filtro_fonte?: string | null
          id?: string
          is_auto_refill?: boolean
          quantidade?: number
          status?: string
          total_convertidos?: number
          total_enviados?: number
          total_responderam?: number
        }
        Update: {
          assigned_to?: string
          company_id?: string
          created_at?: string
          created_by?: string
          filtro_cidade?: string | null
          filtro_ddd?: string | null
          filtro_fonte?: string | null
          id?: string
          is_auto_refill?: boolean
          quantidade?: number
          status?: string
          total_convertidos?: number
          total_enviados?: number
          total_responderam?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_batches_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution: {
        Row: {
          collaborator_id: string
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          dispatch_id: string | null
          distributed_at: string | null
          distributed_by: string | null
          id: string
          lead_name: string | null
          lifecycle_id: string | null
          phone_number: string
          result: string | null
          status: string | null
        }
        Insert: {
          collaborator_id: string
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          dispatch_id?: string | null
          distributed_at?: string | null
          distributed_by?: string | null
          id?: string
          lead_name?: string | null
          lifecycle_id?: string | null
          phone_number: string
          result?: string | null
          status?: string | null
        }
        Update: {
          collaborator_id?: string
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          dispatch_id?: string | null
          distributed_at?: string | null
          distributed_by?: string | null
          id?: string
          lead_name?: string | null
          lifecycle_id?: string | null
          phone_number?: string
          result?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "smart_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_lifecycle_id_fkey"
            columns: ["lifecycle_id"]
            isOneToOne: false
            referencedRelation: "lead_whatsapp_lifecycle"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distributions: {
        Row: {
          collaborator_id: string
          distributed_at: string | null
          distributed_by: string | null
          id: string
          lead_id: string
          notes: string | null
          status: string | null
        }
        Insert: {
          collaborator_id: string
          distributed_at?: string | null
          distributed_by?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          status?: string | null
        }
        Update: {
          collaborator_id?: string
          distributed_at?: string | null
          distributed_by?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distributions_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distributions_distributed_by_fkey"
            columns: ["distributed_by"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distributions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contact_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_import_batches: {
        Row: {
          column_mapping: Json | null
          company_id: string
          completed_at: string | null
          duplicates: number | null
          error_log: Json | null
          file_name: string | null
          id: string
          imported: number | null
          imported_by: string | null
          invalid: number | null
          source: string
          started_at: string | null
          status: string | null
          total_rows: number | null
        }
        Insert: {
          column_mapping?: Json | null
          company_id: string
          completed_at?: string | null
          duplicates?: number | null
          error_log?: Json | null
          file_name?: string | null
          id?: string
          imported?: number | null
          imported_by?: string | null
          invalid?: number | null
          source: string
          started_at?: string | null
          status?: string | null
          total_rows?: number | null
        }
        Update: {
          column_mapping?: Json | null
          company_id?: string
          completed_at?: string | null
          duplicates?: number | null
          error_log?: Json | null
          file_name?: string | null
          id?: string
          imported?: number | null
          imported_by?: string | null
          invalid?: number | null
          source?: string
          started_at?: string | null
          status?: string | null
          total_rows?: number | null
        }
        Relationships: []
      }
      lead_items: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          batch_id: string | null
          cidade: string | null
          company_id: string
          created_at: string
          ddd: string | null
          dispatched_at: string | null
          estado: string | null
          fonte: string | null
          id: string
          nome: string
          status: string
          telefone: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          batch_id?: string | null
          cidade?: string | null
          company_id: string
          created_at?: string
          ddd?: string | null
          dispatched_at?: string | null
          estado?: string | null
          fonte?: string | null
          id?: string
          nome: string
          status?: string
          telefone: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          batch_id?: string | null
          cidade?: string | null
          company_id?: string
          created_at?: string
          ddd?: string | null
          dispatched_at?: string | null
          estado?: string | null
          fonte?: string | null
          id?: string
          nome?: string
          status?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_items_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lead_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      lead_whatsapp_lifecycle: {
        Row: {
          avg_response_time_min: number | null
          collaborator_id: string | null
          company_id: string | null
          conversation_summary: string | null
          created_at: string | null
          id: string
          last_call_at: string | null
          last_inbound_at: string | null
          last_template_name: string | null
          last_template_sent_at: string | null
          lead_interests: Json | null
          lead_name: string | null
          messages_received: number | null
          messages_sent: number | null
          next_call_reason: string | null
          next_call_requested: boolean | null
          objections: Json | null
          opt_in_id: string | null
          phone_number: string
          response_rate: number | null
          sentiment: string | null
          stage: string | null
          stage_changed_at: string | null
          templates_sent_24h: number | null
          templates_sent_total: number | null
          total_calls: number | null
          updated_at: string | null
          window_expires_at: string | null
          window_open: boolean | null
        }
        Insert: {
          avg_response_time_min?: number | null
          collaborator_id?: string | null
          company_id?: string | null
          conversation_summary?: string | null
          created_at?: string | null
          id?: string
          last_call_at?: string | null
          last_inbound_at?: string | null
          last_template_name?: string | null
          last_template_sent_at?: string | null
          lead_interests?: Json | null
          lead_name?: string | null
          messages_received?: number | null
          messages_sent?: number | null
          next_call_reason?: string | null
          next_call_requested?: boolean | null
          objections?: Json | null
          opt_in_id?: string | null
          phone_number: string
          response_rate?: number | null
          sentiment?: string | null
          stage?: string | null
          stage_changed_at?: string | null
          templates_sent_24h?: number | null
          templates_sent_total?: number | null
          total_calls?: number | null
          updated_at?: string | null
          window_expires_at?: string | null
          window_open?: boolean | null
        }
        Update: {
          avg_response_time_min?: number | null
          collaborator_id?: string | null
          company_id?: string | null
          conversation_summary?: string | null
          created_at?: string | null
          id?: string
          last_call_at?: string | null
          last_inbound_at?: string | null
          last_template_name?: string | null
          last_template_sent_at?: string | null
          lead_interests?: Json | null
          lead_name?: string | null
          messages_received?: number | null
          messages_sent?: number | null
          next_call_reason?: string | null
          next_call_requested?: boolean | null
          objections?: Json | null
          opt_in_id?: string | null
          phone_number?: string
          response_rate?: number | null
          sentiment?: string | null
          stage?: string | null
          stage_changed_at?: string | null
          templates_sent_24h?: number | null
          templates_sent_total?: number | null
          total_calls?: number | null
          updated_at?: string | null
          window_expires_at?: string | null
          window_open?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_whatsapp_lifecycle_opt_in_id_fkey"
            columns: ["opt_in_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_opt_ins"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_agent_id: string | null
          attempts: number | null
          campaign_id: string | null
          category: string | null
          city: string | null
          company_id: string | null
          company_target: string | null
          consultant_id: string | null
          contacted_at: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          name: string | null
          next_attempt_at: string | null
          phone: string | null
          phone_alt: string | null
          qualification: string | null
          qualification_notes: string | null
          region: string | null
          responded_at: string | null
          score: number | null
          source: string | null
          source_id: string | null
          status: string | null
          subcategory: string | null
          tipo_pessoa: string | null
          updated_at: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          attempts?: number | null
          campaign_id?: string | null
          category?: string | null
          city?: string | null
          company_id?: string | null
          company_target?: string | null
          consultant_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          name?: string | null
          next_attempt_at?: string | null
          phone?: string | null
          phone_alt?: string | null
          qualification?: string | null
          qualification_notes?: string | null
          region?: string | null
          responded_at?: string | null
          score?: number | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          subcategory?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          attempts?: number | null
          campaign_id?: string | null
          category?: string | null
          city?: string | null
          company_id?: string | null
          company_target?: string | null
          consultant_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          name?: string | null
          next_attempt_at?: string | null
          phone?: string | null
          phone_alt?: string | null
          qualification?: string | null
          qualification_notes?: string | null
          region?: string | null
          responded_at?: string | null
          score?: number | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          subcategory?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      leads_master: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          city: string | null
          company_id: string
          created_at: string | null
          duplicate_of: string | null
          email: string | null
          extra_data: Json | null
          id: string
          import_batch_id: string | null
          imported_at: string | null
          last_call_at: string | null
          last_call_id: string | null
          last_call_result: string | null
          last_dispatch_at: string | null
          lead_name: string | null
          lead_score: number | null
          lead_temperature: string | null
          lifecycle_id: string | null
          next_call_at: string | null
          opt_in_id: string | null
          phone_number: string
          priority: number | null
          region: string | null
          segment: string | null
          source: string
          source_detail: string | null
          state: string | null
          status: string | null
          status_changed_at: string | null
          tags: Json | null
          total_call_attempts: number | null
          total_dispatches: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          city?: string | null
          company_id: string
          created_at?: string | null
          duplicate_of?: string | null
          email?: string | null
          extra_data?: Json | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          last_call_at?: string | null
          last_call_id?: string | null
          last_call_result?: string | null
          last_dispatch_at?: string | null
          lead_name?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          lifecycle_id?: string | null
          next_call_at?: string | null
          opt_in_id?: string | null
          phone_number: string
          priority?: number | null
          region?: string | null
          segment?: string | null
          source?: string
          source_detail?: string | null
          state?: string | null
          status?: string | null
          status_changed_at?: string | null
          tags?: Json | null
          total_call_attempts?: number | null
          total_dispatches?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          city?: string | null
          company_id?: string
          created_at?: string | null
          duplicate_of?: string | null
          email?: string | null
          extra_data?: Json | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          last_call_at?: string | null
          last_call_id?: string | null
          last_call_result?: string | null
          last_dispatch_at?: string | null
          lead_name?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          lifecycle_id?: string | null
          next_call_at?: string | null
          opt_in_id?: string | null
          phone_number?: string
          priority?: number | null
          region?: string | null
          segment?: string | null
          source?: string
          source_detail?: string | null
          state?: string | null
          status?: string | null
          status_changed_at?: string | null
          tags?: Json | null
          total_call_attempts?: number | null
          total_dispatches?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_master_lifecycle_id_fkey"
            columns: ["lifecycle_id"]
            isOneToOne: false
            referencedRelation: "lead_whatsapp_lifecycle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_master_opt_in_id_fkey"
            columns: ["opt_in_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_opt_ins"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenances: {
        Row: {
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          description: string | null
          detected_at: string | null
          id: string
          issue_type: string
          notes: string | null
          priority: string
          resolved_at: string | null
          service_order_id: string | null
          status: string
          technician_id: string | null
          updated_at: string | null
          vehicle_model: string | null
          vehicle_plate: string
        }
        Insert: {
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          description?: string | null
          detected_at?: string | null
          id?: string
          issue_type: string
          notes?: string | null
          priority?: string
          resolved_at?: string | null
          service_order_id?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_plate: string
        }
        Update: {
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          description?: string | null
          detected_at?: string | null
          id?: string
          issue_type?: string
          notes?: string | null
          priority?: string
          resolved_at?: string | null
          service_order_id?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenances_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenances_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_type: string | null
          chip_id: string | null
          content: string | null
          conversation_id: string | null
          created_at: string | null
          delivery_status: string | null
          direction: string | null
          id: string
          media_mimetype: string | null
          media_type: string | null
          media_url: string | null
          message_id: string | null
          sender: string
        }
        Insert: {
          channel_type?: string | null
          chip_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          delivery_status?: string | null
          direction?: string | null
          id?: string
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender: string
        }
        Update: {
          channel_type?: string | null
          chip_id?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          delivery_status?: string | null
          direction?: string | null
          id?: string
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_quality_tracking: {
        Row: {
          blocks_24h: number | null
          checked_at: string | null
          company_id: string | null
          conversations_24h: number | null
          id: string
          messaging_limit_tier: string | null
          phone_number_id: string
          quality_rating: string | null
          reports_24h: number | null
          template_quality_scores: Json | null
          templates_paused: Json | null
          tier_limit: number | null
          usage_pct: number | null
        }
        Insert: {
          blocks_24h?: number | null
          checked_at?: string | null
          company_id?: string | null
          conversations_24h?: number | null
          id?: string
          messaging_limit_tier?: string | null
          phone_number_id: string
          quality_rating?: string | null
          reports_24h?: number | null
          template_quality_scores?: Json | null
          templates_paused?: Json | null
          tier_limit?: number | null
          usage_pct?: number | null
        }
        Update: {
          blocks_24h?: number | null
          checked_at?: string | null
          company_id?: string | null
          conversations_24h?: number | null
          id?: string
          messaging_limit_tier?: string | null
          phone_number_id?: string
          quality_rating?: string | null
          reports_24h?: number | null
          template_quality_scores?: Json | null
          templates_paused?: Json | null
          tier_limit?: number | null
          usage_pct?: number | null
        }
        Relationships: []
      }
      meta_rules: {
        Row: {
          applies_to: string[] | null
          category: string
          created_at: string | null
          description: string
          effective_from: string | null
          effective_until: string | null
          id: string
          is_active: boolean | null
          region: string[] | null
          rule_key: string
          severity: string | null
          source_url: string | null
          subcategory: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          applies_to?: string[] | null
          category: string
          created_at?: string | null
          description: string
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          region?: string[] | null
          rule_key: string
          severity?: string | null
          source_url?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          applies_to?: string[] | null
          category?: string
          created_at?: string | null
          description?: string
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          is_active?: boolean | null
          region?: string[] | null
          rule_key?: string
          severity?: string | null
          source_url?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      meta_tier_history: {
        Row: {
          changed_at: string | null
          company_id: string | null
          id: string
          new_quality: string | null
          new_tier: string | null
          notes: string | null
          old_quality: string | null
          old_tier: string | null
          phone_number_id: string
          trigger_event: string | null
        }
        Insert: {
          changed_at?: string | null
          company_id?: string | null
          id?: string
          new_quality?: string | null
          new_tier?: string | null
          notes?: string | null
          old_quality?: string | null
          old_tier?: string | null
          phone_number_id: string
          trigger_event?: string | null
        }
        Update: {
          changed_at?: string | null
          company_id?: string | null
          id?: string
          new_quality?: string | null
          new_tier?: string | null
          notes?: string | null
          old_quality?: string | null
          old_tier?: string | null
          phone_number_id?: string
          trigger_event?: string | null
        }
        Relationships: []
      }
      omnichannel_conversations: {
        Row: {
          assigned_agent_id: string | null
          assigned_at: string | null
          assigned_collaborator_id: string | null
          category: string | null
          channels_used: string[] | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          current_channel: string | null
          first_response_at: string | null
          first_response_sla_sec: number | null
          id: string
          last_message_at: string | null
          last_message_direction: string | null
          last_message_preview: string | null
          lead_id: string | null
          lead_score: number | null
          metadata: Json | null
          mode: string | null
          priority: string | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          sentiment: string | null
          sla_breached: boolean | null
          sla_deadline: string | null
          status: string | null
          tags: string[] | null
          total_messages: number | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_at?: string | null
          assigned_collaborator_id?: string | null
          category?: string | null
          channels_used?: string[] | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          current_channel?: string | null
          first_response_at?: string | null
          first_response_sla_sec?: number | null
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          lead_score?: number | null
          metadata?: Json | null
          mode?: string | null
          priority?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sentiment?: string | null
          sla_breached?: boolean | null
          sla_deadline?: string | null
          status?: string | null
          tags?: string[] | null
          total_messages?: number | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_at?: string | null
          assigned_collaborator_id?: string | null
          category?: string | null
          channels_used?: string[] | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          current_channel?: string | null
          first_response_at?: string | null
          first_response_sla_sec?: number | null
          id?: string
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          lead_score?: number | null
          metadata?: Json | null
          mode?: string | null
          priority?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sentiment?: string | null
          sla_breached?: boolean | null
          sla_deadline?: string | null
          status?: string | null
          tags?: string[] | null
          total_messages?: number | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnichannel_conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnichannel_conversations_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "v_agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "omnichannel_conversations_assigned_collaborator_id_fkey"
            columns: ["assigned_collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnichannel_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnichannel_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "omnichannel_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      omnichannel_messages: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean | null
          ai_model: string | null
          channel: string
          company_id: string
          content: string | null
          content_type: string
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          id: string
          media_file_name: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          metadata: Json | null
          sender_id: string | null
          sender_name: string | null
          sender_type: string
          source_external_id: string | null
          source_message_id: string | null
          source_table: string | null
          status: string | null
          template_name: string | null
          template_params: Json | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean | null
          ai_model?: string | null
          channel: string
          company_id: string
          content?: string | null
          content_type: string
          conversation_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          id?: string
          media_file_name?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          metadata?: Json | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type: string
          source_external_id?: string | null
          source_message_id?: string | null
          source_table?: string | null
          status?: string | null
          template_name?: string | null
          template_params?: Json | null
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean | null
          ai_model?: string | null
          channel?: string
          company_id?: string
          content?: string | null
          content_type?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_file_name?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          metadata?: Json | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: string
          source_external_id?: string | null
          source_message_id?: string | null
          source_table?: string | null
          status?: string | null
          template_name?: string | null
          template_params?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "omnichannel_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnichannel_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "omnichannel_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "omnichannel_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnichannel_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_active_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_installments: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          order_id: string | null
          paid_at: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_installments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number
          total_price: number | null
          unit_price: number
        }
        Insert: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity: number
          total_price?: number | null
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity?: number
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          installments: number | null
          notes: string | null
          order_number: string
          shipped_at: string | null
          shipping_tracking: string | null
          status: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          order_number: string
          shipped_at?: string | null
          shipping_tracking?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          order_number?: string
          shipped_at?: string | null
          shipping_tracking?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_config: {
        Row: {
          after_hours_action: string | null
          after_hours_target: string | null
          business_hours: Json | null
          call_parking_enabled: boolean | null
          call_queue_max_size: number | null
          call_queue_strategy: string | null
          call_queue_timeout_sec: number | null
          caller_id_mode: string | null
          company_id: string
          created_at: string
          custom_caller_id: string | null
          features: Json | null
          id: string
          intercom_enabled: boolean | null
          max_concurrent_calls: number | null
          music_on_hold_url: string | null
          recording_consent_audio_url: string | null
          recording_consent_prompt: boolean | null
          recording_policy: string | null
          ring_timeout_sec: number | null
          updated_at: string
          voicemail_email_notification: boolean | null
          voicemail_enabled: boolean | null
          voicemail_greeting_url: string | null
          voicemail_max_duration_sec: number | null
        }
        Insert: {
          after_hours_action?: string | null
          after_hours_target?: string | null
          business_hours?: Json | null
          call_parking_enabled?: boolean | null
          call_queue_max_size?: number | null
          call_queue_strategy?: string | null
          call_queue_timeout_sec?: number | null
          caller_id_mode?: string | null
          company_id: string
          created_at?: string
          custom_caller_id?: string | null
          features?: Json | null
          id?: string
          intercom_enabled?: boolean | null
          max_concurrent_calls?: number | null
          music_on_hold_url?: string | null
          recording_consent_audio_url?: string | null
          recording_consent_prompt?: boolean | null
          recording_policy?: string | null
          ring_timeout_sec?: number | null
          updated_at?: string
          voicemail_email_notification?: boolean | null
          voicemail_enabled?: boolean | null
          voicemail_greeting_url?: string | null
          voicemail_max_duration_sec?: number | null
        }
        Update: {
          after_hours_action?: string | null
          after_hours_target?: string | null
          business_hours?: Json | null
          call_parking_enabled?: boolean | null
          call_queue_max_size?: number | null
          call_queue_strategy?: string | null
          call_queue_timeout_sec?: number | null
          caller_id_mode?: string | null
          company_id?: string
          created_at?: string
          custom_caller_id?: string | null
          features?: Json | null
          id?: string
          intercom_enabled?: boolean | null
          max_concurrent_calls?: number | null
          music_on_hold_url?: string | null
          recording_consent_audio_url?: string | null
          recording_consent_prompt?: boolean | null
          recording_policy?: string | null
          ring_timeout_sec?: number | null
          updated_at?: string
          voicemail_email_notification?: boolean | null
          voicemail_enabled?: boolean | null
          voicemail_greeting_url?: string | null
          voicemail_max_duration_sec?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      plano_produtos: {
        Row: {
          ativo: boolean | null
          categoria: string
          coberturas: Json | null
          created_at: string | null
          descricao: string | null
          id: string
          imagem_url: string | null
          nome: string
          regional: string | null
          regras_especiais: string | null
          valor_base: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string
          coberturas?: Json | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          nome: string
          regional?: string | null
          regras_especiais?: string | null
          valor_base?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          coberturas?: Json | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          nome?: string
          regional?: string | null
          regras_especiais?: string | null
          valor_base?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          brand: string | null
          created_at: string | null
          id: string
          model: string
          name: string
          type: string
          unit_cost: number | null
          unit_price: number | null
        }
        Insert: {
          active?: boolean | null
          brand?: string | null
          created_at?: string | null
          id?: string
          model: string
          name: string
          type?: string
          unit_cost?: number | null
          unit_price?: number | null
        }
        Update: {
          active?: boolean | null
          brand?: string | null
          created_at?: string | null
          id?: string
          model?: string
          name?: string
          type?: string
          unit_cost?: number | null
          unit_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      prospection_messages: {
        Row: {
          chip_id: string | null
          consultant_id: string | null
          created_at: string | null
          delivery_status: string | null
          id: string
          lead_id: string | null
          lead_name: string | null
          lead_phone: string | null
          lead_source: string | null
          message_id: string | null
          message_sent: string | null
          message_template: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          chip_id?: string | null
          consultant_id?: string | null
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_source?: string | null
          message_id?: string | null
          message_sent?: string | null
          message_template?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          chip_id?: string | null
          consultant_id?: string | null
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          lead_source?: string | null
          message_id?: string | null
          message_sent?: string | null
          message_template?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospection_messages_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospection_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      proxy_logs: {
        Row: {
          action: string
          chip_id: string | null
          created_at: string | null
          error_message: string | null
          external_ip: string | null
          id: string
          ip_city: string | null
          ip_country: string | null
          ip_region: string | null
          proxy_url_used: string | null
          success: boolean | null
        }
        Insert: {
          action: string
          chip_id?: string | null
          created_at?: string | null
          error_message?: string | null
          external_ip?: string | null
          id?: string
          ip_city?: string | null
          ip_country?: string | null
          ip_region?: string | null
          proxy_url_used?: string | null
          success?: boolean | null
        }
        Update: {
          action?: string
          chip_id?: string | null
          created_at?: string | null
          error_message?: string | null
          external_ip?: string | null
          id?: string
          ip_city?: string | null
          ip_country?: string | null
          ip_region?: string | null
          proxy_url_used?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      role_agent_access: {
        Row: {
          agent_id: string
          created_at: string | null
          granted: boolean | null
          id: string
          role_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
          role_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_agent_access_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_agent_access_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "role_agent_access_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          active: boolean | null
          can_manage_agents: boolean | null
          can_view_all_units: boolean | null
          can_view_own_only: boolean | null
          can_view_own_unit: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          level: number
          name: string
          sector_id: string | null
          slug: string
          usage_limits: Json | null
        }
        Insert: {
          active?: boolean | null
          can_manage_agents?: boolean | null
          can_view_all_units?: boolean | null
          can_view_own_only?: boolean | null
          can_view_own_unit?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          level?: number
          name: string
          sector_id?: string | null
          slug: string
          usage_limits?: Json | null
        }
        Update: {
          active?: boolean | null
          can_manage_agents?: boolean | null
          can_view_all_units?: boolean | null
          can_view_own_only?: boolean | null
          can_view_own_unit?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          level?: number
          name?: string
          sector_id?: string | null
          slug?: string
          usage_limits?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "roles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      rotation_channels: {
        Row: {
          chip_id: string | null
          collaborator_id: string
          created_at: string | null
          daily_limit: number | null
          id: string
          instance_name: string | null
          instance_token: string | null
          last_message_at: string | null
          messages_sent_today: number | null
          phone: string | null
          status: string | null
          uazapi_server_url: string | null
          updated_at: string | null
        }
        Insert: {
          chip_id?: string | null
          collaborator_id: string
          created_at?: string | null
          daily_limit?: number | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          last_message_at?: string | null
          messages_sent_today?: number | null
          phone?: string | null
          status?: string | null
          uazapi_server_url?: string | null
          updated_at?: string | null
        }
        Update: {
          chip_id?: string | null
          collaborator_id?: string
          created_at?: string | null
          daily_limit?: number | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          last_message_at?: string | null
          messages_sent_today?: number | null
          phone?: string | null
          status?: string | null
          uazapi_server_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rotation_channels_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_actions: {
        Row: {
          action_type: string
          company_id: string
          created_at: string | null
          error_message: string | null
          executed_at: string | null
          id: string
          lifecycle_id: string | null
          phone_number: string
          scheduled_for: string
          status: string | null
          template_slot: string | null
          template_variables: Json | null
        }
        Insert: {
          action_type: string
          company_id: string
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lifecycle_id?: string | null
          phone_number: string
          scheduled_for: string
          status?: string | null
          template_slot?: string | null
          template_variables?: Json | null
        }
        Update: {
          action_type?: string
          company_id?: string
          created_at?: string | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lifecycle_id?: string | null
          phone_number?: string
          scheduled_for?: string
          status?: string | null
          template_slot?: string | null
          template_variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_actions_lifecycle_id_fkey"
            columns: ["lifecycle_id"]
            isOneToOne: false
            referencedRelation: "lead_whatsapp_lifecycle"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sectors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      service_orders: {
        Row: {
          client_address: string
          client_city: string
          client_lat: number | null
          client_link_token: string | null
          client_lng: number | null
          client_name: string
          client_phone: string
          client_state: string
          completed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          product_id: string | null
          scheduled_at: string
          service_number: string
          service_rate: number | null
          started_at: string | null
          status: string
          tech_last_location_at: string | null
          tech_lat: number | null
          tech_link_token: string | null
          tech_lng: number | null
          technician_accepted_at: string | null
          technician_id: string | null
          updated_at: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
        }
        Insert: {
          client_address: string
          client_city: string
          client_lat?: number | null
          client_link_token?: string | null
          client_lng?: number | null
          client_name: string
          client_phone: string
          client_state: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          scheduled_at: string
          service_number: string
          service_rate?: number | null
          started_at?: string | null
          status?: string
          tech_last_location_at?: string | null
          tech_lat?: number | null
          tech_link_token?: string | null
          tech_lng?: number | null
          technician_accepted_at?: string | null
          technician_id?: string | null
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          client_address?: string
          client_city?: string
          client_lat?: number | null
          client_link_token?: string | null
          client_lng?: number | null
          client_name?: string
          client_phone?: string
          client_state?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          scheduled_at?: string
          service_number?: string
          service_rate?: number | null
          started_at?: string | null
          status?: string
          tech_last_location_at?: string | null
          tech_lat?: number | null
          tech_link_token?: string | null
          tech_lng?: number | null
          technician_accepted_at?: string | null
          technician_id?: string | null
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_lines: {
        Row: {
          client_id: string | null
          created_at: string | null
          iccid: string
          id: string
          last_seen_at: string | null
          monthly_cost: number | null
          notes: string | null
          phone_number: string | null
          plan: string | null
          product_id: string | null
          provider: string
          status: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          iccid: string
          id?: string
          last_seen_at?: string | null
          monthly_cost?: number | null
          notes?: string | null
          phone_number?: string | null
          plan?: string | null
          product_id?: string | null
          provider: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          iccid?: string
          id?: string
          last_seen_at?: string | null
          monthly_cost?: number | null
          notes?: string | null
          phone_number?: string | null
          plan?: string | null
          product_id?: string | null
          provider?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sim_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sip_extensions: {
        Row: {
          auth_password_vault_id: string | null
          auth_username: string | null
          call_forward_number: string | null
          call_forward_on_busy: boolean | null
          call_forward_on_no_answer: boolean | null
          caller_id_override: string | null
          collaborator_id: string | null
          company_id: string
          created_at: string
          device_info: Json | null
          device_type: string | null
          display_name: string | null
          do_not_disturb: boolean | null
          extension_number: string
          id: string
          last_registered_at: string | null
          max_concurrent_calls: number | null
          no_answer_timeout_sec: number | null
          recording_policy: string | null
          status: string | null
          trunk_id: string
          updated_at: string
          voicemail_email: string | null
          voicemail_enabled: boolean | null
          voicemail_pin_vault_id: string | null
        }
        Insert: {
          auth_password_vault_id?: string | null
          auth_username?: string | null
          call_forward_number?: string | null
          call_forward_on_busy?: boolean | null
          call_forward_on_no_answer?: boolean | null
          caller_id_override?: string | null
          collaborator_id?: string | null
          company_id: string
          created_at?: string
          device_info?: Json | null
          device_type?: string | null
          display_name?: string | null
          do_not_disturb?: boolean | null
          extension_number: string
          id?: string
          last_registered_at?: string | null
          max_concurrent_calls?: number | null
          no_answer_timeout_sec?: number | null
          recording_policy?: string | null
          status?: string | null
          trunk_id: string
          updated_at?: string
          voicemail_email?: string | null
          voicemail_enabled?: boolean | null
          voicemail_pin_vault_id?: string | null
        }
        Update: {
          auth_password_vault_id?: string | null
          auth_username?: string | null
          call_forward_number?: string | null
          call_forward_on_busy?: boolean | null
          call_forward_on_no_answer?: boolean | null
          caller_id_override?: string | null
          collaborator_id?: string | null
          company_id?: string
          created_at?: string
          device_info?: Json | null
          device_type?: string | null
          display_name?: string | null
          do_not_disturb?: boolean | null
          extension_number?: string
          id?: string
          last_registered_at?: string | null
          max_concurrent_calls?: number | null
          no_answer_timeout_sec?: number | null
          recording_policy?: string | null
          status?: string | null
          trunk_id?: string
          updated_at?: string
          voicemail_email?: string | null
          voicemail_enabled?: boolean | null
          voicemail_pin_vault_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sip_extensions_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sip_extensions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sip_extensions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sip_extensions_trunk_id_fkey"
            columns: ["trunk_id"]
            isOneToOne: false
            referencedRelation: "sip_trunks"
            referencedColumns: ["id"]
          },
        ]
      }
      sip_trunks: {
        Row: {
          active_channels: number | null
          auth_password_vault_id: string | null
          auth_realm: string | null
          auth_username: string | null
          codecs: string[] | null
          company_id: string
          created_at: string
          dtmf_mode: string | null
          failover_trunk_id: string | null
          id: string
          inbound_did_pattern: string | null
          is_active: boolean | null
          keep_alive_interval: number | null
          last_registered_at: string | null
          max_channels: number | null
          name: string
          nat_traversal: boolean | null
          outbound_proxy: string | null
          provider: string
          registration_required: boolean | null
          registration_status: string | null
          sip_host: string
          sip_port: number | null
          sip_transport: string | null
          stun_server: string | null
          updated_at: string
        }
        Insert: {
          active_channels?: number | null
          auth_password_vault_id?: string | null
          auth_realm?: string | null
          auth_username?: string | null
          codecs?: string[] | null
          company_id: string
          created_at?: string
          dtmf_mode?: string | null
          failover_trunk_id?: string | null
          id?: string
          inbound_did_pattern?: string | null
          is_active?: boolean | null
          keep_alive_interval?: number | null
          last_registered_at?: string | null
          max_channels?: number | null
          name: string
          nat_traversal?: boolean | null
          outbound_proxy?: string | null
          provider: string
          registration_required?: boolean | null
          registration_status?: string | null
          sip_host: string
          sip_port?: number | null
          sip_transport?: string | null
          stun_server?: string | null
          updated_at?: string
        }
        Update: {
          active_channels?: number | null
          auth_password_vault_id?: string | null
          auth_realm?: string | null
          auth_username?: string | null
          codecs?: string[] | null
          company_id?: string
          created_at?: string
          dtmf_mode?: string | null
          failover_trunk_id?: string | null
          id?: string
          inbound_did_pattern?: string | null
          is_active?: boolean | null
          keep_alive_interval?: number | null
          last_registered_at?: string | null
          max_channels?: number | null
          name?: string
          nat_traversal?: boolean | null
          outbound_proxy?: string | null
          provider?: string
          registration_required?: boolean | null
          registration_status?: string | null
          sip_host?: string
          sip_port?: number | null
          sip_transport?: string | null
          stun_server?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sip_trunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sip_trunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "sip_trunks_failover_trunk_id_fkey"
            columns: ["failover_trunk_id"]
            isOneToOne: false
            referencedRelation: "sip_trunks"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_dispatches: {
        Row: {
          collaborator_id: string | null
          company_id: string | null
          created_at: string | null
          delivered_at: string | null
          dispatch_reason: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          lead_name: string | null
          lifecycle_id: string | null
          meta_message_id: string | null
          phone_number: string
          priority: number | null
          read_at: string | null
          replied_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          template_name: string
          template_params: Json | null
          updated_at: string | null
        }
        Insert: {
          collaborator_id?: string | null
          company_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          dispatch_reason?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          lead_name?: string | null
          lifecycle_id?: string | null
          meta_message_id?: string | null
          phone_number: string
          priority?: number | null
          read_at?: string | null
          replied_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          template_name: string
          template_params?: Json | null
          updated_at?: string | null
        }
        Update: {
          collaborator_id?: string | null
          company_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          dispatch_reason?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          lead_name?: string | null
          lifecycle_id?: string | null
          meta_message_id?: string | null
          phone_number?: string
          priority?: number | null
          read_at?: string | null
          replied_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          template_name?: string
          template_params?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_dispatches_lifecycle_id_fkey"
            columns: ["lifecycle_id"]
            isOneToOne: false
            referencedRelation: "lead_whatsapp_lifecycle"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      system_configs: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      tabela_cotas: {
        Row: {
          cota_valor: number
          created_at: string | null
          fipe_max: number
          fipe_min: number
          id: string
          produtos_vinculados: string | null
          taxa_admin: number
        }
        Insert: {
          cota_valor: number
          created_at?: string | null
          fipe_max: number
          fipe_min: number
          id?: string
          produtos_vinculados?: string | null
          taxa_admin: number
        }
        Update: {
          cota_valor?: number
          created_at?: string | null
          fipe_max?: number
          fipe_min?: number
          id?: string
          produtos_vinculados?: string | null
          taxa_admin?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          reference_id: string | null
          reference_type: string | null
          status: string
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      technician_inventory: {
        Row: {
          id: string
          product_id: string | null
          quantity: number
          technician_id: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          quantity?: number
          technician_id?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          quantity?: number
          technician_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_inventory_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_leads: {
        Row: {
          city: string
          cnae_code: string | null
          cnae_description: string | null
          cnpj: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          source: string | null
          state: string
          status: string
          updated_at: string | null
        }
        Insert: {
          city: string
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          state: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          city?: string
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          state?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      technicians: {
        Row: {
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          city: string
          cpf: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_period: string
          phone: string
          pix_key: string | null
          region: string | null
          service_rate: number | null
          state: string
          status: string
          updated_at: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          city: string
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_period?: string
          phone: string
          pix_key?: string | null
          region?: string | null
          service_rate?: number | null
          state: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          city?: string
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_period?: string
          phone?: string
          pix_key?: string | null
          region?: string | null
          service_rate?: number | null
          state?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      template_performance: {
        Row: {
          block_rate: number | null
          company_id: string | null
          created_at: string | null
          delivery_rate: number | null
          id: string
          last_calculated_at: string | null
          meta_quality_score: string | null
          performance_score: number | null
          read_rate: number | null
          reply_rate: number | null
          template_name: string
          total_blocked: number | null
          total_delivered: number | null
          total_opted_out: number | null
          total_read: number | null
          total_replied: number | null
          total_sent: number | null
        }
        Insert: {
          block_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          delivery_rate?: number | null
          id?: string
          last_calculated_at?: string | null
          meta_quality_score?: string | null
          performance_score?: number | null
          read_rate?: number | null
          reply_rate?: number | null
          template_name: string
          total_blocked?: number | null
          total_delivered?: number | null
          total_opted_out?: number | null
          total_read?: number | null
          total_replied?: number | null
          total_sent?: number | null
        }
        Update: {
          block_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          delivery_rate?: number | null
          id?: string
          last_calculated_at?: string | null
          meta_quality_score?: string | null
          performance_score?: number | null
          read_rate?: number | null
          reply_rate?: number | null
          template_name?: string
          total_blocked?: number | null
          total_delivered?: number | null
          total_opted_out?: number | null
          total_read?: number | null
          total_replied?: number | null
          total_sent?: number | null
        }
        Relationships: []
      }
      template_rejection_log: {
        Row: {
          ai_analysis: string | null
          ai_fix_suggestion: string | null
          category: string | null
          company_id: string | null
          id: string
          meta_error_code: string | null
          meta_error_message: string | null
          rejected_at: string | null
          rejection_reason: string | null
          template_content: Json
          template_name: string
        }
        Insert: {
          ai_analysis?: string | null
          ai_fix_suggestion?: string | null
          category?: string | null
          company_id?: string | null
          id?: string
          meta_error_code?: string | null
          meta_error_message?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          template_content: Json
          template_name: string
        }
        Update: {
          ai_analysis?: string | null
          ai_fix_suggestion?: string | null
          category?: string | null
          company_id?: string | null
          id?: string
          meta_error_code?: string | null
          meta_error_message?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          template_content?: Json
          template_name?: string
        }
        Relationships: []
      }
      template_slots: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          slot: string
          slot_label: string | null
          template_id: string | null
          template_name: string
          use_condition: Json | null
          variable_mapping: Json
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          slot: string
          slot_label?: string | null
          template_id?: string | null
          template_name: string
          use_condition?: Json | null
          variable_mapping?: Json
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          slot?: string
          slot_label?: string | null
          template_id?: string | null
          template_name?: string
          use_condition?: Json | null
          variable_mapping?: Json
        }
        Relationships: []
      }
      trilho_custos_operacionais: {
        Row: {
          categoria: string
          comprovante_url: string | null
          created_at: string | null
          data: string
          descricao: string | null
          id: string
          service_order_id: string | null
          technician_id: string | null
          valor: number
        }
        Insert: {
          categoria: string
          comprovante_url?: string | null
          created_at?: string | null
          data: string
          descricao?: string | null
          id?: string
          service_order_id?: string | null
          technician_id?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          comprovante_url?: string | null
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: string
          service_order_id?: string | null
          technician_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "trilho_custos_operacionais_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilho_custos_operacionais_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      trilho_fechamento_items: {
        Row: {
          created_at: string | null
          descricao: string
          fechamento_id: string
          id: string
          service_order_id: string | null
          tipo: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          descricao: string
          fechamento_id: string
          id?: string
          service_order_id?: string | null
          tipo?: string | null
          valor: number
        }
        Update: {
          created_at?: string | null
          descricao?: string
          fechamento_id?: string
          id?: string
          service_order_id?: string | null
          tipo?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "trilho_fechamento_items_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "trilho_fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilho_fechamento_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      trilho_fechamentos: {
        Row: {
          acrescimos: number | null
          aprovado_em: string | null
          aprovado_por: string | null
          comprovante_url: string | null
          created_at: string | null
          date_from: string
          date_to: string
          descontos: number | null
          id: string
          mes_referencia: string
          observacoes: string | null
          pago_em: string | null
          status: string | null
          technician_id: string
          total_atendimentos: number | null
          updated_at: string | null
          valor_liquido: number | null
          valor_total: number | null
        }
        Insert: {
          acrescimos?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          date_from: string
          date_to: string
          descontos?: number | null
          id?: string
          mes_referencia: string
          observacoes?: string | null
          pago_em?: string | null
          status?: string | null
          technician_id: string
          total_atendimentos?: number | null
          updated_at?: string | null
          valor_liquido?: number | null
          valor_total?: number | null
        }
        Update: {
          acrescimos?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          date_from?: string
          date_to?: string
          descontos?: number | null
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          pago_em?: string | null
          status?: string | null
          technician_id?: string
          total_atendimentos?: number | null
          updated_at?: string | null
          valor_liquido?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trilho_fechamentos_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      uazapi_accounts: {
        Row: {
          account_key: string
          active: boolean | null
          admin_token: string
          api_url: string
          created_at: string | null
          description: string | null
          id: string
          max_instances: number | null
          updated_at: string | null
        }
        Insert: {
          account_key: string
          active?: boolean | null
          admin_token?: string
          api_url: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_instances?: number | null
          updated_at?: string | null
        }
        Update: {
          account_key?: string
          active?: boolean | null
          admin_token?: string
          api_url?: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_instances?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          active: boolean | null
          city: string | null
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          state: string | null
        }
        Insert: {
          active?: boolean | null
          city?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          state?: string | null
        }
        Update: {
          active?: boolean | null
          city?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          associado_id: string | null
          created_at: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
          vehicle_id: string | null
        }
        Insert: {
          associado_id?: string | null
          created_at?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo: string
          vehicle_id?: string | null
        }
        Update: {
          associado_id?: string | null
          created_at?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
          vehicle_id?: string | null
        }
        Relationships: []
      }
      video_edits: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          cuts_count: number | null
          edited_duration: number | null
          ffmpeg_command: string | null
          id: string
          original_duration: number | null
          output_storage_path: string | null
          output_url: string | null
          removed_reasons: Json | null
          removed_seconds: number | null
          segments: Json | null
          status: string | null
          storage_path: string | null
          transcript_text: string | null
          updated_at: string | null
          video_url: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cuts_count?: number | null
          edited_duration?: number | null
          ffmpeg_command?: string | null
          id?: string
          original_duration?: number | null
          output_storage_path?: string | null
          output_url?: string | null
          removed_reasons?: Json | null
          removed_seconds?: number | null
          segments?: Json | null
          status?: string | null
          storage_path?: string | null
          transcript_text?: string | null
          updated_at?: string | null
          video_url: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          cuts_count?: number | null
          edited_duration?: number | null
          ffmpeg_command?: string | null
          id?: string
          original_duration?: number | null
          output_storage_path?: string | null
          output_url?: string | null
          removed_reasons?: Json | null
          removed_seconds?: number | null
          segments?: Json | null
          status?: string | null
          storage_path?: string | null
          transcript_text?: string | null
          updated_at?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_edits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_edits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      voice_messages: {
        Row: {
          audio_url: string | null
          created_at: string
          duration_ms: number | null
          id: string
          text_content: string
          text_hash: string
          voice_key: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          text_content: string
          text_hash: string
          voice_key: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          text_content?: string
          text_hash?: string
          voice_key?: string
        }
        Relationships: []
      }
      voice_profiles: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          gender: string
          id: string
          language: string
          provider: string
          speed: number
          voice_id: string
          voice_key: string
          voice_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          gender: string
          id?: string
          language?: string
          provider?: string
          speed?: number
          voice_id: string
          voice_key: string
          voice_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          gender?: string
          id?: string
          language?: string
          provider?: string
          speed?: number
          voice_id?: string
          voice_key?: string
          voice_name?: string
        }
        Relationships: []
      }
      wa_conversations: {
        Row: {
          analysis: Json | null
          assigned_human_id: string | null
          call_id: string | null
          company_id: string | null
          created_at: string | null
          human_mode: boolean | null
          id: string
          last_message: string | null
          last_message_at: string | null
          lead_name: string | null
          phone: string
          status: string | null
          turn_count: number | null
          updated_at: string | null
        }
        Insert: {
          analysis?: Json | null
          assigned_human_id?: string | null
          call_id?: string | null
          company_id?: string | null
          created_at?: string | null
          human_mode?: boolean | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_name?: string | null
          phone: string
          status?: string | null
          turn_count?: number | null
          updated_at?: string | null
        }
        Update: {
          analysis?: Json | null
          assigned_human_id?: string | null
          call_id?: string | null
          company_id?: string | null
          created_at?: string | null
          human_mode?: boolean | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lead_name?: string | null
          phone?: string
          status?: string | null
          turn_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wa_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          meta_message_id: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          meta_message_id?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          meta_message_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_debug_logs: {
        Row: {
          created_at: string | null
          headers: string | null
          id: string
          payload: string | null
        }
        Insert: {
          created_at?: string | null
          headers?: string | null
          id?: string
          payload?: string | null
        }
        Update: {
          created_at?: string | null
          headers?: string | null
          id?: string
          payload?: string | null
        }
        Relationships: []
      }
      whatsapp_ai_conversations: {
        Row: {
          company_id: string | null
          conversation_context: Json | null
          created_at: string | null
          handed_off_to: string | null
          handoff_reason: string | null
          id: string
          lifecycle_id: string | null
          messages_in_session: number | null
          phone_number: string
          status: string | null
          system_prompt: string | null
          updated_at: string | null
          window_expires_at: string | null
          window_opened_at: string | null
        }
        Insert: {
          company_id?: string | null
          conversation_context?: Json | null
          created_at?: string | null
          handed_off_to?: string | null
          handoff_reason?: string | null
          id?: string
          lifecycle_id?: string | null
          messages_in_session?: number | null
          phone_number: string
          status?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          window_expires_at?: string | null
          window_opened_at?: string | null
        }
        Update: {
          company_id?: string | null
          conversation_context?: Json | null
          created_at?: string | null
          handed_off_to?: string | null
          handoff_reason?: string | null
          id?: string
          lifecycle_id?: string | null
          messages_in_session?: number | null
          phone_number?: string
          status?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          window_expires_at?: string | null
          window_opened_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_conversations_lifecycle_id_fkey"
            columns: ["lifecycle_id"]
            isOneToOne: false
            referencedRelation: "lead_whatsapp_lifecycle"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_ai_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          message_type: string | null
          model_used: string | null
          role: string
          tokens_used: number | null
          wa_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          model_used?: string | null
          role: string
          tokens_used?: number | null
          wa_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          model_used?: string | null
          role?: string
          tokens_used?: number | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_conversations: {
        Row: {
          collaborator_id: string
          contact_name: string | null
          contact_phone: string
          created_at: string | null
          history: Json | null
          id: string
          last_message_at: string | null
          message_count: number | null
          summary: string | null
        }
        Insert: {
          collaborator_id: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string | null
          history?: Json | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          summary?: string | null
        }
        Update: {
          collaborator_id?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string | null
          history?: Json | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_conversations_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          agent_id: string | null
          consultant_id: string | null
          created_at: string | null
          id: string
          instance_name: string | null
          lead_score: number | null
          mode: string | null
          remote_jid: string | null
          sender_name: string | null
          sender_phone: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          consultant_id?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string | null
          lead_score?: number | null
          mode?: string | null
          remote_jid?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          consultant_id?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string | null
          lead_score?: number | null
          mode?: string | null
          remote_jid?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "v_agent_performance"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          bot_enabled: boolean | null
          chip_type: string | null
          collaborator_id: string
          created_at: string | null
          id: string
          instance_name: string
          instance_token: string | null
          phone_number: string | null
          qr_code: string | null
          status: string | null
          uazapi_server_url: string | null
          updated_at: string | null
        }
        Insert: {
          bot_enabled?: boolean | null
          chip_type?: string | null
          collaborator_id: string
          created_at?: string | null
          id?: string
          instance_name: string
          instance_token?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          uazapi_server_url?: string | null
          updated_at?: string | null
        }
        Update: {
          bot_enabled?: boolean | null
          chip_type?: string | null
          collaborator_id?: string
          created_at?: string | null
          id?: string
          instance_name?: string
          instance_token?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          uazapi_server_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          ai_generated: boolean | null
          call_id: string | null
          company_id: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          direction: string | null
          from_number: string | null
          id: string
          lead_id: string | null
          message_type: string | null
          meta_cost: number | null
          role: string
          sender_name: string | null
          sender_phone: string | null
          status: string | null
          template_name: string | null
          to_number: string | null
          wamid: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          call_id?: string | null
          company_id?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          direction?: string | null
          from_number?: string | null
          id?: string
          lead_id?: string | null
          message_type?: string | null
          meta_cost?: number | null
          role: string
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          template_name?: string | null
          to_number?: string | null
          wamid?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          call_id?: string | null
          company_id?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          direction?: string | null
          from_number?: string | null
          id?: string
          lead_id?: string | null
          message_type?: string | null
          meta_cost?: number | null
          role?: string
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          template_name?: string | null
          to_number?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_conversations_billing: {
        Row: {
          category: string
          company_id: string
          contact_name: string | null
          contact_phone: string
          cost_brl: number | null
          created_at: string
          first_message_wamid: string | null
          free_entry_point_type: string | null
          id: string
          is_billable: boolean | null
          is_free_entry_point: boolean | null
          is_free_tier: boolean | null
          message_count: number | null
          meta_conversation_id: string
          origin: string
          phone_number_id: string | null
          pricing_model: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          category: string
          company_id: string
          contact_name?: string | null
          contact_phone: string
          cost_brl?: number | null
          created_at?: string
          first_message_wamid?: string | null
          free_entry_point_type?: string | null
          id?: string
          is_billable?: boolean | null
          is_free_entry_point?: boolean | null
          is_free_tier?: boolean | null
          message_count?: number | null
          meta_conversation_id: string
          origin: string
          phone_number_id?: string | null
          pricing_model?: string | null
          window_end: string
          window_start: string
        }
        Update: {
          category?: string
          company_id?: string
          contact_name?: string | null
          contact_phone?: string
          cost_brl?: number | null
          created_at?: string
          first_message_wamid?: string | null
          free_entry_point_type?: string | null
          id?: string
          is_billable?: boolean | null
          is_free_entry_point?: boolean | null
          is_free_tier?: boolean | null
          message_count?: number | null
          meta_conversation_id?: string
          origin?: string
          phone_number_id?: string | null
          pricing_model?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_conversations_billing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_conversations_billing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_meta_conversations_billing_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_credentials: {
        Row: {
          api_version: string | null
          app_id: string | null
          app_secret_vault_id: string | null
          business_id: string | null
          certificate_expiry: string | null
          certificate_pem: string | null
          company_id: string | null
          created_at: string | null
          embedded_signup_enabled: boolean | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          messaging_limit_tier: string | null
          meta_access_token: string
          meta_display_phone: string | null
          meta_phone_number_id: string
          meta_waba_id: string
          onboarding_status: string | null
          quality_rating: string | null
          solution_id: string | null
          system_user_token_vault_id: string | null
          updated_at: string | null
          webhook_secret: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          api_version?: string | null
          app_id?: string | null
          app_secret_vault_id?: string | null
          business_id?: string | null
          certificate_expiry?: string | null
          certificate_pem?: string | null
          company_id?: string | null
          created_at?: string | null
          embedded_signup_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          messaging_limit_tier?: string | null
          meta_access_token: string
          meta_display_phone?: string | null
          meta_phone_number_id: string
          meta_waba_id: string
          onboarding_status?: string | null
          quality_rating?: string | null
          solution_id?: string | null
          system_user_token_vault_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          api_version?: string | null
          app_id?: string | null
          app_secret_vault_id?: string | null
          business_id?: string | null
          certificate_expiry?: string | null
          certificate_pem?: string | null
          company_id?: string | null
          created_at?: string | null
          embedded_signup_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          messaging_limit_tier?: string | null
          meta_access_token?: string
          meta_display_phone?: string | null
          meta_phone_number_id?: string
          meta_waba_id?: string
          onboarding_status?: string | null
          quality_rating?: string | null
          solution_id?: string | null
          system_user_token_vault_id?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      whatsapp_meta_messages: {
        Row: {
          body: string | null
          company_id: string | null
          context: Json | null
          conversation_origin: string | null
          conversation_type: string | null
          cost_brl: number | null
          created_at: string | null
          delivered_at: string | null
          direction: string
          error_code: string | null
          error_details: Json | null
          error_title: string | null
          failed_at: string | null
          frequently_forwarded: boolean | null
          id: string
          is_billable: boolean | null
          is_forwarded: boolean | null
          media_url: string | null
          message_id: string
          meta_conversation_id: string | null
          metadata: Json | null
          opt_in_id: string | null
          phone_from: string
          phone_number_fk: string | null
          phone_number_id: string | null
          phone_to: string
          pricing_category: string | null
          reaction_emoji: string | null
          read_at: string | null
          reply_to_wamid: string | null
          sent_at: string | null
          status: string | null
          template_id: string | null
          template_name: string | null
          template_params: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          context?: Json | null
          conversation_origin?: string | null
          conversation_type?: string | null
          cost_brl?: number | null
          created_at?: string | null
          delivered_at?: string | null
          direction: string
          error_code?: string | null
          error_details?: Json | null
          error_title?: string | null
          failed_at?: string | null
          frequently_forwarded?: boolean | null
          id?: string
          is_billable?: boolean | null
          is_forwarded?: boolean | null
          media_url?: string | null
          message_id: string
          meta_conversation_id?: string | null
          metadata?: Json | null
          opt_in_id?: string | null
          phone_from: string
          phone_number_fk?: string | null
          phone_number_id?: string | null
          phone_to: string
          pricing_category?: string | null
          reaction_emoji?: string | null
          read_at?: string | null
          reply_to_wamid?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          template_name?: string | null
          template_params?: Json | null
          type: string
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string | null
          context?: Json | null
          conversation_origin?: string | null
          conversation_type?: string | null
          cost_brl?: number | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_code?: string | null
          error_details?: Json | null
          error_title?: string | null
          failed_at?: string | null
          frequently_forwarded?: boolean | null
          id?: string
          is_billable?: boolean | null
          is_forwarded?: boolean | null
          media_url?: string | null
          message_id?: string
          meta_conversation_id?: string | null
          metadata?: Json | null
          opt_in_id?: string | null
          phone_from?: string
          phone_number_fk?: string | null
          phone_number_id?: string | null
          phone_to?: string
          pricing_category?: string | null
          reaction_emoji?: string | null
          read_at?: string | null
          reply_to_wamid?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          template_name?: string | null
          template_params?: Json | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_meta_messages_opt_in_id_fkey"
            columns: ["opt_in_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_opt_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_messages_phone_number_fk_fkey"
            columns: ["phone_number_fk"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_opt_ins: {
        Row: {
          company_id: string
          consent_ip: unknown
          consent_marketing: boolean | null
          consent_support: boolean | null
          consent_text: string
          consent_transactional: boolean | null
          consent_user_agent: string | null
          contact_name: string | null
          created_at: string
          id: string
          is_active: boolean | null
          lgpd_anonymized: boolean | null
          lgpd_data_purpose: string | null
          lgpd_deletion_completed_at: string | null
          lgpd_deletion_requested_at: string | null
          lgpd_legal_basis: string | null
          lgpd_retention_days: number | null
          opt_in_method: string
          opt_in_source: string | null
          opted_in_at: string
          opted_out_at: string | null
          phone_number: string
          proof_document_url: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          consent_ip?: unknown
          consent_marketing?: boolean | null
          consent_support?: boolean | null
          consent_text: string
          consent_transactional?: boolean | null
          consent_user_agent?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          lgpd_anonymized?: boolean | null
          lgpd_data_purpose?: string | null
          lgpd_deletion_completed_at?: string | null
          lgpd_deletion_requested_at?: string | null
          lgpd_legal_basis?: string | null
          lgpd_retention_days?: number | null
          opt_in_method: string
          opt_in_source?: string | null
          opted_in_at?: string
          opted_out_at?: string | null
          phone_number: string
          proof_document_url?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          consent_ip?: unknown
          consent_marketing?: boolean | null
          consent_support?: boolean | null
          consent_text?: string
          consent_transactional?: boolean | null
          consent_user_agent?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          lgpd_anonymized?: boolean | null
          lgpd_data_purpose?: string | null
          lgpd_deletion_completed_at?: string | null
          lgpd_deletion_requested_at?: string | null
          lgpd_legal_basis?: string | null
          lgpd_retention_days?: number | null
          opt_in_method?: string
          opt_in_source?: string | null
          opted_in_at?: string
          opted_out_at?: string | null
          phone_number?: string
          proof_document_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_opt_ins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_opt_ins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      whatsapp_meta_phone_numbers: {
        Row: {
          code_verification_status: string | null
          company_id: string
          created_at: string
          credential_id: string
          display_phone: string
          id: string
          is_official_business_account: boolean | null
          is_pin_enabled: boolean | null
          last_onboarded_at: string | null
          max_msgs_per_second: number | null
          messaging_limit: number | null
          messaging_limit_tier: string | null
          name_status: string | null
          phone_number_id: string
          platform_type: string | null
          quality_rating: string | null
          status: string | null
          throughput_level: string | null
          updated_at: string
          verified_name: string | null
          webhook_url: string | null
        }
        Insert: {
          code_verification_status?: string | null
          company_id: string
          created_at?: string
          credential_id: string
          display_phone: string
          id?: string
          is_official_business_account?: boolean | null
          is_pin_enabled?: boolean | null
          last_onboarded_at?: string | null
          max_msgs_per_second?: number | null
          messaging_limit?: number | null
          messaging_limit_tier?: string | null
          name_status?: string | null
          phone_number_id: string
          platform_type?: string | null
          quality_rating?: string | null
          status?: string | null
          throughput_level?: string | null
          updated_at?: string
          verified_name?: string | null
          webhook_url?: string | null
        }
        Update: {
          code_verification_status?: string | null
          company_id?: string
          created_at?: string
          credential_id?: string
          display_phone?: string
          id?: string
          is_official_business_account?: boolean | null
          is_pin_enabled?: boolean | null
          last_onboarded_at?: string | null
          max_msgs_per_second?: number | null
          messaging_limit?: number | null
          messaging_limit_tier?: string | null
          name_status?: string | null
          phone_number_id?: string
          platform_type?: string | null
          quality_rating?: string | null
          status?: string | null
          throughput_level?: string | null
          updated_at?: string
          verified_name?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_phone_numbers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_phone_numbers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_meta_phone_numbers_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_quality_signals: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          company_id: string
          created_at: string
          details: Json | null
          id: string
          new_value: string | null
          old_value: string | null
          phone_number_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: string | null
          signal_type: string
          source: string | null
          template_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          company_id: string
          created_at?: string
          details?: Json | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          phone_number_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string | null
          signal_type: string
          source?: string | null
          template_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          company_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          phone_number_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string | null
          signal_type?: string
          source?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_quality_signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_quality_signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_meta_quality_signals_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_quality_signals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_rate_limits: {
        Row: {
          company_id: string
          created_at: string
          current_window_count: number | null
          id: string
          is_throttled: boolean | null
          last_reset_at: string | null
          last_violation_at: string | null
          limit_type: string
          max_per_day: number | null
          max_per_second: number | null
          phone_number_id: string | null
          throttled_until: string | null
          updated_at: string
          violation_count: number | null
          window_duration_seconds: number | null
          window_start: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_window_count?: number | null
          id?: string
          is_throttled?: boolean | null
          last_reset_at?: string | null
          last_violation_at?: string | null
          limit_type: string
          max_per_day?: number | null
          max_per_second?: number | null
          phone_number_id?: string | null
          throttled_until?: string | null
          updated_at?: string
          violation_count?: number | null
          window_duration_seconds?: number | null
          window_start?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_window_count?: number | null
          id?: string
          is_throttled?: boolean | null
          last_reset_at?: string | null
          last_violation_at?: string | null
          limit_type?: string
          max_per_day?: number | null
          max_per_second?: number | null
          phone_number_id?: string | null
          throttled_until?: string | null
          updated_at?: string
          violation_count?: number | null
          window_duration_seconds?: number | null
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_rate_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_rate_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_meta_rate_limits_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_templates: {
        Row: {
          approved_at: string | null
          category: string
          company_id: string
          components: Json
          created_at: string
          cta_url_link_tracking_opted_out: boolean | null
          example_values: Json | null
          id: string
          language: string
          last_sent_at: string | null
          message_send_ttl_seconds: number | null
          meta_template_id: string | null
          name: string
          phone_number_id: string | null
          previous_category: string | null
          quality_score: string | null
          rejection_reason: string | null
          status: string | null
          sub_category: string | null
          total_delivered: number | null
          total_failed: number | null
          total_read: number | null
          total_sent: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          category: string
          company_id: string
          components?: Json
          created_at?: string
          cta_url_link_tracking_opted_out?: boolean | null
          example_values?: Json | null
          id?: string
          language?: string
          last_sent_at?: string | null
          message_send_ttl_seconds?: number | null
          meta_template_id?: string | null
          name: string
          phone_number_id?: string | null
          previous_category?: string | null
          quality_score?: string | null
          rejection_reason?: string | null
          status?: string | null
          sub_category?: string | null
          total_delivered?: number | null
          total_failed?: number | null
          total_read?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          category?: string
          company_id?: string
          components?: Json
          created_at?: string
          cta_url_link_tracking_opted_out?: boolean | null
          example_values?: Json | null
          id?: string
          language?: string
          last_sent_at?: string | null
          message_send_ttl_seconds?: number | null
          meta_template_id?: string | null
          name?: string
          phone_number_id?: string | null
          previous_category?: string | null
          quality_score?: string | null
          rejection_reason?: string | null
          status?: string | null
          sub_category?: string | null
          total_delivered?: number | null
          total_failed?: number | null
          total_read?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "whatsapp_meta_templates_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_meta_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_webhook_events: {
        Row: {
          company_id: string | null
          error_message: string | null
          event_subtype: string | null
          event_type: string
          from_phone: string | null
          id: string
          idempotency_key: string | null
          payload: Json
          phone_number_id: string | null
          processed_at: string | null
          processing_status: string | null
          received_at: string
          retry_count: number | null
          to_phone: string | null
          wamid: string | null
        }
        Insert: {
          company_id?: string | null
          error_message?: string | null
          event_subtype?: string | null
          event_type: string
          from_phone?: string | null
          id?: string
          idempotency_key?: string | null
          payload: Json
          phone_number_id?: string | null
          processed_at?: string | null
          processing_status?: string | null
          received_at?: string
          retry_count?: number | null
          to_phone?: string | null
          wamid?: string | null
        }
        Update: {
          company_id?: string | null
          error_message?: string | null
          event_subtype?: string | null
          event_type?: string
          from_phone?: string | null
          id?: string
          idempotency_key?: string | null
          payload?: Json
          phone_number_id?: string | null
          processed_at?: string | null
          processing_status?: string | null
          received_at?: string
          retry_count?: number | null
          to_phone?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_meta_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_meta_webhook_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      whatsapp_opt_ins: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          lead_name: string | null
          opt_in_at: string | null
          opt_in_proof: string | null
          opt_in_proof_type: string | null
          opt_in_source: string
          opt_out_at: string | null
          opt_out_reason: string | null
          phone_number: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          lead_name?: string | null
          opt_in_at?: string | null
          opt_in_proof?: string | null
          opt_in_proof_type?: string | null
          opt_in_source: string
          opt_out_at?: string | null
          opt_out_reason?: string | null
          phone_number: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          lead_name?: string | null
          opt_in_at?: string | null
          opt_in_proof?: string | null
          opt_in_proof_type?: string | null
          opt_in_source?: string
          opt_out_at?: string | null
          opt_out_reason?: string | null
          phone_number?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_active_conversations: {
        Row: {
          assigned_agent_name: string | null
          assigned_collaborator_name: string | null
          channels_used: string[] | null
          company_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          current_channel: string | null
          id: string | null
          last_message_at: string | null
          last_message_direction: string | null
          last_message_preview: string | null
          mode: string | null
          priority: string | null
          sentiment: string | null
          sla_breached: boolean | null
          sla_deadline: string | null
          status: string | null
          tags: string[] | null
          unread_count: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omnichannel_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnichannel_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_agent_performance: {
        Row: {
          active_conversations: number | null
          agent_id: string | null
          agent_name: string | null
          agent_type: string | null
          company_id: string | null
          last_activity_at: string | null
          omnichannel_conversations: number | null
          resolved_conversations: number | null
          total_conversations: number | null
          total_messages: number | null
          whatsapp_conversations: number | null
        }
        Insert: {
          active_conversations?: never
          agent_id?: string | null
          agent_name?: string | null
          agent_type?: string | null
          company_id?: string | null
          last_activity_at?: never
          omnichannel_conversations?: never
          resolved_conversations?: never
          total_conversations?: never
          total_messages?: never
          whatsapp_conversations?: never
        }
        Update: {
          active_conversations?: never
          agent_id?: string | null
          agent_name?: string | null
          agent_type?: string | null
          company_id?: string | null
          last_activity_at?: never
          omnichannel_conversations?: never
          resolved_conversations?: never
          total_conversations?: never
          total_messages?: never
          whatsapp_conversations?: never
        }
        Relationships: [
          {
            foreignKeyName: "agent_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_all_whatsapp_messages: {
        Row: {
          company_id: string | null
          content: string | null
          cost_brl: number | null
          created_at: string | null
          direction: string | null
          from_number: string | null
          id: string | null
          media_url: string | null
          message_type: string | null
          pricing_category: string | null
          source: string | null
          status: string | null
          template_name: string | null
          to_number: string | null
        }
        Relationships: []
      }
      v_company_whatsapp_health: {
        Row: {
          active_opt_ins: number | null
          approved_templates: number | null
          company_id: string | null
          company_name: string | null
          connected_numbers: number | null
          is_verified: boolean | null
          messaging_limit_tier: string | null
          onboarding_status: string | null
          pending_lgpd_deletions: number | null
          pending_templates: number | null
          quality_rating: string | null
          rejected_templates: number | null
          total_phone_numbers: number | null
          unresolved_quality_signals: number | null
        }
        Relationships: []
      }
      v_daily_channel_costs: {
        Row: {
          avg_unit_cost: number | null
          channel: string | null
          company_id: string | null
          cost_date: string | null
          total_cost_brl: number | null
          total_quantity: number | null
          total_transactions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
      v_recorded_calls: {
        Row: {
          billable_duration_sec: number | null
          caller_number: string | null
          company_id: string | null
          consent_obtained: boolean | null
          cost_brl: number | null
          created_at: string | null
          destination_number: string | null
          direction: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          hangup_cause: string | null
          id: string | null
          is_recorded: boolean | null
          quality_mos: number | null
          recording_duration: number | null
          recording_url: string | null
          status: string | null
          storage_recording_url: string | null
          transcription_confidence: number | null
          transcription_status: string | null
          transcription_text: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_company_whatsapp_health"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Functions: {
      can_collaborator_dispatch: {
        Args: { p_collaborator_id: string; p_template_name?: string }
        Returns: Json
      }
      check_and_auto_refill: {
        Args: { p_bolt_collaborator_id: string }
        Returns: Json
      }
      claim_next_lead: {
        Args: { p_collaborator_id: string; p_lead_ids?: string[] }
        Returns: {
          id: string
          lead_name: string
          phone: string
        }[]
      }
      close_expired_windows: { Args: never; Returns: number }
      complete_call: {
        Args: {
          p_ai_qualification?: string
          p_ai_summary?: string
          p_call_id: string
          p_duration?: number
          p_status?: string
        }
        Returns: undefined
      }
      count_available_leads: { Args: { p_company_id?: string }; Returns: Json }
      distribute_leads: {
        Args: {
          p_assigned_by: string
          p_assigned_to: string
          p_company_id: string
          p_filtro_cidade?: string
          p_filtro_ddd?: string
          p_quantidade?: number
        }
        Returns: Json
      }
      fn_check_dnc: {
        Args: { p_company_id?: string; p_phone: string }
        Returns: boolean
      }
      fn_check_opt_in: {
        Args: { p_company_id: string; p_message_type?: string; p_phone: string }
        Returns: {
          consent_marketing: boolean
          consent_transactional: boolean
          has_opt_in: boolean
          lgpd_legal_basis: string
          opt_in_id: string
        }[]
      }
      fn_cleanup_expired_recordings: { Args: never; Returns: number }
      fn_cleanup_old_webhook_events: { Args: never; Returns: number }
      fn_get_or_create_omnichannel_conversation: {
        Args: {
          p_channel: string
          p_company_id: string
          p_contact_name?: string
          p_contact_phone: string
        }
        Returns: string
      }
      fn_open_conversation_window: {
        Args: {
          p_category: string
          p_company_id: string
          p_contact_phone: string
          p_origin: string
          p_phone_number_id?: string
          p_wamid?: string
        }
        Returns: string
      }
      fn_process_lgpd_deletion: {
        Args: { p_company_id: string; p_phone: string }
        Returns: Json
      }
      fn_route_message: {
        Args: {
          p_channel: string
          p_company_id: string
          p_contact_phone?: string
          p_content?: string
        }
        Returns: {
          routing_id: string
          target_channel: string
          target_config: Json
          target_id: string
          target_type: string
        }[]
      }
      get_contact_leads_stats: { Args: never; Returns: Json }
      get_dashboard_metrics: {
        Args: { p_company_id: string; p_date?: string }
        Returns: Json
      }
      get_lead_pool_summary: {
        Args: never
        Returns: {
          collaborator_id: string
          company: string
          converted: number
          name: string
          pending: number
          responded: number
          sent: number
        }[]
      }
      get_lead_stats_by_collaborator: {
        Args: { p_company_id?: string }
        Returns: {
          collaborator_id: string
          collaborator_name: string
          role_slug: string
          total_atribuidos: number
          total_convertidos: number
          total_enviados: number
          total_pendentes: number
          total_responderam: number
        }[]
      }
      get_my_company_id: { Args: never; Returns: string }
      get_next_lead_to_call: {
        Args: { p_company_id: string; p_queue_id?: string }
        Returns: {
          extra_data: Json
          lead_id: string
          lead_name: string
          lead_score: number
          phone_number: string
          priority: number
          total_call_attempts: number
        }[]
      }
      get_next_lead_to_dial: {
        Args: { p_campaign_id: string; p_company_id: string }
        Returns: {
          lead_id: string
          lead_name: string
          lead_phone: string
          queue_id: string
        }[]
      }
      get_next_lead_to_dispatch: {
        Args: { p_company_id: string; p_queue_id?: string }
        Returns: {
          extra_data: Json
          lead_id: string
          lead_name: string
          lifecycle_id: string
          opt_in_id: string
          phone_number: string
        }[]
      }
      has_social_selling_access: { Args: never; Returns: boolean }
      increment_call_attempts: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      increment_dispatch_counter: {
        Args: { p_collaborator_id: string }
        Returns: undefined
      }
      is_dispatch_ceo: { Args: { _user_id: string }; Returns: boolean }
      leads_master_stats: { Args: { p_company_id: string }; Returns: Json }
      match_memories: {
        Args: {
          match_count: number
          match_threshold: number
          p_consultant_id: string
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          id: string
          lead_phone: string
          similarity: number
        }[]
      }
      recalculate_template_performance: {
        Args: { p_company_id: string; p_template_name: string }
        Returns: undefined
      }
      reset_daily_chip_counts: { Args: never; Returns: undefined }
      reset_daily_dispatch_counters: { Args: never; Returns: number }
      resolve_template_variables: {
        Args: {
          p_company_config?: Json
          p_extracted_data: Json
          p_lead_name: string
          p_product_data: Json
          p_variable_mapping: Json
        }
        Returns: Json
      }
      select_template_for_call: {
        Args: {
          p_company_id: string
          p_extracted_data: Json
          p_suggested_slot: string
        }
        Returns: {
          slot: string
          slot_id: string
          template_name: string
          variable_mapping: Json
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_leads_from_base: {
        Args: { p_company_id: string; p_limit?: number }
        Returns: Json
      }
    }
    Enums: {
      user_role: "admin" | "gestor" | "consultor" | "sdr"
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
      user_role: ["admin", "gestor", "consultor", "sdr"],
    },
  },
} as const
