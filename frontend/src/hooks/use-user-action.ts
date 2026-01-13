import { useCallback } from 'react';
import { useSession } from 'next-auth/react';

export enum ActionType {
  QUERY = 'QUERY',
  EDIT = 'EDIT',
  EXECUTE = 'EXECUTE',
  RE_ASK = 'RE_ASK',
  RATE = 'RATE',
  SAVE = 'SAVE',
  ABANDON = 'ABANDON',
}

export function useUserAction() {
  const { data: session } = useSession();

  const logAction = useCallback(async (actionType: ActionType, queryId?: string, payload?: any) => {
    if (!session?.user) return;

    try {
      await fetch('/api/evolution/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(session as any).accessToken}`, // Assuming access token handling
        },
        body: JSON.stringify({
          actionType,
          queryId,
          payload,
        }),
      });
    } catch (error) {
      console.error('Failed to log user action', error);
    }
  }, [session]);

  return { logAction };
}
