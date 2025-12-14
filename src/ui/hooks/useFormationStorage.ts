import { useState, useCallback, useEffect } from 'react';
import type { Formation } from '../../core/types';
import type { StoredFormation } from '../../core/storage/types';
import { createStoredFormation, loadFormations, saveFormations } from '../../core/storage';

export function useFormationStorage() {
    const [savedFormations, setSavedFormations] = useState<StoredFormation[]>([]);

    useEffect(() => {
        setSavedFormations(loadFormations());
    }, []);

    const saveFormation = useCallback((name: string, formation: Formation) => {
        const newEntry = createStoredFormation(name, formation);
        const current = loadFormations();
        const updated = [...current, newEntry];
        saveFormations(updated);
        setSavedFormations(updated);
    }, []);

    const deleteFormation = useCallback((id: string) => {
        const current = loadFormations();
        const updated = current.filter(f => f.id !== id);
        saveFormations(updated);
        setSavedFormations(updated);
        // If necessary, also update the last loaded state or simply let the user handle it
    }, []);

    // Optionally update an existing formation?
    // For now, simple add/delete is sufficient as per "Save/Load" requirement.

    return {
        savedFormations,
        saveFormation,
        deleteFormation,
    };
}
