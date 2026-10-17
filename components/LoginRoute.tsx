const STEPS = [
  "BAE",
  "Facturation douane",
  "Mise en livraison",
  "Livraison",
  "Retour conteneur",
  "Déclarés non facturés",
  "Facturation prestation",
  "Archivage",
];

const COMETS = [
  { dur: "8.5s", delay: "-1.5s", size: "h-1.5 w-1.5", trail: "h-9" },
  { dur: "10.5s", delay: "-6s", size: "h-2 w-2", trail: "h-12" },
  { dur: "12s", delay: "-3s", size: "h-1 w-1", trail: "h-7" },
];

export default function LoginRoute() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-8 left-[210px] right-8 top-8 hidden lg:block"
    >
      {/* ligne de route : repère fin + tireté qui défile vers le bas */}
      <div className="absolute inset-y-0 left-[calc(50%_-_0.5px)] w-px bg-marine-800/15" />
      <svg className="absolute inset-y-0 left-[calc(50%_-_1px)] h-full w-0.5">
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="100%"
          stroke="rgba(28,51,89,0.5)"
          strokeWidth="1.2"
          strokeDasharray="6 16"
          strokeLinecap="round"
          className="route-dash"
        />
      </svg>

      {/* points bleu marine descendant la route, vitesses légèrement différentes */}
      {COMETS.map((c, i) => (
        <div
          key={i}
          className="route-comet absolute inset-y-0 left-[calc(50%_-_2px)] w-1"
          style={{ animationDuration: c.dur, animationDelay: c.delay }}
        >
          <span className={`absolute bottom-0 left-1/2 ${c.size} -translate-x-1/2 rounded-full bg-marine-800`} />
          <span
            className={`absolute bottom-0 left-1/2 ${c.trail} w-px -translate-x-1/2 bg-gradient-to-t from-marine-700/40 via-marine-700/15 to-transparent`}
          />
        </div>
      ))}

      {/* 8 étapes du fichier SPOT, apparition en fondu l'une après l'autre puis fixes */}
      {STEPS.map((label, i) => (
        <div
          key={label}
          className="route-step absolute flex items-center gap-2"
          style={{ top: `${7 + i * 9.5}%`, left: "calc(50% - 3px)", animationDelay: `${0.4 + i * 0.6}s` }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-marine-800 ring-1 ring-white/60" />
          <span className="whitespace-nowrap text-xs font-medium text-marine-800">{label}</span>
        </div>
      ))}

      <p
        className="route-step absolute bottom-0 left-[calc(50%_+_11px)] text-[11px] tracking-wide text-marine-800/70"
        style={{ animationDelay: "5.6s" }}
      >
        Pilotage des dossiers Hinterland
      </p>
    </div>
  );
}
