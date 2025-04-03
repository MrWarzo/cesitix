import { NextResponse } from 'next/server';
import dictionaryFr from 'dictionary-fr';
import Nspell from 'nspell';
import { Buffer } from 'buffer';

let spellChecker: Nspell | null = null;

// Initialiser le dictionnaire
async function initDictionary() {
    const { aff, dic } = await dictionaryFr;
    spellChecker = new Nspell(Buffer.from(aff), Buffer.from(dic));
}

// Initialiser le dictionnaire au démarrage
initDictionary();

export async function POST(request: Request) {
    const { word } = await request.json();

    if (!spellChecker) {
        return NextResponse.json({ isValid: false, error: "Dictionnaire non initialisé" });
    }

    // On vérifie le mot avec ses accents d'abord
    let isValid = spellChecker.correct(word.toLowerCase());
    let suggestions = isValid ? [] : spellChecker.suggest(word.toLowerCase());

    // Si le mot n'est pas valide avec ses accents, on essaie sans
    if (!isValid) {
        const normalizedWord = word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        isValid = spellChecker.correct(normalizedWord);
        if (!isValid) {
            suggestions = spellChecker.suggest(normalizedWord);
        }
    }

    return NextResponse.json({ 
        isValid,
        suggestions: suggestions.map(s => s.toLowerCase())
    });
} 