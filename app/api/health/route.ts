import { NextResponse } from "next/server";

// Rendue à chaque requête : sans cette ligne, Next.js génère la route au build et sert
// une réponse en cache, donc la sonde répondrait 200 même serveur cassé.
export const dynamic = "force-dynamic";

// Route publique : aucune donnée renvoyée, pas de log (la sonde passe toutes les 5 à 30 s).
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
