import { describe, expect, it } from 'vitest';
import { webViewBordABord } from './barres';

describe('webViewBordABord', () => {
  it('rend faux avant Chromium 140 : Capacitor décale la WebView sous les barres', () => {
    expect(
      webViewBordABord(
        'Mozilla/5.0 (Linux; Android 16; sdk_gphone64_x86_64 Build/BP22.250325.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/133.0.6943.137 Mobile Safari/537.36',
      ),
    ).toBe(false);
    expect(webViewBordABord('Mozilla/5.0 (Linux; Android 14; wv) Chrome/139.0.7258.94 Mobile Safari/537.36')).toBe(false);
  });

  it('rend vrai à partir de Chromium 140', () => {
    expect(webViewBordABord('Mozilla/5.0 (Linux; Android 16; wv) Chrome/140.0.7339.51 Mobile Safari/537.36')).toBe(true);
    expect(webViewBordABord('Mozilla/5.0 (Linux; Android 16; wv) Chrome/146.0.7680.4 Mobile Safari/537.36')).toBe(true);
  });

  it('rend vrai sans numéro de Chromium : rien ne permet de supposer une ancienne WebView', () => {
    expect(webViewBordABord('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0')).toBe(true);
  });
});
