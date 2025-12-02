import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type AuditAction = 'create' | 'update' | 'delete';
export type AuditEntity = 'person' | 'course' | 'discipline';

interface AuditLogEntry {
  userId: string;
  userEmail: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityName: string;
  changes?: Record<string, { before: any; after: any }>;
  timestamp: any;
}

export const useAuditLog = () => {
  const logAction = async (
    userId: string,
    userEmail: string,
    action: AuditAction,
    entity: AuditEntity,
    entityId: string,
    entityName: string,
    changes?: Record<string, { before: any; after: any }>
  ) => {
    try {
      const auditLog: AuditLogEntry = {
        userId,
        userEmail,
        action,
        entity,
        entityId,
        entityName,
        changes,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'audit-log'), auditLog);
    } catch (error) {
      console.error('Erro ao registrar auditoria:', error);
    }
  };

  return { logAction };
};
