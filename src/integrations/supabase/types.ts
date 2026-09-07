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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          archive_id: string | null
          archive_name: string | null
          created_at: string
          details: Json | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          archive_id?: string | null
          archive_name?: string | null
          created_at?: string
          details?: Json | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          archive_id?: string | null
          archive_name?: string | null
          created_at?: string
          details?: Json | null
          id?: number
        }
        Relationships: []
      }
      archived_company_focus: {
        Row: {
          archive_id: string
          company_name: string | null
          contact_job_title: string | null
          contact_person: string | null
          email: string | null
          employee_count: string | null
          hq_address: string | null
          id: string
          industry: string | null
          team_id: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          archive_id: string
          company_name?: string | null
          contact_job_title?: string | null
          contact_person?: string | null
          email?: string | null
          employee_count?: string | null
          hq_address?: string | null
          id: string
          industry?: string | null
          team_id: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          archive_id?: string
          company_name?: string | null
          contact_job_title?: string | null
          contact_person?: string | null
          email?: string | null
          employee_count?: string | null
          hq_address?: string | null
          id?: string
          industry?: string | null
          team_id?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_company_focus_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_file_comments: {
        Row: {
          archive_id: string
          author_id: string
          body: string
          created_at: string | null
          file_id: string
          id: string
          recipient_ids: string[] | null
          related_status: Database["public"]["Enums"]["vault_status"] | null
          team_id: string
          to_entire_team: boolean | null
        }
        Insert: {
          archive_id: string
          author_id: string
          body: string
          created_at?: string | null
          file_id: string
          id: string
          recipient_ids?: string[] | null
          related_status?: Database["public"]["Enums"]["vault_status"] | null
          team_id: string
          to_entire_team?: boolean | null
        }
        Update: {
          archive_id?: string
          author_id?: string
          body?: string
          created_at?: string | null
          file_id?: string
          id?: string
          recipient_ids?: string[] | null
          related_status?: Database["public"]["Enums"]["vault_status"] | null
          team_id?: string
          to_entire_team?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_file_comments_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_file_tags: {
        Row: {
          archive_id: string
          created_at: string | null
          file_id: string
          id: string
          tag: string
        }
        Insert: {
          archive_id: string
          created_at?: string | null
          file_id: string
          id: string
          tag: string
        }
        Update: {
          archive_id?: string
          created_at?: string | null
          file_id?: string
          id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_file_tags_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_file_versions: {
        Row: {
          archive_id: string
          archive_storage_path: string
          file_id: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_at: string | null
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          archive_id: string
          archive_storage_path: string
          file_id: string
          file_size?: number | null
          id: string
          mime_type?: string | null
          storage_path: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_number: number
        }
        Update: {
          archive_id?: string
          archive_storage_path?: string
          file_id?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "archived_file_versions_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_files: {
        Row: {
          archive_id: string
          assigned_to: string | null
          category: string | null
          created_at: string | null
          current_version_id: string | null
          description: string | null
          file_name: string
          id: string
          is_locked: boolean | null
          is_template: boolean | null
          section: string
          status: Database["public"]["Enums"]["vault_status"] | null
          subsection: string
          team_id: string | null
          template_source_id: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          archive_id: string
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          current_version_id?: string | null
          description?: string | null
          file_name: string
          id: string
          is_locked?: boolean | null
          is_template?: boolean | null
          section: string
          status?: Database["public"]["Enums"]["vault_status"] | null
          subsection: string
          team_id?: string | null
          template_source_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          archive_id?: string
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          current_version_id?: string | null
          description?: string | null
          file_name?: string
          id?: string
          is_locked?: boolean | null
          is_template?: boolean | null
          section?: string
          status?: Database["public"]["Enums"]["vault_status"] | null
          subsection?: string
          team_id?: string | null
          template_source_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_files_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_group_norms: {
        Row: {
          archive_document_path: string
          archive_id: string
          document_path: string
          id: string
          is_locked: boolean | null
          locked_at: string | null
          team_id: string
          uploaded_at: string | null
        }
        Insert: {
          archive_document_path: string
          archive_id: string
          document_path: string
          id: string
          is_locked?: boolean | null
          locked_at?: string | null
          team_id: string
          uploaded_at?: string | null
        }
        Update: {
          archive_document_path?: string
          archive_id?: string
          document_path?: string
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          team_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_group_norms_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_group_norms_signatures: {
        Row: {
          archive_id: string
          group_norms_id: string
          id: string
          signed_at: string | null
          user_id: string
        }
        Insert: {
          archive_id: string
          group_norms_id: string
          id: string
          signed_at?: string | null
          user_id: string
        }
        Update: {
          archive_id?: string
          group_norms_id?: string
          id?: string
          signed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_group_norms_signatures_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_manager_submissions: {
        Row: {
          admin_notes: string | null
          archive_id: string
          company_name: string | null
          company_website: string | null
          created_at: string | null
          id: string
          industry: string | null
          manager_first_name: string | null
          manager_last_name: string | null
          num_employees: number | null
          status: string | null
          submitted_by: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          archive_id: string
          company_name?: string | null
          company_website?: string | null
          created_at?: string | null
          id: string
          industry?: string | null
          manager_first_name?: string | null
          manager_last_name?: string | null
          num_employees?: number | null
          status?: string | null
          submitted_by: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          archive_id?: string
          company_name?: string | null
          company_website?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          manager_first_name?: string | null
          manager_last_name?: string | null
          num_employees?: number | null
          status?: string | null
          submitted_by?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_manager_submissions_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_team_members: {
        Row: {
          archive_id: string
          id: string
          job_title: Database["public"]["Enums"]["team_job"]
          joined_at: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          archive_id: string
          id: string
          job_title: Database["public"]["Enums"]["team_job"]
          joined_at?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          archive_id?: string
          id?: string
          job_title?: Database["public"]["Enums"]["team_job"]
          joined_at?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_team_members_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_teams: {
        Row: {
          archive_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          section: string | null
          updated_at: string | null
        }
        Insert: {
          archive_id: string
          created_at?: string | null
          description?: string | null
          id: string
          name: string
          section?: string | null
          updated_at?: string | null
        }
        Update: {
          archive_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          section?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_teams_archive_id_fkey"
            columns: ["archive_id"]
            isOneToOne: false
            referencedRelation: "semester_archives"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_audit_log: {
        Row: {
          created_at: string
          event: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      backlog_items: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_index: number
          priority: Database["public"]["Enums"]["backlog_priority"]
          status: Database["public"]["Enums"]["backlog_status"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          priority?: Database["public"]["Enums"]["backlog_priority"]
          status?: Database["public"]["Enums"]["backlog_status"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          priority?: Database["public"]["Enums"]["backlog_priority"]
          status?: Database["public"]["Enums"]["backlog_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      file_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          changed_fields: string[] | null
          created_at: string
          file_id: string | null
          file_name: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          section: string | null
          subsection: string | null
          team_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changed_fields?: string[] | null
          created_at?: string
          file_id?: string | null
          file_name?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          section?: string | null
          subsection?: string | null
          team_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changed_fields?: string[] | null
          created_at?: string
          file_id?: string | null
          file_name?: string | null
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          section?: string | null
          subsection?: string | null
          team_id?: string | null
        }
        Relationships: []
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
          first_name: string | null
          id: string
          initials: string | null
          last_name: string | null
          name: string
          phone_number: string | null
          phone_visible: boolean
          section: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          initials?: string | null
          last_name?: string | null
          name?: string
          phone_number?: string | null
          phone_visible?: boolean
          section?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          initials?: string | null
          last_name?: string | null
          name?: string
          phone_number?: string | null
          phone_visible?: boolean
          section?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      semester_archives: {
        Row: {
          created_at: string
          created_by: string | null
          file_count: number
          id: string
          kind: string
          member_count: number
          name: string
          notes: string | null
          tag_date: string | null
          team_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_count?: number
          id?: string
          kind?: string
          member_count?: number
          name: string
          notes?: string | null
          tag_date?: string | null
          team_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_count?: number
          id?: string
          kind?: string
          member_count?: number
          name?: string
          notes?: string | null
          tag_date?: string | null
          team_count?: number
        }
        Relationships: []
      }
      semester_schedule: {
        Row: {
          end_date: string | null
          id: boolean
          start_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          end_date?: string | null
          id?: boolean
          start_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          end_date?: string | null
          id?: boolean
          start_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      team_meeting_agreements: {
        Row: {
          agreement_text: string | null
          agreement_version: string | null
          full_name: string | null
          id: string
          initials: string
          proposal_id: string
          responded_at: string
          status: string
          team_id: string
          user_id: string
        }
        Insert: {
          agreement_text?: string | null
          agreement_version?: string | null
          full_name?: string | null
          id?: string
          initials: string
          proposal_id: string
          responded_at?: string
          status: string
          team_id: string
          user_id: string
        }
        Update: {
          agreement_text?: string | null
          agreement_version?: string | null
          full_name?: string | null
          id?: string
          initials?: string
          proposal_id?: string
          responded_at?: string
          status?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_meeting_agreements_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "team_meeting_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_meeting_agreements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_meeting_proposals: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          location: string | null
          meeting_mode: string | null
          meeting_time: string
          mode_choice_1: string | null
          mode_choice_2: string | null
          mode_choice_3: string | null
          proposed_by: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          location?: string | null
          meeting_mode?: string | null
          meeting_time: string
          mode_choice_1?: string | null
          mode_choice_2?: string | null
          mode_choice_3?: string | null
          proposed_by: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          location?: string | null
          meeting_mode?: string | null
          meeting_time?: string
          mode_choice_1?: string | null
          mode_choice_2?: string | null
          mode_choice_3?: string | null
          proposed_by?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_meeting_proposals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
          job_title?: Database["public"]["Enums"]["team_job"]
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
          display_name: string | null
          id: string
          name: string
          section: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          id?: string
          name: string
          section?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string | null
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
      is_team_pm: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      shares_team: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "student"
      backlog_priority: "low" | "medium" | "high"
      backlog_status: "todo" | "in_progress" | "done" | "shelved"
      team_job:
        | "PM"
        | "Communication Specialist"
        | "Video Specialist"
        | "Company Liaison"
        | "Researcher"
        | "Unassigned"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      backlog_priority: ["low", "medium", "high"],
      backlog_status: ["todo", "in_progress", "done", "shelved"],
      team_job: [
        "PM",
        "Communication Specialist",
        "Video Specialist",
        "Company Liaison",
        "Researcher",
        "Unassigned",
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
