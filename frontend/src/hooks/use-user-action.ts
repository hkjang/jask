import { useCallback } from 'react';

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
  const logAction = useCallback(async (actionType: ActionType, queryId?: string, payload?: any) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      await fetch('/api/evolution/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
  }, []);

  return { logAction };
}
