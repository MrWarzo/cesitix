import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';

export async function GET() {
  const response = await fetch('https://fr.wikipedia.org/wiki/Spécial:Page_au_hasard');
  const html = await response.text();
  
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // On récupère le titre
  const title = doc.querySelector('#firstHeading')?.textContent?.trim() || '';
  
  // On récupère uniquement les paragraphes enfants directs
  const paragraphs = doc.querySelectorAll('#mw-content-text > .mw-content-ltr > p');
  
  if (!paragraphs.length) {
    return NextResponse.json({ content: '', title });
  }

  // Nettoyer les liens dans les paragraphes
  paragraphs.forEach(p => {
    const links = p.querySelectorAll('a');
    links.forEach(link => {
      if (link.textContent) {
        link.replaceWith(doc.createTextNode(link.textContent));
      }
    });
  });

  // Extraire le texte des paragraphes
  const contentParts: string[] = [];
  paragraphs.forEach(p => {
    const text = p.textContent?.trim() || '';
    if (text) {
      contentParts.push(text);
    }
  });

  // Joindre les paragraphes avec des sauts de ligne doubles
  const content = contentParts.join('\n\n');
  
  return NextResponse.json({ content, title });
} 