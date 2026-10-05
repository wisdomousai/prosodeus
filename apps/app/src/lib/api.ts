import type { TokenStorage } from "@prosodeus/shared/browser";
import { ApiClient } from "@prosodeus/shared/browser";

// Web-specific TokenStorage using localStorage
const webTokenStorage: TokenStorage = {
  async getToken() {
    return localStorage.getItem("prosodeus_token");
  },
  async setToken(token: string) {
    localStorage.setItem("prosodeus_token", token);
  },
  async removeToken() {
    localStorage.removeItem("prosodeus_token");
  },
};

const API_BASE = import.meta.env.VITE_API_URL || "";

const client = new ApiClient(API_BASE, webTokenStorage);

// Re-export types
export type {
  DocumentMeta,
  DocumentStatus,
  FolderMeta,
  ModelInfo,
  PatternCreateRequest,
  PatternDetail,
  PatternExportPayload,
  PatternImportRequest,
  PatternImportResult,
  PatternLevel,
  PatternListItem,
  PatternListResponse,
  PatternScope,
  PatternSeverity,
  PatternUpdateRequest,
  PatternVersion,
  StyleInfo,
  TemplateMeta,
  UserProfile,
  UserStyle,
  UserStyleCreateRequest,
  UserStyleUpdateRequest,
  UserStyleVersion,
  WorkspaceAnalytics,
  WorkspaceMeta,
  WorkspaceSettings,
} from "@prosodeus/shared/browser";

// Re-export functions for backward compatibility with existing web app code
export const createDocument = client.createDocument.bind(client);
export const listDocuments = client.listDocuments.bind(client);
export const getDocument = client.getDocument.bind(client);
export const updateDocument = client.updateDocument.bind(client);
export const deleteDocument = client.deleteDocument.bind(client);
export const fetchStyles = client.fetchStyles.bind(client);
export const fetchModels = client.fetchModels.bind(client);
export const createFolder = client.createFolder.bind(client);
export const listFolders = client.listFolders.bind(client);
export const renameFolder = client.renameFolder.bind(client);
export const updateFolder = client.updateFolder.bind(client);
export const deleteFolder = client.deleteFolder.bind(client);
export const getMe = client.getMe.bind(client);

// Workspaces
export const createWorkspace = client.createWorkspace.bind(client);
export const listWorkspaces = client.listWorkspaces.bind(client);
export const updateWorkspace = client.updateWorkspace.bind(client);
export const deleteWorkspace = client.deleteWorkspace.bind(client);
export const getWorkspaceAnalytics = client.getWorkspaceAnalytics.bind(client);

// Tags
export const addDocumentTags = client.addDocumentTags.bind(client);
export const removeDocumentTag = client.removeDocumentTag.bind(client);
export const listWorkspaceTags = client.listWorkspaceTags.bind(client);

// Templates
export const createTemplate = client.createTemplate.bind(client);
export const listTemplates = client.listTemplates.bind(client);
export const deleteTemplate = client.deleteTemplate.bind(client);

// Share Links
export const createShareLink = client.createShareLink.bind(client);
export const listShareLinks = client.listShareLinks.bind(client);
export const deleteShareLink = client.deleteShareLink.bind(client);

// Pattern management
export const listPatterns = client.listPatterns.bind(client);
export const getPattern = client.getPattern.bind(client);
export const createPattern = client.createPattern.bind(client);
export const updatePattern = client.updatePattern.bind(client);
export const deletePattern = client.deletePattern.bind(client);
export const togglePattern = client.togglePattern.bind(client);
export const forkPattern = client.forkPattern.bind(client);
export const exportPatterns = client.exportPatterns.bind(client);
export const importPatterns = client.importPatterns.bind(client);
export const getPatternVersions = client.getPatternVersions.bind(client);
export const revertPattern = client.revertPattern.bind(client);
export const suggestPatternFromSentence = client.suggestPatternFromSentence.bind(client);

// User-defined styles
export const listUserStyles = client.listUserStyles.bind(client);
export const getUserStyle = client.getUserStyle.bind(client);
export const createUserStyle = client.createUserStyle.bind(client);
export const updateUserStyle = client.updateUserStyle.bind(client);
export const deleteUserStyle = client.deleteUserStyle.bind(client);
export const listUserStyleVersions = client.listUserStyleVersions.bind(client);
