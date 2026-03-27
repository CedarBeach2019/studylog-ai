// Central Preact/HTM shim — all components import from here.
// Direct CDN URLs. No importmap needed.
export { render, h, createContext, Fragment, toChildArray, createRef } from 'https://esm.sh/preact@10.20.2';
export { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext } from 'https://esm.sh/preact@10.20.2/hooks';
export { signal, computed, effect, batch, untracked } from 'https://esm.sh/@preact/signals@1.3.1';
import htm from 'https://esm.sh/htm@3.1.1';
import { h } from 'https://esm.sh/preact@10.20.2';
export const html = htm.bind(h);
