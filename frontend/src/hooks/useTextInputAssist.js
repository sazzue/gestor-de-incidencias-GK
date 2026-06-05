import { useEffect } from "react";

const TECHNICAL_FIELD_PATTERN =
  /(correo|email|e-mail|usuario|username|user|password|contrasena|slug|serial|serie|smtp|host|puerto|port|url|token|codigo|fecha|date|precio|price|monto|phone|telefono|color|hex)/i;

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "email",
  "file",
  "hidden",
  "month",
  "number",
  "password",
  "radio",
  "range",
  "reset",
  "submit",
  "tel",
  "time",
  "url",
  "week",
]);

const getFieldDescriptor = (element) =>
  [
    element.getAttribute("name"),
    element.getAttribute("id"),
    element.getAttribute("placeholder"),
    element.getAttribute("aria-label"),
    element.getAttribute("autocomplete"),
  ]
    .filter(Boolean)
    .join(" ");

const shouldAssistElement = (element) => {
  if (!element || element.disabled || element.readOnly) return false;
  if (element.dataset.noTextAssist === "true") return false;

  if (element.tagName === "TEXTAREA") return true;

  if (element.tagName !== "INPUT") return false;

  const type = (element.getAttribute("type") || "text").toLowerCase();
  if (NON_TEXT_INPUT_TYPES.has(type)) return false;

  return !TECHNICAL_FIELD_PATTERN.test(getFieldDescriptor(element));
};

const applyTextAssistToElement = (element) => {
  if (!shouldAssistElement(element)) return;

  element.setAttribute("spellcheck", "true");
  element.setAttribute("autocorrect", "on");
  element.setAttribute("autocapitalize", element.tagName === "TEXTAREA" ? "sentences" : "words");
};

const applyTextAssist = (root = document) => {
  root.querySelectorAll?.("input, textarea").forEach(applyTextAssistToElement);
};

export function useTextInputAssist() {
  useEffect(() => {
    applyTextAssist();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          if (node.matches?.("input, textarea")) {
            applyTextAssistToElement(node);
            return;
          }

          applyTextAssist(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}
