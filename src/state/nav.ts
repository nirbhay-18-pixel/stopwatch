import { createContext, useContext } from "react";

export type View = "timer" | "dashboard" | "history" | "stats" | "settings";

export const NavContext = createContext<{ view: View; go: (v: View) => void }>({
  view: "timer",
  go: () => {},
});

export const useNav = () => useContext(NavContext);
