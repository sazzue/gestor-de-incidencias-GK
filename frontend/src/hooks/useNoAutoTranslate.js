import { useEffect } from "react";

const protectTextControls = () => {
  document.documentElement.lang = "es-MX";
  document.documentElement.setAttribute("translate", "no");
  document.documentElement.classList.add("notranslate");
  document.body?.setAttribute("translate", "no");
  document.body?.classList.add("notranslate");

  document.querySelectorAll("input, textarea, select, button").forEach((element) => {
    element.setAttribute("translate", "no");
    element.setAttribute("spellcheck", "false");
    element.setAttribute("autocomplete", element.getAttribute("autocomplete") || "off");
    element.setAttribute("autocorrect", "off");
    element.setAttribute("autocapitalize", "off");
    element.classList.add("notranslate");
  });
};

export function useNoAutoTranslate() {
  useEffect(() => {
    protectTextControls();

    const observer = new MutationObserver(protectTextControls);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);
}
