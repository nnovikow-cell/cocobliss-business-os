export const CATEGORY_COLORS: Array<{ id: string; label: string; bg: string; text: string; ring: string }> = [
  { id: "teal",    label: "Teal",    bg: "oklch(0.92 0.06 195)", text: "oklch(0.30 0.10 195)", ring: "oklch(0.55 0.20 195)" },
  { id: "mango",   label: "Mango",   bg: "oklch(0.93 0.08 70)",  text: "oklch(0.36 0.12 70)",  ring: "oklch(0.78 0.18 70)" },
  { id: "berry",   label: "Berry",   bg: "oklch(0.92 0.06 350)", text: "oklch(0.36 0.16 350)", ring: "oklch(0.62 0.22 350)" },
  { id: "leaf",    label: "Leaf",    bg: "oklch(0.92 0.07 145)", text: "oklch(0.32 0.12 145)", ring: "oklch(0.58 0.18 145)" },
  { id: "ocean",   label: "Ocean",   bg: "oklch(0.92 0.05 240)", text: "oklch(0.30 0.14 240)", ring: "oklch(0.55 0.20 240)" },
  { id: "sand",    label: "Sand",    bg: "oklch(0.94 0.04 80)",  text: "oklch(0.34 0.05 80)",  ring: "oklch(0.78 0.10 80)" },
  { id: "plum",    label: "Plum",    bg: "oklch(0.92 0.06 310)", text: "oklch(0.32 0.14 310)", ring: "oklch(0.55 0.20 310)" },
  { id: "graphite",label: "Graphite",bg: "oklch(0.92 0.01 250)", text: "oklch(0.30 0.02 250)", ring: "oklch(0.45 0.02 250)" },
];

export function colorById(id: string | null | undefined) {
  return CATEGORY_COLORS.find((c) => c.id === id) ?? CATEGORY_COLORS[0];
}
