export type Theme = "system" | "light" | "dark";

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem("tema");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function setTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-anim");
  if (t === "system") {
    delete root.dataset.theme;
    localStorage.removeItem("tema");
  } else {
    root.dataset.theme = t;
    localStorage.setItem("tema", t);
  }
  setTimeout(() => root.classList.remove("theme-anim"), 450);
}
