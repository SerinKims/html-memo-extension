import { browser } from 'wxt/browser';

import type { ExtensionMetadata } from '../types/extension';

export function getExtensionMetadata(): ExtensionMetadata {
  const manifest = browser.runtime.getManifest();

  return {
    name: manifest.name,
    version: manifest.version,
  };
}
