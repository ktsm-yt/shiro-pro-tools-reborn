import { useEffect, useState } from 'react';
import { ensureAnonymousAuth, onAuthStateChange } from '../../core/database/auth';

export function useAuth() {
    const [userId, setUserId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        ensureAnonymousAuth().then(id => {
            setUserId(id);
            setIsReady(true);
        });

        const subscription = onAuthStateChange(setUserId);
        return () => subscription.unsubscribe();
    }, []);

    return { userId, isReady };
}
