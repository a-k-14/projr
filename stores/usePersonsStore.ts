import { create } from 'zustand';
import { getPersons } from '../services/persons';

interface PersonsStore {
  persons: string[];
  isLoaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
}

export const usePersonsStore = create<PersonsStore>((set) => ({
  persons: [],
  isLoaded: false,

  load: async () => {
    const persons = await getPersons();
    set({ persons, isLoaded: true });
  },

  reset: () => {
    set({ persons: [], isLoaded: false });
  },
}));
