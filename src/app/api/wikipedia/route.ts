import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';

function cleanupText(text: string): string {
    return text
        .replace(/\[\d+\]/g, '') // Supprime les références [1], [2], etc.
        .replace(/\s+/g, ' ') // Normalise les espaces
        .trim();
}

export async function GET() {
    try {
        const response = await fetch('https://fr.wikipedia.org/wiki/Spécial:Page_au_hasard');
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Récupère le titre
        const titleElement = document.querySelector('#firstHeading');
        const title = titleElement ? cleanupText(titleElement.textContent || '') : '';

        // Supprime les éléments qu'on ne veut pas
        document.querySelectorAll('.reference').forEach(el => el.remove());
        document.querySelectorAll('table').forEach(el => el.remove());
        document.querySelectorAll('.mw-editsection').forEach(el => el.remove());

        // Récupère uniquement les paragraphes du contenu principal
        const paragraphs = document.querySelectorAll('#mw-content-text > .mw-parser-output > p');
        
        // Nettoie les liens dans les paragraphes
        paragraphs.forEach(p => {
            const links = p.querySelectorAll('a');
            links.forEach(link => {
                if (link.textContent) {
                    link.replaceWith(document.createTextNode(link.textContent));
                }
            });
        });

        const content = Array.from(paragraphs)
            .map(p => cleanupText(p.textContent || ''))
            .filter(text => text.length > 0)
            .join('\n\n');

        if (!content) {
            return NextResponse.json({ error: "Article invalide" }, { status: 400 });
        }

        return NextResponse.json({ content, title });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Erreur lors de la récupération de l'article" }, { status: 500 });
    }
} 