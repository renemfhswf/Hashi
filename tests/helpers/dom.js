/**
 * Minimales DOM für die Oberflächentests.
 *
 * Die echten Seiten (`index.html`, `puzzlebook.html`) werden in Node
 * geladen und ihre Module ausgeführt – ohne Browser und ohne zusätzliche
 * Abhängigkeiten. Nachgebaut ist nur, was die Oberfläche braucht:
 * Elementbaum, Attribute, Klassen, Styles, Ereignisse und ein Canvas-Stub.
 *
 * Damit lassen sich Schaltflächen wirklich anklicken und ihre Wirkung
 * prüfen (Statuszeile, Hash, `aria-pressed`, Druckaufruf …).
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Vor dem Überschreiben sichern, sonst ruft sich der Stub selbst auf. */
const nativeSetInterval = globalThis.setInterval;

/* ---------------------------------------------------------------- Knoten */

class TextNode {
  constructor(text, ownerDocument) {
    this.nodeType = 3;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.textContent = text;
  }
}

export class Element {
  constructor(tagName, ownerDocument, namespace = null) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.localName = String(tagName).toLowerCase();
    this.namespaceURI = namespace;
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = createStyle();
    this.value = '';
    this.checked = false;
    this.width = 0;
    this.height = 0;
  }

  /* -- Attribute ---------------------------------------------------- */

  setAttribute(name, value) {
    const key = String(name).toLowerCase();
    this.attributes.set(key, String(value));
    // Formularfelder spiegeln ihr Attribut in die Eigenschaft.
    if (key === 'value' && this.tagName === 'INPUT') this.value = String(value);
    if (key === 'checked') this.checked = true;
  }

  get hidden() {
    return this.hasAttribute('hidden');
  }

  set hidden(value) {
    if (value) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(value) {
    if (value) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  getAttribute(name) {
    const key = String(name).toLowerCase();
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name).toLowerCase());
  }

  removeAttribute(name) {
    this.attributes.delete(String(name).toLowerCase());
  }

  get id() {
    return this.getAttribute('id') ?? '';
  }

  get className() {
    return this.getAttribute('class') ?? '';
  }

  set className(value) {
    this.setAttribute('class', value);
  }

  get classList() {
    const el = this;
    const read = () => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    const write = (list) => el.setAttribute('class', [...new Set(list)].join(' '));
    return {
      add: (...names) => write([...read(), ...names]),
      remove: (...names) => write(read().filter((n) => !names.includes(n))),
      contains: (name) => read().includes(name),
      toggle: (name, force) => {
        const has = read().includes(name);
        const next = force === undefined ? !has : Boolean(force);
        if (next && !has) write([...read(), name]);
        if (!next && has) write(read().filter((n) => n !== name));
        return next;
      },
    };
  }

  get dataset() {
    const el = this;
    return new Proxy(
      {},
      {
        get: (_, key) => el.getAttribute(`data-${hyphenate(key)}`) ?? undefined,
        set: (_, key, value) => {
          el.setAttribute(`data-${hyphenate(key)}`, String(value));
          return true;
        },
        has: (_, key) => el.hasAttribute(`data-${hyphenate(key)}`),
        deleteProperty: (_, key) => {
          el.removeAttribute(`data-${hyphenate(key)}`);
          return true;
        },
      },
    );
  }

  /* -- Inhalt ------------------------------------------------------- */

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    this.childNodes = [];
    if (value !== '' && value != null) this.appendChild(new TextNode(String(value), this.ownerDocument));
  }

  set innerHTML(html) {
    this.childNodes = [];
    parseFragment(String(html), this.ownerDocument, this);
  }

  get innerHTML() {
    return this.textContent;
  }

  appendChild(node) {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(node instanceof TextNode ? node : toNode(node, this.ownerDocument));
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }
    return node;
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  /* -- Suche -------------------------------------------------------- */

  descendants() {
    const out = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue;
        out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  querySelectorAll(selector) {
    const all = this.descendants();
    return all.filter((el) => matchesComplex(el, selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (matchesComplex(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  matches(selector) {
    return matchesComplex(this, selector);
  }

  /* -- Ereignisse --------------------------------------------------- */

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((entry) => entry !== handler),
    );
  }

  hasListener(type) {
    return (this.listeners.get(type)?.length ?? 0) > 0;
  }

  dispatchEvent(event) {
    event.target ??= this;
    event.currentTarget = this;
    for (const handler of this.listeners.get(event.type) ?? []) handler.call(this, event);
    return !event.defaultPrevented;
  }

  click() {
    return this.dispatchEvent(makeEvent('click', this));
  }

  /* -- Sonstiges ---------------------------------------------------- */

  get clientWidth() {
    return 800;
  }

  get clientHeight() {
    return 600;
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
  }

  getContext() {
    return create2dContext(this);
  }

  setPointerCapture() {}

  releasePointerCapture() {}

  select() {}

  focus() {}

  blur() {}

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }
}

export class HTMLInputElement extends Element {}
export class HTMLTextAreaElement extends Element {}
export class HTMLCanvasElement extends Element {}

/** Ereignis-Objekt (nur die Felder, die die App liest). */
export function makeEvent(type, target, extra = {}) {
  return {
    type,
    target,
    currentTarget: target,
    defaultPrevented: false,
    cancelable: true,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    ...extra,
  };
}

/* -------------------------------------------------------------- Dokument */

export class Document {
  constructor(href = 'http://localhost/index.html') {
    this.nodeType = 9;
    this.href = href;
    this.listeners = new Map();
    this.documentElement = this.createElement('html');
    this.head = this.createElement('head');
    this.body = this.createElement('body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(tag) {
    const name = String(tag).toLowerCase();
    if (name === 'input') return new HTMLInputElement(name, this);
    if (name === 'textarea') return new HTMLTextAreaElement(name, this);
    if (name === 'canvas') return new HTMLCanvasElement(name, this);
    return new Element(name, this);
  }

  createElementNS(namespace, tag) {
    return new Element(tag, this, namespace);
  }

  createTextNode(text) {
    return new TextNode(String(text), this);
  }

  getElementById(id) {
    return this.documentElement.descendants().find((el) => el.getAttribute('id') === id) ?? null;
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((entry) => entry !== handler),
    );
  }

  dispatchEvent(event) {
    event.target ??= this;
    for (const handler of this.listeners.get(event.type) ?? []) handler.call(this, event);
    return !event.defaultPrevented;
  }
}

/* -------------------------------------------------------------- Parsing */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X'
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[name.toLowerCase()] ?? all;
  });
}

function parseAttributes(text) {
  const out = [];
  const re = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    out.push([match[1].toLowerCase(), decodeEntities(value)]);
  }
  return out;
}

/** Zerlegt HTML und hängt die Knoten an `parent` (Toleranter Mini-Parser). */
export function parseFragment(html, doc, parent) {
  const stack = [parent];
  const current = () => stack[stack.length - 1];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      const text = html.slice(i);
      if (text) current().appendChild(new TextNode(decodeEntities(text), doc));
      break;
    }
    if (lt > i) {
      const text = html.slice(i, lt);
      if (text.trim()) current().appendChild(new TextNode(decodeEntities(text), doc));
    }

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      i = end === -1 ? html.length : end + 3;
      continue;
    }

    const close = /^<\/\s*([a-zA-Z][\w-]*)\s*>/.exec(html.slice(lt));
    if (close) {
      const tag = close[1].toUpperCase();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tagName === tag) {
          stack.length = k;
          break;
        }
      }
      i = lt + close[0].length;
      continue;
    }

    if (html.startsWith('<!', lt)) {
      const end = html.indexOf('>', lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const open = /^<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"])*)>/.exec(html.slice(lt));
    if (!open) {
      current().appendChild(new TextNode('<', doc));
      i = lt + 1;
      continue;
    }

    const name = open[1].toLowerCase();
    const el = doc.createElement(name);
    for (const [attr, value] of parseAttributes(open[2])) el.setAttribute(attr, value);
    current().appendChild(el);
    i = lt + open[0].length;

    if (VOID_TAGS.has(name)) continue;

    // Rohtext-Elemente: Inhalt nicht als HTML deuten.
    if (name === 'script' || name === 'style') {
      const closeIdx = html.toLowerCase().indexOf(`</${name}`, i);
      const raw = html.slice(i, closeIdx === -1 ? html.length : closeIdx);
      if (raw.trim()) el.appendChild(new TextNode(raw, doc));
      i = closeIdx === -1 ? html.length : html.indexOf('>', closeIdx) + 1;
      continue;
    }

    stack.push(el);
  }
}

/* --------------------------------------------------------------- Styles */

function createStyle() {
  const values = new Map();
  const style = {
    setProperty(name, value) {
      values.set(name, String(value));
      style[name] = String(value);
    },
    getPropertyValue(name) {
      return values.get(name) ?? (name in style ? String(style[name]) : '');
    },
    removeProperty(name) {
      values.delete(name);
      delete style[name];
    },
  };
  return style;
}

/* -------------------------------------------------------------- Selektoren */

function matchesSimple(el, selector) {
  if (!el || el.nodeType !== 1) return false;
  if (selector === '*') return true;
  const parts = selector.match(/^[a-zA-Z][\w-]*|\.[\w-]+|#[\w-]+|\[[^\]]+\]/g) ?? [];
  if (parts.length === 0) return false;
  return parts.every((part) => {
    if (part.startsWith('.')) return el.classList.contains(part.slice(1));
    if (part.startsWith('#')) return el.getAttribute('id') === part.slice(1);
    if (part.startsWith('[')) {
      const [rawName, rawValue] = part.slice(1, -1).split('=');
      const name = rawName.trim();
      if (!el.hasAttribute(name)) return false;
      if (rawValue === undefined) return true;
      return el.getAttribute(name) === rawValue.replace(/^["']|["']$/g, '');
    }
    return el.tagName === part.toUpperCase();
  });
}

function matchesComplex(el, selector) {
  return selector.split(',').some((group) => {
    const chain = group.trim().split(/\s+/).filter(Boolean);
    if (chain.length === 0) return false;
    if (!matchesSimple(el, chain[chain.length - 1])) return false;
    let node = el.parentNode;
    for (let k = chain.length - 2; k >= 0; k--) {
      while (node && node.nodeType === 1 && !matchesSimple(node, chain[k])) node = node.parentNode;
      if (!node || node.nodeType !== 1) return false;
      node = node.parentNode;
    }
    return true;
  });
}

/* ----------------------------------------------------------------- Canvas */

function create2dContext(canvas) {
  const target = {
    canvas,
    measureText: (text) => ({ width: String(text).length * 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (typeof prop === 'symbol') return undefined;
      obj[prop] = () => undefined;
      return obj[prop];
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  });
}

/* -------------------------------------------------------- globale Umgebung */

function hyphenate(key) {
  return String(key).replace(/[A-Z]/g, (chr) => `-${chr.toLowerCase()}`);
}

function toNode(value, doc) {
  if (value && typeof value === 'object' && 'nodeType' in value) return value;
  return new TextNode(String(value), doc);
}

function setGlobal(name, value) {
  try {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  } catch {
    /* nicht überschreibbar – ignorieren */
  }
}

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

/**
 * Baut eine Seite samt Browser-Umgebung auf und führt ihr Modul aus.
 *
 * @param {string} htmlFile  Pfad zur HTML-Datei
 * @param {string} moduleFile Pfad zum Einstiegsmodul
 * @param {{hash?: string}} options
 */
export async function mountPage(htmlFile, moduleFile, { hash = '' } = {}) {
  const html = readFileSync(htmlFile, 'utf8');
  const name = htmlFile.split(/[\\/]/).pop();
  const href = `http://localhost/${name}${hash}`;
  const doc = new Document(href);

  // Zuerst in einen Zwischenknoten parsen und dann <head>/<body> füllen.
  const root = new Element('root', doc);
  parseFragment(html, doc, root);
  const htmlEl = root.querySelector('html');
  if (htmlEl) {
    for (const [attr, value] of htmlEl.attributes) doc.documentElement.setAttribute(attr, value);
    const head = htmlEl.children.find((el) => el.tagName === 'HEAD');
    const body = htmlEl.children.find((el) => el.tagName === 'BODY');
    if (head) for (const node of [...head.childNodes]) doc.head.appendChild(node);
    if (body) for (const node of [...body.childNodes]) doc.body.appendChild(node);
  } else {
    for (const node of [...root.childNodes]) doc.body.appendChild(node);
  }

  const location = {
    href,
    hash,
    search: '',
    pathname: `/${name}`,
    reload() {},
  };
  const origin = 'http://localhost/';
  const history = {
    replaceState(_state, _title, url) {
      if (typeof url !== 'string' || !url) return;
      if (url.startsWith('#')) {
        location.hash = url;
        location.href = `${origin}${name}${url}`;
      } else {
        location.href = url;
        location.hash = url.includes('#') ? `#${url.split('#')[1]}` : '';
      }
    },
    pushState() {},
    back() {},
  };

  const win = {
    document: doc,
    location,
    history,
    devicePixelRatio: 1,
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    printCalls: 0,
    print() {
      win.printCalls += 1;
    },
    navigator: { clipboard: { writeText: async () => {} }, userAgent: 'node' },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (callback) => {
      callback(0);
      return 1;
    },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };

  setGlobal('window', win);
  setGlobal('document', doc);
  setGlobal('getComputedStyle', win.getComputedStyle);
  setGlobal('localStorage', win.localStorage);
  setGlobal('sessionStorage', win.sessionStorage);
  setGlobal('history', history);
  setGlobal('navigator', win.navigator);
  setGlobal('HTMLElement', Element);
  setGlobal('HTMLInputElement', HTMLInputElement);
  setGlobal('HTMLTextAreaElement', HTMLTextAreaElement);
  setGlobal('HTMLCanvasElement', HTMLCanvasElement);
  setGlobal('Node', Element);
  setGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  setGlobal('requestAnimationFrame', win.requestAnimationFrame);
  setGlobal('cancelAnimationFrame', win.cancelAnimationFrame);
  // Intervalle dürfen den Testlauf nicht offen halten.
  setGlobal('setInterval', (fn, ms) => {
    const timer = nativeSetInterval(fn, ms);
    timer.unref?.();
    return timer;
  });

  const module = await import(`${pathToFileURL(moduleFile).href}?t=${Date.now()}${Math.random()}`);

  return { document: doc, window: win, module, element: (id) => doc.getElementById(id) };
}
