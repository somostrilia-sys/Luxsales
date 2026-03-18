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
          company_id: string | null
          created_at: string | null
          description: string | null
          emoji: string | null
          icon: string | null
          id: string
          name: string
          sector_id: string | null
          slug: string
          system_prompt: string | null
        }
        Insert: {
          active?: boolean | null
          agent_type?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          icon?: string | null
          id?: string
          name: string
          sector_id?: string | null
          slug: string
          system_prompt?: string | null
        }
        Update: {
          active?: boolean | null
          agent_type?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          emoji?: string | null
          icon?: string | null
          id?: string
          name?: string
          sector_id?: string | null
          slug?: string
          system_prompt?: string | null
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
            foreignKeyName: "agent_definitions_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          duration_sec: number | null
          ended_at: string | null
          id: string
          lead_name: string | null
          lead_phone: string
          recording_url: string | null
          result: string | null
          started_at: string | null
          status: string
          transcript: Json | null
          voice_key: string
        }
        Insert: {
          campaign_id?: string | null
          chip_instance?: string | null
          created_at?: string
          duration_sec?: number | null
          ended_at?: string | null
          id?: string
          lead_name?: string | null
          lead_phone: string
          recording_url?: string | null
          result?: string | null
          started_at?: string | null
          status?: string
          transcript?: Json | null
          voice_key: string
        }
        Update: {
          campaign_id?: string | null
          chip_instance?: string | null
          created_at?: string
          duration_sec?: number | null
          ended_at?: string | null
          id?: string
          lead_name?: string | null
          lead_phone?: string
          recording_url?: string | null
          result?: string | null
          started_at?: string | null
          status?: string
          transcript?: Json | null
          voice_key?: string
        }
        Relationships: []
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
          bairro: string | null
          cep: string | null
          cnae_descricao: string | null
          cnae_fiscal: string | null
          cnpj: string | null
          email: string | null
          id: string
          imported_at: string | null
          logradouro: string | null
          municipio: string | null
          nome_fantasia: string | null
          numero: string | null
          porte_empresa: string | null
          razao_social: string | null
          situacao_cadastral: string | null
          telefone1: string | null
          telefone2: string | null
          uf: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cnae_descricao?: string | null
          cnae_fiscal?: string | null
          cnpj?: string | null
          email?: string | null
          id?: string
          imported_at?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          porte_empresa?: string | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          telefone1?: string | null
          telefone2?: string | null
          uf?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cnae_descricao?: string | null
          cnae_fiscal?: string | null
          cnpj?: string | null
          email?: string | null
          id?: string
          imported_at?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          porte_empresa?: string | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          telefone1?: string | null
          telefone2?: string | null
          uf?: string | null
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
            foreignKeyName: "collaborators_last_agent_id_fkey"
            columns: ["last_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
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
          created_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          active?: boolean | null
          brand_identity?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          active?: boolean | null
          brand_identity?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
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
          lead_phone: string
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
          lead_phone: string
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
          lead_phone?: string
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
      disposable_chips: {
        Row: {
          chip_index: number
          collaborator_id: string | null
          created_at: string | null
          created_at_date: string | null
          daily_msg_count: number | null
          id: string
          instance_name: string | null
          instance_token: string | null
          last_reset_at: string | null
          phone: string | null
          proxy_enabled: boolean
          proxy_host: string | null
          proxy_last_tested_at: string | null
          proxy_password: string | null
          proxy_port: number | null
          proxy_protocol: string | null
          proxy_username: string | null
          qr_code: string | null
          status: string | null
          uazapi_account: string | null
          uazapi_admin_token: string | null
          uazapi_server_url: string | null
          updated_at: string | null
        }
        Insert: {
          chip_index?: number
          collaborator_id?: string | null
          created_at?: string | null
          created_at_date?: string | null
          daily_msg_count?: number | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          last_reset_at?: string | null
          phone?: string | null
          proxy_enabled?: boolean
          proxy_host?: string | null
          proxy_last_tested_at?: string | null
          proxy_password?: string | null
          proxy_port?: number | null
          proxy_protocol?: string | null
          proxy_username?: string | null
          qr_code?: string | null
          status?: string | null
          uazapi_account?: string | null
          uazapi_admin_token?: string | null
          uazapi_server_url?: string | null
          updated_at?: string | null
        }
        Update: {
          chip_index?: number
          collaborator_id?: string | null
          created_at?: string | null
          created_at_date?: string | null
          daily_msg_count?: number | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          last_reset_at?: string | null
          phone?: string | null
          proxy_enabled?: boolean
          proxy_host?: string | null
          proxy_last_tested_at?: string | null
          proxy_password?: string | null
          proxy_port?: number | null
          proxy_protocol?: string | null
          proxy_username?: string | null
          qr_code?: string | null
          status?: string | null
          uazapi_account?: string | null
          uazapi_admin_token?: string | null
          uazapi_server_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disposable_chips_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      disposable_chipset_proxy: {
        Row: {
          chip_id: string
          created_at: string
          id: string
          proxy_url: string | null
          updated_at: string
        }
        Insert: {
          chip_id: string
          created_at?: string
          id?: string
          proxy_url?: string | null
          updated_at?: string
        }
        Update: {
          chip_id?: string
          created_at?: string
          id?: string
          proxy_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disposable_chipset_proxy_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: true
            referencedRelation: "disposable_chips"
            referencedColumns: ["id"]
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
            foreignKeyName: "lead_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "collaborators"
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
        ]
      }
      leads: {
        Row: {
          category: string | null
          city: string | null
          company_target: string | null
          consultant_id: string | null
          contacted_at: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          region: string | null
          responded_at: string | null
          score: number | null
          source: string | null
          status: string | null
          subcategory: string | null
          tipo_pessoa: string | null
          updated_at: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          company_target?: string | null
          consultant_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          region?: string | null
          responded_at?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          subcategory?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          company_target?: string | null
          consultant_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          region?: string | null
          responded_at?: string | null
          score?: number | null
          source?: string | null
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
            foreignKeyName: "leads_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
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
            foreignKeyName: "messages_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "disposable_chips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
            foreignKeyName: "prospection_messages_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "disposable_chips"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "proxy_logs_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "disposable_chips"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "roles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
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
      social_selling_actions: {
        Row: {
          action_type: string
          campaign_id: string | null
          content: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          profile_id: string | null
          response_text: string | null
          status: string | null
          target_url: string | null
          target_username: string
        }
        Insert: {
          action_type: string
          campaign_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          response_text?: string | null
          status?: string | null
          target_url?: string | null
          target_username: string
        }
        Update: {
          action_type?: string
          campaign_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          profile_id?: string | null
          response_text?: string | null
          status?: string | null
          target_url?: string | null
          target_username?: string
        }
        Relationships: []
      }
      social_selling_campaigns: {
        Row: {
          created_at: string | null
          created_by: string | null
          daily_target: number | null
          end_date: string | null
          id: string
          name: string
          platform: string
          profile_ids: string[] | null
          start_date: string | null
          status: string | null
          strategy: Json | null
          target_expert_ids: string[] | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          daily_target?: number | null
          end_date?: string | null
          id?: string
          name: string
          platform: string
          profile_ids?: string[] | null
          start_date?: string | null
          status?: string | null
          strategy?: Json | null
          target_expert_ids?: string[] | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          daily_target?: number | null
          end_date?: string | null
          id?: string
          name?: string
          platform?: string
          profile_ids?: string[] | null
          start_date?: string | null
          status?: string | null
          strategy?: Json | null
          target_expert_ids?: string[] | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      social_selling_experts: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          follower_count: number | null
          id: string
          is_active: boolean | null
          name: string | null
          platform: string
          profile_url: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          follower_count?: number | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          platform: string
          profile_url?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          follower_count?: number | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          platform?: string
          profile_url?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      social_selling_knowledge: {
        Row: {
          category: string
          company_id: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          company_id?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      social_selling_leads: {
        Row: {
          assigned_to: string | null
          bio: string | null
          campaign_id: string | null
          created_at: string | null
          email: string | null
          follower_count: number | null
          id: string
          name: string | null
          notes: string | null
          phone: string | null
          platform: string
          source_expert: string | null
          status: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          assigned_to?: string | null
          bio?: string | null
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          follower_count?: number | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          platform: string
          source_expert?: string | null
          status?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          assigned_to?: string | null
          bio?: string | null
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          follower_count?: number | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          platform?: string
          source_expert?: string | null
          status?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      social_selling_profiles: {
        Row: {
          collaborator_id: string | null
          created_at: string | null
          daily_limit_comments: number | null
          daily_limit_dms: number | null
          daily_limit_follows: number | null
          daily_limit_likes: number | null
          id: string
          is_active: boolean | null
          last_activity_at: string | null
          password_encrypted: string | null
          platform: string
          proxy_url: string | null
          session_data: Json | null
          updated_at: string | null
          username: string
        }
        Insert: {
          collaborator_id?: string | null
          created_at?: string | null
          daily_limit_comments?: number | null
          daily_limit_dms?: number | null
          daily_limit_follows?: number | null
          daily_limit_likes?: number | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          password_encrypted?: string | null
          platform: string
          proxy_url?: string | null
          session_data?: Json | null
          updated_at?: string | null
          username: string
        }
        Update: {
          collaborator_id?: string | null
          created_at?: string | null
          daily_limit_comments?: number | null
          daily_limit_dms?: number | null
          daily_limit_follows?: number | null
          daily_limit_likes?: number | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          password_encrypted?: string | null
          platform?: string
          proxy_url?: string | null
          session_data?: Json | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      social_selling_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          message_text: string
          name: string
          platform: string
          scenario: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_text: string
          name: string
          platform: string
          scenario: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_text?: string
          name?: string
          platform?: string
          scenario?: string
          updated_at?: string | null
          variables?: Json | null
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
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          role: string
          sender_name: string | null
          sender_phone: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role: string
          sender_name?: string | null
          sender_phone?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          sender_name?: string | null
          sender_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      count_available_leads: { Args: { p_company_id?: string }; Returns: Json }
      distribute_leads:
        | {
            Args: {
              p_assigned_by?: string
              p_assigned_to: string
              p_company_id?: string
              p_filtro_cidade?: string
              p_filtro_ddd?: string
              p_quantidade?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_assigned_by?: string
              p_assigned_to: string
              p_company_id?: string
              p_filtro_cidade?: string
              p_filtro_ddd?: string
              p_quantidade: number
            }
            Returns: Json
          }
      get_contact_leads_stats: { Args: never; Returns: Json }
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
          atribuidos: number
          collaborator_id: string
          collaborator_name: string
          company_name: string
          convertidos: number
          enviados: number
          pendentes: number
          responderam: number
          total_atribuidos: number
          total_convertidos: number
          total_enviados: number
          total_pendentes: number
          total_responderam: number
        }[]
      }
      has_social_selling_access: { Args: never; Returns: boolean }
      reset_daily_chip_counts: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_leads_from_base: {
        Args: { p_company_id?: string; p_limit?: number }
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
