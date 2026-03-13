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
      collaborators: {
        Row: {
          active: boolean | null
          auth_user_id: string | null
          bot_memory: string | null
          bot_training: string | null
          company_id: string | null
          company_ids: Json | null
          created_at: string | null
          deactivated_at: string | null
          email: string | null
          id: string
          is_super_admin: boolean | null
          last_agent_id: string | null
          name: string
          phone: string | null
          reports_to: string | null
          role: string | null
          role_id: string | null
          sector_id: string | null
          status: string | null
          superior_id: string | null
          telegram_id: string | null
          uazapi_instance_name: string | null
          unit: string | null
          unit_id: string | null
          unit_ids: Json | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
          whatsapp_comercial: string | null
        }
        Insert: {
          active?: boolean | null
          auth_user_id?: string | null
          bot_memory?: string | null
          bot_training?: string | null
          company_id?: string | null
          company_ids?: Json | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          id?: string
          is_super_admin?: boolean | null
          last_agent_id?: string | null
          name: string
          phone?: string | null
          reports_to?: string | null
          role?: string | null
          role_id?: string | null
          sector_id?: string | null
          status?: string | null
          superior_id?: string | null
          telegram_id?: string | null
          uazapi_instance_name?: string | null
          unit?: string | null
          unit_id?: string | null
          unit_ids?: Json | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
          whatsapp_comercial?: string | null
        }
        Update: {
          active?: boolean | null
          auth_user_id?: string | null
          bot_memory?: string | null
          bot_training?: string | null
          company_id?: string | null
          company_ids?: Json | null
          created_at?: string | null
          deactivated_at?: string | null
          email?: string | null
          id?: string
          is_super_admin?: boolean | null
          last_agent_id?: string | null
          name?: string
          phone?: string | null
          reports_to?: string | null
          role?: string | null
          role_id?: string | null
          sector_id?: string | null
          status?: string | null
          superior_id?: string | null
          telegram_id?: string | null
          uazapi_instance_name?: string | null
          unit?: string | null
          unit_id?: string | null
          unit_ids?: Json | null
          updated_at?: string | null
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
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
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
          category: string | null
          city: string | null
          created_at: string | null
          document: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          region: string | null
          score: number | null
          source: string | null
          state: string | null
          status: string | null
          subcategory: string | null
          tipo_pessoa: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          region?: string | null
          score?: number | null
          source?: string | null
          state?: string | null
          status?: string | null
          subcategory?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          region?: string | null
          score?: number | null
          source?: string | null
          state?: string | null
          status?: string | null
          subcategory?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          chip_id: string | null
          chip_instance_token: string | null
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
            foreignKeyName: "conversations_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
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
          collaborator_id: string
          created_at: string
          id: string
          instance_name: string | null
          instance_token: string | null
          phone: string | null
          qr_code: string | null
          status: string
          uazapi_admin_token: string
          uazapi_server_url: string
          updated_at: string
        }
        Insert: {
          chip_index?: number
          collaborator_id: string
          created_at?: string
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          phone?: string | null
          qr_code?: string | null
          status?: string
          uazapi_admin_token?: string
          uazapi_server_url?: string
          updated_at?: string
        }
        Update: {
          chip_index?: number
          collaborator_id?: string
          created_at?: string
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          phone?: string | null
          qr_code?: string | null
          status?: string
          uazapi_admin_token?: string
          uazapi_server_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      invite_links: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          role: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          role?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          role?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          city: string | null
          consultant_id: string | null
          contacted_at: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          phone: string
          region: string | null
          responded_at: string | null
          score: number | null
          source: string | null
          status: string | null
          updated_at: string | null
          vehicle_model: string | null
          vehicle_type: string | null
          vehicle_year: string | null
        }
        Insert: {
          city?: string | null
          consultant_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone: string
          region?: string | null
          responded_at?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
          vehicle_year?: string | null
        }
        Update: {
          city?: string | null
          consultant_id?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string
          region?: string | null
          responded_at?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
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
      messages: {
        Row: {
          channel_type: string | null
          content: string | null
          conversation_id: string | null
          created_at: string | null
          delivery_status: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          sender: string
        }
        Insert: {
          channel_type?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          delivery_status?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender: string
        }
        Update: {
          channel_type?: string | null
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          delivery_status?: string | null
          id?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
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
            referencedRelation: "channels"
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
          level: number | null
          name: string
          permissions: Json | null
          sector_id: string | null
          slug: string | null
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
          level?: number | null
          name: string
          permissions?: Json | null
          sector_id?: string | null
          slug?: string | null
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
          level?: number | null
          name?: string
          permissions?: Json | null
          sector_id?: string | null
          slug?: string | null
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
        ]
      }
      system_configs: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
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
      whatsapp_bot_conversations: {
        Row: {
          collaborator_id: string
          contact_name: string | null
          contact_phone: string
          created_at: string | null
          history: Json
          id: string
          last_message_at: string | null
          updated_at: string | null
        }
        Insert: {
          collaborator_id: string
          contact_name?: string | null
          contact_phone: string
          created_at?: string | null
          history?: Json
          id?: string
          last_message_at?: string | null
          updated_at?: string | null
        }
        Update: {
          collaborator_id?: string
          contact_name?: string | null
          contact_phone?: string
          created_at?: string | null
          history?: Json
          id?: string
          last_message_at?: string | null
          updated_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_auto_refill: {
        Args: { p_bolt_collaborator_id: string }
        Returns: Json
      }
      distribute_leads: {
        Args: {
          p_assigned_by: string
          p_assigned_to: string
          p_company_id: string
          p_filtro_cidade?: string
          p_filtro_ddd?: string
          p_is_auto_refill?: boolean
          p_quantidade?: number
        }
        Returns: Json
      }
      get_contact_leads_stats: { Args: never; Returns: Json }
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
      increment_metric: {
        Args: { p_consultant_id: string; p_metric: string; p_value?: number }
        Returns: undefined
      }
      reset_daily_chip_counts: { Args: never; Returns: undefined }
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
