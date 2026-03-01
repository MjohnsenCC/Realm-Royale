export type UISize = "small" | "medium" | "large";

const SCALE_MAP: Record<UISize, number> = {
  small: 1.0,
  medium: 1.5,
  large: 2.0,
};

const STORAGE_KEY = "uiSize";

export function getUISize(): UISize {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "small" || stored === "medium" || stored === "large") {
    return stored;
  }
  return "small";
}

export function setUISize(size: UISize): void {
  localStorage.setItem(STORAGE_KEY, size);
}

export function getUIScale(): number {
  return SCALE_MAP[getUISize()];
}
