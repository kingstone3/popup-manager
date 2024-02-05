import { NoCachePopup, Popup } from '.';

export function callCheckWrapper(fn: () => void, probe: { called: boolean }) {
  return () => {
    fn();

    probe.called = true;
  };
}

export function isNoCache(
  d: Popup | NoCachePopup,
  noCache: boolean,
): d is NoCachePopup {
  return noCache;
}
