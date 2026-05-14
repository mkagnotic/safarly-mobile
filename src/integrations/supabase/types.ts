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
      activity_feed: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          category: string | null
          content: string
          cover_image_url: string | null
          created_at: string
          id: string
          published_at: string | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          category?: string | null
          content: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          category?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_timeline: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          description: string | null
          event: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          description?: string | null
          event: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          description?: string | null
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_timeline_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          carrier_id: string
          carrier_request_id: string
          created_at: string
          delivered_at: string | null
          delivery_otp_attempts: number
          delivery_otp_expires_at: string | null
          delivery_otp_hash: string | null
          delivery_proof_url: string | null
          id: string
          parcel_id: string
          pickup_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          carrier_id: string
          carrier_request_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_otp_attempts?: number
          delivery_otp_expires_at?: string | null
          delivery_otp_hash?: string | null
          delivery_proof_url?: string | null
          id?: string
          parcel_id: string
          pickup_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          carrier_id?: string
          carrier_request_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_otp_attempts?: number
          delivery_otp_expires_at?: string | null
          delivery_otp_hash?: string | null
          delivery_proof_url?: string | null
          id?: string
          parcel_id?: string
          pickup_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_carrier_request_id_fkey"
            columns: ["carrier_request_id"]
            isOneToOne: false
            referencedRelation: "carrier_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcel_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_connections: {
        Row: {
          conversation_id: string | null
          created_at: string
          disconnected_at: string | null
          id: string
          request_id: string | null
          user_1: string
          user_2: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          request_id?: string | null
          user_1: string
          user_2: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          request_id?: string | null
          user_1?: string
          user_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_connections_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_connections_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "buddy_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_connections_user_1_fkey"
            columns: ["user_1"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_connections_user_1_fkey"
            columns: ["user_1"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_connections_user_2_fkey"
            columns: ["user_2"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_connections_user_2_fkey"
            columns: ["user_2"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_listings: {
        Row: {
          age: number | null
          airline: string | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          from_city: string
          id: string
          interests: string | null
          languages: string[] | null
          layover: string | null
          to_city: string
          travel_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          airline?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          from_city: string
          id?: string
          interests?: string | null
          languages?: string[] | null
          layover?: string | null
          to_city: string
          travel_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          airline?: string | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          from_city?: string
          id?: string
          interests?: string | null
          languages?: string[] | null
          layover?: string | null
          to_city?: string
          travel_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buddy_requests: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          message: string | null
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["buddy_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["buddy_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["buddy_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "buddy_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      career_positions: {
        Row: {
          created_at: string
          department: string | null
          description: string
          id: string
          is_active: boolean
          location: string | null
          requirements: string | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description: string
          id?: string
          is_active?: boolean
          location?: string | null
          requirements?: string | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string
          id?: string
          is_active?: boolean
          location?: string | null
          requirements?: string | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      carrier_requests: {
        Row: {
          carrier_id: string
          created_at: string
          id: string
          message: string | null
          offer_amount: number
          parcel_id: string
          status: Database["public"]["Enums"]["carrier_request_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          carrier_id: string
          created_at?: string
          id?: string
          message?: string | null
          offer_amount: number
          parcel_id: string
          status?: Database["public"]["Enums"]["carrier_request_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          carrier_id?: string
          created_at?: string
          id?: string
          message?: string | null
          offer_amount?: number
          parcel_id?: string
          status?: Database["public"]["Enums"]["carrier_request_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_requests_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_requests_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_requests_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcel_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "travel_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          context_id: string | null
          context_type: Database["public"]["Enums"]["conversation_context"]
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          declined_by: string | null
          id: string
          last_message_at: string | null
          last_message_text: string | null
          match_status: string
          matched_at: string | null
          matched_by: string | null
          participant_1: string
          participant_2: string
        }
        Insert: {
          context_id?: string | null
          context_type?: Database["public"]["Enums"]["conversation_context"]
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          declined_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          participant_1: string
          participant_2: string
        }
        Update: {
          context_id?: string | null
          context_type?: Database["public"]["Enums"]["conversation_context"]
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          declined_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          participant_1?: string
          participant_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_evidence: {
        Row: {
          dispute_id: string
          id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          dispute_id: string
          id?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          dispute_id?: string
          id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          created_at: string
          dispute_id: string
          id: string
          is_admin: boolean
          sender_id: string
          text: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          is_admin?: boolean
          sender_id: string
          text: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          is_admin?: boolean
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          booking_id: string
          category: Database["public"]["Enums"]["dispute_category"]
          created_at: string
          description: string
          filed_by: string
          id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          category: Database["public"]["Enums"]["dispute_category"]
          created_at?: string
          description: string
          filed_by: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          category?: Database["public"]["Enums"]["dispute_category"]
          created_at?: string
          description?: string
          filed_by?: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_filed_by_fkey"
            columns: ["filed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_filed_by_fkey"
            columns: ["filed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_document_files: {
        Row: {
          file_type: Database["public"]["Enums"]["kyc_file_type"]
          id: string
          kyc_document_id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          file_type: Database["public"]["Enums"]["kyc_file_type"]
          id?: string
          kyc_document_id: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          file_type?: Database["public"]["Enums"]["kyc_file_type"]
          id?: string
          kyc_document_id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_document_files_kyc_document_id_fkey"
            columns: ["kyc_document_id"]
            isOneToOne: false
            referencedRelation: "kyc_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          id: string
          provider_session_id: string | null
          provider_verification_url: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["kyc_doc_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          id?: string
          provider_session_id?: string | null
          provider_verification_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["kyc_doc_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"]
          id?: string
          provider_session_id?: string | null
          provider_verification_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["kyc_doc_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          message_id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          message_id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          conversation_id: string
          created_at: string
          from_user_id: string
          id: string
          read_at: string | null
          text: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          conversation_id: string
          created_at?: string
          from_user_id: string
          id?: string
          read_at?: string | null
          text: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          conversation_id?: string
          created_at?: string
          from_user_id?: string
          id?: string
          read_at?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      parcel_images: {
        Row: {
          display_order: number
          id: string
          parcel_id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          display_order?: number
          id?: string
          parcel_id: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          display_order?: number
          id?: string
          parcel_id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcel_images_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcel_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_requests: {
        Row: {
          any_from: boolean
          any_to: boolean
          carrier_id: string | null
          category: Database["public"]["Enums"]["parcel_category"]
          created_at: string
          deleted_at: string | null
          delivery_by: string
          description: string | null
          fee_offered: number
          flag_reason: string | null
          from_city: string
          from_country: string
          id: string
          is_flagged: boolean
          sender_id: string
          status: Database["public"]["Enums"]["parcel_status"]
          to_city: string
          to_country: string
          updated_at: string
          weight: number
        }
        Insert: {
          any_from?: boolean
          any_to?: boolean
          carrier_id?: string | null
          category: Database["public"]["Enums"]["parcel_category"]
          created_at?: string
          deleted_at?: string | null
          delivery_by: string
          description?: string | null
          fee_offered: number
          flag_reason?: string | null
          from_city: string
          from_country: string
          id?: string
          is_flagged?: boolean
          sender_id: string
          status?: Database["public"]["Enums"]["parcel_status"]
          to_city: string
          to_country: string
          updated_at?: string
          weight: number
        }
        Update: {
          any_from?: boolean
          any_to?: boolean
          carrier_id?: string | null
          category?: Database["public"]["Enums"]["parcel_category"]
          created_at?: string
          deleted_at?: string | null
          delivery_by?: string
          description?: string | null
          fee_offered?: number
          flag_reason?: string | null
          from_city?: string
          from_country?: string
          id?: string
          is_flagged?: boolean
          sender_id?: string
          status?: Database["public"]["Enums"]["parcel_status"]
          to_city?: string
          to_country?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcel_requests_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_requests_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["device_platform"]
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["device_platform"]
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["device_platform"]
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          author_id: string
          booking_id: string | null
          connection_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          rated_user_id: string
          review: string | null
          score: number
          type: Database["public"]["Enums"]["rating_type"]
          updated_at: string
        }
        Insert: {
          author_id: string
          booking_id?: string | null
          connection_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          rated_user_id: string
          review?: string | null
          score: number
          type?: Database["public"]["Enums"]["rating_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          booking_id?: string | null
          connection_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          rated_user_id?: string
          review?: string | null
          score?: number
          type?: Database["public"]["Enums"]["rating_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "buddy_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_user_id_fkey"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_user_id_fkey"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          avatar_initials: string
          created_at: string
          id: string
          is_featured: boolean
          location: string
          name: string
          rating: number
          text: string
        }
        Insert: {
          avatar_initials: string
          created_at?: string
          id?: string
          is_featured?: boolean
          location: string
          name: string
          rating?: number
          text: string
        }
        Update: {
          avatar_initials?: string
          created_at?: string
          id?: string
          is_featured?: boolean
          location?: string
          name?: string
          rating?: number
          text?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          net_amount: number | null
          platform_fee: number | null
          status: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id: string | null
          stripe_payout_id: string | null
          stripe_refund_id: string | null
          stripe_transfer_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          net_amount?: number | null
          platform_fee?: number | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          net_amount?: number | null
          platform_fee?: number | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_listings: {
        Row: {
          airline: string | null
          any_from: boolean
          any_to: boolean
          carrier_id: string
          created_at: string
          deleted_at: string | null
          from_city: string
          from_country: string
          id: string
          luggage_capacity: number
          offers_count: number
          open_to_buddy: boolean
          status: Database["public"]["Enums"]["trip_status"]
          to_city: string
          to_country: string
          travel_date: string
          updated_at: string
        }
        Insert: {
          airline?: string | null
          any_from?: boolean
          any_to?: boolean
          carrier_id: string
          created_at?: string
          deleted_at?: string | null
          from_city: string
          from_country: string
          id?: string
          luggage_capacity: number
          offers_count?: number
          open_to_buddy?: boolean
          status?: Database["public"]["Enums"]["trip_status"]
          to_city: string
          to_country: string
          travel_date: string
          updated_at?: string
        }
        Update: {
          airline?: string | null
          any_from?: boolean
          any_to?: boolean
          carrier_id?: string
          created_at?: string
          deleted_at?: string | null
          from_city?: string
          from_country?: string
          id?: string
          luggage_capacity?: number
          offers_count?: number
          open_to_buddy?: boolean
          status?: Database["public"]["Enums"]["trip_status"]
          to_city?: string
          to_country?: string
          travel_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_listings_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_listings_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          currency: string
          date_format: string | null
          email_notifications: boolean
          id: string
          language: string
          push_enabled: boolean
          sms_enabled: boolean
          theme: Database["public"]["Enums"]["theme_preference"]
          time_format: Database["public"]["Enums"]["time_format"]
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          date_format?: string | null
          email_notifications?: boolean
          id?: string
          language?: string
          push_enabled?: boolean
          sms_enabled?: boolean
          theme?: Database["public"]["Enums"]["theme_preference"]
          time_format?: Database["public"]["Enums"]["time_format"]
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          date_format?: string | null
          email_notifications?: boolean
          id?: string
          language?: string
          push_enabled?: boolean
          sms_enabled?: boolean
          theme?: Database["public"]["Enums"]["theme_preference"]
          time_format?: Database["public"]["Enums"]["time_format"]
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          flag_reason: string | null
          id: string
          is_flagged: boolean
          is_suspended: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          name: string | null
          on_time_rate: number | null
          rating: number | null
          response_rate: number | null
          role: Database["public"]["Enums"]["user_role"]
          stripe_connect_id: string | null
          stripe_customer_id: string | null
          terms_accepted_at: string | null
          total_deliveries: number
          total_trips: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          flag_reason?: string | null
          id: string
          is_flagged?: boolean
          is_suspended?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name?: string | null
          on_time_rate?: number | null
          rating?: number | null
          response_rate?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          stripe_connect_id?: string | null
          stripe_customer_id?: string | null
          terms_accepted_at?: string | null
          total_deliveries?: number
          total_trips?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          is_suspended?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          name?: string | null
          on_time_rate?: number | null
          rating?: number | null
          response_rate?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          stripe_connect_id?: string | null
          stripe_customer_id?: string | null
          terms_accepted_at?: string | null
          total_deliveries?: number
          total_trips?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          role_interest: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role_interest?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role_interest?: string | null
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          id: string
          in_escrow: number
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          in_escrow?: number
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          id?: string
          in_escrow?: number
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string | null
          id: string | null
          name: string | null
          on_time_rate: number | null
          rating: number | null
          response_rate: number | null
          role: Database["public"]["Enums"]["user_role"] | null
          total_deliveries: number | null
          total_trips: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          on_time_rate?: number | null
          rating?: number | null
          response_rate?: number | null
          role?: Database["public"]["Enums"]["user_role"] | null
          total_deliveries?: number | null
          total_trips?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          on_time_rate?: number | null
          rating?: number | null
          response_rate?: number | null
          role?: Database["public"]["Enums"]["user_role"] | null
          total_deliveries?: number | null
          total_trips?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      find_buddy_matches: {
        Args: { p_listing_id: string }
        Returns: {
          airline: string
          bio: string
          from_city: string
          listing_id: string
          match_score: number
          to_city: string
          travel_date: string
          user_id: string
          user_name: string
        }[]
      }
      find_matches_for_parcel: {
        Args: { p_parcel_id: string }
        Returns: {
          airline: string
          carrier_id: string
          carrier_name: string
          from_city: string
          luggage_capacity: number
          match_score: number
          open_to_buddy: boolean
          to_city: string
          travel_date: string
          trip_id: string
        }[]
      }
      find_matches_for_trip: {
        Args: { p_trip_id: string }
        Returns: {
          category: Database["public"]["Enums"]["parcel_category"]
          delivery_by: string
          fee_offered: number
          from_city: string
          match_score: number
          parcel_id: string
          sender_id: string
          sender_name: string
          to_city: string
          weight: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_offers_count: {
        Args: { trip_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      booking_status:
        | "pending_payment"
        | "confirmed"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "disputed"
      buddy_request_status: "pending" | "accepted" | "rejected"
      carrier_request_status: "pending" | "accepted" | "rejected" | "withdrawn"
      conversation_context: "booking" | "buddy" | "support"
      device_platform: "ios" | "android" | "web"
      dispute_category:
        | "damaged"
        | "late_delivery"
        | "wrong_items"
        | "missing_items"
        | "no_show"
        | "other"
      dispute_status: "open" | "investigating" | "resolved" | "escalated"
      doc_type: "passport" | "drivers_license" | "national_id"
      kyc_doc_status: "pending" | "approved" | "rejected"
      kyc_file_type: "doc_front" | "doc_back" | "selfie"
      kyc_status: "none" | "pending" | "approved" | "rejected"
      notification_type:
        | "booking"
        | "payment"
        | "message"
        | "dispute"
        | "kyc"
        | "rating"
        | "buddy"
        | "system"
      parcel_category:
        | "electronics"
        | "documents"
        | "clothing"
        | "food"
        | "medicine"
        | "personal"
      parcel_status:
        | "open"
        | "matched"
        | "in_transit"
        | "delivered"
        | "disputed"
        | "cancelled"
        | "expired"
        | "looking_for_match"
        | "chatting"
        | "match_requested"
        | "completed"
        | "archived"
      rating_type: "delivery" | "buddy"
      report_reason: "spam" | "harassment" | "fraud" | "other"
      theme_preference: "light" | "dark" | "system"
      time_format: "12h" | "24h"
      transaction_status:
        | "pending"
        | "held"
        | "completed"
        | "refunded"
        | "failed"
      transaction_type:
        | "payment"
        | "payout"
        | "refund"
        | "wallet_topup"
        | "wallet_withdrawal"
      trip_status:
        | "active"
        | "completed"
        | "cancelled"
        | "expired"
        | "looking_for_match"
        | "chatting"
        | "match_requested"
        | "matched"
        | "in_transit"
        | "delivered"
        | "archived"
      user_role: "receiver" | "carrier" | "both"
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
      app_role: ["admin", "moderator", "user"],
      booking_status: [
        "pending_payment",
        "confirmed",
        "in_transit",
        "delivered",
        "cancelled",
        "disputed",
      ],
      buddy_request_status: ["pending", "accepted", "rejected"],
      carrier_request_status: ["pending", "accepted", "rejected", "withdrawn"],
      conversation_context: ["booking", "buddy", "support"],
      device_platform: ["ios", "android", "web"],
      dispute_category: [
        "damaged",
        "late_delivery",
        "wrong_items",
        "missing_items",
        "no_show",
        "other",
      ],
      dispute_status: ["open", "investigating", "resolved", "escalated"],
      doc_type: ["passport", "drivers_license", "national_id"],
      kyc_doc_status: ["pending", "approved", "rejected"],
      kyc_file_type: ["doc_front", "doc_back", "selfie"],
      kyc_status: ["none", "pending", "approved", "rejected"],
      notification_type: [
        "booking",
        "payment",
        "message",
        "dispute",
        "kyc",
        "rating",
        "buddy",
        "system",
      ],
      parcel_category: [
        "electronics",
        "documents",
        "clothing",
        "food",
        "medicine",
        "personal",
      ],
      parcel_status: [
        "open",
        "matched",
        "in_transit",
        "delivered",
        "disputed",
        "cancelled",
        "expired",
        "looking_for_match",
        "chatting",
        "match_requested",
        "completed",
        "archived",
      ],
      rating_type: ["delivery", "buddy"],
      report_reason: ["spam", "harassment", "fraud", "other"],
      theme_preference: ["light", "dark", "system"],
      time_format: ["12h", "24h"],
      transaction_status: [
        "pending",
        "held",
        "completed",
        "refunded",
        "failed",
      ],
      transaction_type: [
        "payment",
        "payout",
        "refund",
        "wallet_topup",
        "wallet_withdrawal",
      ],
      trip_status: [
        "active",
        "completed",
        "cancelled",
        "expired",
        "looking_for_match",
        "chatting",
        "match_requested",
        "matched",
        "in_transit",
        "delivered",
        "archived",
      ],
      user_role: ["receiver", "carrier", "both"],
    },
  },
} as const
