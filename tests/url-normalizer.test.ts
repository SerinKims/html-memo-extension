import { describe, expect, it } from 'vitest';

import { createPageKey, normalizeUrl } from '../utils/url-normalizer';

describe('normalizeUrl', () => {
  it('추적 파라미터와 fragment를 제거하고 나머지 query를 정렬한다', () => {
    expect(
      normalizeUrl(
        'HTTPS://Example.COM/products?utm_source=newsletter&id=42&fbclid=tracking&view=detail#reviews',
      ),
    ).toBe('https://example.com/products?id=42&view=detail');
  });

  it('페이지를 식별하는 파라미터와 중복 파라미터는 유지한다', () => {
    expect(normalizeUrl('https://example.com/search?page=2&q=memo&q=html&utm_medium=email')).toBe(
      'https://example.com/search?page=2&q=html&q=memo',
    );
  });

  it('추적 파라미터만 다른 URL에 같은 page key를 부여한다', () => {
    expect(createPageKey('https://example.com/docs?id=7&utm_campaign=summer')).toBe(
      createPageKey('https://example.com/docs?id=7&fbclid=abc'),
    );
  });

  it('웹페이지가 아닌 URL은 거부한다', () => {
    expect(() => normalizeUrl('data:text/html;base64,AAAA')).toThrow(
      'http 또는 https 웹페이지 URL만 사용할 수 있습니다.',
    );
  });
});
