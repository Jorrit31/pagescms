/**
 * Click-to-edit: find the form field for something clicked in the live
 * preview, open the collapsed blocks around it, scroll to it and focus it.
 *
 * The preview page sends { type: "pagescms:select", path?, entry?, text?, image? }.
 * - path: the data path of the block that was clicked, e.g. "secties.3"
 *   (from a data-pcms-path attribute on the site). Optional.
 * - entry: the content entry the clicked part belongs to, e.g. "instellingen"
 *   (from data-pcms-entry). Optional.
 * - text: the text of the clicked element.
 * - image: the file name of a clicked image.
 */

export type PreviewSelection = {
  path?: string;
  entry?: string;
  text?: string;
  image?: string;
};

const normalize = (value: string) =>
  value.replace(/\s+/g, " ").trim().toLowerCase();

const fieldValue = (element: HTMLElement) =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.value
    : element.textContent || "";

const textFields = (root: ParentNode) =>
  Array.from(
    root.querySelectorAll<HTMLElement>(
      'input[name]:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea[name], [contenteditable="true"]',
    ),
  );

// The smallest element that holds every field of a block, e.g. "secties.3".
const findBlockRoot = (form: HTMLElement, path: string): HTMLElement | null => {
  const inputs = form.querySelectorAll<HTMLElement>(`[name^="${CSS.escape(path)}."]`);
  if (inputs.length === 0) return null;
  const last = inputs[inputs.length - 1];
  let node: HTMLElement | null = inputs[0];
  while (node && node !== form && !node.contains(last)) node = node.parentElement;
  // Climb to the block's own box (the element that also holds its header).
  while (node && node !== form && !node.querySelector(":scope > header")) node = node.parentElement;
  return node && node !== form ? node : null;
};

const findTextField = (root: ParentNode, text: string): HTMLElement | null => {
  const wanted = normalize(text);
  if (!wanted) return null;
  const fields = textFields(root);

  const exact = fields.find((field) => normalize(fieldValue(field)) === wanted);
  if (exact) return exact;

  // The clicked text can hold a field's text (e.g. a heading made of two
  // fields), or the other way around (markup or line breaks added by the site).
  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const field of fields) {
    const value = normalize(fieldValue(field));
    if (value.length < 3) continue;
    if (wanted.includes(value) || value.includes(wanted)) {
      const score = Math.min(value.length, wanted.length) / Math.max(value.length, wanted.length);
      if (score > bestScore) {
        best = field;
        bestScore = score;
      }
    }
  }
  return best;
};

const findImageField = (root: ParentNode, image: string): HTMLElement | null => {
  const name = image.split("/").pop();
  if (!name) return null;
  const match = Array.from(root.querySelectorAll<HTMLElement>("[title]")).find((element) =>
    (element.getAttribute("title") || "").split("/").pop() === name,
  );
  // Highlight the whole image field (label, photo and buttons).
  return match?.closest<HTMLElement>('[data-slot="form-item"]') || match || null;
};

const findTarget = (form: HTMLElement, selection: PreviewSelection) => {
  const blockRoot = selection.path ? findBlockRoot(form, selection.path) : null;
  const scopes: ParentNode[] = blockRoot ? [blockRoot, form] : [form];
  for (const scope of scopes) {
    const target =
      (selection.image && findImageField(scope, selection.image)) ||
      (selection.text && findTextField(scope, selection.text));
    if (target) return target;
  }
  return blockRoot;
};

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 60));

// Open every collapsed block or item around the element, outermost first.
const revealElement = async (form: HTMLElement, element: HTMLElement) => {
  const hidden: HTMLElement[] = [];
  for (let node = element.parentElement; node && node !== form; node = node.parentElement) {
    if (node.classList.contains("hidden") && node.previousElementSibling?.tagName === "HEADER") hidden.push(node);
  }
  for (const body of hidden.reverse()) {
    if (body.classList.contains("hidden")) {
      (body.previousElementSibling as HTMLElement).click();
      await nextFrame();
    }
  }
  // A block root itself may be collapsed.
  const ownBody = element.querySelector<HTMLElement>(":scope > header + .hidden");
  if (ownBody) {
    (ownBody.previousElementSibling as HTMLElement).click();
    await nextFrame();
  }
};

const highlight = (element: HTMLElement) => {
  const classes = ["ring-4", "ring-green-500/60", "ring-offset-2", "rounded-md", "transition-shadow"];
  element.classList.add(...classes);
  setTimeout(() => element.classList.remove(...classes), 1600);
};

/** Returns false when nothing in this form matches. */
export const selectInForm = async (form: HTMLElement, selection: PreviewSelection) => {
  const target = findTarget(form, selection);
  if (!target) return false;
  await revealElement(form, target);
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  if (target.matches("input, textarea, button, [contenteditable=true]")) {
    target.focus({ preventScroll: true });
  }
  highlight(target);
  return true;
};
