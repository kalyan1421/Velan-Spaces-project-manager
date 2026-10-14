import type { CSSProperties } from "react";

/*
 * Inline line-art in the style of the Velan Spaces logo: thin ink strokes,
 * a warm sun disc and the pendant lamp's cone of light.
 *
 * Signature moment: on the home page the room draws itself, then the light
 * and the sun come on — "from drawing to a lived-in home". CSS only; with
 * prefers-reduced-motion the finished drawing is shown immediately.
 */

const heroCss = `
@media (prefers-reduced-motion: no-preference) {
  .vs-art .vs-draw {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    opacity: 0;
    animation: vs-draw 1.5s cubic-bezier(.65,0,.35,1) var(--d, 0s) both;
  }
  .vs-art .vs-fade {
    opacity: 0;
    animation: vs-fade 1.4s ease-out var(--d, 1.4s) both;
  }
  .vs-art .vs-sun {
    opacity: 0;
    transform: scale(.55);
    transform-box: fill-box;
    transform-origin: center;
    animation: vs-sun 1.1s cubic-bezier(.2,.9,.3,1.15) var(--d, 1.2s) both;
  }
}
@keyframes vs-draw {
  0% { stroke-dashoffset: 1; opacity: 0; }
  4% { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 1; }
}
@keyframes vs-fade { to { opacity: 1; } }
@keyframes vs-sun { to { opacity: 1; transform: scale(1); } }
`;

function Stroke({ d, delay, width }: { d: string; delay: number; width?: number }) {
  return (
    <path
      d={d}
      pathLength={1}
      className="vs-draw"
      strokeWidth={width}
      style={{ "--d": `${delay}s` } as CSSProperties}
    />
  );
}

export function HeroRoomIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 520"
      role="img"
      aria-label="Line drawing of a living room with a sofa, a pendant lamp casting warm light, and the sun outside"
      className={`vs-art ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <style>{heroCss}</style>
      <defs>
        <linearGradient id="vs-hero-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE566" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#FFE566" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFE566" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Sun and light come on after the drawing. */}
      <circle className="vs-sun" cx="520" cy="118" r="52" fill="#FFE566" stroke="none" style={{ "--d": "1.2s" } as CSSProperties} />
      <polygon
        className="vs-fade"
        points="276,216 324,216 398,388 202,388"
        fill="url(#vs-hero-cone)"
        stroke="none"
        style={{ "--d": "1.45s" } as CSSProperties}
      />

      {/* Structure */}
      <Stroke d="M40 470 H600" delay={0} />
      <Stroke d="M70 196 L300 72 L590 236 V470" delay={0.1} />

      {/* Pendant lamp */}
      <Stroke d="M300 72 V160" delay={0.35} />
      <Stroke
        d="M292 172 Q292 160 300 160 Q308 160 308 172 M288 172 H312 C318 184 320 198 326 214 H274 C280 198 282 184 288 172 Z"
        delay={0.45}
      />

      {/* Wall art */}
      <Stroke d="M156 246 H224 V300 H156 Z M166 290 L184 268 L198 281 L210 266 L220 280" delay={0.75} width={3} />
      <circle className="vs-fade" cx="204" cy="256" r="4.5" fill="#FFE566" stroke="none" style={{ "--d": "1.5s" } as CSSProperties} />

      {/* Floor lamp */}
      <Stroke d="M104 302 H140 L150 334 H94 Z M122 334 V470 M106 470 H138" delay={0.5} />

      {/* Sofa */}
      <Stroke d="M182 392 V368 Q182 350 200 350 H400 Q418 350 418 368 V392" delay={0.6} />
      <Stroke
        d="M162 470 V398 Q162 380 179 380 Q196 380 196 398 V470 M404 470 V398 Q404 380 421 380 Q438 380 438 398 V470"
        delay={0.7}
      />
      <Stroke d="M196 424 H404" delay={0.8} />
      <Stroke d="M226 368 h14 v14 h-14 Z M293 368 h14 v14 h-14 Z M360 368 h14 v14 h-14 Z" delay={0.9} width={3} />

      {/* Side table and plant */}
      <Stroke
        d="M474 398 H542 Q548 398 548 404 Q548 410 542 410 H474 Q468 410 468 404 Q468 398 474 398 Z M478 410 V432 H538 V410 M486 432 L478 470 M530 432 L538 470"
        delay={0.85}
      />
      <Stroke
        d="M494 398 L498 380 H518 L522 398 M508 380 C502 358 490 350 480 348 M508 380 C512 356 526 346 538 344 M508 380 C507 364 507 350 508 338"
        delay={1}
        width={3}
      />
    </svg>
  );
}

/** Small pendant lamp whose light falls on whatever sits below it. */
export function PendantLight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 300"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      preserveAspectRatio="xMidYMin meet"
    >
      <defs>
        <linearGradient id="vs-cta-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE566" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#FFE566" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FFE566" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points="100,104 140,104 236,300 4,300" fill="url(#vs-cta-cone)" stroke="none" />
      <path d="M120 0 V54" />
      <path d="M113 64 Q113 54 120 54 Q127 54 127 64 M109 64 H131 C136 75 138 88 143 102 H97 C102 88 104 75 109 64 Z" />
    </svg>
  );
}
