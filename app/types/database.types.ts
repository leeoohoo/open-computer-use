import { Attachment } from "@ai-sdk/ui-utils"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          user_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          user_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          chat_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_chat"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          updated_at: string | null
          id: string
          model: string | null
          project_id: string | null
          title: string | null
          user_id: string
          public: boolean
          collaborative: boolean | null
          max_participants: number | null
          invite_code: string | null
          room_settings: Json | null
        }
        Insert: {
          created_at?: string | null
          updated_at?: string | null
          id?: string
          model?: string | null
          project_id?: string | null
          title?: string | null
          user_id: string
          public?: boolean
          collaborative?: boolean | null
          max_participants?: number | null
          invite_code?: string | null
          room_settings?: Json | null
        }
        Update: {
          created_at?: string | null
          updated_at?: string | null
          id?: string
          model?: string | null
          project_id?: string | null
          title?: string | null
          user_id?: string
          public?: boolean
          collaborative?: boolean | null
          max_participants?: number | null
          invite_code?: string | null
          room_settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          experimental_attachments: Attachment[]
          chat_id: string
          content: string | null
          created_at: string | null
          id: number
          role: "system" | "user" | "assistant" | "data"
          parts: Json | null
          user_id?: string | null
          message_group_id: string | null
          model: string | null
          is_chunked?: boolean | null
          is_compressed?: boolean | null
          truncated?: boolean | null
        }
        Insert: {
          experimental_attachments?: Attachment[]
          chat_id: string
          content: string | null
          created_at?: string | null
          id?: number
          role: "system" | "user" | "assistant" | "data"
          parts?: Json
          user_id?: string | null
          message_group_id?: string | null
          model?: string | null
          is_chunked?: boolean | null
          is_compressed?: boolean | null
          truncated?: boolean | null
        }
        Update: {
          experimental_attachments?: Attachment[]
          chat_id?: string
          content?: string | null
          created_at?: string | null
          id?: number
          role?: "system" | "user" | "assistant" | "data"
          parts?: Json
          user_id?: string | null
          message_group_id?: string | null
          model?: string | null
          is_chunked?: boolean | null
          is_compressed?: boolean | null
          truncated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_chunks: {
        Row: {
          id: string
          parent_message_id: string
          chunk_index: number
          total_chunks: number
          content: string
          is_compressed: boolean | null
          original_size: number | null
          compressed_size: number | null
          created_at: string | null
        }
        Insert: {
          id: string
          parent_message_id: string
          chunk_index: number
          total_chunks: number
          content: string
          is_compressed?: boolean | null
          original_size?: number | null
          compressed_size?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          parent_message_id?: string
          chunk_index?: number
          total_chunks?: number
          content?: string
          is_compressed?: boolean | null
          original_size?: number | null
          compressed_size?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          anonymous: boolean | null
          created_at: string | null
          daily_message_count: number | null
          daily_reset: string | null
          display_name: string | null
          email: string
          favorite_models: string[] | null
          id: string
          message_count: number | null
          premium: boolean | null
          profile_image: string | null
          last_active_at: string | null
          daily_pro_message_count: number | null
          daily_pro_reset: string | null
          system_prompt: string | null
          onboarding_completed: boolean | null
          role: string | null
          company: string | null
          website: string | null
          team_size: string | null
          referral_source: string | null
          use_case: string | null
        }
        Insert: {
          anonymous?: boolean | null
          created_at?: string | null
          daily_message_count?: number | null
          daily_reset?: string | null
          display_name?: string | null
          email: string
          favorite_models?: string[] | null
          id: string
          message_count?: number | null
          premium?: boolean | null
          profile_image?: string | null
          last_active_at?: string | null
          daily_pro_message_count?: number | null
          daily_pro_reset?: string | null
          system_prompt?: string | null
          onboarding_completed?: boolean | null
          role?: string | null
          company?: string | null
          website?: string | null
          team_size?: string | null
          referral_source?: string | null
          use_case?: string | null
        }
        Update: {
          anonymous?: boolean | null
          created_at?: string | null
          daily_message_count?: number | null
          daily_reset?: string | null
          display_name?: string | null
          email?: string
          favorite_models?: string[] | null
          id?: string
          message_count?: number | null
          premium?: boolean | null
          profile_image?: string | null
          last_active_at?: string | null
          daily_pro_message_count?: number | null
          daily_pro_reset?: string | null
          system_prompt?: string | null
          onboarding_completed?: boolean | null
          role?: string | null
          company?: string | null
          website?: string | null
          team_size?: string | null
          referral_source?: string | null
          use_case?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_keys: {
        Row: {
          user_id: string
          provider: string
          encrypted_key: string
          iv: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          provider: string
          encrypted_key: string
          iv: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          provider?: string
          encrypted_key?: string
          iv?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          user_id: string
          layout: string | null
          prompt_suggestions: boolean | null
          show_tool_invocations: boolean | null
          show_conversation_previews: boolean | null
          multi_model_enabled: boolean | null
          hidden_models: string[] | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          layout?: string | null
          prompt_suggestions?: boolean | null
          show_tool_invocations?: boolean | null
          show_conversation_previews?: boolean | null
          multi_model_enabled?: boolean | null
          hidden_models?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          layout?: string | null
          prompt_suggestions?: boolean | null
          show_tool_invocations?: boolean | null
          show_conversation_previews?: boolean | null
          multi_model_enabled?: boolean | null
          hidden_models?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          role: string
          joined_at: string | null
          last_active_at: string | null
          permissions: Json | null
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          role?: string
          joined_at?: string | null
          last_active_at?: string | null
          permissions?: Json | null
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          role?: string
          joined_at?: string | null
          last_active_at?: string | null
          permissions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_invitations: {
        Row: {
          id: string
          chat_id: string
          invited_by: string
          invited_user_id: string | null
          invite_code: string
          email: string | null
          expires_at: string
          used_at: string | null
          used_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          chat_id: string
          invited_by: string
          invited_user_id?: string | null
          invite_code: string
          email?: string | null
          expires_at: string
          used_at?: string | null
          used_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          chat_id?: string
          invited_by?: string
          invited_user_id?: string | null
          invite_code?: string
          email?: string | null
          expires_at?: string
          used_at?: string | null
          used_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_invitations_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_activity: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          activity_type: string
          metadata: Json | null
          created_at: string | null
          expires_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          activity_type: string
          metadata?: Json | null
          created_at?: string | null
          expires_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          activity_type?: string
          metadata?: Json | null
          created_at?: string | null
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_activity_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_machines: {
        Row: {
          id: string
          user_id: string
          container_name: string
          display_name: string
          status: "creating" | "starting" | "running" | "stopping" | "stopped" | "error" | "deleting"
          status_message: string | null
          azure_resource_group: string
          azure_container_group: string
          azure_resource_id: string | null
          azure_location: string | null
          public_ip_address: string | null
          vnc_password: string
          vnc_port: number | null
          websocket_port: number | null
          ssh_port: number | null
          cpu_cores: number
          memory_gb: number
          storage_gb: number
          gpu_enabled: boolean | null
          created_at: string | null
          started_at: string | null
          last_active_at: string | null
          auto_shutdown_at: string | null
          auto_shutdown_minutes: number | null
          settings: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          container_name: string
          display_name: string
          status?: "creating" | "starting" | "running" | "stopping" | "stopped" | "error" | "deleting"
          status_message?: string | null
          azure_resource_group: string
          azure_container_group: string
          azure_resource_id?: string | null
          azure_location?: string | null
          public_ip_address?: string | null
          vnc_password: string
          vnc_port?: number | null
          websocket_port?: number | null
          ssh_port?: number | null
          cpu_cores?: number
          memory_gb?: number
          storage_gb?: number
          gpu_enabled?: boolean | null
          created_at?: string | null
          started_at?: string | null
          last_active_at?: string | null
          auto_shutdown_at?: string | null
          auto_shutdown_minutes?: number | null
          settings?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          container_name?: string
          display_name?: string
          status?: "creating" | "starting" | "running" | "stopping" | "stopped" | "error" | "deleting"
          status_message?: string | null
          azure_resource_group?: string
          azure_container_group?: string
          azure_resource_id?: string | null
          azure_location?: string | null
          public_ip_address?: string | null
          vnc_password?: string
          vnc_port?: number | null
          websocket_port?: number | null
          ssh_port?: number | null
          cpu_cores?: number
          memory_gb?: number
          storage_gb?: number
          gpu_enabled?: boolean | null
          created_at?: string | null
          started_at?: string | null
          last_active_at?: string | null
          auto_shutdown_at?: string | null
          auto_shutdown_minutes?: number | null
          settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "user_machines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_sessions: {
        Row: {
          id: string
          machine_id: string
          user_id: string
          session_type: "ai_controlled" | "user_controlled" | "mixed"
          started_at: string | null
          ended_at: string | null
          duration_seconds: number | null
          actions_performed: Json | null
          screenshots_captured: number | null
          commands_executed: number | null
          errors_encountered: number | null
          ai_model: string | null
          ai_objective: string | null
          ai_completion_status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | null
        }
        Insert: {
          id?: string
          machine_id: string
          user_id: string
          session_type: "ai_controlled" | "user_controlled" | "mixed"
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          actions_performed?: Json | null
          screenshots_captured?: number | null
          commands_executed?: number | null
          errors_encountered?: number | null
          ai_model?: string | null
          ai_objective?: string | null
          ai_completion_status?: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | null
        }
        Update: {
          id?: string
          machine_id?: string
          user_id?: string
          session_type?: "ai_controlled" | "user_controlled" | "mixed"
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number | null
          actions_performed?: Json | null
          screenshots_captured?: number | null
          commands_executed?: number | null
          errors_encountered?: number | null
          ai_model?: string | null
          ai_objective?: string | null
          ai_completion_status?: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_sessions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "user_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_limits: {
        Row: {
          user_id: string
          tier: "free" | "basic" | "pro" | "enterprise"
          max_machines: number
          max_running_machines: number
          max_cpu_cores: number
          max_memory_gb: number
          max_storage_gb: number
          gpu_access: boolean | null
          max_hours_per_month: number
          max_sessions_per_day: number
          allow_internet_access: boolean | null
          allowed_domains: string[] | null
          allow_persistence: boolean | null
          allow_snapshots: boolean | null
          allow_custom_software: boolean | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          tier?: "free" | "basic" | "pro" | "enterprise"
          max_machines?: number
          max_running_machines?: number
          max_cpu_cores?: number
          max_memory_gb?: number
          max_storage_gb?: number
          gpu_access?: boolean | null
          max_hours_per_month?: number
          max_sessions_per_day?: number
          allow_internet_access?: boolean | null
          allowed_domains?: string[] | null
          allow_persistence?: boolean | null
          allow_snapshots?: boolean | null
          allow_custom_software?: boolean | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          tier?: "free" | "basic" | "pro" | "enterprise"
          max_machines?: number
          max_running_machines?: number
          max_cpu_cores?: number
          max_memory_gb?: number
          max_storage_gb?: number
          gpu_access?: boolean | null
          max_hours_per_month?: number
          max_sessions_per_day?: number
          allow_internet_access?: boolean | null
          allowed_domains?: string[] | null
          allow_persistence?: boolean | null
          allow_snapshots?: boolean | null
          allow_custom_software?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_usage: {
        Row: {
          id: string
          user_id: string
          machine_id: string
          period_start: string
          period_end: string
          cpu_seconds: number
          memory_gb_seconds: number
          storage_gb_hours: number
          network_gb_transferred: number
          estimated_cost: number | null
        }
        Insert: {
          id?: string
          user_id: string
          machine_id: string
          period_start: string
          period_end: string
          cpu_seconds?: number
          memory_gb_seconds?: number
          storage_gb_hours?: number
          network_gb_transferred?: number
          estimated_cost?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          machine_id?: string
          period_start?: string
          period_end?: string
          cpu_seconds?: number
          memory_gb_seconds?: number
          storage_gb_hours?: number
          network_gb_transferred?: number
          estimated_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_usage_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "user_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_snapshots: {
        Row: {
          id: string
          machine_id: string
          user_id: string
          snapshot_name: string
          snapshot_type: "manual" | "auto" | "pre_shutdown" | null
          storage_location: string
          size_gb: number
          os_state: Json | null
          installed_software: Json | null
          created_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          machine_id: string
          user_id: string
          snapshot_name: string
          snapshot_type?: "manual" | "auto" | "pre_shutdown" | null
          storage_location: string
          size_gb: number
          os_state?: Json | null
          installed_software?: Json | null
          created_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          machine_id?: string
          user_id?: string
          snapshot_name?: string
          snapshot_type?: "manual" | "auto" | "pre_shutdown" | null
          storage_location?: string
          size_gb?: number
          os_state?: Json | null
          installed_software?: Json | null
          created_at?: string | null
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_snapshots_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "user_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_ai_actions: {
        Row: {
          id: string
          session_id: string
          machine_id: string
          action_type: string
          action_target: string | null
          action_parameters: Json | null
          executed_at: string | null
          execution_time_ms: number | null
          success: boolean
          error_message: string | null
          screenshot_before: string | null
          screenshot_after: string | null
          ai_reasoning: string | null
        }
        Insert: {
          id?: string
          session_id: string
          machine_id: string
          action_type: string
          action_target?: string | null
          action_parameters?: Json | null
          executed_at?: string | null
          execution_time_ms?: number | null
          success: boolean
          error_message?: string | null
          screenshot_before?: string | null
          screenshot_after?: string | null
          ai_reasoning?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          machine_id?: string
          action_type?: string
          action_target?: string | null
          action_parameters?: Json | null
          executed_at?: string | null
          execution_time_ms?: number | null
          success?: boolean
          error_message?: string | null
          screenshot_before?: string | null
          screenshot_after?: string | null
          ai_reasoning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_ai_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "machine_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_ai_actions_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "user_machines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_monthly_usage: {
        Args: {
          p_user_id: string
        }
        Returns: {
          total_hours: number
          total_cpu_hours: number
          total_estimated_cost: number
        }[]
      }
      can_user_create_machine: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
