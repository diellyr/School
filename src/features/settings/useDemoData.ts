import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { DEMO_ORG_ID } from '../../db/demoIds';
import { loadDemoData, removeDemoData } from '../../db/seedDemoData';
import { useAuthStore } from '../../auth/authStore';

export function useDemoDataStatus() {
  return useLiveQuery(async () => !!(await db.organizations.get(DEMO_ORG_ID)), []);
}

export function useDemoDataActions() {
  const [loading, setLoading] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const session = useAuthStore((s) => s.session);

  async function handleLoad() {
    setLoading(true);
    try {
      await loadDemoData();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    try {
      await removeDemoData();
      // Se o usuário atual era um usuário demo, a conta acabou de ser removida.
      if (session?.user.isDemo) logout();
    } finally {
      setLoading(false);
    }
  }

  return { loading, handleLoad, handleRemove };
}
