/**
 * documents.api.ts
 *
 * Typed browser client for the documents workspace API.
 */
import { apiClient, authClient } from "./client";

export type DocumentType = "RICH_TEXT" | "SPREADSHEET";
export type DocumentStatus = "DRAFT" | "FINALISED" | "SIGNED" | "LOCKED";
export type SignatureRequestStatus = "PENDING" | "SIGNED" | "DECLINED";
export type DocumentSigningReadinessStatus =
  | "ready"
  | "needs_login"
  | "needs_identity_verification"
  | "needs_certificate"
  | "not_required_signer"
  | "already_signed"
  | "document_not_finalised"
  | "document_locked"
  | "document_hash_missing";
export type DocumentListScope = "ALL_ACCESSIBLE" | "OWNED" | "SHARED_WITH_ME";
export type CollaboratorInvitationStatus =
  "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
export type DocumentAccessAuditEvent =
  | "INVITE_CREATED"
  | "INVITE_EMAIL_QUEUED"
  | "INVITE_EMAIL_SENT"
  | "INVITE_EMAIL_FAILED"
  | "INVITE_EMAIL_OTP_REQUIRED"
  | "INVITE_EMAIL_OTP_SENT"
  | "INVITE_EMAIL_OTP_FAILED"
  | "INVITE_EMAIL_OTP_PASSED"
  | "INVITE_OPENED"
  | "AUTH_REQUIRED"
  | "LOGIN_COMPLETED"
  | "IDENTITY_VERIFICATION_REQUIRED"
  | "IDENTITY_VERIFICATION_PASSED"
  | "IDENTITY_VERIFICATION_FAILED"
  | "INVITE_ACCEPTED"
  | "INVITE_DECLINED"
  | "INVITE_REVOKED"
  | "PERMISSIONS_UPDATED"
  | "COMMENT_CREATED"
  | "COMMENT_REPLIED"
  | "COMMENT_RESOLVED"
  | "DOCUMENT_SIGNED"
  | "DOCUMENT_LOCKED"
  | "SIGNATURE_REMINDER_SENT"
  | "SIGNATURE_REMINDER_FAILED";
export type CollaboratorPermission =
  "READ" | "COMMENT" | "SIGN" | "EDIT" | "MANAGE_ACCESS";
export type InvitationVerificationRequirement =
  "EMAIL_OTP" | "IDENTITY_VERIFICATION";

export interface DocumentAccessSummary {
  isOwner: boolean;
  role: "OWNER" | "VIEWER" | "EDITOR" | "SIGNER" | null;
  collaboratorId: string | null;
  permissions: CollaboratorPermission[];
  acceptedAt: string | null;
  sharedBy: {
    id: string;
    email: string;
    displayName: string;
  } | null;
}

export interface DocumentCollaboratorAccess {
  id: string;
  userId: string;
  role: "VIEWER" | "EDITOR" | "SIGNER";
  permissions: CollaboratorPermission[];
  verificationRequirements: InvitationVerificationRequirement[];
  invitationStatus: CollaboratorInvitationStatus;
  invitationExpiresAt: string | null;
  invitationEmailSentAt: string | null;
  invitationOpenedAt: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
  note: string | null;
  isActive: boolean;
  user: {
    email: string;
    imageUrl: string | null;
    displayName: string;
    surName: string | null;
    postNames: string | null;
  };
  invitedBy: {
    id: string;
    email: string;
    displayName: string;
  } | null;
}

export interface DocumentAccessListResponse {
  documentId: string;
  title: string;
  collaborators: DocumentCollaboratorAccess[];
}

export interface DocumentAccessAuditUser {
  id: string;
  email: string;
  displayName: string;
}

export interface DocumentAccessAuditEntry {
  id: string;
  eventType: DocumentAccessAuditEvent;
  fromPermissions: CollaboratorPermission[];
  toPermissions: CollaboratorPermission[];
  invitationStatus: CollaboratorInvitationStatus | null;
  metadata: Record<string, string | number | boolean | null> | null;
  createdAt: string;
  actor: DocumentAccessAuditUser | null;
  target: DocumentAccessAuditUser | null;
}

export interface DocumentAccessAuditResponse {
  documentId: string;
  title: string;
  events: DocumentAccessAuditEntry[];
}

export interface DocumentCommentAuthor {
  id: string;
  email: string;
  imageUrl: string | null;
  displayName: string;
}

export interface DocumentComment {
  id: string;
  authorId: string;
  parentCommentId: string | null;
  anchorText: string | null;
  anchorFrom: number | null;
  anchorTo: number | null;
  content: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: DocumentCommentAuthor;
  replies: DocumentComment[];
}

export interface DocumentCommentsResponse {
  documentId: string;
  limit?: number;
  nextCursor: string | null;
  hasMore: boolean;
  comments: DocumentComment[];
}

export interface DocumentSummary {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  tags: string[];
  wordCount: number;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  signedAt: string | null;
  lockedAt: string | null;
  layout: {
    paperSize: "A4";
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    headerFooter: {
      headerEnabled: boolean;
      footerEnabled: boolean;
      pageNumbersEnabled: boolean;
      headerText: string;
      footerText: string;
    };
  };
  access?: DocumentAccessSummary;
}

export interface DocumentSignatureSnapshot {
  signatureId: string | null;
  certificateId: string | null;
  signerName: string | null;
  imageUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Normalized horizontal position of the strip (0.0 = left edge, 1.0 = right edge). */
  x: number | null;
  /** Normalized vertical position of the strip (0.0 = top, 1.0 = bottom). */
  y: number | null;
  signedAt: string | null;
  lockedAt: string | null;
}

export interface DocumentCompletedSignature {
  signatureId: string;
  certificateId: string | null;
  signerId: string;
  signerName: string;
  signerEmail: string;
  imageUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  signedAt: string;
  isOwner: boolean;
}

export interface DocumentSignatureRequestSummary {
  id: string;
  requestedById: string;
  requestedUserId: string;
  status: SignatureRequestStatus;
  personalSignedDocumentId: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nextReminderAvailableAt?: string | null;
  requestedUser?: {
    id: string;
    email: string;
    imageUrl: string | null;
    displayName: string;
    surName: string | null;
    postNames: string | null;
  } | null;
}

export interface DocumentDetail extends DocumentSummary {
  content: Record<string, unknown> | null;
  contentHash: string | null;
  collaborators: DocumentCollaboratorAccess[];
  signatureSnapshot: DocumentSignatureSnapshot | null;
  completedSignatures: DocumentCompletedSignature[];
  signatureRequests: DocumentSignatureRequestSummary[];
  pendingSignatureCount?: number;
}

export interface DocumentSigningReadiness {
  documentId: string;
  status: DocumentSigningReadinessStatus;
  canSign: boolean;
  message: string;
  documentStatus: DocumentStatus | null;
  documentHash: string | null;
  signatureRequestId: string | null;
  signedAt: string | null;
  personalSignedDocumentId: string | null;
  certificateId: string | null;
  certificateExpiresAt: string | null;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  wordCount: number;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  type: DocumentType;
  usageCount: number;
  contentJson?: Record<string, unknown>;
  previewUrl?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentFolderId: string | null;
  subFolders: Folder[];
}

const pendingGetRequests = new Map<string, Promise<unknown>>();

function buildGetRequestKey(path: string, params?: unknown) {
  return `${path}::${JSON.stringify(params ?? null)}`;
}

async function getDeduped<T>(path: string, params?: unknown): Promise<T> {
  const key = buildGetRequestKey(path, params);
  const pending = pendingGetRequests.get(key);

  if (pending) {
    return pending as Promise<T>;
  }

  const request = apiClient
    .get<T>(path, { params })
    .then((res) => res.data)
    .finally(() => {
      pendingGetRequests.delete(key);
    });

  pendingGetRequests.set(key, request as Promise<unknown>);
  return request;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function createDocument(data: {
  title?: string;
  type: DocumentType;
  folderId?: string;
  templateId?: string;
  tags?: string[];
}): Promise<DocumentSummary> {
  const res = await apiClient.post("/documents", data);
  return res.data;
}

export async function listDocuments(params: {
  scope?: DocumentListScope;
  status?: DocumentStatus;
  type?: DocumentType;
  folderId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  total: number;
  page: number;
  limit: number;
  items: DocumentSummary[];
}> {
  return getDeduped("/documents", params);
}

export async function getDocument(
  id: string,
  includeContent = true,
): Promise<DocumentDetail> {
  return getDeduped(`/documents/${id}`, { includeContent });
}

export async function autosaveDocument(
  id: string,
  content: Record<string, unknown>,
  wordCount?: number,
): Promise<{ saved: boolean; versionNumber: number; savedAt: string }> {
  const res = await apiClient.patch(`/documents/${id}/autosave`, {
    content,
    wordCount,
  });
  return res.data;
}

export async function updateDocumentMeta(
  id: string,
  data: {
    title?: string;
    tags?: string[];
    layout?: {
      paperSize?: "A4";
      margins?: Partial<{
        top: number;
        right: number;
        bottom: number;
        left: number;
      }>;
      headerFooter?: Partial<{
        headerEnabled: boolean;
        footerEnabled: boolean;
        pageNumbersEnabled: boolean;
        headerText: string;
        footerText: string;
      }>;
    };
  },
): Promise<DocumentSummary> {
  const res = await apiClient.patch(`/documents/${id}`, data);
  return res.data;
}

export async function copyDocument(id: string): Promise<DocumentSummary> {
  const res = await apiClient.post(`/documents/${id}/copy`);
  return res.data;
}

export async function finaliseDocument(
  id: string,
  data: {
    note?: string;
    requireOwnerSignature?: boolean;
  } = {},
): Promise<
  DocumentSummary & {
    contentHash: string;
    message: string;
    completedSignatures: DocumentCompletedSignature[];
    signatureRequests: DocumentSignatureRequestSummary[];
    pendingSignatureCount: number;
  }
> {
  const res = await apiClient.post(`/documents/${id}/finalise`, data);
  return res.data;
}

export async function signDocumentInOneStep(
  id: string,
  documentHash: string,
  documentName: string,
): Promise<
  DocumentSummary & {
    signatureId: string;
    signatureBytes: string | null;
    message: string;
    completedSignatures: DocumentCompletedSignature[];
    signatureSnapshot: DocumentSignatureSnapshot | null;
    signatureRequests: DocumentSignatureRequestSummary[];
    pendingSignatureCount: number;
  }
> {
  const res = await authClient.post(`/documents/${id}/sign`, {
    documentHash,
    documentName,
  });
  return res.data;
}

export async function getDocumentSigningReadiness(
  id: string,
): Promise<DocumentSigningReadiness> {
  const res = await apiClient.get<DocumentSigningReadiness>(
    `/documents/${id}/signing-readiness`,
    { validateStatus: (status) => status < 500 },
  );

  if (res.status === 401) {
    return {
      documentId: id,
      status: "needs_login",
      canSign: false,
      message:
        "Sign in with the required account before signing this document.",
      documentStatus: null,
      documentHash: null,
      signatureRequestId: null,
      signedAt: null,
      personalSignedDocumentId: null,
      certificateId: null,
      certificateExpiresAt: null,
    };
  }

  return res.data;
}

export async function lockDocument(id: string): Promise<
  DocumentSummary & {
    message: string;
    completedSignatures: DocumentCompletedSignature[];
    signatureSnapshot: DocumentSignatureSnapshot | null;
    signatureRequests: DocumentSignatureRequestSummary[];
    pendingSignatureCount: number;
  }
> {
  const res = await apiClient.post(`/documents/${id}/lock`);
  return res.data;
}

export async function updateSignatureLayout(
  id: string,
  position: { x: number; y: number },
): Promise<
  DocumentSummary & { signatureSnapshot: DocumentSignatureSnapshot | null }
> {
  const res = await apiClient.patch(
    `/documents/${id}/signature-layout`,
    position,
  );
  return res.data;
}

/**
 * Triggers a PDF export for a locked document and initiates a browser download.
 * The PDF places the signature strip at the same normalized x/y as the HTML render.
 */
export async function exportDocumentAsPdf(
  id: string,
  title: string,
): Promise<void> {
  const res = await apiClient.get(`/documents/${id}/export/pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(res.data as Blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-zA-Z0-9-_]/g, "_")}-signed.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function deleteDocument(
  id: string,
): Promise<{ deleted: boolean }> {
  const res = await apiClient.delete(`/documents/${id}`);
  return res.data;
}

export async function getVersions(id: string): Promise<DocumentVersion[]> {
  const res = await apiClient.get(`/documents/${id}/versions`);
  return res.data;
}

export async function restoreVersion(
  id: string,
  versionNumber: number,
): Promise<{ restored: boolean; versionNumber: number }> {
  const res = await apiClient.post(
    `/documents/${id}/versions/${versionNumber}/restore`,
  );
  return res.data;
}

export async function shareDocumentAccess(
  id: string,
  data: {
    userId: string;
    permissions: CollaboratorPermission[];
    verificationRequirements?: InvitationVerificationRequirement[];
    note?: string;
    expiresInDays?: number;
  },
): Promise<{
  id: string;
  userId: string;
  permissions: CollaboratorPermission[];
  invitationStatus: string;
  emailStatus: "sent" | "failed" | "not_required";
}> {
  const res = await apiClient.post(`/documents/${id}/access`, data);
  return res.data;
}

export async function getDocumentAccessList(
  id: string,
): Promise<DocumentAccessListResponse> {
  const res = await apiClient.get(`/documents/${id}/access`);
  return res.data;
}

export async function updateDocumentAccess(
  id: string,
  collaboratorId: string,
  permissions: CollaboratorPermission[],
): Promise<DocumentCollaboratorAccess> {
  const res = await apiClient.patch(
    `/documents/${id}/access/${collaboratorId}`,
    {
      permissions,
    },
  );
  return res.data;
}

export async function revokeDocumentAccess(
  id: string,
  collaboratorId: string,
): Promise<{ revoked: boolean; collaboratorId: string }> {
  const res = await apiClient.delete(
    `/documents/${id}/access/${collaboratorId}`,
  );
  return res.data;
}

export async function resendDocumentInvitation(
  id: string,
  collaboratorId: string,
): Promise<DocumentCollaboratorAccess & { emailStatus: "sent" | "failed" }> {
  const res = await apiClient.post(
    `/documents/${id}/access/${collaboratorId}/resend`,
  );
  return res.data;
}

export async function sendSignatureReminder(
  id: string,
  requestId: string,
): Promise<{
  sent: boolean;
  requestId: string;
  sentAt: string;
  nextReminderAvailableAt: string;
}> {
  const res = await apiClient.post(
    `/documents/${id}/signature-requests/${requestId}/remind`,
  );
  return res.data;
}

export async function getDocumentAccessAuditLog(
  id: string,
  limit = 50,
): Promise<DocumentAccessAuditResponse> {
  const res = await apiClient.get(`/documents/${id}/access/audit`, {
    params: { limit },
  });
  return res.data;
}

export async function listDocumentComments(
  id: string,
  limit = 50,
  cursor?: string | null,
): Promise<DocumentCommentsResponse> {
  const res = await apiClient.get(`/documents/${id}/comments`, {
    params: { limit, ...(cursor ? { cursor } : {}) },
  });
  return res.data;
}

export async function createDocumentComment(
  id: string,
  data: {
    content: string;
    anchorText?: string;
    anchorFrom?: number;
    anchorTo?: number;
    parentCommentId?: string;
  },
): Promise<DocumentComment> {
  const res = await apiClient.post(`/documents/${id}/comments`, data);
  return res.data;
}

export async function resolveDocumentComment(
  id: string,
  commentId: string,
): Promise<DocumentComment> {
  const res = await apiClient.patch(
    `/documents/${id}/comments/${commentId}/resolve`,
  );
  return res.data;
}

export interface VerifyDocumentResponse {
  verified: boolean;
  documentId?: string;
  title?: string;
  contentHash?: string;
  signedBy?: { name: string };
  signedAt?: string;
  lockedAt?: string;
  signers?: Array<{
    name: string;
    email: string;
    signedAt: string;
    isOwner: boolean;
    signingOrder: number;
  }>;
  message?: string;
}

export async function verifyDocument(
  id: string,
): Promise<VerifyDocumentResponse> {
  const res = await apiClient.get(`/documents/${id}/verify`);
  return res.data;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(params?: {
  category?: string;
  type?: DocumentType;
}): Promise<Template[]> {
  const res = await apiClient.get("/templates", { params });
  return res.data;
}

export async function getTemplate(id: string): Promise<Template> {
  const res = await apiClient.get(`/templates/${id}`);
  return res.data;
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function listFolders(): Promise<Folder[]> {
  const res = await apiClient.get("/folders");
  return res.data;
}

export async function createFolder(data: {
  name: string;
  parentFolderId?: string;
}): Promise<Folder> {
  const res = await apiClient.post("/folders", data);
  return res.data;
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const res = await apiClient.patch(`/folders/${id}/rename`, { name });
  return res.data;
}

export async function deleteFolder(id: string): Promise<{ deleted: boolean }> {
  const res = await apiClient.delete(`/folders/${id}`);
  return res.data;
}
