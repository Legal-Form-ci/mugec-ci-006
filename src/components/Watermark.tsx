import watermark from "@/assets/mugec-watermark.png";

/** Visuel MUGEC-CI en filigrane derrière un formulaire ou document imprimable. */
export function Watermark({ opacity = 0.08 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <img
        src={watermark}
        alt=""
        crossOrigin="anonymous"
        style={{ opacity, width: "85%", maxWidth: "640px", objectFit: "contain" }}
        className="select-none"
      />
    </div>
  );
}
