CREATE TABLE "document_analysis_summary" (
	"document_id" text PRIMARY KEY NOT NULL,
	"pattern_counts" text NOT NULL,
	"top_patterns" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_custom_fields" (
	"document_id" text NOT NULL,
	"field_id" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "document_custom_fields_document_id_field_id_pk" PRIMARY KEY("document_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "document_tags" (
	"document_id" text NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "document_tags_document_id_tag_pk" PRIMARY KEY("document_id","tag")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text,
	"word_count" integer,
	"sentence_count" integer,
	"mean_heat" real,
	"status" text DEFAULT 'draft',
	"folder_id" text,
	"workspace_id" text,
	"due_date" text,
	"status_changed_at" text,
	"status_changed_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"workspace_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pattern_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" text NOT NULL,
	"change_summary" text,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"pattern_id" text NOT NULL,
	"taxonomy_id" text,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"scope" text DEFAULT 'user' NOT NULL,
	"user_id" text NOT NULL,
	"heat_weight" real DEFAULT 1 NOT NULL,
	"self_amplification" text DEFAULT 'med' NOT NULL,
	"detection_hint" text NOT NULL,
	"rewrite_menu" text DEFAULT '[]' NOT NULL,
	"pce_directive" text DEFAULT '' NOT NULL,
	"tolerance_overrides" text DEFAULT '{}' NOT NULL,
	"description" text DEFAULT '',
	"examples" text DEFAULT '[]',
	"false_positives" text DEFAULT '[]',
	"substitutions" text DEFAULT '[]',
	"false_substitutions" text DEFAULT '[]',
	"tags" text DEFAULT '[]',
	"severity" text DEFAULT 'medium',
	"related_patterns" text DEFAULT '[]',
	"detection_notes" text,
	"research_sources" text DEFAULT '[]',
	"forked_from" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"created_by" text NOT NULL,
	"permission" text DEFAULT 'view' NOT NULL,
	"token" text NOT NULL,
	"expires_at" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "style_guides" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"targets" text NOT NULL,
	"is_builtin" boolean DEFAULT false,
	"is_premium" boolean DEFAULT false NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"author" text,
	"user_id" text,
	"workspace_id" text,
	"exemplar_word_count" integer,
	"source_description" text
);
--> statement-breakpoint
CREATE TABLE "style_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"style_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" text NOT NULL,
	"change_summary" text,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "styles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"policy" text DEFAULT '{}' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_prompts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "system_prompts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"content_format" text DEFAULT 'plaintext',
	"default_tags" text,
	"default_style" text,
	"is_shared" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"settings" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "document_analysis_summary" ADD CONSTRAINT "document_analysis_summary_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_custom_fields" ADD CONSTRAINT "document_custom_fields_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_versions" ADD CONSTRAINT "pattern_versions_pattern_id_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_versions" ADD CONSTRAINT "pattern_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patterns" ADD CONSTRAINT "patterns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_guides" ADD CONSTRAINT "style_guides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_versions" ADD CONSTRAINT "style_versions_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_versions" ADD CONSTRAINT "style_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_prompts" ADD CONSTRAINT "system_prompts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_document_tags_tag" ON "document_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "idx_documents_user" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_updated" ON "documents" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_documents_folder" ON "documents" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "idx_documents_workspace" ON "documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_folders_user" ON "folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_folders_parent" ON "folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_folders_workspace" ON "folders" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_pattern_versions" ON "pattern_versions" USING btree ("pattern_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_patterns_user" ON "patterns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_patterns_level" ON "patterns" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_patterns_unique" ON "patterns" USING btree ("pattern_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_saved_searches_workspace" ON "saved_searches" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_share_links_token" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_share_links_document" ON "share_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_style_guides_user" ON "style_guides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_style_versions" ON "style_versions" USING btree ("style_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_styles_user" ON "styles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_styles_user_name_unique" ON "styles" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "idx_templates_workspace" ON "templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_templates_user" ON "templates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_workspaces_owner_slug" ON "workspaces" USING btree ("owner_id","slug");