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
      company_focus: {
        Row: {
          company_name: string
          contact_job_title: string
          contact_person: string
          email: string
          employee_count: string | null
          hq_address: string | null
          id: string
          industry: string
          team_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          company_name: string
          contact_job_title?: string
          contact_person?: string
          email?: string
          employee_count?: string | null
          hq_address?: string | null
          id?: string
          industry?: string
          team_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          company_name?: string
          contact_job_title?: string
          contact_person?: string
          email?: string
          employee_count?: string | null
          hq_address?: string | null
          id?: string
          industry?: string
          team_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_focus_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      file_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          file_id: string
          id: string
          recipient_ids: string[]
          related_status: Database["public"]["Enums"]["vault_status"] | null
          team_id: string
          to_entire_team: boolean
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          file_id: string
          id?: string
          recipient_ids?: string[]
          related_status?: Database["public"]["Enums"]["vault_status"] | null
          team_id: string
          to_entire_team?: boolean
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          file_id?: string
          id?: string
          recipient_ids?: string[]
          related_status?: Database["public"]["Enums"]["vault_status"] | null
          team_id?: string
          to_entire_team?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "file_comments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_comments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      file_tags: {
        Row: {
          created_at: string
          file_id: string
          id: string
          tag: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          tag: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_tags_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_versions: {
        Row: {
          file_id: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string
          version_number: number
        }
        Insert: {
          file_id: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
          version_number: number
        }
        Update: {
          file_id?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "file_versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          current_version_id: string | null
          description: string | null
          file_name: string
          id: string
          is_locked: boolean
          is_template: boolean
          section: string
          status: Database["public"]["Enums"]["vault_status"]
          subsection: string
          team_id: string | null
          template_source_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          file_name: string
          id?: string
          is_locked?: boolean
          is_template?: boolean
          section?: string
          status?: Database["public"]["Enums"]["vault_status"]
          subsection?: string
          team_id?: string | null
          template_source_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          file_name?: string
          id?: string
          is_locked?: boolean
          is_template?: boolean
          section?: string
          status?: Database["public"]["Enums"]["vault_status"]
          subsection?: string
          team_id?: string | null
          template_source_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_template_source_id_fkey"
            columns: ["template_source_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      group_norms: {
        Row: {
          document_path: string
          id: string
          is_locked: boolean
          locked_at: string | null
          team_id: string
          uploaded_at: string
        }
        Insert: {
          document_path: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          team_id: string
          uploaded_at?: string
        }
        Update: {
          document_path?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          team_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_norms_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      group_norms_signatures: {
        Row: {
          group_norms_id: string
          id: string
          signed_at: string
          user_id: string
        }
        Insert: {
          group_norms_id: string
          id?: string
          signed_at?: string
          user_id: string
        }
        Update: {
          group_norms_id?: string
          id?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_norms_signatures_group_norms_id_fkey"
            columns: ["group_norms_id"]
            isOneToOne: false
            referencedRelation: "group_norms"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_submissions: {
        Row: {
          admin_notes: string | null
          company_name: string
          company_website: string
          created_at: string
          id: string
          industry: string
          manager_first_name: string
          manager_last_name: string
          num_employees: number
          status: string
          submitted_by: string
          team_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company_name: string
          company_website: string
          created_at?: string
          id?: string
          industry: string
          manager_first_name: string
          manager_last_name: string
          num_employees: number
          status?: string
          submitted_by: string
          team_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company_name?: string
          company_website?: string
          created_at?: string
          id?: string
          industry?: string
          manager_first_name?: string
          manager_last_name?: string
          num_employees?: number
          status?: string
          submitted_by?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          file_id: string | null
          id: string
          kind: string
          message: string
          read: boolean
          team_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          kind?: string
          message: string
          read?: boolean
          team_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          kind?: string
          message?: string
          read?: boolean
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "file_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone_number: string | null
          section: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string
          phone_number?: string | null
          section?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone_number?: string | null
          section?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          job_title: Database["public"]["Enums"]["team_job"]
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          job_title: Database["public"]["Enums"]["team_job"]
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          job_title?: Database["public"]["Enums"]["team_job"]
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          section: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          section?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          section?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      shares_team: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "student"
      team_job:
        | "PM"
        | "Communication Specialist"
        | "Video Specialist"
        | "Company Liaison"
        | "Researcher"
      vault_status:
        | "Submitted"
        | "Awaiting Review"
        | "Reviewed"
        | "Needs Revision"
        | "Resolved"
        | "Missing"
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
      app_role: ["admin", "student"],
      team_job: [
        "PM",
        "Communication Specialist",
        "Video Specialist",
        "Company Liaison",
        "Researcher",
      ],
      vault_status: [
        "Submitted",
        "Awaiting Review",
        "Reviewed",
        "Needs Revision",
        "Resolved",
        "Missing",
      ],
    },
  },
} as const
