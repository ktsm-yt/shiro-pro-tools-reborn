import { supabase } from './client';

export async function ensureAnonymousAuth(): Promise<string | null> {
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user.id;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
        console.error('Anonymous auth failed:', error.message);
        return null;
    }
    return data.user?.id ?? null;
}

export function onAuthStateChange(callback: (userId: string | null) => void) {
    if (!supabase) return { unsubscribe: () => {} };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user?.id ?? null);
    });
    return subscription;
}
